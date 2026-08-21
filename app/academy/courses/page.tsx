"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Eye, EyeOff, GraduationCap, LayoutTemplate, PenSquare, Plus } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { listCourses, setCoursePublished } from "@/lib/academy/courses";
import type { AcademyCourse, AcademyHeadquarters } from "@/types/database";

function CoursesContent() {
  const { profile } = useAuth();
  const [hq, setHq] = useState<AcademyHeadquarters | null>(null);
  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const foundHq = await getOwnedHeadquarters(profile.user_id);
    setHq(foundHq);
    if (foundHq) setCourses(await listCourses(foundHq.id));
    setLoading(false);
  }, [profile.user_id]);

  useEffect(() => {
    load();
  }, [load]);

  async function togglePublish(course: AcademyCourse) {
    if (!hq) return;
    setBusyId(course.id);
    try {
      await setCoursePublished(profile, hq.id, course, !course.is_published);
      setCourses(await listCourses(hq.id));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;

  if (!hq) {
    return (
      <div className="space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-5 text-center">
        <p className="text-sm font-bold text-[var(--mikke-text)]">本部がまだありません</p>
        <p className="text-xs text-[var(--mikke-muted)]">契約確認後、Academyのホームから本部を作成してください。</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-[var(--mikke-muted)]">{hq.name}</p>
          <h2 className="text-base font-bold text-[var(--mikke-text)]">講座管理</h2>
        </div>
        <Link href="/academy/courses/new" className="flex items-center gap-1 rounded-full bg-[var(--mikke-accent)] px-3 py-2 text-xs font-bold text-white">
          <Plus size={16} /> 新規
        </Link>
      </div>

      {courses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--mikke-line)] bg-white p-8 text-center">
          <BookOpen size={28} className="mx-auto text-[var(--mikke-accent)]" />
          <p className="mt-2 text-sm text-[var(--mikke-text-soft)]">まだ講座がありません。</p>
          <Link href="/academy/courses/new" className="mt-3 inline-block text-xs font-bold text-[var(--mikke-accent-strong)]">
            最初の講座を作る
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {courses.map((course) => (
            <li key={course.id} className="overflow-hidden rounded-2xl border border-[var(--mikke-line)] bg-white">
              {course.main_image_url ? (
                <img src={course.main_image_url} alt="" className="h-36 w-full object-cover" />
              ) : (
                <div className="flex h-20 items-center justify-center bg-[var(--mikke-surface-soft)]">
                  <BookOpen size={22} className="text-[var(--mikke-primary-border)]" />
                </div>
              )}
              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 rounded bg-[var(--mikke-accent-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--mikke-accent-strong)]">{course.code}</span>
                      <span className="truncate text-sm font-bold text-[var(--mikke-text)]">{course.name}</span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--mikke-muted)]">
                      受講料 {course.price.toLocaleString()}円{course.duration_text ? ` ・ ${course.duration_text}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => togglePublish(course)}
                    disabled={busyId === course.id}
                    className={`flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold ${
                      course.is_published
                        ? "border-[var(--mikke-success)]/30 bg-[var(--mikke-success-soft)] text-[var(--mikke-success)]"
                        : "border-[var(--mikke-line)] bg-white text-[var(--mikke-muted)]"
                    }`}
                  >
                    {course.is_published ? <Eye size={12} /> : <EyeOff size={12} />}
                    {course.is_published ? "公開中" : "非公開"}
                  </button>
                </div>

                <p className="rounded-xl bg-[var(--mikke-surface-soft)] px-3 py-2 text-[11px] leading-5 text-[var(--mikke-text-soft)]">
                  受講料・キット・FAQなどの基本情報は「講座情報を編集」、ページの見せ方は「LPビルダー」で編集します。
                </p>

                <div className="grid grid-cols-2 gap-2 border-t border-[var(--mikke-line-soft)] pt-3">
                  <Link
                    href={`/academy/courses/${course.id}`}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-[var(--mikke-accent)] px-2 py-2 text-xs font-bold text-white"
                  >
                    <PenSquare size={14} /> 講座情報を編集
                  </Link>
                  <Link
                    href={`/academy/courses/${course.id}/lp`}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--mikke-accent)] px-2 py-2 text-xs font-bold text-[var(--mikke-accent-strong)]"
                  >
                    <LayoutTemplate size={14} /> LPビルダー
                  </Link>
                  <Link
                    href={`/academy/c/${course.id}`}
                    target="_blank"
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--mikke-line)] px-2 py-2 text-xs font-bold text-[var(--mikke-text-soft)]"
                  >
                    <Eye size={14} /> 公開LPを見る
                  </Link>
                  <Link
                    href={`/academy/courses/${course.id}/instructor-page`}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--mikke-line)] px-2 py-2 text-xs font-bold text-[var(--mikke-text-soft)]"
                  >
                    <GraduationCap size={14} /> 講師専用ページ
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function CoursesPage() {
  return (
    <HonbuShell title="講座管理">
      <CoursesContent />
    </HonbuShell>
  );
}
