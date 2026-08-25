"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import { listMyManagerActivityLogs, type ManagerActivityLog } from "@/lib/manager/activity-logs";
import { ManagerShell } from "./ManagerShell";

const managerTimeZone = "Asia/Tokyo";

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
    void loadLogs(() => active);

    return () => {
      active = false;
    };
  }, [user.id]);

  async function loadLogs(isActive = () => true) {
    setLoading(true);
    setLoadError(false);
    try {
      const nextLogs = await listMyManagerActivityLogs(user.id);
      if (isActive()) setLogs(nextLogs);
    } catch {
      if (isActive()) setLoadError(true);
    } finally {
      if (isActive()) setLoading(false);
    }
  }

  const groupedLogs = groupLogsByDate(logs);

  return (
    <ManagerShell title="履歴" subtitle="あなた自身の活動を、各アプリをまたいで振り返ります。">
      <section className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4 shadow-sm">
        {loading ? (
          <p className="py-8 text-center text-sm font-semibold text-[var(--mikke-muted)]">履歴を読み込んでいます…</p>
        ) : loadError ? (
          <div className="py-4 text-center">
            <MikkeEmptyState title="履歴を読み込めませんでした" helper="通信状態を確認して、もう一度お試しください。" />
            <button
              type="button"
              onClick={() => void loadLogs()}
              className="mt-3 rounded-full bg-[var(--mikke-primary)] px-4 py-2 text-sm font-bold text-white"
            >
              もう一度試す
            </button>
          </div>
        ) : logs.length === 0 ? (
          <MikkeEmptyState title="履歴はまだありません" helper="各アプリの活動が記録されると、ここに表示されます。" />
        ) : (
          <div className="grid gap-6">
            {groupedLogs.map((group) => (
              <section key={group.dateKey} aria-labelledby={`history-${group.dateKey}`}>
                <h2 id={`history-${group.dateKey}`} className="mb-2 text-sm font-bold text-[var(--mikke-muted)]">
                  {group.dateLabel}
                </h2>
                <div className="grid gap-2">
                  {group.logs.map((log, index) => (
                    <article
                      key={`${log.occurredAt}:${log.sourceService}:${log.title}:${index}`}
                      className="flex items-start justify-between gap-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-bold leading-6 text-[var(--mikke-text)]">{log.title}</span>
                        <span className="mt-1 block text-xs font-semibold leading-5 text-[var(--mikke-muted)]">
                          {formatHistoryTime(log.occurredAt)} / {log.description || "活動を記録しました"}
                        </span>
                      </span>
                      <MikkeStatusBadge tone="primary" className="shrink-0 px-2 py-1 text-[10px]">
                        {getSourceServiceLabel(log.sourceService)}
                      </MikkeStatusBadge>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </ManagerShell>
  );
}

function groupLogsByDate(logs: ManagerActivityLog[]) {
  const groups = new Map<string, { dateKey: string; dateLabel: string; logs: ManagerActivityLog[] }>();
  for (const log of logs) {
    const date = new Date(log.occurredAt);
    const dateKey = formatHistoryDateKey(date);
    const existing = groups.get(dateKey);
    if (existing) {
      existing.logs.push(log);
    } else {
      groups.set(dateKey, {
        dateKey,
        dateLabel: new Intl.DateTimeFormat("ja-JP", {
          timeZone: managerTimeZone,
          year: "numeric",
          month: "long",
          day: "numeric",
          weekday: "short"
        }).format(date),
        logs: [log]
      });
    }
  }
  return [...groups.values()];
}

function formatHistoryDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: managerTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function formatHistoryTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: managerTimeZone,
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
