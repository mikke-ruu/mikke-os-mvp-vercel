"use client";

import { useEffect, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import {
  listMyManagerActivityLogs,
  type ManagerActivityLog
} from "@/lib/manager/activity-logs";
import { getManagerHistorySourceLabel } from "@/lib/manager/history-labels";
import { ManagerShell } from "./ManagerShell";

const managerTimeZone = "Asia/Tokyo";

export function ManagerHistoryList() {
  const { user } = useAuth();
  const [logState, setLogState] = useState<{ ownerId: string; logs: ManagerActivityLog[] } | null>(null);
  const logs = logState?.ownerId === user.id ? logState.logs : [];
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
      if (isActive()) setLogState({ ownerId: user.id, logs: nextLogs });
    } catch {
      if (isActive()) setLoadError(true);
    } finally {
      if (isActive()) setLoading(false);
    }
  }

  const visibleLogs = logs;
  const groupedLogs = groupLogsByDate(visibleLogs);
  const emptyTitle = "履歴はまだありません";
  const emptyHelper = "各アプリの活動が記録されると、ここに表示されます。";

  return (
    <ManagerShell title="履歴" subtitle="各アプリで起きたことを、あとから振り返れます。">
      <section className="mb-3 flex items-start gap-2.5 rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-[var(--mikke-primary)]" aria-hidden="true">
          <LockKeyhole size={16} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold text-[var(--mikke-text)]">この履歴は本人だけに表示されます</span>
          <span className="mt-1 block text-xs font-semibold leading-5 text-[var(--mikke-muted)]">
            STORYなどの公開ページへ、自動で掲載されることはありません。
          </span>
        </span>
      </section>

      <section className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-3 shadow-sm">
        <div className="mb-3">
          <h2 className="text-sm font-bold text-[var(--mikke-text)]">
            最近の動き
          </h2>
          <p className="mt-1 text-xs font-semibold leading-5 text-[var(--mikke-muted)]">
            最新30件までを、日付ごとに表示します。
          </p>
        </div>
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
        ) : visibleLogs.length === 0 ? (
          <MikkeEmptyState title={emptyTitle} helper={emptyHelper} />
        ) : (
          <div className="grid gap-4">
            {groupedLogs.map((group) => (
              <section key={group.dateKey} aria-labelledby={`history-${group.dateKey}`}>
                <h2 id={`history-${group.dateKey}`} className="mb-1.5 text-xs font-bold text-[var(--mikke-muted)]">
                  {group.dateLabel}
                </h2>
                <div className="grid gap-2">
                  {group.logs.map((log, index) => (
                    <HistoryRow
                      key={`${log.occurredAt}:${log.sourceService}:${log.title}:${index}`}
                      log={log}
                    />
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

function HistoryRow({ log }: { log: ManagerActivityLog }) {
  return (
    <article className="flex items-start justify-between gap-2.5 rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2.5 shadow-sm">
      <span className="min-w-0">
        <span className="block text-xs font-bold leading-5 text-[var(--mikke-text)]">{log.title}</span>
        <span className="mt-0.5 block text-[11px] font-semibold leading-4 text-[var(--mikke-muted)]">
          {formatHistoryTime(log.occurredAt)} / {log.description || "活動を記録しました"}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <MikkeStatusBadge tone="primary" className="px-1.5 py-0.5 text-[9px]">
          {getManagerHistorySourceLabel(log.sourceService)}
        </MikkeStatusBadge>
      </span>
    </article>
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
