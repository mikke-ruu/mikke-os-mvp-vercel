import { supabase } from "@/lib/supabase/client";
import type { AcademyInstructorPage, AcademyPageBlock, Profile } from "@/types/database";

// 本部: 講座の講師専用ページを取得（未作成なら null）
export async function getInstructorPage(headquartersId: string, courseId: string) {
  const { data, error } = await supabase
    .from("academy_instructor_pages")
    .select("*")
    .eq("headquarters_id", headquartersId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as AcademyInstructorPage | null;
}

// 講師: 取得講座の講師専用ページを取得（RLSで活動中講師 or 本部だけ読める）
export async function getInstructorPageForViewer(courseId: string) {
  const { data, error } = await supabase
    .from("academy_instructor_pages")
    .select("*")
    .eq("course_id", courseId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as AcademyInstructorPage | null;
}

// 本部: 講師専用ページのブロックを保存（1講座1ページ、upsert）
export async function saveInstructorPageBlocks(
  profile: Profile,
  headquartersId: string,
  courseId: string,
  blocks: AcademyPageBlock[]
) {
  const { data, error } = await supabase
    .from("academy_instructor_pages")
    .upsert(
      {
        headquarters_id: headquartersId,
        course_id: courseId,
        user_id: profile.user_id,
        blocks
      },
      { onConflict: "course_id" }
    )
    .select("*")
    .single();

  if (error) throw error;
  return data as AcademyInstructorPage;
}
