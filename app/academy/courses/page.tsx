"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toCurrentAcademyContextHref } from "@/lib/academy/access-context";
import { BookOpen, Eye, EyeOff, GraduationCap, LayoutTemplate, PenSquare, Plus } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { AcademyListTools } from "@/components/academy/AcademyListTools";
import { getMyAcademyCourseCreationAccess } from "@/lib/academy/course-creation-access";
import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { resolveAcademyCourseFeaturesForCourse } from "@/lib/academy/course-feature-settings";
import { listCourses } from "@/lib/academy/courses";
import type { AcademyCourse, AcademyHeadquarters } from "@/types/database";

function CoursesContent() {
  const { profile } = useAuth();
  const [hq, setHq] = useState<AcademyHeadquarters | null>(null);
  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [createAccess, setCreateAccess] = useState<{ allowed: boolean; reason: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const visibleCourses = courses.filter(c => c.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) && (filter === "all" || (filter === "published" ? c.is_published : !c.is_published)));

  const load = useCallback(async () => {
    setLoading(true);
    const foundHq = await getOwnedHeadquarters(profile.user_id);
    setHq(foundHq);
    if (foundHq) {
      const [foundCourses, foundCreateAccess] = await Promise.all([
        listCourses(foundHq.id),
        getMyAcademyCourseCreationAccess(foundHq.id)
      ]);
      setCourses(foundCourses);
      setCreateAccess(foundCreateAccess);
    } else {
      setCourses([]);
      setCreateAccess(null);
    }
    setLoading(false);
  }, [profile.user_id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;

  if (!hq) {
    return (
      <div className="space-y-3 rounded-lg border border-[var(--mikke-line)] bg-white p-5 text-center">
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
          <h2 className="mt-1 text-2xl font-bold text-[var(--mikke-text)]">あなたの講座</h2>
        </div>
        {createAccess?.allowed ? (
          <Link href={toCurrentAcademyContextHref("/academy/courses/new")} className="flex min-h-11 shrink-0 items-center gap-1 rounded-lg bg-[var(--mikke-accent)] px-3 py-2 text-sm font-bold text-white">
            <Plus size={16} /> 講座をつくる
          </Link>
        ) : (
          <span aria-disabled="true" className="flex items-center gap-1 rounded-lg bg-[var(--mikke-line)] px-3 py-2 text-xs font-bold text-[var(--mikke-muted)]">
            <Plus size={16} /> 新規
          </span>
        )}
      </div>

      <p className="text-sm leading-7 text-[var(--mikke-muted)]">下書きから少しずつ整えましょう。講座を選ぶと、紹介文・料金・教材を編集できます。</p>
      <AcademyListTools label="講座" query={query} onQuery={setQuery} filter={filter} onFilter={setFilter} count={visibleCourses.length} options={[
        {value:"all",label:"すべて",count:courses.length},
        {value:"draft",label:"下書き",count:courses.filter(c=>!c.is_published).length},
        {value:"published",label:"公開中",count:courses.filter(c=>c.is_published).length}
      ]} />
      {courses.length > 0 && visibleCourses.length === 0 ? <p className="py-6 text-sm">条件に合う講座がありません。検索語や公開状態を変えてください。</p> : null}
      {!createAccess?.allowed && createAccess?.reason ? (
        <p role="status" className="rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] px-4 py-3 text-xs leading-5 text-[var(--mikke-text-soft)]">
          {createAccess.reason}
        </p>
      ) : null}

      {courses.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--mikke-line)] bg-white p-8 text-center">
          <BookOpen size={28} className="mx-auto text-[var(--mikke-accent)]" />
          <p className="mt-4 text-xl font-bold text-[var(--mikke-text)]">最初の講座を、ここから。</p>
          <p className="mt-2 text-sm leading-7 text-[var(--mikke-muted)]">教えたいことの名前と受講料を決めるだけ。<br />紹介文や写真は後から追加できます。</p>
          {createAccess?.allowed ? (
            <Link href={toCurrentAcademyContextHref("/academy/courses/new")} className="mt-3 inline-block text-xs font-bold text-[var(--mikke-accent-strong)]">
              最初の講座を作る
            </Link>
          ) : null}
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {visibleCourses.map((course) => {
            const features = resolveAcademyCourseFeaturesForCourse(course);
            const format = course.formats.length === 0 ? "開催方法はこれから" : course.formats.length === 2 ? "対面・オンライン" : course.formats[0] === "online" ? "オンライン" : "対面";
            return (
            <li key={course.id} className="overflow-hidden border border-[var(--mikke-line)] bg-white">
              {course.main_image_url ? (
                <img src={course.main_image_url} alt="" className="h-36 w-full object-cover" />
              ) : null}
              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="break-words text-lg font-bold text-[var(--mikke-text)]">{course.name}</span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--mikke-muted)]">
                      受講料（税込） {course.price.toLocaleString()}円{course.duration_text ? ` ・ ${course.duration_text}` : ""}
                    </p>
                  </div>
                  <span
                    className={`flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold ${
                      course.is_published
                        ? "border-[var(--mikke-success)]/30 bg-[var(--mikke-success-soft)] text-[var(--mikke-success)]"
                        : "border-[var(--mikke-line)] bg-white text-[var(--mikke-muted)]"
                    }`}
                  >
                    {course.is_published ? <Eye size={12} /> : <EyeOff size={12} />}
                    {course.is_published ? "公開中" : "下書き"}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {[format, features.certification ? "認定講座" : null].filter(Boolean).map((label) => (
                    <span key={label} className="rounded-lg bg-[var(--mikke-surface-soft)] px-2 py-1 text-xs text-[var(--mikke-text-soft)]">{label}</span>
                  ))}
                </div>

                <p className="text-sm leading-6 text-[var(--mikke-muted)]">{course.subtitle || (course.is_published ? "公開中の内容を確認・編集できます。" : "下書きを保存済みです。続きをつくりましょう。")}</p>

                <div className="grid gap-2 border-t border-[var(--mikke-line-soft)] pt-3 sm:grid-cols-2 [&_a]:min-h-11">
                  <Link
                    href={toCurrentAcademyContextHref(`/academy/courses/${course.id}`)}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-[var(--mikke-accent)] px-2 py-2 text-xs font-bold text-white"
                  >
                    <PenSquare size={14} /> {course.is_published ? "講座を編集" : "編集を続ける"}
                  </Link>
                  <Link
                    href={toCurrentAcademyContextHref(`/academy/courses/${course.id}/lp`)}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--mikke-accent)] px-2 py-2 text-xs font-bold text-[var(--mikke-accent-strong)]"
                  >
                    <LayoutTemplate size={14} /> 紹介ページを整える
                  </Link>
                </div>
                <section className="border-t border-[var(--mikke-line)] pt-3"><h3 className="text-sm font-bold text-[var(--mikke-muted)]">教材・受講者向けページ</h3><div className="mt-3 grid gap-2 [&_a]:min-h-11">
                  <Link
                    href={`/academy/c/${course.id}`}
                    target="_blank"
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--mikke-line)] px-2 py-2 text-xs font-bold text-[var(--mikke-text-soft)]"
                  >
                    <Eye size={14} /> 紹介・申込ページを見る
                  </Link>
                  <Link
                    href={toCurrentAcademyContextHref(`/academy/courses/${course.id}/instructor-page`)}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--mikke-line)] px-2 py-2 text-xs font-bold text-[var(--mikke-text-soft)]"
                  >
                    <GraduationCap size={14} /> 講師用資料ページ編集
                  </Link>
                  <Link
                    href={toCurrentAcademyContextHref(`/academy/courses/${course.id}/instructor-page?audience=learner`)}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--mikke-line)] px-2 py-2 text-xs font-bold text-[var(--mikke-text-soft)]"
                  >
                    <GraduationCap size={14} /> 復習ページ編集
                  </Link>
                </div></section>
              </div>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function CoursesPage() {
  return (
    <HonbuShell title="あなたの講座">
      <CoursesContent />
    </HonbuShell>
  );
}
