"use client";

import Link from "next/link";
import { useState } from "react";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import { managerAppLabels, type ManagerProgress, type ManagerScheduleItem, type ManagerTask, type ManagerUrgency } from "@/lib/manager/types";

const metricToneColor = {
  orange: "var(--mikke-orange)",
  yellow: "var(--mikke-yellow)",
  green: "var(--mikke-green)"
} as const;

export function ManagerMetricCard({
  label,
  value,
  helper,
  tone,
  href
}: {
  label: string;
  value: string;
  helper: string;
  tone: keyof typeof metricToneColor;
  href: string;
}) {
  return (
    <Link
      href={href}
      aria-label={`${label} ${value}を見る`}
      className="group min-w-0 rounded-xl border border-[var(--mikke-line)] border-t-[3px] bg-white px-2 py-2.5 shadow-sm transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mikke-blue)] active:scale-[0.98] sm:rounded-2xl sm:p-4"
      style={{ borderTopColor: metricToneColor[tone] }}
    >
      <p className="truncate text-[10px] font-bold text-[var(--mikke-muted)] sm:text-xs">{label}</p>
      <span className="mt-1 flex items-center justify-between gap-1 sm:mt-2">
        <span className="text-xl font-extrabold tracking-tight text-[var(--mikke-text)] sm:text-2xl">{value}</span>
        <span aria-hidden="true" className="text-sm font-bold text-[var(--mikke-blue)] transition-transform group-hover:translate-x-0.5">→</span>
      </span>
      <p className="mt-1 hidden text-xs font-semibold text-[var(--mikke-muted)] sm:block">{helper}</p>
    </Link>
  );
}

export function ManagerScheduleList({ items, emptyTitle = "予定はまだありません" }: { items: ManagerScheduleItem[]; emptyTitle?: string }) {
  if (items.length === 0) return <MikkeEmptyState title={emptyTitle} helper="各アプリの予定がここに集まります。詳しいカレンダーはMarketNoteで確認できます。" />;

  return (
    <div className="grid gap-2">
      {items.map((item) => (
        <ManagerRow
          key={item.id}
          href={item.source.href}
          title={item.title}
          description={withTime(item)}
          badge={managerAppLabels[item.source.appKey]}
          urgency={item.urgency}
        />
      ))}
    </div>
  );
}

