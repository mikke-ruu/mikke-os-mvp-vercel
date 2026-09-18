"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { CourseForm } from "../CourseForm";
import { createAcademyDraftInput } from "@/lib/academy/draft-input";
import { toCurrentAcademyContextHref } from "@/lib/academy/access-context";
import { getMyAcademyCourseCreationAccess, type AcademyCourseCreationAccess } from "@/lib/academy/course-creation-access";
import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { createCourse, getCourse } from "@/lib/academy/courses";
import { duplicateCourseInput } from "@/lib/academy/course-draft-copy";
import type { AcademyHeadquarters } from "@/types/database";

function NewCourseContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const duplicateId = useSearchParams().get("duplicate");
  const [hq, setHq] = useState<AcademyHeadquarters | null>(null);
  const [loading, setLoading] = useState(true);
  const [createAccess, setCreateAccess] = useState<AcademyCourseCreationAccess | null>(null);
  const [initial, setInitial] = useState(() => ({ ...createAcademyDraftInput("新しい講座", "0"), name: "", price: Number.NaN }));

  useEffect(() => {
    let active = true;
    setLoading(true);
    setHq(null);
    setCreateAccess(null);
    getOwnedHeadquarters(profile.user_id)
      .then(async (found) => {
        if (!active) return;
        setHq(found);
        const access = found ? await getMyAcademyCourseCreationAccess(found.id) : null;
        const source = found && access?.allowed && duplicateId ? await getCourse(found.id, duplicateId) : null;
        if (found && access?.allowed && duplicateId && !source) throw new Error("copy_source_missing");
        if (!active) return;
        setInitial(source ? duplicateCourseInput(source) : { ...createAcademyDraftInput("新しい講座", "0"), name: "", price: Number.NaN });
        setHq(found);
        setCreateAccess(access);
      })
      .catch((cause) => {
        if (!active) return;
        setCreateAccess({
          allowed: false,
          reason: cause instanceof Error && cause.message === "copy_source_missing" ? "複製する講座が見つかりません。講座一覧から選び直してください。" : "講座を作成できるか確認できませんでした。講座管理へ戻り、再読み込みしてください。"
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [profile.user_id, duplicateId]);

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

  return (
      <div>
      <header className="mb-5"><p className="text-[11px] tracking-[.14em]">MY ACADEMY</p><h1 className="mt-1 text-2xl font-bold">講座をつくる</h1></header>
      {duplicateId && <p className="mb-3 text-sm">講座情報をコピーしました。保存するまで新しい講座は作成されません。レッスン教材は保存後に追加してください。</p>}
      <CourseForm
        key={`${profile.user_id}:${duplicateId ?? "new"}`}
        initial={initial}
        submitLabel="下書きを保存"
        onSubmit={async (input) => {
          const course = await createCourse(profile, hq.id, input);
          router.push(toCurrentAcademyContextHref(`/academy/courses/${course.id}?created=1`));
        }}
        onNext={async (input) => {
          const course = await createCourse(profile, hq.id, input);
          router.push(toCurrentAcademyContextHref(`/academy/courses/${course.id}/instructor-page?audience=learner`));
        }}
      />
      </div>
  );
}

export default function NewCoursePage() {
  return (
    <HonbuShell title="講座を作成">
      <div className="mx-auto min-w-0 max-w-5xl">
        <Suspense fallback={<p>読み込み中…</p>}><NewCourseContent /></Suspense>
      </div>
    </HonbuShell>
  );
}
