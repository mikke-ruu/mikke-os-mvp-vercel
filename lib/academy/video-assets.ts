import { supabase } from "@/lib/supabase/client";
import { assertAcademyWritable, isAcademyLocalReview } from "@/lib/academy/preview";
import type { AcademyVideoAsset, AcademyVideoProvider, AcademyVideoAssetStatus } from "@/types/database";

export async function listCourseVideoAssets(headquartersId: string, courseId: string) {
  if (isAcademyLocalReview()) return [] as AcademyVideoAsset[];
  const { data, error } = await supabase
    .from("academy_video_assets")
    .select("*")
    .eq("headquarters_id", headquartersId)
    .eq("course_id", courseId)
    .neq("status", "archived")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AcademyVideoAsset[];
}

export async function createVideoAssetDraft(
  headquartersId: string,
  courseId: string,
  createdByUserId: string,
  title: string
) {
  assertAcademyWritable();
  const { data, error } = await supabase
    .from("academy_video_assets")
    .insert({
      headquarters_id: headquartersId,
      course_id: courseId,
      created_by_user_id: createdByUserId,
      title: title.trim(),
      provider: "unconfigured",
      status: "draft"
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as AcademyVideoAsset;
}

export async function updateVideoAssetProviderState(
  assetId: string,
  input: {
    provider: Exclude<AcademyVideoProvider, "unconfigured">;
    providerAssetId: string;
    status: Exclude<AcademyVideoAssetStatus, "draft" | "archived">;
    durationSeconds?: number | null;
    errorMessage?: string | null;
  }
) {
  assertAcademyWritable();
  const { data, error } = await supabase
    .from("academy_video_assets")
    .update({
      provider: input.provider,
      provider_asset_id: input.providerAssetId.trim(),
      status: input.status,
      duration_seconds: input.durationSeconds ?? null,
      error_message: input.errorMessage ?? null,
      archived_at: null
    })
    .eq("id", assetId)
    .select("*")
    .single();
  if (error) throw error;
  return data as AcademyVideoAsset;
}

export async function archiveVideoAsset(assetId: string) {
  assertAcademyWritable();
  const { data, error } = await supabase
    .from("academy_video_assets")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("id", assetId)
    .select("*")
    .single();
  if (error) throw error;
  return data as AcademyVideoAsset;
}
