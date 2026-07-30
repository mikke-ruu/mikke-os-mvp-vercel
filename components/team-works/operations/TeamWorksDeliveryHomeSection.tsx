"use client";

import { CalendarDays, FileCheck2 } from "lucide-react";
import Link from "next/link";
import { MikkeSection } from "@/components/mikkeos/MikkeSection";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import type { DeliveryHomeSummary } from "@/lib/team-works-delivery-home";

// ホーム(本部ダッシュボード)に置く、納品型プロジェクトを横断した要約。
// 運営型のコマ管理とは仕事の形が違う(名簿・シフトの概念が無い)ため、
// 同じカレンダーグリッドに無理に混ぜず、別セクションとして「対応が
// 必要なこと」と「今後の期日」を一覧できるようにしている。
export function TeamWorksDeliveryHomeSection({ summary }: { summary: DeliveryHomeSummary | null }) {
  if (summary === null) return <p className="text-sm font-semibold text-[var(--mikke-muted)]">読み込んでいます…</p>;
  if (summary.projectCount === 0) return null;

  return (
    <MikkeSection title="Delivery" tone="editorial" action="すべて見る" actionHref="/apps/team-works/projects">
      <p className="mb-2 -mt-2 text-xs font-semibold text-[var(--mikke-muted)]">納品型プロジェクト {summary.projectCount}件・対応が必要なことと今後の期日</p>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--mikke-line)] bg-white p-3">
          <p className="text-[11px] font-bold text-[var(--mikke-muted)]">クライアント待ち</p>
          <p className="text-lg font-extrabold text-[var(--tw-deadline)]">{summary.clientWaitingCount}件</p>
        </div>
        <div className="rounded-xl border border-[var(--mikke-line)] bg-white p-3">
          <p className="text-[11px] font-bold text-[var(--mikke-muted)]">本部確認待ち</p>
          <p className="text-lg font-extrabold text-[var(--tw-title)]">{summary.staffReviewCount}件</p>
        </div>
        <div className="rounded-xl border border-[var(--mikke-line)] bg-white p-3">
          <p className="text-[11px] font-bold text-[var(--mikke-muted)]">期限超過</p>
          <p className="text-lg font-extrabold text-[var(--tw-action)]">{summary.overdueCount}件</p>
        </div>
      </div>

      {summary.items.length > 0 ? (
        <div className="mt-3 space-y-1.5">
          {summary.items.map((item, index) => (
            <Link
              key={`${item.projectId}-${item.taskId}-${item.urgency}-${index}`}
              href={`/apps/team-works/projects/${item.projectId}?tab=tasks`}
              className="flex items-center gap-2 rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-xs font-semibold hover:border-[var(--tw-done)]"
            >
              <FileCheck2 size={13} className="shrink-0 text-[var(--mikke-muted)]" />
              <span className="min-w-0 flex-1 truncate">{item.detail}</span>
              <span className="shrink-0 text-[var(--mikke-muted)]">{item.projectTitle}</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-3">
          <MikkeEmptyState title="対応が必要なことはありません" />
        </div>
      )}

      {summary.upcoming.length > 0 ? (
        <div className="mt-4 border-t border-[var(--mikke-line)] pt-4">
          <p className="mb-2 text-xs font-extrabold text-[var(--mikke-primary)]">今後の期日</p>
          <div className="grid gap-2">
            {summary.upcoming.map((item, index) => (
              <Link
                key={`${item.taskId}-${item.kind}-${index}`}
                href={`/apps/team-works/projects/${item.projectId}?tab=schedule`}
                className="grid gap-2 rounded-xl border border-[var(--mikke-line)] bg-white p-3 transition hover:border-[var(--tw-done)] sm:grid-cols-[100px_1fr_auto] sm:items-center"
              >
                <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--tw-planned)] px-2 py-2 text-center text-xs font-extrabold text-[var(--tw-on-tint)]">
                  <CalendarDays size={12} /> {item.date.slice(5)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">{item.taskTitle}</span>
                  <span className="block text-[11px] font-semibold text-[var(--mikke-muted)]">
                    {item.projectTitle}・{item.kind === "submit" ? "提出期日" : "完了期日"}
                  </span>
                </span>
                <span className="text-xs font-bold text-[var(--mikke-primary)]">開く</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </MikkeSection>
  );
}
