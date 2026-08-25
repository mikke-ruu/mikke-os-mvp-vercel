"use client";

import Link from "next/link";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import { managerAppLabels, type ManagerProgress, type ManagerScheduleItem, type ManagerTask, type ManagerUrgency } from "@/lib/manager/types";

export function ManagerMetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm">
      <p className="text-xs font-bold text-[var(--mikke-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-extrabold tracking-tight text-[var(--mikke-text)]">{value}</p>
      <p className="mt-1 text-xs font-semibold text-[var(--mikke-muted)]">{helper}</p>
    </div>
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

export function ManagerTaskListRows({ tasks, emptyTitle = "タスクはまだありません" }: { tasks: ManagerTask[]; emptyTitle?: string }) {
  if (tasks.length === 0) return <MikkeEmptyState title={emptyTitle} helper="申込対応・予約確認・提供対応などがここに並びます。" />;

  return (
    <div className="grid gap-2">
      {tasks.map((task) => (
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
  );
}

export function ManagerProgressList({ progress, emptyTitle = "進行中のものはまだありません" }: { progress: ManagerProgress[]; emptyTitle?: string }) {
  if (progress.length === 0) return <MikkeEmptyState title={emptyTitle} helper="イベントやFundなどの進行状況がここに集まります。" />;

  return (
    <div className="grid gap-3">
      {progress.map((item) => (
        <Link key={item.id} href={item.source.href} className="block rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[var(--mikke-text)]">{item.title}</p>
              <p className="mt-1 text-xs font-semibold text-[var(--mikke-muted)]">{item.description}</p>
            </div>
            <MikkeStatusBadge tone="primary" className="shrink-0 px-2 py-1 text-[10px]">
              {managerAppLabels[item.source.appKey]}
            </MikkeStatusBadge>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--mikke-surface-soft)]">
            <div className="h-full rounded-full bg-[var(--mikke-accent)]" style={{ width: `${Math.min(100, Math.max(0, item.progressPercent))}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-xs font-semibold text-[var(--mikke-muted)]">
            <span>{item.statusLabel}</span>
            <span>{item.dueAt ? `目安 ${item.dueAt}` : "日付未設定"}</span>
          </div>
        </Link>
      ))}
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
    <Link href={href} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm">
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-[var(--mikke-text)]">{title}</span>
        <span className="mt-1 block truncate text-xs font-semibold text-[var(--mikke-muted)]">{description}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <MikkeStatusBadge tone={urgencyTone(urgency)} className="hidden px-2 py-1 text-[10px] sm:inline-flex">
          {urgencyLabel(urgency)}
        </MikkeStatusBadge>
        <MikkeStatusBadge tone="primary" className="px-2 py-1 text-[10px]">
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

