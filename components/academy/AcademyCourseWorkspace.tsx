"use client";

import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import type { AcademyCourse } from "@/types/database";
import { resolveAcademyCourseFeaturesForCourse } from "@/lib/academy/course-feature-settings";

const courseTabs = [
  { id: "settings", label: "講座の内容を整える", href: (courseId: string) => `/academy/courses/${courseId}` },
  { id: "program", label: "ステップ教材", href: (courseId: string) => `/academy/courses/${courseId}/program` },
  { id: "page", label: "紹介ページを整える", href: (courseId: string) => `/academy/courses/${courseId}/lp` },
  {
    id: "learner",
    label: "復習ページ",
    href: (courseId: string) => `/academy/courses/${courseId}/instructor-page?audience=learner`
  },
  {
    id: "instructor",
    label: "講師用資料ページ",
    href: (courseId: string) => `/academy/courses/${courseId}/instructor-page`
  },
  { id: "materials", label: "講師用ファイル", href: (courseId: string) => `/academy/materials?course=${courseId}` }
] as const;

export type AcademyCourseWorkspaceTab = (typeof courseTabs)[number]["id"];

export function AcademyCourseWorkspace({
  course,
  activeTab,
  children
}: {
  course: AcademyCourse;
  activeTab: AcademyCourseWorkspaceTab;
  children: React.ReactNode;
}) {
  const features = resolveAcademyCourseFeaturesForCourse(course);
  const visibleTabs = courseTabs.filter((tab) => {
    if (tab.id === "program") return false;
    if (tab.id === "page") return features.publicCoursePage;
    return true;
  });

  return (
    <div className="space-y-5">
      <header className="border-b border-[var(--mikke-line)] pb-4">
        <Link
          href="/academy/courses"
          className="inline-flex items-center gap-1 text-xs font-bold text-[var(--mikke-primary)]"
        >
          <ArrowLeft size={14} />
          講座一覧へ戻る
        </Link>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--mikke-muted)]">
              講座の編集
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-[var(--mikke-primary)]">{course.name}</h2>
              <span
                className={`rounded px-2 py-1 text-[11px] font-bold ${
                  course.is_published
                    ? "bg-[var(--mikke-green)] text-[var(--mikke-text)]"
                    : "bg-[var(--mikke-surface-soft)] text-[var(--mikke-muted)]"
                }`}
              >
                {course.is_published ? "公開中" : "下書き保存済み"}
              </span>
            </div>
          </div>
          <Link
            href={`/academy/c/${course.id}`}
            target="_blank"
            className="inline-flex items-center gap-1 self-start rounded-[10px] border border-[var(--mikke-line)] bg-white px-3 py-2 text-xs font-bold text-[var(--mikke-text-soft)] lg:self-auto"
          >
            <ExternalLink size={14} />
            公開講座ページを見る
          </Link>
        </div>
        <p className="mt-4 text-sm leading-7 text-[var(--mikke-muted)]">{activeTab === "settings" ? "下の道順に沿って、一つずつ整えます。途中でも保存でき、順番を戻して修正できます。" : activeTab === "page" ? "受講を考えている人へ、講座の魅力を伝えるページをつくります。" : activeTab === "learner" ? "受講者が講座の後も見返せる、教材や復習内容をまとめます。" : "教える人が使う進め方や資料をまとめます。"}</p>
      </header>

      <nav aria-label="講座内メニュー" className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {visibleTabs.filter(tab => tab.id === "settings" || tab.id === "page").map((tab) => {
          const active = tab.id === activeTab;
          return (
            <Link
              key={tab.id}
              href={tab.href(course.id)}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center justify-center rounded-sm border px-3 py-2 text-sm font-bold ${
                active
                  ? "border-[var(--mikke-primary)] bg-white text-[var(--mikke-primary)]"
                  : "border-[var(--mikke-line)] bg-white text-[var(--mikke-text-soft)]"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      <div className="mx-auto w-full max-w-3xl">{children}</div>
      <section className="rounded-sm border border-[var(--mikke-line)] bg-white px-4 py-3">
        <h2 className="text-sm font-bold">教材・講師向けのページを整える</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">教材を渡す場合や、講師と一緒に運営する場合に使います。</p>
        <nav aria-label="教材・講師用メニュー" className="mt-3 grid gap-2 sm:grid-cols-3">{visibleTabs.filter(tab => tab.id !== "settings" && tab.id !== "page").map(tab => <Link key={tab.id} href={tab.href(course.id)} aria-current={activeTab === tab.id ? "page" : undefined} className={`flex min-h-11 items-center justify-center rounded-sm border p-3 text-sm font-bold ${activeTab === tab.id ? "bg-[#3f4eb5] text-white" : "bg-white"}`}>{tab.label}</Link>)}</nav>
      </section>


    </div>
  );
}
