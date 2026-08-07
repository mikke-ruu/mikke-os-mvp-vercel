"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatMonthDayWeekday, toDateKey } from "@/lib/format";
import { hasAppliedEntryStatus } from "@/lib/marketnote";
import { defaultReminderSettings, loadReminderSettings } from "@/lib/reminders";
import type { MarketCheckItem, MarketEvent, MarketFinancialRecord } from "@/types/database";

type PaymentState = "paid" | "unpaid" | "not_required";

type Props = {
  events: MarketEvent[];
  checksByEvent: Record<string, MarketCheckItem[]>;
  financesByEvent: Record<string, MarketFinancialRecord[]>;
};

const weekdayLabels = ["日", "月", "火", "水", "木", "金", "土"];

export function HomeCalendar({ events, checksByEvent, financesByEvent }: Props) {
  const todayKey = toDateKey(new Date());
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [reminderSettings, setReminderSettings] = useState(defaultReminderSettings);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    setReminderSettings(loadReminderSettings());
  }, []);

  const eventsByDate = useMemo(() => {
    const map: Record<string, MarketEvent[]> = {};
    for (const event of events) {
      if (!map[event.event_date]) map[event.event_date] = [];
      map[event.event_date].push(event);
    }
    return map;
  }, [events]);

  const weeks = useMemo(() => buildMonthMatrix(visibleMonth), [visibleMonth]);
  const activeEvents = useMemo(
    () => events
      .filter((event) => event.status !== "completed" && event.status !== "cancelled")
      .sort((a, b) => a.event_date.localeCompare(b.event_date)),
    [events]
  );
  const upcomingEvents = useMemo(
    () => activeEvents.filter((event) => event.event_date >= todayKey),
    [activeEvents, todayKey]
  );
  const dueTasks = useMemo(() => {
    if (!reminderSettings.enabled || !reminderSettings.targets.checkItemDue) return [];
    const tasks: Array<{ event: MarketEvent; item: MarketCheckItem; effectiveDue: string }> = [];
    for (const event of activeEvents) {
      for (const item of checksByEvent[event.id] ?? []) {
        if (item.is_done) continue;
        const effectiveDue = item.due_date ?? event.event_date;
        const daysUntilDue = daysBetween(todayKey, effectiveDue);
        const shouldShow = daysUntilDue < 0
          || daysUntilDue === 0 && reminderSettings.timings.sameDay
          || daysUntilDue === 1 && reminderSettings.timings.oneDayBefore
          || daysUntilDue === 3 && reminderSettings.timings.threeDaysBefore
          || daysUntilDue === 7 && reminderSettings.timings.sevenDaysBefore;
        if (shouldShow) tasks.push({ event, item, effectiveDue });
      }
    }
    return tasks.sort((a, b) => a.effectiveDue.localeCompare(b.effectiveDue)).slice(0, 3);
  }, [activeEvents, checksByEvent, reminderSettings, todayKey]);
  const unrecordedFinishedEvents = useMemo(
    () => events
      .filter((event) => event.status === "completed" && (financesByEvent[event.id]?.length ?? 0) === 0)
      .sort((a, b) => b.event_date.localeCompare(a.event_date)),
    [events, financesByEvent]
  );

  function moveMonth(delta: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  function goToToday() {
    const now = new Date();
    setVisibleMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  }

  return (
    <div>
      <div className="flex items-center justify-between px-1">
        <button type="button" onClick={() => moveMonth(-1)} aria-label="前の月" className="grid h-11 w-11 place-items-center rounded-full text-[var(--mikke-blue)] hover:bg-[var(--mikke-surface-soft)]">
          <ChevronLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold tracking-normal text-[var(--mikke-blue)]">
            {visibleMonth.getFullYear()}年{visibleMonth.getMonth() + 1}月
          </h2>
          <button type="button" onClick={goToToday} className="min-h-9 rounded-full border border-[var(--mikke-blue)] px-2.5 text-[11px] font-bold text-[var(--mikke-blue)]">
            今日
          </button>
        </div>
        <button type="button" onClick={() => moveMonth(1)} aria-label="次の月" className="grid h-11 w-11 place-items-center rounded-full text-[var(--mikke-blue)] hover:bg-[var(--mikke-surface-soft)]">
          <ChevronRight size={20} />
        </button>
      </div>

      <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-[var(--mikke-blue)]" style={{ fontFamily: "var(--mikke-font-display)" }}>
        CALENDAR
      </p>

      <div
        className="mt-2 grid touch-pan-y grid-cols-7 gap-1 rounded-xl border border-[var(--mikke-line)] bg-white p-2"
        onTouchStart={(event) => {
          touchStartX.current = event.touches[0]?.clientX ?? null;
          touchStartY.current = event.touches[0]?.clientY ?? null;
        }}
        onTouchEnd={(event) => {
          if (touchStartX.current === null || touchStartY.current === null) return;
          const endTouch = event.changedTouches[0];
          if (!endTouch) return;
          const deltaX = endTouch.clientX - touchStartX.current;
          const deltaY = endTouch.clientY - touchStartY.current;
          touchStartX.current = null;
          touchStartY.current = null;
          if (Math.abs(deltaX) >= 54 && Math.abs(deltaX) > Math.abs(deltaY)) moveMonth(deltaX > 0 ? -1 : 1);
        }}
      >
        {weekdayLabels.map((label) => (
          <div key={label} className="py-1 text-center text-[11px] font-bold text-[var(--mikke-muted-light)]">{label}</div>
        ))}
        {weeks.flat().map((date) => {
          const key = toDateKey(date);
          const inMonth = date.getMonth() === visibleMonth.getMonth();
          const dayEvents = eventsByDate[key] ?? [];
          const today = key === todayKey;
          return (
            <Link
              key={key}
              href={`/marketnote/day/${key}`}
              aria-label={calendarDayLabel(date, dayEvents)}
              className={`flex h-[68px] min-w-0 flex-col items-stretch rounded-lg border border-transparent p-0.5 text-center hover:border-[var(--mikke-blue)] hover:bg-[var(--mikke-surface-soft)] sm:h-[74px] ${inMonth ? "" : "opacity-40"}`}
            >
              <span className={`mx-auto grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${today ? "border border-[var(--mikke-blue)] text-[var(--mikke-blue)]" : "text-[var(--mikke-text)]"}`}>
                {date.getDate()}
              </span>
              <CalendarCellBody events={dayEvents} />
            </Link>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[10px] font-semibold text-[var(--mikke-muted)]" aria-label="予定の色分け">
        <CalendarLegend color="var(--mikke-blue)" label="予定" />
        <CalendarLegend color="var(--mikke-orange)" label="出店確定" />
        <CalendarLegend color="var(--mikke-green)" label="完了" />
      </div>

      {dueTasks.length > 0 || upcomingEvents.length > 0 || unrecordedFinishedEvents.length > 0 ? (
        <div className="mt-5 space-y-4">
          {dueTasks.length > 0 ? (
            <section className="border-t border-[var(--mikke-line)] pt-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--mikke-blue)]" style={{ fontFamily: "var(--mikke-font-display)" }}>TODO</p>
              <h3 className="mt-1 text-sm font-bold text-[var(--mikke-text)]">やること（期限順）</h3>
              <ul className="mt-2 space-y-1.5">
                {dueTasks.map(({ event, item, effectiveDue }) => (
                  <li key={item.id}>
                    <Link
                      href={`/marketnote/${event.id}`}
                      className="grid min-h-11 grid-cols-[12px_1fr_auto] items-center gap-2 rounded-lg px-1 text-xs font-semibold text-[var(--mikke-text-soft)] hover:bg-[var(--mikke-surface-soft)]"
                      aria-label={`${item.title}、${event.title}を開く`}
                    >
                      <span className={`h-3 w-3 rounded-full ${effectiveDue <= todayKey ? "bg-[var(--mikke-pink)]" : "bg-[var(--mikke-yellow)]"}`} />
                      <span className="min-w-0">
                        <span className="block truncate">{item.title}</span>
                        <span className="mt-0.5 block truncate text-[10px] text-[var(--mikke-muted)]">{event.title}</span>
                      </span>
                      <span className={`shrink-0 ${effectiveDue < todayKey ? "font-bold text-[var(--mikke-pink)]" : "text-[var(--mikke-muted)]"}`}>
                        {effectiveDue < todayKey ? "期限切れ " : ""}{formatMonthDayWeekday(effectiveDue)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {upcomingEvents.length > 0 ? (
            <section className="border-t border-[var(--mikke-line)] pt-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--mikke-blue)]" style={{ fontFamily: "var(--mikke-font-display)" }}>NEXT EVENTS</p>
              <h3 className="mt-1 text-sm font-bold text-[var(--mikke-text)]">次回イベント</h3>
              <ul className="mt-2 space-y-2">
                {upcomingEvents.slice(0, 3).map((event) => {
                  const checks = checksByEvent[event.id] ?? [];
                  const done = checks.filter((check) => check.is_done).length;
                  const payment = getPaymentState(checks);
                  return (
                    <li key={event.id}>
                      <Link href={`/marketnote/${event.id}`} className="block text-xs font-semibold text-[var(--mikke-text-soft)]">
                        <span className="font-bold text-[var(--mikke-text)]">{formatMonthDayWeekday(event.event_date)}　{event.title}</span>
                        <span className="mt-0.5 block text-[var(--mikke-muted)]">
                          {hasAppliedEntryStatus(event.private_note) && event.status === "planned" ? "申込済み" : statusLabel(event.status)} / {payment === "paid" ? "支払済" : payment === "unpaid" ? "未払い" : "支払い不要"} / {done}/{checks.length}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {unrecordedFinishedEvents.length > 0 ? (
            <p className="px-1 text-xs font-semibold text-[var(--mikke-muted)]">
              未記録の終了イベントが{unrecordedFinishedEvents.length}件あります。
              <Link href={`/marketnote/${unrecordedFinishedEvents[0].id}`} className="ml-1 font-bold text-[var(--mikke-blue)]">確認する</Link>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CalendarCellBody({ events }: { events: MarketEvent[] }) {
  if (events.length === 0) return null;
  return (
    <div className="mt-0.5 min-w-0 space-y-0.5" aria-hidden="true">
      {events.slice(0, 2).map((event) => (
        <span key={event.id} className={`block h-3 truncate rounded-[3px] px-0.5 text-[9px] font-bold leading-3 ${calendarEventBandClass(event)}`}>
          {event.title}
        </span>
      ))}
      {events.length > 2 ? <span className="block text-right text-[9px] font-bold leading-none text-[var(--mikke-muted)]">+{events.length - 2}</span> : null}
    </div>
  );
}

function CalendarLegend({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: color }} />{label}</span>;
}

function calendarEventBandClass(event: MarketEvent) {
  if (event.status === "completed") return "bg-[var(--mikke-green)] text-[var(--mikke-text)]";
  if (event.status === "preparing") return "bg-[var(--mikke-orange)] text-white";
  if (hasAppliedEntryStatus(event.private_note) && event.status === "planned") return "bg-[var(--mikke-yellow)] text-[var(--mikke-text)]";
  if (event.status === "planned") return "bg-[var(--mikke-blue)] text-white";
  return "bg-[var(--mikke-line)] text-[var(--mikke-muted)]";
}

function calendarDayLabel(date: Date, events: MarketEvent[]) {
  const dateLabel = date.toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" });
  if (events.length === 0) return `${dateLabel}、予定なし`;
  return `${dateLabel}、${events.map((event) => `${event.title}（${statusLabel(event.status)}）`).join("、")}`;
}

function buildMonthMatrix(monthStart: Date) {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  const gridEnd = new Date(lastOfMonth);
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));
  const weeks: Date[][] = [];
  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i += 1) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

function daysBetween(fromDateKey: string, toDateKeyValue: string) {
  const from = Date.parse(`${fromDateKey}T00:00:00Z`);
  const to = Date.parse(`${toDateKeyValue}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.round((to - from) / 86_400_000);
}

function getPaymentState(checks: MarketCheckItem[]): PaymentState {
  const paymentCheck = checks.find((check) => check.title.includes("支払い") || check.title.includes("支払"));
  if (!paymentCheck) return "not_required";
  return paymentCheck.is_done ? "paid" : "unpaid";
}

function statusLabel(status: MarketEvent["status"]) {
  if (status === "completed") return "終了";
  if (status === "preparing") return "出店確定";
  if (status === "cancelled") return "中止";
  return "検討中";
}
