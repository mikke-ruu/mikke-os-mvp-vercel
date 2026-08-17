"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import {
  isManagerAchievement,
  listMyManagerActivityLogs,
  type ManagerActivityLog
} from "@/lib/manager/activity-logs";
import { ManagerShell } from "./ManagerShell";

const sourceServiceLabels: Record<string, string> = {
  academy: "Academy",
  community: "Community",
  event: "Event",
  fund: "Fund",
  item_studio: "Item Studio",
  library: "Library",
  manual: "mikkeOS",
  market_note: "MarketNote",
  marketnote: "MarketNote",
  order: "Order",
  page: "Page",
  session: "Session",
  studio: "Item Studio",
  team_works: "Team Works"
};

function getSourceServiceLabel(sourceService: string) {
  return sourceServiceLabels[sourceService] ?? "mikkeOS";
}

export function ManagerHistoryList() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ManagerActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);

    void listMyManagerActivityLogs(user.id)
      .then((nextLogs) => {
        if (active) setLogs(nextLogs);
      })
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user.id]);

  const achievements = logs.filter((log) => isManagerAchievement(log));

  return (
    <ManagerShell title="履歴" subtitle="過去の実績と、各アプリで起きた最近の動きを確認します。">
      <section className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4 shadow-sm">
        <div className="mb-3">
          <h2 className="text-sm font-bold text-[var(--mikke-text)]">過去の実績</h2>
          <p className="mt-1 text-xs font-semibold text-[var(--mikke-muted)]">終了日が昨日以前になったMarketNoteの確定予定です。</p>
        </div>
        {loading ? (
          <p className="py-6 text-center text-sm font-semibold text-[var(--mikke-muted)]">実績を読み込んでいます…</p>
        ) : loadError ? (
          <MikkeEmptyState title="実績を読み込めませんでした" helper="通信状態を確認して、画面を読み込み直してください。" />
        ) : achievements.length === 0 ? (
          <MikkeEmptyState title="実績はまだありません" helper="確定した予定の終了日を過ぎると、ここに表示されます。" />
        ) : (
          <div className="grid gap-2">
            {achievements.map((log, index) => (
              <HistoryRow key={`achievement:${log.occurredAt}:${log.title}:${index}`} log={log} achievement />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-[var(--mikke-text)]">最近の動き</h2>
        {loading ? (
          <p className="py-8 text-center text-sm font-semibold text-[var(--mikke-muted)]">履歴を読み込んでいます…</p>
        ) : loadError ? (
          <MikkeEmptyState title="履歴を読み込めませんでした" helper="通信状態を確認して、画面を読み込み直してください。" />
        ) : logs.length === 0 ? (
          <MikkeEmptyState title="履歴はまだありません" helper="各アプリの活動が記録されると、ここに表示されます。" />
        ) : (
          <div className="grid gap-2">
            {logs.map((log, index) => (
              <HistoryRow key={`${log.occurredAt}:${log.sourceService}:${log.title}:${index}`} log={log} />
            ))}
          </div>
        )}
      </section>
    </ManagerShell>
  );
}

function HistoryRow({ log, achievement = false }: { log: ManagerActivityLog; achievement?: boolean }) {
  return (
    <article className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm">
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-[var(--mikke-text)]">{log.title}</span>
        <span className="mt-1 block truncate text-xs font-semibold text-[var(--mikke-muted)]">
          {new Date(log.occurredAt).toLocaleDateString("ja-JP")} / {log.description || "活動を記録しました"}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        {achievement ? (
          <MikkeStatusBadge tone="success" withDot className="px-2 py-1 text-[10px]">
            実績
          </MikkeStatusBadge>
        ) : null}
        <MikkeStatusBadge tone="primary" className="px-2 py-1 text-[10px]">
          {getSourceServiceLabel(log.sourceService)}
        </MikkeStatusBadge>
      </span>
    </article>
  );
}
