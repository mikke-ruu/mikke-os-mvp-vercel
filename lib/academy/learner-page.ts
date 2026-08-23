import { supabase } from "@/lib/supabase/client";
import {
  academyPreviewLearnerPage,
  assertAcademyWritable,
  isAcademyLocalReview
} from "@/lib/academy/preview";
import type { AcademyLearnerPage, AcademyPageBlock, Profile } from "@/types/database";

export async function getLearnerPage(headquartersId: string, courseId: string) {
  if (isAcademyLocalReview()) return academyPreviewLearnerPage;
  const { data, error } = await supabase
    .from("academy_learner_pages")
    .select("*")
    .eq("headquarters_id", headquartersId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as AcademyLearnerPage | null;
}

export async function getLearnerPageForViewer(courseId: string) {
  if (isAcademyLocalReview()) return academyPreviewLearnerPage;
  const { data, error } = await supabase
    .from("academy_learner_pages")
    .select("*")
    .eq("course_id", courseId)
    .eq("is_published", true)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as AcademyLearnerPage | null;
}

export async function saveLearnerPage(
  profile: Profile,
  headquartersId: string,
  courseId: string,
  blocks: AcademyPageBlock[],
  isPublished: boolean
) {
  assertAcademyWritable();
  const { data, error } = await supabase
    .from("academy_learner_pages")
    .upsert(
      {
        headquarters_id: headquartersId,
        course_id: courseId,
        user_id: profile.user_id,
        blocks,
        is_published: isPublished
      },
      { onConflict: "course_id" }
    )
    .select("*")
    .single();

  if (error) throw error;
  return data as AcademyLearnerPage;
}
