"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getJapanDayOff } from "@/lib/japanese-calendar";
import { deliveryTaskStatusLabels, type DeliveryTask, type DeliveryTaskStatus } from "@/lib/team-works-delivery";

const dowLabels = ["日", "月", "火", "水", "木", "金", "土"];
const maxChipsPerCell = 2;

export type DeliveryCalendarItemKind = "submit" | "due" | "both";

export type DeliveryCalendarItem = {
  id: string;
  projectId: string;
  title: string;
  status: DeliveryTaskStatus;
  date: string;
  kind: DeliveryCalendarItemKind;
  projectTitle?: string;
};

type DeliveryCalendarDisplayMode = "both" | "submit" | "due";

// 提出期日(submit_due_on)と完了期日(due_on)をカレンダー項目に展開する。
// 同じ日なら(確認不要な工程は逆算配置で同日になる)1件にまとめる。
// 別々に出すと同じ工程が同じ日に2チップ並んで見えてしまうため。
// projectTitleは省略可(単一プロジェクトの詳細画面ではプロジェクト名は不要。
// 複数プロジェクトを横断するホームダッシュボードでのみ渡す)。
export function buildDeliveryCalendarItems(tasks: (DeliveryTask & { projectTitle?: string })[]): DeliveryCalendarItem[] {
  const items: DeliveryCalendarItem[] = [];
  for (const task of tasks) {
    if (task.submitDueOn && task.dueOn && task.submitDueOn === task.dueOn) {
      items.push({ id: task.id, projectId: task.projectId, title: task.title, status: task.status, date: task.dueOn, kind: "both", projectTitle: task.projectTitle });
      continue;
    }
    if (task.submitDueOn) items.push({ id: task.id, projectId: task.projectId, title: task.title, status: task.status, date: task.submitDueOn, kind: "submit", projectTitle: task.projectTitle });
    if (task.dueOn) items.push({ id: task.id, projectId: task.projectId, title: task.title, status: task.status, date: task.dueOn, kind: "due", projectTitle: task.projectTitle });
  }
  return items;
}

const doneLikeStatuses: DeliveryTaskStatus[] = ["completed", "cancelled", "archived"];

function isOverdue(dateOn: string, status: DeliveryTaskStatus): boolean {
  if (doneLikeStatuses.includes(status)) return false;
  return dateOn < toDateKey(new Date());
}

// 色は役割トークン固定: 完了=GREEN、期限超過=ORANGE(要対応)、
// 提出期日=PINK(締切)、完了期日・提出完了同日=BLUE(基準日)。
export function itemTone(item: DeliveryCalendarItem): { bg: string; text: string } {
  if (item.status === "completed") return { bg: "var(--tw-done)", text: "var(--tw-on-tint)" };
  if (isOverdue(item.date, item.status)) return { bg: "var(--tw-action)", text: "var(--tw-on-solid)" };
  if (item.kind === "submit") return { bg: "var(--tw-deadline)", text: "var(--tw-on-tint)" };
  return { bg: "var(--tw-title)", text: "var(--tw-on-solid)" };
}

function chipLabel(item: DeliveryCalendarItem): string {
  const base = item.kind === "submit" ? `提出 ${item.title}` : item.kind === "both" ? `提出・完了 ${item.title}` : item.title;
  return item.projectTitle ? `${item.projectTitle}・${base}` : base;
}

