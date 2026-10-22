import { academyPublicClient } from "./public-client";
import type { AcademyCourse } from "@/types/database";

export type PublicCourseOverview = Pick<AcademyCourse,
  "id" | "headquarters_id" | "code" | "name" | "subtitle" | "main_image_url" |
  "description" | "duration_text" | "can_do_after" | "kit_contents" |
  "material_contents" | "certification_conditions"
>;

// Only public introduction fields are read. Lessons, materials and application data stay private.
export async function getPublicCourseOverview(headquartersId: string, courseId: string): Promise<PublicCourseOverview | null> {
  const { data, error } = await academyPublicClient.from("academy_courses")
    .select("id,headquarters_id,code,name,subtitle,main_image_url,description,duration_text,can_do_after,kit_contents,material_contents,certification_conditions")
    .eq("id", courseId).eq("headquarters_id", headquartersId).eq("is_published", true)
    .abortSignal(AbortSignal.timeout(30000)).maybeSingle();
  if (error) throw error;
  return data as PublicCourseOverview | null;
}
