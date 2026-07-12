import { supabase } from "@/lib/supabase/client";
import { logAcademyEvent } from "@/lib/academy/events";
import type { AcademyCourse, AcademyFaqItem, AcademyFormField, Profile } from "@/types/database";

export type CourseInput = {
  code: string;
  name: string;
  subtitle: string;
  mainImageUrl: string;
  description: string;
  price: number;
  durationText: string;
  formats: ("in_person" | "online")[];
  certificationConditions: string;
  canDoAfter: string;
  kitContents: string;
  materialContents: string;
  faq: AcademyFaqItem[];
  applicationFormFields: AcademyFormField[];
  acceptAtHonbu: boolean;
  acceptAtKoushi: boolean;
  paymentUrl: string;
};

function toRow(hqId: string, userId: string, input: CourseInput) {
  return {
    headquarters_id: hqId,
    user_id: userId,
    code: input.code.trim(),
    name: input.name.trim(),
    subtitle: input.subtitle || null,
    main_image_url: input.mainImageUrl || null,
    description: input.description || null,
    price: input.price,
    duration_text: input.durationText || null,
    formats: input.formats,
    certification_conditions: input.certificationConditions || null,
    can_do_after: input.canDoAfter || null,
    kit_contents: input.kitContents || null,
    material_contents: input.materialContents || null,
    faq: input.faq,
    application_form_fields: input.applicationFormFields,
    accept_at_honbu: input.acceptAtHonbu,
    accept_at_koushi: input.acceptAtKoushi,
    payment_url: input.paymentUrl || null
  };
}

export async function listCourses(headquartersId: string) {
  const { data, error } = await supabase
    .from("academy_courses")
    .select("*")
    .eq("headquarters_id", headquartersId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as AcademyCourse[];
}

export async function getCourse(headquartersId: string, id: string) {
  const { data, error } = await supabase
    .from("academy_courses")
    .select("*")
    .eq("headquarters_id", headquartersId)
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as AcademyCourse;
}

export async function createCourse(profile: Profile, headquartersId: string, input: CourseInput) {
  const { data, error } = await supabase
    .from("academy_courses")
    .insert(toRow(headquartersId, profile.user_id, input))
    .select("*")
    .single();

  if (error) throw error;
  const course = data as AcademyCourse;

  await logAcademyEvent({
    headquartersId,
    actorUserId: profile.user_id,
    actorProfileId: profile.id,
    ownerUserId: profile.user_id,
    eventType: "course_created",
    idempotencyKey: `academy:course_created:${course.id}`,
    courseId: course.id,
    title: `講座「${course.name}」を作成しました`
  });

  return course;
}

export async function updateCourse(
  profile: Profile,
  headquartersId: string,
  courseId: string,
  input: CourseInput
) {
  const { data, error } = await supabase
    .from("academy_courses")
    .update(toRow(headquartersId, profile.user_id, input))
    .eq("id", courseId)
    .eq("headquarters_id", headquartersId)
    .select("*")
    .single();

  if (error) throw error;
  return data as AcademyCourse;
}

// 公開ON/OFF切り替え。公開は明示操作（seamにも実績候補として残す）。
export async function setCoursePublished(
  profile: Profile,
  headquartersId: string,
  course: AcademyCourse,
  isPublished: boolean
) {
  const { data, error } = await supabase
    .from("academy_courses")
    .update({ is_published: isPublished })
    .eq("id", course.id)
    .eq("headquarters_id", headquartersId)
    .select("*")
    .single();

  if (error) throw error;

  if (isPublished) {
    await logAcademyEvent({
      headquartersId,
      actorUserId: profile.user_id,
      actorProfileId: profile.id,
      ownerUserId: profile.user_id,
      eventType: "course_published",
      idempotencyKey: `academy:course_published:${course.id}`,
      courseId: course.id,
      title: `講座「${course.name}」を公開しました`,
      // 講座公開は本部の実績になりうる。ただし公開判断は本部に委ねる（既定は非公開）。
      visibility: "public",
      displayOnStory: true,
      displayInTimeline: true,
      displayAsAchievement: true,
      countsTowardSummary: true
    });
  }

  return data as AcademyCourse;
}