function buildMonthDates(monthDate: Date): Date[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const start = new Date(firstOfMonth);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function TeamWorksDeliveryCalendar({ items, onSelectDay }: { items: DeliveryCalendarItem[]; onSelectDay?: (dateKey: string) => void }) {
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [displayMode, setDisplayMode] = useState<DeliveryCalendarDisplayMode>("both");
  const todayKey = toDateKey(new Date());
  const dates = useMemo(() => buildMonthDates(monthDate), [monthDate]);

  const visibleItems = useMemo(() => {
    if (displayMode === "both") return items;
    if (displayMode === "submit") return items.filter((item) => item.kind !== "due");
    return items.filter((item) => item.kind !== "submit");
  }, [items, displayMode]);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, DeliveryCalendarItem[]>();
    for (const item of visibleItems) {
      const list = map.get(item.date) ?? [];
      list.push(item);
      map.set(item.date, list);
    }
    return map;
  }, [visibleItems]);

  return (
    <div className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="前の月" onClick={() => setMonthDate((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))} className="grid h-7 w-7 place-items-center rounded-lg border border-[var(--mikke-line)] text-[var(--mikke-muted)]">
            <ChevronLeft size={14} />
          </button>
          <p className="text-sm font-bold">{monthDate.getFullYear()}年 {monthDate.getMonth() + 1}月</p>
          <button type="button" aria-label="次の月" onClick={() => setMonthDate((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))} className="grid h-7 w-7 place-items-center rounded-lg border border-[var(--mikke-line)] text-[var(--mikke-muted)]">
            <ChevronRight size={14} />
          </button>
        </div>
        <div className="flex overflow-hidden rounded-lg border border-[var(--mikke-line)]">
          {([
            { value: "both", label: "両方" },
            { value: "submit", label: "提出期日" },
            { value: "due", label: "完了期日" }
          ] as { value: DeliveryCalendarDisplayMode; label: string }[]).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setDisplayMode(option.value)}
              className={`px-3 py-1.5 text-xs font-bold ${
                displayMode === option.value ? "bg-[var(--mikke-primary)] text-white" : "bg-white text-[var(--mikke-muted)]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {dowLabels.map((label) => (
          <div key={label} className="pb-1 text-center text-[10px] font-bold text-[var(--mikke-muted)]">
            {label}
          </div>
        ))}
        {dates.map((date) => {
          const key = toDateKey(date);
          const inMonth = date.getMonth() === monthDate.getMonth();
          const isToday = key === todayKey;
          const dayItems = itemsByDate.get(key) ?? [];
          const japanDayOff = getJapanDayOff(date);
          const visibleDayItems = dayItems.slice(0, maxChipsPerCell);
          const overflowCount = dayItems.length - visibleDayItems.length;

          if (!inMonth) {
            return (
              <div key={key} className="min-h-[60px] rounded-lg border border-[var(--mikke-line)] p-1 opacity-35">
                <span className="text-[10px] font-semibold text-[var(--mikke-muted)]">{date.getDate()}</span>
              </div>
            );
          }

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDay?.(key)}
              className={`min-h-[60px] rounded-lg border p-1 text-left ${
                japanDayOff.isDayOff ? "border-[var(--mikke-pink)] bg-[var(--mikke-pink)]" : "border-[var(--mikke-line)] bg-white"
              } ${isToday ? "border-[1.5px] border-[var(--tw-done)]" : ""}`}
            >
              <span className={`text-[10px] font-bold ${isToday ? "text-[var(--tw-done)]" : "text-[var(--mikke-muted)]"}`}>{date.getDate()}</span>
              {japanDayOff.isDayOff ? (
                <span title={japanDayOff.label ?? undefined} className="mt-0.5 block truncate text-[8px] font-extrabold text-[var(--tw-on-tint)]">
                  {japanDayOff.label ?? "祝"}
                </span>
              ) : null}
              {visibleDayItems.map((item) => {
                const tone = itemTone(item);
                return (
                  <span key={`${item.id}-${item.kind}`} className="mt-0.5 block truncate rounded px-1 py-[1px] text-[8px] font-bold" style={{ background: tone.bg, color: tone.text }}>
                    {chipLabel(item)}
                  </span>
                );
              })}
              {overflowCount > 0 ? <span className="mt-0.5 block text-[8px] font-bold text-[var(--mikke-muted)]">+{overflowCount}</span> : null}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[10.5px] font-semibold text-[var(--mikke-muted)]">
        <Legend color="var(--tw-title)" label="完了期日" />
        <Legend color="var(--tw-deadline)" label="提出期日" />
        <Legend color="var(--tw-done)" label="完了" />
        <Legend color="var(--tw-action)" label="期限超過" />
        <Legend color="var(--mikke-pink)" label="土日祝" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: color }} />
      {label}
    </span>
  );
}

export function deliveryTaskStatusLabel(status: DeliveryTaskStatus): string {
  return deliveryTaskStatusLabels[status];
}
