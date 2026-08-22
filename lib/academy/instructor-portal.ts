import { supabase } from "@/lib/supabase/client";
import { getAcademyRouteContext } from "@/lib/academy/access-context";
import {
  academyPreviewApplications,
  academyPreviewCourses,
  academyPreviewInstructors,
  academyPreviewMaterials,
  assertAcademyWritable,
  isAcademyLocalReview
} from "@/lib/academy/preview";
import type {
  AcademyApplication,
  AcademyCourse,
  AcademyInstructor,
  AcademyMaterial,
  AcademyPaymentProvider
} from "@/types/database";

// 講師側: 自分が担当講師になっている申込（RLSで担当分だけ読める）
export async function listMyApplications(instructorIds: string[]) {
  if (isAcademyLocalReview()) return academyPreviewApplications.filter((item) => item.instructor_id && instructorIds.includes(item.instructor_id));
  if (instructorIds.length === 0) return [];
  const { data, error } = await supabase
    .from("academy_applications")
    .select("*")
    .in("instructor_id", instructorIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AcademyApplication[];
}

// 講師側: 取得講座の情報（RLSで講師は自分の講座を読める）
export async function getCoursesByIds(courseIds: string[]) {
  if (isAcademyLocalReview()) return academyPreviewCourses.filter((item) => courseIds.includes(item.id));
  if (courseIds.length === 0) return [];
  const { data, error } = await supabase.from("academy_courses").select("*").in("id", courseIds);
  if (error) throw error;
  return (data ?? []) as AcademyCourse[];
}

// 講師側: 自分の講師レコード（複数講座を持てる）
export async function getMyInstructorRecords(userId: string, academyId?: string) {
  if (isAcademyLocalReview()) return academyPreviewInstructors.filter((item) => item.registration_status === "registered" && item.is_active);
  const explicitAcademyId = academyId ?? getAcademyRouteContext()?.academyId;
  let query = supabase
    .from("academy_instructors")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (explicitAcademyId) query = query.eq("headquarters_id", explicitAcademyId);
  const { data, error } = await query;

  if (error) throw error;
  return (data ?? []) as AcademyInstructor[];
}

// 講師側: 自分が取得した講座の公開教材だけ（RLSで講座外・非活動はDBが弾く）
export async function listMaterialsForInstructor(courseIds: string[]) {
  if (isAcademyLocalReview()) return academyPreviewMaterials.filter((item) => courseIds.includes(item.course_id) && item.is_published);
  if (courseIds.length === 0) return [];
  const { data, error } = await supabase
    .from("academy_materials")
    .select("*")
    .in("course_id", courseIds)
    .eq("is_published", true)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []) as AcademyMaterial[];
}

// 講師が編集できるのは営業列のみ。本部管理列を送っても §8 トリガが OLD 値に戻す。
export type InstructorProfileEdit = {
  business_name: string | null;
  area: string | null;
  online_available: boolean;
  instagram_url: string | null;
  self_intro: string | null;
  message: string | null;
  available_note: string | null;
  accepts_applications: boolean;
  is_listed: boolean;
  display_on_story: boolean;
  // Wave F (AC-F5b): 講師本人の決済設定。本部管理列保護トリガの対象外なので講師本人が書ける。
  payment_method_note: string | null;
  payment_url: string | null;
  payment_provider: AcademyPaymentProvider;
};

export async function updateMyInstructorProfile(instructor: AcademyInstructor, patch: Partial<InstructorProfileEdit>) {
  assertAcademyWritable();
  const { data, error } = await supabase
    .from("academy_instructors")
    .update(patch)
    .eq("id", instructor.id)
    .eq("user_id", instructor.user_id as string)
    .select("*")
    .single();

  if (error) throw error;
  return data as AcademyInstructor;
}