export function ManagerTaskListRows({
  tasks,
  emptyTitle = "タスクはまだありません",
  initialLimit
}: {
  tasks: ManagerTask[];
  emptyTitle?: string;
  initialLimit?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  if (tasks.length === 0) return <MikkeEmptyState title={emptyTitle} helper="申込対応・予約確認・提供対応などがここに並びます。" />;

  const visibleTasks = initialLimit && !expanded ? tasks.slice(0, initialLimit) : tasks;

  return (
    <div>
      <div className="grid gap-2">
        {visibleTasks.map((task) => (
          <ManagerRow
            key={task.id}
            href={task.source.href}
            title={task.title}
            description={`${task.description}${task.dueAt ? ` / 期限 ${task.dueAt}` : ""}`}
            badge={task.ownerLabel}
            urgency={task.urgency}
          />
        ))}
      </div>
      {initialLimit && tasks.length > initialLimit ? (
        <button type="button" onClick={() => setExpanded((value) => !value)} className="mt-3 w-full rounded-lg border border-[var(--mikke-line)] py-2 text-xs font-bold text-[var(--mikke-primary)]">
          {expanded ? "閉じる" : `あと${tasks.length - initialLimit}件を見る`}
        </button>
      ) : null}
    </div>
  );
}

export function ManagerProgressList({
  progress,
  emptyTitle = "進行中のものはまだありません",
  initialLimit
}: {
  progress: ManagerProgress[];
  emptyTitle?: string;
  initialLimit?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  if (progress.length === 0) return <MikkeEmptyState title={emptyTitle} helper="各アプリの進行状況がここに集まります。" />;

  const visibleProgress = initialLimit && !expanded ? progress.slice(0, initialLimit) : progress;

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-[var(--mikke-line)] bg-white">
        {visibleProgress.map((item) => (
        <Link key={item.id} href={item.source.href} className="block border-b border-[var(--mikke-line)] px-3 py-2.5 last:border-b-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-[var(--mikke-text)] sm:text-sm">{item.title}</p>
              <p className="mt-0.5 truncate text-[10px] font-semibold text-[var(--mikke-muted)] sm:text-xs">{item.description}</p>
            </div>
            <MikkeStatusBadge tone="primary" className="shrink-0 px-1.5 py-0.5 text-[9px] sm:px-2 sm:py-1 sm:text-[10px]">
              {managerAppLabels[item.source.appKey]}
            </MikkeStatusBadge>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--mikke-surface-soft)]">
            <div className="h-full rounded-full bg-[var(--mikke-orange)]" style={{ width: `${Math.min(100, Math.max(0, item.progressPercent))}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between gap-2 text-[10px] font-semibold text-[var(--mikke-muted)] sm:text-xs">
            <span>{item.statusLabel}</span>
            <span className="truncate">{item.dueAt ? `目安 ${item.dueAt}` : "日付未設定"}</span>
          </div>
        </Link>
        ))}
      </div>
      {initialLimit && progress.length > initialLimit ? (
        <button type="button" onClick={() => setExpanded((value) => !value)} className="mt-3 w-full rounded-lg border border-[var(--mikke-line)] py-2 text-xs font-bold text-[var(--mikke-primary)]">
          {expanded ? "閉じる" : `あと${progress.length - initialLimit}件を見る`}
        </button>
      ) : null}
    </div>
  );
}

function ManagerRow({
  href,
  title,
  description,
  badge,
  urgency
}: {
  href: string;
  title: string;
  description: string;
  badge: string;
  urgency: ManagerUrgency;
}) {
  return (
    <Link href={href} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-[var(--mikke-line)] border-l-[3px] bg-white px-3 py-2.5 shadow-sm" style={{ borderLeftColor: urgencyColor(urgency) }}>
      <span className="min-w-0">
        <span className="block truncate text-xs font-bold text-[var(--mikke-text)] sm:text-sm">{title}</span>
        <span className="mt-0.5 block truncate text-[10px] font-semibold text-[var(--mikke-muted)] sm:text-xs">{description}</span>
      </span>
      <span className="flex min-w-0 shrink-0 items-center gap-1">
        <MikkeStatusBadge tone={urgencyTone(urgency)} className="hidden px-2 py-1 text-[10px] sm:inline-flex">
          {urgencyLabel(urgency)}
        </MikkeStatusBadge>
        <MikkeStatusBadge tone="primary" className="max-w-[82px] truncate px-1.5 py-0.5 text-[9px] sm:max-w-none sm:px-2 sm:py-1 sm:text-[10px]">
          {badge}
        </MikkeStatusBadge>
      </span>
    </Link>
  );
}

function withTime(item: ManagerScheduleItem) {
  const time = item.startTime ? `${item.startTime}${item.endTime ? `-${item.endTime}` : ""}` : "";
  return `${item.dueAt ?? "日付未設定"}${time ? ` ${time}` : ""} / ${item.description}`;
}

function urgencyLabel(urgency: ManagerUrgency) {
  if (urgency === "overdue") return "期限超過";
  if (urgency === "today") return "今日";
  if (urgency === "week") return "7日以内";
  if (urgency === "later") return "予定あり";
  return "未設定";
}

function urgencyTone(urgency: ManagerUrgency) {
  if (urgency === "overdue" || urgency === "today") return "success" as const;
  if (urgency === "week") return "primary" as const;
  return "muted" as const;
}

function urgencyColor(urgency: ManagerUrgency) {
  if (urgency === "overdue") return "var(--mikke-pink)";
  if (urgency === "today") return "var(--mikke-green)";
  if (urgency === "week") return "var(--mikke-yellow)";
  return "var(--mikke-blue)";
}

