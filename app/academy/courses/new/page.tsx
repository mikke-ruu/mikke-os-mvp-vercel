"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { AcademyCourseSetupWizard } from "@/components/academy/AcademyCourseSetupWizard";
import { toCurrentAcademyContextHref } from "@/lib/academy/access-context";
import { getMyAcademyCourseCreationAccess, type AcademyCourseCreationAccess } from "@/lib/academy/course-creation-access";
import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { createCourse } from "@/lib/academy/courses";
import type { CourseInput } from "@/lib/academy/courses";
import type { AcademyHeadquarters } from "@/types/database";
import { CourseForm } from "../CourseForm";

function NewCourseContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const [hq, setHq] = useState<AcademyHeadquarters | null>(null);
  const [loading, setLoading] = useState(true);
  const [createAccess, setCreateAccess] = useState<AcademyCourseCreationAccess | null>(null);
  const [guidedInitial, setGuidedInitial] = useState<Partial<CourseInput> | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setHq(null);
    setCreateAccess(null);
    getOwnedHeadquarters(profile.user_id)
      .then(async (found) => {
        const access = found ? await getMyAcademyCourseCreationAccess(found.id) : null;
        if (!active) return;
        setHq(found);
        setCreateAccess(access);
      })
      .catch(() => {
        if (!active) return;
        setCreateAccess({
          allowed: false,
          reason: "講座を作成できるか確認できませんでした。講座管理へ戻り、再読み込みしてください。"
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [profile.user_id]);

  if (loading) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;
  if (!hq) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">先に本部を作成してください。</p>;
  if (!createAccess?.allowed) {
    return (
      <div className="space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-5 text-center">
        <p className="text-sm font-bold text-[var(--mikke-text)]">この本部では講座を作成できません</p>
        <p className="text-xs leading-5 text-[var(--mikke-muted)]">
          {createAccess?.reason ?? "役割とAcademyの利用状態を確認してください。"}
        </p>
        <button type="button" onClick={() => router.push(toCurrentAcademyContextHref("/academy/courses"))} className="rounded-xl border border-[var(--mikke-line)] px-4 py-2 text-xs font-bold">
          講座管理へ戻る
        </button>
      </div>
    );
  }

  if (!guidedInitial) {
    return <AcademyCourseSetupWizard onComplete={setGuidedInitial} />;
  }

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--mikke-accent-soft)] px-4 py-3">
        <div className="min-w-0"><p className="text-xs font-bold text-[var(--mikke-accent-strong)]">講座の基本設定が終わりました</p><p className="mt-1 text-[11px] leading-5 text-[var(--mikke-muted)]">質問の回答から必要な機能を設定しました。この講座はまだ公開されていません。内容を確認して下書きを作成してください。</p></div>
        <button type="button" onClick={() => setGuidedInitial(null)} className="w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2 text-xs font-bold sm:w-auto">質問に戻る</button>
      </div>
      <CourseForm
        initial={guidedInitial}
        submitLabel="非公開で講座を作成する"
        onSubmit={async (input) => {
          await createCourse(profile, hq.id, input);
          router.push(toCurrentAcademyContextHref("/academy/courses"));
        }}
      />
    </div>
  );
}

export default function NewCoursePage() {
  return (
    <HonbuShell title="講座を作成">
      <div className="mx-auto min-w-0 max-w-2xl">
        <NewCourseContent />
      </div>
    </HonbuShell>
  );
}
