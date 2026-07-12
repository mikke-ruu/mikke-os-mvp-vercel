"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, Edit3, MapPin } from "lucide-react";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import { formatMonthDayWeekday, formatYen, toDateKey } from "@/lib/format";
import { hasAppliedEntryStatus } from "@/lib/marketnote";
import type { MarketCheckItem, MarketEvent, MarketFinancialRecord, MarketReflection } from "@/types/database";

type PaymentState = "paid" | "unpaid" | "not_required";

type Props = {
  events: MarketEvent[];
  checksByEvent: Record<string, MarketCheckItem[]>;
  financesByEvent: Record<string, MarketFinancialRecord[]>;
  reflectionsByEvent: Record<string, MarketReflection | undefined>;
};

const weekdayLabels = ["日", "月", "火", "水", "木", "金", "土"];

export function HomeCalendar({ events, checksByEvent, financesByEvent, reflectionsByEvent }: Props) {
  const todayKey = toDateKey(new Date());
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string>(todayKey);
  const [expandedReflection, setExpandedReflection] = useState<string | null>(null);

  const eventsByDate = useMemo(() => {
    const map: Record<string, MarketEvent[]> = {};
    for (const event of events) {
      const key = event.event_date;
      if (!map[key]) map[key] = [];
      map[key].push(event);
    }
    return map;
  }, [events]);

  const weeks = useMemo(() => buildMonthMatrix(visibleMonth), [visibleMonth]);

  const upcomingEvents = useMemo(
    () => events.filter((event) => event.status !== "completed" && event.status !== "cancelled").sort((a, b) => a.event_date.localeCompare(b.event_date)),
    [events]
  );

  const dueTasks = useMemo(() => {
    const tasks: Array<{ event: MarketEvent; item: MarketCheckItem; effectiveDue: string }> = [];
    for (const event of upcomingEvents) {
      const checks = checksByEvent[event.id] ?? [];
      for (const item of checks) {
        if (item.is_done) continue;
        tasks.push({ event, item, effectiveDue: item.due_date ?? event.event_date });
      }
    }
    return tasks.sort((a, b) => a.effectiveDue.localeCompare(b.effectiveDue)).slice(0, 3);
  }, [checksByEvent, upcomingEvents]);

  const unrecordedFinishedEvents = useMemo(() => {
    return events
      .filter((event) => event.status === "completed" && (financesByEvent[event.id]?.length ?? 0) === 0)
      .sort((a, b) => b.event_date.localeCompare(a.event_date));
  }, [events, financesByEvent]);

  const selectedEvents = eventsByDate[selectedDate] ?? [];

  return (
    <div>
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
          aria-label="前の月"
          className="grid h-9 w-9 place-items-center rounded-full text-[var(--mikke-muted)] hover:bg-[var(--mikke-surface-soft)]"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold tracking-normal text-[var(--mikke-text)]">
            {visibleMonth.getFullYear()}年{visibleMonth.getMonth() + 1}月
          </h2>
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              setVisibleMonth(new Date(now.getFullYear(), now.getMonth(), 1));
              setSelectedDate(todayKey);
            }}
            className="rounded-full border border-[var(--mikke-line)] px-2 py-1 text-[11px] font-bold text-[var(--mikke-muted)]"
          >
            今日
          </button>
        </div>
        <button
          type="button"
          onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
          aria-label="次の月"
          className="grid h-9 w-9 place-items-center rounded-full text-[var(--mikke-muted)] hover:bg-[var(--mikke-surface-soft)]"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-2">
        {weekdayLabels.map((label) => (
          <div key={label} className="py-1 text-center text-[11px] font-bold text-[var(--mikke-muted-light)]">
            {label}
          </div>
        ))}
        {weeks.flat().map((date) => {
          const key = toDateKey(date);
          const inMonth = date.getMonth() === visibleMonth.getMonth();
          const dayEvents = eventsByDate[key] ?? [];
          const selected = key === selectedDate;

          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedDate(key)}
              className={`flex h-16 flex-col items-start rounded-xl border p-1 text-left sm:h-20 ${
                selected
                  ? "border-[var(--mikke-accent)] bg-[var(--mikke-accent-soft)]"
                  : "border-transparent hover:bg-[var(--mikke-surface-soft)]"
              } ${inMonth ? "" : "opacity-40"}`}
            >
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                  selected ? "bg-[var(--mikke-accent)] text-white" : "text-[var(--mikke-text)]"
                }`}
              >
                {date.getDate()}
              </span>
              <CalendarCellBody events={dayEvents} checksByEvent={checksByEvent} financesByEvent={financesByEvent} />
            </button>
          );
        })}
      </div>

      <div className="mt-4 space-y-3">
        {selectedEvents.length > 0 ? (
          selectedEvents.map((event) =>
            event.status === "completed" ? (
              <FinishedEventCard
                key={event.id}
                event={event}
                finances={financesByEvent[event.id] ?? []}
                reflection={reflectionsByEvent[event.id]}
                expanded={expandedReflection === event.id}
                onToggleReflection={() => setExpandedReflection((current) => (current === event.id ? null : event.id))}
              />
            ) : (
              <UpcomingEventCard key={event.id} event={event} checks={checksByEvent[event.id] ?? []} />
            )
          )
        ) : (
          <MikkeEmptyState title="この日の予定はまだありません" helper="出店予定を追加すると、この日にカードが表示されます。" />
        )}
        <Link
          href={`/marketnote/new?startDate=${selectedDate}`}
          className="block text-center text-xs font-bold text-[var(--mikke-accent)]"
        >
          + この日に別の予定を追加
        </Link>
      </div>

      {dueTasks.length > 0 || upcomingEvents.length > 0 || unrecordedFinishedEvents.length > 0 ? (
        <div className="mt-6 space-y-4">
          {dueTasks.length > 0 ? (
            <section className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4">
              <h3 className="text-sm font-bold text-[var(--mikke-text)]">やること（期限順）</h3>
              <ul className="mt-2 space-y-1.5">
                {dueTasks.map(({ event, item, effectiveDue }) => (
                  <li key={item.id} className="flex items-center gap-2 text-xs font-semibold text-[var(--mikke-text-soft)]">
                    <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-[var(--mikke-line)]" />
                    <span className="min-w-0 flex-1 truncate">{item.title}</span>
                    <span className="shrink-0 text-[var(--mikke-muted)]">{formatMonthDayWeekday(effectiveDue)}</span>
                    <span className="sr-only">（{event.title}）</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {upcomingEvents.length > 0 ? (
            <section className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4">
              <h3 className="text-sm font-bold text-[var(--mikke-text)]">次回イベント</h3>
              <ul className="mt-2 space-y-2">
                {upcomingEvents.slice(0, 3).map((event) => {
                  const checks = checksByEvent[event.id] ?? [];
                  const done = checks.filter((check) => check.is_done).length;
                  return (
                    <li key={event.id}>
                      <Link href={`/marketnote/${event.id}`} className="block text-xs font-semibold text-[var(--mikke-text-soft)]">
                        <span className="font-bold text-[var(--mikke-text)]">{formatMonthDayWeekday(event.event_date)}　{event.title}</span>
                        <span className="mt-0.5 block text-[var(--mikke-muted)]">
                          {hasAppliedEntryStatus(event.private_note) && event.status === "planned" ? "申込済み" : statusLabel(event.status)} / {getPaymentState(checks) === "paid" ? "支払済" : getPaymentState(checks) === "unpaid" ? "未払い" : "支払い不要"} / {done}/{checks.length}
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
              <Link href={`/marketnote/${unrecordedFinishedEvents[0].id}`} className="ml-1 font-bold text-[var(--mikke-accent)]">
                確認する
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CalendarCellBody({
  events,
  checksByEvent,
  financesByEvent
}: {
  events: MarketEvent[];
  checksByEvent: Record<string, MarketCheckItem[]>;
  financesByEvent: Record<string, MarketFinancialRecord[]>;
}) {
  if (events.length === 0) return null;

  const primary = events[0];
  const extraCount = events.length - 1;

  return (
    <div className="mt-0.5 min-w-0 flex-1 text-[9px] font-bold leading-tight sm:text-[10px]">
      {extraCount > 0 ? <span className="text-[var(--mikke-muted-light)]">+{extraCount}</span> : null}
      {primary.status === "completed" ? (
        <FinishedCellSummary event={primary} finances={financesByEvent[primary.id] ?? []} />
      ) : (
        <PendingCellSummary event={primary} checks={checksByEvent[primary.id] ?? []} />
      )}
    </div>
  );
}

function PendingCellSummary({ event, checks }: { event: MarketEvent; checks: MarketCheckItem[] }) {
  const done = checks.filter((check) => check.is_done).length;
  const payment = getPaymentState(checks);
  const applied = hasAppliedEntryStatus(event.private_note) && event.status === "planned";
  const toneClass = applied || event.status === "preparing" ? "text-[var(--mikke-accent-strong)]" : "text-[var(--mikke-muted)]";

  return (
    <div className={`space-y-0.5 ${toneClass}`}>
      <p className="truncate">{event.title}</p>
      <p className="truncate text-[var(--mikke-muted-light)]">
        {payment === "not_required" ? "" : payment === "paid" ? "済" : "未"}
        {checks.length > 0 ? ` ${done}/${checks.length}` : ""}
      </p>
    </div>
  );
}

function FinishedCellSummary({ event, finances }: { event: MarketEvent; finances: MarketFinancialRecord[] }) {
  if (finances.length === 0) {
    return (
      <div className="space-y-0.5 text-[var(--mikke-muted-light)]">
        <p className="truncate">終了</p>
        <p className="truncate">未記録</p>
      </div>
    );
  }

  const profit = sumProfit(finances);
  return (
    <div className="space-y-0.5 text-[var(--mikke-success)]">
      <p className="truncate text-[var(--mikke-muted-light)]">利益</p>
      <p className="truncate">{formatYen(profit)}</p>
    </div>
  );
}

function UpcomingEventCard({ event, checks }: { event: MarketEvent; checks: MarketCheckItem[] }) {
  const done = checks.filter((check) => check.is_done).length;
  const progress = checks.length ? Math.round((done / checks.length) * 100) : 0;
  const payment = getPaymentState(checks);
  const applied = hasAppliedEntryStatus(event.private_note) && event.status === "planned";

  return (
    <Link
      href={`/marketnote/${event.id}`}
      className="block rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4 shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <MikkeStatusBadge tone={applied || event.status === "preparing" ? "primary" : "muted"} className="rounded-full py-1">
          {applied ? "申込済み" : statusLabel(event.status)}
          <ChevronDown size={13} />
        </MikkeStatusBadge>
        <Edit3 size={16} className="shrink-0 text-[var(--mikke-muted)]" />
      </div>
      <h4 className="mt-2 truncate text-base font-bold text-[var(--mikke-text)]">{event.title}</h4>
      <p className="mt-1 truncate text-xs font-semibold text-[var(--mikke-muted)]">{formatMonthDayWeekday(event.event_date)}</p>
      {event.venue_name || event.area ? (
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs font-semibold text-[var(--mikke-muted)]">
          <MapPin size={13} className="shrink-0" />
          {[event.venue_name, event.area].filter(Boolean).join(" / ")}
        </p>
      ) : null}
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="font-semibold text-[var(--mikke-text-soft)]">支払い：{paymentLabel(payment)}</span>
        <span className="font-semibold text-[var(--mikke-text-soft)]">タスク {done}/{checks.length}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--mikke-line-soft)]">
        <div className="h-full rounded-full bg-[var(--mikke-accent)]" style={{ width: `${progress}%` }} />
      </div>
    </Link>
  );
}

function FinishedEventCard({
  event,
  finances,
  reflection,
  expanded,
  onToggleReflection
}: {
  event: MarketEvent;
  finances: MarketFinancialRecord[];
  reflection: MarketReflection | undefined;
  expanded: boolean;
  onToggleReflection: () => void;
}) {
  const revenue = sumByType(finances, "revenue");
  const expense = sumByType(finances, "expense");
  const profit = revenue - expense;
  const reflectionText = reflection?.good_points?.trim() || "";

  return (
    <div className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <MikkeStatusBadge tone="success" className="rounded-full px-2 py-0.5 text-[10px]">終了</MikkeStatusBadge>
        <p className="text-xs font-semibold text-[var(--mikke-muted)]">{formatMonthDayWeekday(event.event_date)}</p>
      </div>
      <Link href={`/marketnote/${event.id}`} className="mt-2 block truncate text-base font-bold text-[var(--mikke-text)]">
        {event.title}
      </Link>

      <div className="mt-3 flex items-center justify-between gap-2 text-xs font-semibold text-[var(--mikke-text-soft)]">
        <span className="min-w-0 flex-1 truncate">
          売上 {formatYen(revenue)}　経費 {formatYen(expense)}
          <span className="font-bold text-[var(--mikke-success)]">利益 {formatYen(profit)}</span>
        </span>
        <Link href={`/marketnote/finance?eventId=${event.id}`} aria-label="収支を編集" className="shrink-0 text-[var(--mikke-muted)]">
          <Edit3 size={15} />
        </Link>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold text-[var(--mikke-text)]">振り返り</p>
          <div className="flex items-center gap-2 text-[var(--mikke-muted)]">
            {reflectionText ? (
              <button type="button" onClick={onToggleReflection} aria-label="振り返りを開閉">
                <ChevronDown size={15} className={expanded ? "rotate-180 transition-transform" : "transition-transform"} />
              </button>
            ) : null}
            <Link href={`/marketnote/${event.id}#reflection`} aria-label="振り返りを編集">
              <Edit3 size={15} />
            </Link>
          </div>
        </div>
        <p className={`mt-1 text-xs leading-6 text-[var(--mikke-text-soft)] ${expanded ? "" : "line-clamp-2"}`}>
          {reflectionText || "まだ振り返りが記録されていません。"}
        </p>
      </div>

      <Link
        href={`/marketnote/${event.id}`}
        className="mt-3 inline-flex items-center text-xs font-bold text-[var(--mikke-accent)]"
      >
        詳細を見る
      </Link>
    </div>
  );
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
  let cursor = new Date(gridStart);
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

function sumByType(finances: MarketFinancialRecord[], type: "revenue" | "expense") {
  return finances.filter((record) => record.record_type === type).reduce((total, record) => total + Number(record.amount), 0);
}

function sumProfit(finances: MarketFinancialRecord[]) {
  return sumByType(finances, "revenue") - sumByType(finances, "expense");
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

function paymentLabel(payment: PaymentState) {
  if (payment === "paid") return "支払済";
  if (payment === "unpaid") return "未払い";
  return "不要";
}
