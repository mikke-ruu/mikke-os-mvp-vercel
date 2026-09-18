import type { AcademyCourse } from "@/types/database";
import type { CourseInput } from "./courses";
import { resolveAcademyCourseFeaturesForCourse } from "./course-feature-settings";

/** Copy editable course information only. No database write or publication. */
export function duplicateCourseInput(course: AcademyCourse): CourseInput {
  const fixedEnd = course.learner_access_fixed_end_at ? new Date(course.learner_access_fixed_end_at) : null;
  const pad = (value: number) => String(value).padStart(2, "0");
  const localFixedEnd = fixedEnd ? `${fixedEnd.getFullYear()}-${pad(fixedEnd.getMonth() + 1)}-${pad(fixedEnd.getDate())}T${pad(fixedEnd.getHours())}:${pad(fixedEnd.getMinutes())}` : "";
  return structuredClone({
    code: `COURSE-${crypto.randomUUID()}`, name: `${course.name}（コピー）`,
    subtitle: course.subtitle ?? "", mainImageUrl: course.main_image_url ?? "",
    description: course.description ?? "", price: Number(course.price),
    durationText: course.duration_text ?? "", formats: course.formats,
    certificationConditions: course.certification_conditions ?? "", canDoAfter: course.can_do_after ?? "",
    kitContents: course.kit_contents ?? "", materialContents: course.material_contents ?? "",
    faq: course.faq, applicationFormFields: course.application_form_fields,
    acceptAtHonbu: course.accept_at_honbu, acceptAtKoushi: course.accept_at_koushi,
    paymentUrl: course.payment_url ?? "", paymentProvider: course.payment_provider ?? "manual",
    kitPrice: course.kit_price ?? 0, kitPaymentUrl: course.kit_payment_url ?? "", requiresKit: course.requires_kit ?? true,
    learnerAccessMode: course.learner_access_mode ?? "unlimited", learnerAccessDays: course.learner_access_days ?? null,
    learnerAccessFixedEndAt: localFixedEnd,
    featureSettings: resolveAcademyCourseFeaturesForCourse(course)
  });
}
