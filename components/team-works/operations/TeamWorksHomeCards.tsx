"use client";

import Link from "next/link";
import { MessageSquare, Users, Wallet } from "lucide-react";
import { useTeamWorksLabels } from "@/components/team-works/useTeamWorksLabels";
import type { RecentOperationsComment } from "@/lib/team-works-operations";

// ホーム右レールの共通カード。運営・納品どちらのダッシュボードからも
// 同じ見た目で使う(元はTeamWorksOperationsDashboard.tsx内のローカル関数だった)。

export function FinanceCard() {
  const labels = useTeamWorksLabels();
  return (
    <Link href="/apps/team-works/projects" className="block rounded-2xl border border-[#ffd370] bg-white p-4 transition hover:border-[#8bc7ad]">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--mikke-primary)]">
          <Wallet size={13} /> Finance
        </span>
        <span className="text-[11px] font-bold text-[var(--mikke-muted-light)]">今月・本部のみ</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full border-[6px] border-[var(--mikke-line-soft)]">
          <span className="text-xs font-bold text-[var(--mikke-muted-light)]">未設定</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {[
            { label: "売上想定", color: "var(--mikke-blue)" },
            { label: "経費想定", color: "var(--mikke-orange)" },
            { label: "利益見込み", color: "var(--mikke-green)" }
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between rounded-lg bg-[var(--mikke-surface-soft)] px-2.5 py-1.5 text-xs">
              <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--mikke-muted)]">
                <span className="h-2 w-2 rounded-[3px]" style={{ background: row.color }} />
                {row.label}
              </span>
              <span className="font-bold text-[var(--mikke-muted-light)]">—</span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-[10.5px] leading-5 text-[var(--mikke-muted-light)]">
        {labels.workers}報酬・請求のレートがまだ設定されていないため集計できません。レート項目を追加すると自動で表示されます。
      </p>
    </Link>
  );
}

export function MessagesCard({ comments }: { comments: RecentOperationsComment[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#f9d3d2] bg-white">
      <div className="flex items-baseline justify-between px-4 pt-4">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--mikke-primary)]">
          <MessageSquare size={13} /> Messages
        </span>
      </div>
      <div className="mt-3">
        {comments.length === 0 ? (
          <p className="px-4 pb-4 text-xs font-semibold text-[var(--mikke-muted)]">新着メッセージはありません。</p>
        ) : (
          <div className="divide-y divide-[var(--mikke-line)]">
            {comments.map((comment) => (
              <Link key={comment.id} href={`/apps/team-works/projects/${comment.projectId}?tab=messages`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-[var(--mikke-surface-soft)]">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f9d3d2] text-[#3f4eb5]">
                  <Users size={14} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold">
                    {comment.authorName}（{comment.projectTitle}）
                  </span>
                  <span className="block truncate text-[11px] font-semibold text-[var(--mikke-muted)]">{comment.body}</span>
                </span>
                <span className="shrink-0 text-[10px] font-semibold text-[var(--mikke-muted-light)]">{formatRelativeTime(comment.createdAt)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 1) return "たった今";
  if (diffMinutes < 60) return `${diffMinutes}分前`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}時間前`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}日前`;
}
