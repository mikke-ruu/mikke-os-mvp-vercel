"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { toCurrentAcademyContextHref } from "@/lib/academy/access-context";
import { AcademyCourseWorkspace } from "@/components/academy/AcademyCourseWorkspace";
import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { getCourse, setCoursePublished, updateCourse, type CourseInput } from "@/lib/academy/courses";
import { resolveAcademyCourseFeaturesForCourse } from "@/lib/academy/course-feature-settings";
import type { AcademyCourse, AcademyHeadquarters } from "@/types/database";
import { CourseForm } from "../CourseForm";

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
  const [publishing, setPublishing] = useState(false);

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
      <section className="mb-4 space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
        <div>
          <p className="text-sm font-bold text-[var(--mikke-text)]">公開講座ページの表示</p>
          <p className="mt-1 text-sm leading-6 text-[var(--mikke-muted)]">講座の紹介と申込フォームを、受講希望者に見せるかをここで切り替えます。</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {([
            [false, "下書き", "本部だけが編集・確認できます"],
            [true, "公開中", "公開講座ページに表示します"]
          ] as const).map(([value, label, description]) => {
            const selected = course.is_published === value;
            return (
              <button
                key={label}
                type="button"
                aria-pressed={selected}
                disabled={publishing || selected}
                onClick={async () => {
                  setPublishing(true);
                  try {
                    const next = await setCoursePublished(profile, hq.id, course, value);
                    setCourse(next);
                  } finally {
                    setPublishing(false);
                  }
                }}
                className={`rounded-xl border p-3 text-left ${selected ? "border-[#3f4eb5] bg-[#3f4eb5] text-white" : "border-[var(--mikke-line)] bg-white text-[var(--mikke-text)]"}`}
              >
                <span className="block text-sm font-bold">{label}</span>
                <span className={`mt-1 block text-xs leading-5 ${selected ? "text-white/90" : "text-[var(--mikke-muted)]"}`}>{description}</span>
              </button>
            );
          })}
        </div>
      </section>
      <CourseForm
        initial={toInput(course)}
        submitLabel="変更を保存する"
        onSubmit={async (input) => {
          await updateCourse(profile, hq.id, course.id, input);
          router.push(toCurrentAcademyContextHref("/academy/courses"));
        }}
      />
    </AcademyCourseWorkspace>
  );
}

export default function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <HonbuShell title="講座を編集">
      <EditCourseContent courseId={id} />
    </HonbuShell>
  );
}
