"use client";

import Link from "next/link";

export type CalendarProjectLink = { id: string; title: string; bg?: string };

// カレンダーの凡例の色と揃わない呼び出し元(納品ダッシュボードなど、プロジェクトに
// 固有の色を持たない)向けの識別用フォールバック。役割トークンではなく識別色として使う。
const fallbackDotColors = [
  "var(--mikke-blue)",
  "var(--mikke-orange)",
  "var(--mikke-green)",
  "var(--mikke-yellow)",
  "var(--mikke-pink)"
];

// カレンダーの下に、各プロジェクトへ直接飛べるリンクを添える。
// 以前は左メニューの「プロジェクト管理」を経由しないとプロジェクトへ辿り着けなかった。
// 運営・納品どちらのホームカレンダーからも同じ見た目で使う。
export function TeamWorksCalendarProjectLinks({ projects }: { projects: CalendarProjectLink[] }) {
  if (projects.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--mikke-line-soft)] pt-3">
      <span className="mr-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--mikke-muted-light)]">
        プロジェクト（{projects.length}件）
      </span>
      {projects.map((project, index) => (
        <Link
          key={project.id}
          href={`/apps/team-works/projects/${project.id}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--mikke-line)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--mikke-text)] transition hover:border-[var(--tw-done)]"
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: project.bg ?? fallbackDotColors[index % fallbackDotColors.length] }} />
          {project.title}
        </Link>
      ))}
      <Link href="/apps/team-works/projects" className="ml-auto shrink-0 text-xs font-bold text-[var(--mikke-primary)]">
        プロジェクト管理へ ›
      </Link>
    </div>
  );
}
