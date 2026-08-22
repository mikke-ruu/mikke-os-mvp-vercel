import { supabase } from "@/lib/supabase/client";
import { logAcademyEvent } from "@/lib/academy/events";
import { academyPreviewMaterials, assertAcademyWritable, isAcademyLocalReview } from "@/lib/academy/preview";
import type { AcademyMaterial, Profile } from "@/types/database";

export const MATERIAL_KIND_LABELS: Record<AcademyMaterial["kind"], string> = {
  pdf: "PDF資料",
  video: "動画",
  link: "リンク"
};

export type MaterialInput = {
  courseId: string;
  kind: AcademyMaterial["kind"];
  title: string;
  url: string;
  description: string;
  requiresActive: boolean;
  isPublished: boolean;
};

// 本部管理: 自本部の全教材（講座で絞り込み可）
export async function listMaterials(headquartersId: string, courseId?: string) {
  if (isAcademyLocalReview()) {
    return courseId ? academyPreviewMaterials.filter((item) => item.course_id === courseId) : academyPreviewMaterials;
  }
  let query = supabase
    .from("academy_materials")
    .select("*")
    .eq("headquarters_id", headquartersId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (courseId) query = query.eq("course_id", courseId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AcademyMaterial[];
}

export async function createMaterial(profile: Profile, headquartersId: string, input: MaterialInput) {
  assertAcademyWritable();
  const { data, error } = await supabase
    .from("academy_materials")
    .insert({
      headquarters_id: headquartersId,
      course_id: input.courseId,
      user_id: profile.user_id,
      kind: input.kind,
      title: input.title.trim(),
      url: input.url.trim(),
      description: input.description || null,
      requires_active: input.requiresActive,
      is_published: input.isPublished
    })
    .select("*")
    .single();

  if (error) throw error;
  const material = data as AcademyMaterial;

  // seam: 教材を追加（あゆみの残したいイベント一覧より）。既定private。
  await logAcademyEvent({
    headquartersId,
    actorUserId: profile.user_id,
    actorProfileId: profile.id,
    ownerUserId: profile.user_id,
    eventType: "academy_material_added",
    idempotencyKey: `academy:material_added:${material.id}`,
    courseId: material.course_id,
    materialId: material.id,
    title: `教材「${material.title}」を追加しました`
  });

  return material;
}

export async function setMaterialPublished(headquartersId: string, material: AcademyMaterial, isPublished: boolean) {
  assertAcademyWritable();
  const { data, error } = await supabase
    .from("academy_materials")
    .update({ is_published: isPublished })
    .eq("id", material.id)
    .eq("headquarters_id", headquartersId)
    .select("*")
    .single();

  if (error) throw error;
  return data as AcademyMaterial;
}

export async function deleteMaterial(headquartersId: string, materialId: string) {
  assertAcademyWritable();
  const { error } = await supabase
    .from("academy_materials")
    .delete()
    .eq("id", materialId)
    .eq("headquarters_id", headquartersId);

  if (error) throw error;
}
