"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import { listMyManagerActivityLogs, type ManagerActivityLog } from "@/lib/manager/activity-logs";
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

  return (
    <ManagerShell title="最近の動き" subtitle="各アプリで起きたことを、見返しやすい履歴として確認します。">
      <section className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4 shadow-sm">
        {loading ? (
          <p className="py-8 text-center text-sm font-semibold text-[var(--mikke-muted)]">履歴を読み込んでいます…</p>
        ) : loadError ? (
          <MikkeEmptyState title="履歴を読み込めませんでした" helper="通信状態を確認して、画面を読み込み直してください。" />
        ) : logs.length === 0 ? (
          <MikkeEmptyState title="履歴はまだありません" helper="各アプリの活動が記録されると、ここに表示されます。" />
        ) : (
          <div className="grid gap-2">
            {logs.map((log, index) => (
              <article
                key={`${log.occurredAt}:${log.sourceService}:${log.title}:${index}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-[var(--mikke-text)]">{log.title}</span>
                  <span className="mt-1 block truncate text-xs font-semibold text-[var(--mikke-muted)]">
                    {new Date(log.occurredAt).toLocaleDateString("ja-JP")} / {log.description || "活動を記録しました"}
                  </span>
                </span>
                <MikkeStatusBadge tone="primary" className="shrink-0 px-2 py-1 text-[10px]">
                  {getSourceServiceLabel(log.sourceService)}
                </MikkeStatusBadge>
              </article>
            ))}
          </div>
        )}
      </section>
    </ManagerShell>
  );
}
