"use client";

import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import type { AcademyCourse } from "@/types/database";
import { resolveAcademyCourseFeaturesForCourse } from "@/lib/academy/course-feature-settings";

const courseTabs = [
  { id: "settings", label: "講座設定", href: (courseId: string) => `/academy/courses/${courseId}` },
  { id: "program", label: "ステップ教材", href: (courseId: string) => `/academy/courses/${courseId}/program` },
  { id: "page", label: "公開講座ページ", href: (courseId: string) => `/academy/courses/${courseId}/lp` },
  {
    id: "instructor",
    label: "復習・共有ページ",
    href: (courseId: string) => `/academy/courses/${courseId}/instructor-page`
  },
  { id: "materials", label: "教材・資料", href: (courseId: string) => `/academy/materials?course=${courseId}` }
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
    if (tab.id === "program") return features.stepLearning;
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
              Course Workspace
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-[var(--mikke-primary)]">{course.name}</h2>
              <span className="rounded bg-[var(--mikke-surface-soft)] px-2 py-1 text-[11px] font-bold text-[var(--mikke-muted)]">
                {course.code}
              </span>
              <span
                className={`rounded px-2 py-1 text-[11px] font-bold ${
                  course.is_published
                    ? "bg-[var(--mikke-green)] text-[var(--mikke-text)]"
                    : "bg-[var(--mikke-surface-soft)] text-[var(--mikke-muted)]"
                }`}
              >
                {course.is_published ? "公開中" : "非公開"}
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
      </header>

      <nav aria-label="講座内メニュー" className="flex flex-wrap gap-2">
        {visibleTabs.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <Link
              key={tab.id}
              href={tab.href(course.id)}
              aria-current={active ? "page" : undefined}
              className={`rounded-[10px] border px-3 py-2 text-xs font-bold ${
                active
                  ? "border-[var(--mikke-primary)] bg-[var(--mikke-primary)] text-white"
                  : "border-[var(--mikke-line)] bg-white text-[var(--mikke-text-soft)]"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="mx-auto w-full max-w-3xl">{children}</div>
    </div>
  );
}
