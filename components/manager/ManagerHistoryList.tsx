"use client";

import { useEffect, useState } from "react";
import { Clock3, LockKeyhole, Trophy } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import {
  isManagerAchievement,
  listMyManagerActivityLogs,
  type ManagerActivityLog
} from "@/lib/manager/activity-logs";
import { ManagerShell } from "./ManagerShell";

const managerTimeZone = "Asia/Tokyo";
type HistoryView = "recent" | "achievements";

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
  const [view, setView] = useState<HistoryView>("recent");

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

  const achievements = logs.filter((log) => isManagerAchievement(log));
  const visibleLogs = view === "achievements" ? achievements : logs;
  const groupedLogs = groupLogsByDate(visibleLogs);
  const emptyTitle = view === "achievements" ? "実績はまだありません" : "履歴はまだありません";
  const emptyHelper = view === "achievements"
    ? "確定したMarketNoteの予定は、終了日の翌日から実績として確認できます。"
    : "各アプリの活動が記録されると、ここに表示されます。";

  return (
    <ManagerShell title="履歴" subtitle="各アプリで起きたことを、あとから振り返れます。">
      <section className="mb-4 flex items-start gap-3 rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-[var(--mikke-primary)]" aria-hidden="true">
          <LockKeyhole size={18} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold text-[var(--mikke-text)]">この履歴は本人だけに表示されます</span>
          <span className="mt-1 block text-xs font-semibold leading-5 text-[var(--mikke-muted)]">
            STORYなどの公開ページへ、自動で掲載されることはありません。
          </span>
        </span>
      </section>

      <div className="mb-4 grid grid-cols-2 gap-2" role="tablist" aria-label="履歴の表示切り替え">
        <HistoryTab
          active={view === "recent"}
          icon={<Clock3 size={16} />}
          label="最近の動き"
          count={logs.length}
          onClick={() => setView("recent")}
        />
        <HistoryTab
          active={view === "achievements"}
          icon={<Trophy size={16} />}
          label="過去の実績"
          count={achievements.length}
          onClick={() => setView("achievements")}
        />
      </div>

      <section className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4 shadow-sm">
        <div className="mb-4">
          <h2 className="text-base font-bold text-[var(--mikke-text)]">
            {view === "achievements" ? "過去の実績" : "最近の動き"}
          </h2>
          <p className="mt-1 text-xs font-semibold leading-5 text-[var(--mikke-muted)]">
            {view === "achievements"
              ? "終了日が昨日以前になったMarketNoteの確定予定です。"
              : "新しい記録から順に、日付ごとに表示します。"}
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
          <div className="grid gap-6">
            {groupedLogs.map((group) => (
              <section key={group.dateKey} aria-labelledby={`history-${group.dateKey}`}>
                <h2 id={`history-${group.dateKey}`} className="mb-2 text-sm font-bold text-[var(--mikke-muted)]">
                  {group.dateLabel}
                </h2>
                <div className="grid gap-2">
                  {group.logs.map((log, index) => (
                    <HistoryRow
                      key={`${log.occurredAt}:${log.sourceService}:${log.title}:${index}`}
                      log={log}
                      achievement={view === "achievements"}
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

function HistoryTab({
  active,
  icon,
  label,
  count,
  onClick
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-bold ${
        active
          ? "border-[var(--mikke-primary-border)] bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent)]"
          : "border-[var(--mikke-line)] bg-white text-[var(--mikke-muted)]"
      }`}
    >
      {icon}
      <span>{label}</span>
      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] tabular-nums">{count}</span>
    </button>
  );
}

function HistoryRow({ log, achievement }: { log: ManagerActivityLog; achievement: boolean }) {
  return (
    <article className="flex items-start justify-between gap-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm">
      <span className="min-w-0">
        <span className="block text-sm font-bold leading-6 text-[var(--mikke-text)]">{log.title}</span>
        <span className="mt-1 block text-xs font-semibold leading-5 text-[var(--mikke-muted)]">
          {formatHistoryTime(log.occurredAt)} / {log.description || "活動を記録しました"}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        {achievement ? (
          <MikkeStatusBadge tone="success" withDot className="px-2 py-1 text-[10px]">実績</MikkeStatusBadge>
        ) : null}
        <MikkeStatusBadge tone="primary" className="px-2 py-1 text-[10px]">
          {getSourceServiceLabel(log.sourceService)}
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
