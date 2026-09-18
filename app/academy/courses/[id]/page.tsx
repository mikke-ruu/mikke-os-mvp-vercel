"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { AcademyCourseWorkspace } from "@/components/academy/AcademyCourseWorkspace";
import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { getCourse, updateCourse, type CourseInput } from "@/lib/academy/courses";
import { resolveAcademyCourseFeaturesForCourse } from "@/lib/academy/course-feature-settings";
import type { AcademyCourse, AcademyHeadquarters } from "@/types/database";
import { CourseForm } from "../CourseForm";
import { toCurrentAcademyContextHref } from "@/lib/academy/access-context";

function toLocalDateTimeValue(value: string) {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toInput(course: AcademyCourse): CourseInput {
  return {
    code: course.code,
    name: course.name,
    subtitle: course.subtitle ?? "",
    mainImageUrl: course.main_image_url ?? "",
    description: course.description ?? "",
    price: course.price,
    durationText: course.duration_text ?? "",
    formats: course.formats,
    certificationConditions: course.certification_conditions ?? "",
    canDoAfter: course.can_do_after ?? "",
    kitContents: course.kit_contents ?? "",
    materialContents: course.material_contents ?? "",
    faq: course.faq,
    applicationFormFields: course.application_form_fields,
    acceptAtHonbu: course.accept_at_honbu,
    acceptAtKoushi: course.accept_at_koushi,
    paymentUrl: course.payment_url ?? "",
    paymentProvider: course.payment_provider ?? "manual",
    kitPrice: course.kit_price ?? 0,
    kitPaymentUrl: course.kit_payment_url ?? "",
    requiresKit: course.requires_kit ?? true,
    learnerAccessMode: course.learner_access_mode ?? "unlimited",
    learnerAccessDays: course.learner_access_days ?? null,
    learnerAccessFixedEndAt: course.learner_access_fixed_end_at
      ? toLocalDateTimeValue(course.learner_access_fixed_end_at)
      : "",
    featureSettings: resolveAcademyCourseFeaturesForCourse(course)
  };
}

function EditCourseContent({ courseId }: { courseId: string }) {
  const { profile } = useAuth();
  const router = useRouter();
  const [hq, setHq] = useState<AcademyHeadquarters | null>(null);
  const [course, setCourse] = useState<AcademyCourse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const foundHq = await getOwnedHeadquarters(profile.user_id);
      setHq(foundHq);
      if (foundHq) setCourse(await getCourse(foundHq.id, courseId));
      setLoading(false);
    }
    load();
  }, [profile.user_id, courseId]);

  if (loading) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;
  if (!hq || !course) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">講座が見つかりません。</p>;

  return (
    <AcademyCourseWorkspace course={course} activeTab="settings">
      <CourseForm
        initial={toInput(course)}
        submitLabel="変更を保存する"
        onSubmit={async (input) => {
          const updated = await updateCourse(profile, hq.id, course.id, input);
          setCourse(updated);
        }}
        onNext={async (input) => {
          const updated = await updateCourse(profile, hq.id, course.id, input);
          setCourse(updated);
          router.push(toCurrentAcademyContextHref(`/academy/courses/${course.id}/instructor-page?audience=learner`));
        }}
      />
    </AcademyCourseWorkspace>
  );
}

export default function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <HonbuShell title="講座を編集">
      <EditCourseIdentity courseId={id} />
    </HonbuShell>
  );
}

function EditCourseIdentity({ courseId }: { courseId: string }) {
  const { user } = useAuth();
  return <EditCourseContent key={`${user.id}:${courseId}`} courseId={courseId} />;
}
