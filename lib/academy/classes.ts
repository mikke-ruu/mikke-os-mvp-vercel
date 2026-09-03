import { supabase } from "@/lib/supabase/client";
import { resolveAcademyCourseFeaturesForCourse } from "@/lib/academy/course-feature-settings";
import { getCourseProgram } from "@/lib/academy/programs";
import { academyPreviewClasses, assertAcademyWritable, isAcademyLocalReview } from "@/lib/academy/preview";
import type { AcademyClass, AcademyCourse, Profile } from "@/types/database";

const classDetails =
  "*, course:academy_courses(id,code,name), instructor:academy_instructors(id,business_name,profile_id)";

export async function listAcademyClasses(headquartersId: string) {
  if (isAcademyLocalReview()) return academyPreviewClasses;
  const { data, error } = await supabase
    .from("academy_classes")
    .select(classDetails)
    .eq("headquarters_id", headquartersId)
    .order("starts_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as AcademyClass[];
}

export type AcademyClassInput = {
  courseId: string;
  title: string;
  scheduleMode: AcademyClass["schedule_mode"];
  startsAt: string;
  endsAt: string | null;
  format: AcademyClass["format"];
  capacity: number | null;
  venueName: string;
  meetingUrl: string;
  registrationStatus: AcademyClass["registration_status"];
};

export async function createAcademyClass(
  profile: Profile,
  headquartersId: string,
  course: AcademyCourse,
  input: AcademyClassInput
) {
  assertAcademyWritable();
  const features = resolveAcademyCourseFeaturesForCourse(course);
  const program = features.stepLearning
    ? await getCourseProgram(headquartersId, course.id)
    : null;
  if (features.stepLearning && !program) {
    throw new Error("先に講座のステップ教材を作成し、現在の内容を確定してください。");
  }

  const { data, error } = await supabase
    .from("academy_classes")
    .insert({
      headquarters_id: headquartersId,
      course_id: course.id,
      program_id: program?.id ?? null,
      program_version_id: null,
      instructor_id: null,
      title: input.title.trim(),
      starts_at: input.startsAt || null,
      ends_at: input.endsAt,
      format: input.format,
      capacity: input.capacity,
      venue_name: input.format === "in_person" ? input.venueName.trim() || null : null,
      meeting_url: input.format === "online" ? input.meetingUrl.trim() || null : null,
      schedule_mode: input.scheduleMode,
      registration_status: input.registrationStatus,
      status: "planned",
      created_by_user_id: profile.user_id
    })
    .select(classDetails)
    .single();

  if (error) {
    if (error.message.includes("Publish the program before creating a class")) {
      throw new Error("先に講座のステップ教材を1件以上追加し、現在の内容を確定してください。");
    }
    throw error;
  }
  return data as unknown as AcademyClass;
}
