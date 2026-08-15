import { supabase } from "@/lib/supabase/client";
import type { AcademyClass } from "@/types/database";

const classDetails =
  "*, course:academy_courses(id,code,name), instructor:academy_instructors(id,business_name,profile_id)";

export async function listAcademyClasses(headquartersId: string) {
  const { data, error } = await supabase
    .from("academy_classes")
    .select(classDetails)
    .eq("headquarters_id", headquartersId)
    .order("starts_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as AcademyClass[];
}
