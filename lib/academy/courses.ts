import { supabase } from "@/lib/supabase/client";
import { logAcademyEvent } from "@/lib/academy/events";
import { resolveAcademyCourseFeatureSettings } from "@/lib/academy/course-feature-settings";
import { academyPreviewCourses, assertAcademyWritable, isAcademyLocalReview } from "@/lib/academy/preview";
import type {
  AcademyCourse,
  AcademyCourseFeatureSettings,
  AcademyLearnerAccessMode,
  AcademyPaymentProvider,
  AcademyFaqItem,
  AcademyFormField,
  Profile
} from "@/types/database";

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
  paymentProvider: AcademyPaymentProvider;
  // Wave F (AC-F5a/c)
  kitPrice: number;
  kitPaymentUrl: string;
  requiresKit: boolean;
  learnerAccessMode: AcademyLearnerAccessMode;
  learnerAccessDays: number | null;
  learnerAccessFixedEndAt: string;
  featureSettings: AcademyCourseFeatureSettings;
};

function toRow(hqId: string, input: CourseInput) {
  const featureSettings = resolveAcademyCourseFeatureSettings(input.featureSettings);
  const fixedEndAt = input.learnerAccessMode === "fixed_end" && input.learnerAccessFixedEndAt
    ? new Date(input.learnerAccessFixedEndAt).toISOString()
    : null;
  return {
    headquarters_id: hqId,
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
    payment_url: input.paymentUrl || null,
    payment_provider: input.paymentProvider,
    kit_price: input.kitPrice,
    kit_payment_url: input.kitPaymentUrl || null,
    requires_kit: featureSettings.kits,
    learner_access_mode: input.learnerAccessMode,
    learner_access_days: input.learnerAccessMode.startsWith("days_after_") ? input.learnerAccessDays : null,
    learner_access_fixed_end_at: fixedEndAt,
    feature_settings: featureSettings
  };
}

export async function listCourses(headquartersId: string) {
  if (isAcademyLocalReview()) return academyPreviewCourses;
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
  if (isAcademyLocalReview()) {
    const course = academyPreviewCourses.find((item) => item.id === id) ?? academyPreviewCourses[0];
    return course;
  }
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
  assertAcademyWritable();
  const { data, error } = await supabase
    .from("academy_courses")
    .insert({ ...toRow(headquartersId, input), user_id: profile.user_id })
    .select("*")
    .single();

  if (error) throw error;
  const course = data as AcademyCourse;

  // Activity Log連携用の補助記録で講座本体の保存結果を失敗扱いにしない。
  // 本体保存後にこの補助記録だけ失敗しても、作成済み講座を再送で重複させないため。
  try {
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
  } catch {
    // academy_activity_events is a non-authoritative seam. Course creation succeeded.
  }

  return course;
}

export async function updateCourse(
  profile: Profile,
  headquartersId: string,
  courseId: string,
  input: CourseInput
) {
  assertAcademyWritable();
  const { data, error } = await supabase
    .from("academy_courses")
    .update(toRow(headquartersId, input))
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
  assertAcademyWritable();
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
