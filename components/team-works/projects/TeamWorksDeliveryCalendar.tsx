"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getJapanDayOff } from "@/lib/japanese-calendar";
import { deliveryTaskStatusLabels, type DeliveryTaskStatus } from "@/lib/team-works-delivery";

const dowLabels = ["日", "月", "火", "水", "木", "金", "土"];

export type DeliveryCalendarItem = {
  id: string;
  title: string;
  status: DeliveryTaskStatus;
  dueOn: string;
  projectTitle?: string;
};

function statusTone(status: DeliveryTaskStatus): { bg: string; text: string } {
  if (status === "completed") return { bg: "var(--tw-done)", text: "var(--tw-on-tint)" };
  if (status === "review_pending" || status === "revising") return { bg: "var(--tw-action)", text: "var(--tw-on-solid)" };
  if (status === "on_hold" || status === "cancelled" || status === "archived") {
    return { bg: "var(--mikke-surface-soft)", text: "var(--mikke-muted)" };
  }
  return { bg: "var(--tw-planned)", text: "var(--tw-on-tint)" };
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
  const dates = useMemo(() => buildMonthDates(monthDate), [monthDate]);
  const itemsByDate = useMemo(() => {
    const map = new Map<string, DeliveryCalendarItem[]>();
    for (const item of items) {
      const list = map.get(item.dueOn) ?? [];
      list.push(item);
      map.set(item.dueOn, list);
    }
    return map;
  }, [items]);

  return (
    <div className="rounded-2xl border border-[var(--mikke-line)] bg-white p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button type="button" aria-label="前月" onClick={() => setMonthDate((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))} className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--mikke-line)]">
          <ChevronLeft size={16} />
        </button>
        <p className="text-sm font-extrabold">{monthDate.getFullYear()}年{monthDate.getMonth() + 1}月</p>
        <button type="button" aria-label="翌月" onClick={() => setMonthDate((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))} className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--mikke-line)]">
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-[var(--mikke-muted)]">
        {dowLabels.map((label) => <span key={label}>{label}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {dates.map((date) => {
          const key = toDateKey(date);
          const inMonth = date.getMonth() === monthDate.getMonth();
          const dayItems = itemsByDate.get(key) ?? [];
          const japanDayOff = getJapanDayOff(date);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDay?.(key)}
              className={`min-h-16 rounded-lg border p-1 text-left ${
                japanDayOff.isDayOff ? "border-[var(--mikke-pink)] bg-[var(--mikke-pink)]" : "border-[var(--mikke-line)] bg-white"
              } ${inMonth ? "" : "opacity-40"}`}
            >
              <span className="block text-[10px] font-bold">{date.getDate()}</span>
              <span className="mt-1 flex flex-col gap-0.5">
                {dayItems.slice(0, 2).map((item) => {
                  const tone = statusTone(item.status);
                  return (
                    <span key={item.id} className="truncate rounded px-1 py-0.5 text-[8px] font-bold" style={{ background: tone.bg, color: tone.text }}>
                      {item.title}
                    </span>
                  );
                })}
                {dayItems.length > 2 ? <span className="text-[8px] font-bold text-[var(--mikke-muted)]">+{dayItems.length - 2}件</span> : null}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[10px] font-semibold text-[var(--mikke-muted)]">
        <Legend color="var(--tw-planned)" label="未着手・進行中" />
        <Legend color="var(--tw-action)" label="確認待ち・修正中" />
        <Legend color="var(--tw-done)" label="完了" />
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
