"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Edit3,
  Plus
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AuthGate, useAuth } from "@/components/AuthGate";
import { formatDate, formatMonthDay, formatYen } from "@/lib/format";
import { listCheckItems, listFinancialRecords, listMarketEvents, listReflections, updateMarketEventStatus } from "@/lib/marketnote";
import type { MarketCheckItem, MarketEvent, MarketFinancialRecord, MarketReflection } from "@/types/database";

const weekDays = ["日", "月", "火", "水", "木", "金", "土"];

type PaymentState = "paid" | "unpaid" | "not_required";
type EventSummary = {
  event: MarketEvent;
  checks: MarketCheckItem[];
  finances: MarketFinancialRecord[];
  reflection: MarketReflection | null;
};

type EventMeta = {
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
};

const statusMenuOptions: Array<{ label: string; value: MarketEvent["status"] }> = [
  { label: "検討中", value: "planned" },
  { label: "出店確定", value: "preparing" },
  { label: "終了", value: "completed" }
];

function HomeContent() {
  const router = useRouter();
  const { profile } = useAuth();
  const [events, setEvents] = useState<MarketEvent[]>([]);
  const [checksByEvent, setChecksByEvent] = useState<Record<string, MarketCheckItem[]>>({});
  const [finances, setFinances] = useState<MarketFinancialRecord[]>([]);
  const [reflections, setReflections] = useState<MarketReflection[]>([]);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));

  useEffect(() => {
    let active = true;

    async function load() {
      const nextEvents = await listMarketEvents(profile.id);
      const [nextFinances, nextReflections, checkPairs] = await Promise.all([
        listFinancialRecords(profile.id),
        listReflections(profile.id),
        Promise.all(nextEvents.map(async (event) => [event.id, await listCheckItems(profile.id, event.id)] as const))
      ]);

      if (!active) return;
      setEvents(nextEvents);
      setFinances(nextFinances);
      setReflections(nextReflections);

      const nextChecks = Object.fromEntries(checkPairs);
      setChecksByEvent(nextChecks);

      const firstEvent = [...nextEvents].sort((a, b) => a.event_date.localeCompare(b.event_date))[0];
      if (firstEvent) {
        const eventDate = parseDate(firstEvent.event_date);
        setVisibleMonth(startOfMonth(eventDate));
        setSelectedDate(firstEvent.event_date);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [profile.id]);

  const summaries = useMemo<EventSummary[]>(() => {
    return events.map((event) => ({
      event,
      checks: checksByEvent[event.id] ?? [],
      finances: finances.filter((row) => row.market_event_id === event.id),
      reflection: reflections.find((row) => row.market_event_id === event.id) ?? null
    }));
  }, [checksByEvent, events, finances, reflections]);

  const eventsByDate = useMemo(() => {
    return summaries.reduce<Record<string, EventSummary[]>>((acc, summary) => {
      acc[summary.event.event_date] = [...(acc[summary.event.event_date] ?? []), summary];
      return acc;
    }, {});
  }, [summaries]);

  const monthCells = useMemo(() => buildMonthCells(visibleMonth), [visibleMonth]);
  const selectedSummaries = eventsByDate[selectedDate] ?? [];
  const selectedDateHasActiveEvent = selectedSummaries.some((summary) => summary.event.status !== "completed");
  const dueSoon = useMemo(() => getDueSoon(summaries).slice(0, 3), [summaries]);
  const nextEvents = useMemo(() => {
    const today = toDateKey(new Date());
    return summaries
      .filter((summary) => summary.event.event_date >= today && summary.event.status !== "completed" && summary.event.status !== "cancelled")
      .sort((a, b) => a.event.event_date.localeCompare(b.event.event_date))
      .slice(0, 3);
  }, [summaries]);

  function moveMonth(diff: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + diff, 1));
  }

  function selectToday() {
    const today = new Date();
    setVisibleMonth(startOfMonth(today));
    setSelectedDate(toDateKey(today));
  }

  async function changeEventStatus(event: MarketEvent, status: MarketEvent["status"]) {
    const updated = await updateMarketEventStatus(profile, event, status);
    setEvents((current) => current.map((item) => item.id === updated.id ? updated : item));
  }

  return (
    <AppShell title="MarketNote" hideHeader>
      <div className="-mx-1 pb-1">
        <header className="mb-5 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-serif text-4xl italic leading-none text-[#f46a14]">M</span>
              <span className="font-serif text-3xl tracking-normal text-[#1f1b18]">MarketNote</span>
            </div>
            <button className="relative rounded-full p-2 text-[#1f1b18]" aria-label="通知">
              <Bell size={26} strokeWidth={1.8} />
              <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#f46a14]" />
            </button>
          </div>

          <div className="mt-6 grid grid-cols-[48px_1fr_48px_auto] items-center gap-3">
            <button className="grid h-10 place-items-center rounded-full text-[#5f5a55]" onClick={() => moveMonth(-1)} aria-label="前の月">
              <ChevronLeft size={26} />
            </button>
            <h1 className="text-center text-3xl font-semibold tracking-normal text-[#1f1b18]">{visibleMonth.getFullYear()}年{visibleMonth.getMonth() + 1}月</h1>
            <button className="grid h-10 place-items-center rounded-full text-[#5f5a55]" onClick={() => moveMonth(1)} aria-label="次の月">
              <ChevronRight size={26} />
            </button>
            <button onClick={selectToday} className="rounded-full border border-[#ded9d4] bg-white px-4 py-2 text-sm font-bold text-[#5f5a55] shadow-sm">
              今日
            </button>
          </div>
        </header>

        <section>
          <div className="grid grid-cols-7 pb-2 text-center text-sm font-bold text-[#1f1b18]">
            {weekDays.map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="overflow-hidden rounded-xl border border-[#eee9e4] bg-white">
            <div className="grid grid-cols-7">
              {monthCells.map((date) => {
                const key = toDateKey(date);
                const dayEvents = eventsByDate[key] ?? [];
                const summary = dayEvents[0];
                return (
                  <CalendarCell
                    key={key}
                    date={date}
                    currentMonth={date.getMonth() === visibleMonth.getMonth()}
                    selected={key === selectedDate}
                    summary={summary}
                    extraCount={Math.max(dayEvents.length - 1, 0)}
                    onSelect={() => setSelectedDate(key)}
                  />
                );
              })}
            </div>
          </div>
        </section>

        {selectedSummaries.length > 0 ? (
          <>
            <div className="space-y-3">
              {selectedSummaries.map((summary) => (
                summary.event.status === "completed" ? (
                  <CompletedEventCard key={summary.event.id} summary={summary} />
                ) : (
                  <UpcomingEventCard
                    key={summary.event.id}
                    summary={summary}
                    onOpen={() => router.push(`/marketnote/${summary.event.id}`)}
                    onStatusChange={(status) => changeEventStatus(summary.event, status)}
                  />
                )
              ))}
            </div>
            <AddAnotherEventLink selectedDate={selectedDate} />
          </>
        ) : (
          <EmptyDateCard selectedDate={selectedDate} />
        )}

        {selectedSummaries.length > 0 && !selectedDateHasActiveEvent ? null : (
          <section className="mt-5 grid grid-cols-2 gap-4">
            <div>
              <h2 className="mb-3 text-sm font-extrabold text-[#1f1b18]">やること（期限順）</h2>
              <div className="space-y-3">
                {dueSoon.length > 0 ? dueSoon.map(({ check, summary }) => (
                  <Link key={check.id} href={`/marketnote/${summary.event.id}`} className="grid grid-cols-[18px_1fr_auto] items-center gap-2 text-xs">
                    <Circle size={15} className="text-[#9a9089]" />
                    <span className="truncate font-semibold text-[#3b3530]">{check.title}</span>
                    <span className="font-bold text-[#f46a14]">{shortDate(check.due_date ?? summary.event.event_date)}</span>
                  </Link>
                )) : <p className="text-xs font-semibold text-[#9a9089]">未完了タスクはありません。</p>}
              </div>
            </div>
            <div>
              <h2 className="mb-3 text-sm font-extrabold text-[#1f1b18]">次回イベント</h2>
              <div className="space-y-2">
                {nextEvents.length > 0 ? nextEvents.map((summary) => {
                  const done = summary.checks.filter((check) => check.is_done).length;
                  return (
                    <Link key={summary.event.id} href={`/marketnote/${summary.event.id}`} className="grid grid-cols-[34px_1fr] gap-2 text-xs">
                      <span className="font-bold text-[#3b3530]">{shortDate(summary.event.event_date)}</span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-[#1f1b18]">{summary.event.title}</span>
                        <span className="mt-0.5 block truncate text-[#7b736d]">{statusLabel(summary.event.status)} / {paymentLabel(getPaymentState(summary))} / {done}/{summary.checks.length}</span>
                      </span>
                    </Link>
                  );
                }) : <p className="text-xs font-semibold text-[#9a9089]">次回イベントは未登録です。</p>}
              </div>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

function EmptyDateCard({ selectedDate }: { selectedDate: string }) {
  return (
    <section className="mt-4 rounded-2xl border border-[#eee9e4] bg-white p-5 shadow-[0_4px_16px_rgba(45,33,22,0.04)]">
      <p className="text-lg font-semibold tracking-normal text-[#1f1b18]">{dateWithWeekdayLabel(selectedDate)}</p>
      <p className="mt-2 text-sm font-bold text-[#8a817a]">この日の予定はありません</p>
      <Link
        href={`/marketnote/new?startDate=${selectedDate}`}
        className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#f3d0be] bg-white px-4 py-2 text-sm font-extrabold text-[#f46a14]"
      >
        <Plus size={16} strokeWidth={1.8} />
        この日に予定を追加
      </Link>
    </section>
  );
}

function AddAnotherEventLink({ selectedDate }: { selectedDate: string }) {
  return (
    <Link
      href={`/marketnote/new?startDate=${selectedDate}`}
      className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-extrabold text-[#f46a14]"
    >
      <Plus size={14} strokeWidth={1.8} />
      この日に別の予定を追加
    </Link>
  );
}

function CalendarCell({
  date,
  currentMonth,
  selected,
  summary,
  extraCount,
  onSelect
}: {
  date: Date;
  currentMonth: boolean;
  selected: boolean;
  summary?: EventSummary;
  extraCount: number;
  onSelect: () => void;
}) {
  const isCompleted = summary?.event.status === "completed";
  const totals = summary ? getTotals(summary.finances) : { revenue: 0, expense: 0, profit: 0 };
  const done = summary?.checks.filter((check) => check.is_done).length ?? 0;
  const payment = summary ? getPaymentState(summary) : "not_required";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative min-h-[82px] border-b border-r border-[#eee9e4] p-2 text-left transition last:border-r-0 ${
        selected ? "bg-[#fffaf7] ring-1 ring-inset ring-[#f46a14]" : "bg-white"
      } ${currentMonth ? "text-[#1f1b18]" : "text-[#aaa39d]"}`}
    >
      <div className="flex h-full flex-col">
        <span className={`text-sm font-semibold leading-none ${selected && !isCompleted ? "ml-auto grid h-6 w-6 place-items-center rounded-full bg-[#f46a14] text-white" : ""}`}>
          {date.getDate()}
        </span>

        {summary ? (
          isCompleted ? (
            <div className="mt-auto space-y-1">
              {totals.revenue || totals.expense ? (
                <>
                  <PhotoThumb className="h-7 w-full rounded-md" tone="green" />
                  <p className="truncate whitespace-nowrap text-[10px] font-extrabold leading-none text-[#15823b]">{formatYen(totals.profit)}</p>
                </>
              ) : (
                <>
                  <p className="truncate text-[10px] font-bold text-[#77706a]">終了</p>
                  <p className="truncate text-[10px] font-bold text-[#aaa39d]">未記録</p>
                </>
              )}
            </div>
          ) : (
            <div className="mt-auto space-y-1.5">
              <p className="truncate text-[10px] font-semibold leading-tight text-[#2f2a26]">{summary.event.title}</p>
              <div className="flex items-center justify-between gap-1">
                <PaymentChip payment={payment} short />
                <span className="whitespace-nowrap text-[10px] font-semibold text-[#3c3732]">{done}/{summary.checks.length}</span>
              </div>
            </div>
          )
        ) : null}
        <ExtraEventCount count={extraCount} />
      </div>
    </button>
  );
}

function ExtraEventCount({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <span className="absolute bottom-1.5 right-1.5 rounded-full bg-[#f3eee9] px-1.5 py-0.5 text-[10px] font-extrabold leading-none text-[#f46a14]">
      +{count}
    </span>
  );
}

function UpcomingEventCard({
  summary,
  onOpen,
  onStatusChange
}: {
  summary: EventSummary;
  onOpen: () => void;
  onStatusChange: (status: MarketEvent["status"]) => Promise<void>;
}) {
  const done = summary.checks.filter((check) => check.is_done).length;
  const progress = summary.checks.length ? Math.round((done / summary.checks.length) * 100) : 0;
  const payment = getPaymentState(summary);
  const eventMeta = parseEventMeta(summary.event);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);

  async function chooseStatus(status: MarketEvent["status"]) {
    if (status === summary.event.status || changingStatus) {
      setStatusMenuOpen(false);
      return;
    }

    setChangingStatus(true);
    try {
      await onStatusChange(status);
      setStatusMenuOpen(false);
    } finally {
      setChangingStatus(false);
    }
  }

  return (
    <section
      role="link"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onOpen();
      }}
      className="mt-4 grid cursor-pointer grid-cols-[68px_1fr] gap-4 rounded-2xl border border-[#eee9e4] bg-white p-4 shadow-[0_4px_16px_rgba(45,33,22,0.045)]"
    >
      <div className="border-r border-[#eee9e4] pr-3 text-center">
        <p className="text-2xl font-semibold text-[#1f1b18]">{shortDate(summary.event.event_date)}</p>
        <p className="mt-1 text-xs font-bold text-[#1f1b18]">{weekdayLabel(summary.event.event_date)}</p>
      </div>
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setStatusMenuOpen((current) => !current);
              }}
              className="rounded-full"
              aria-label="ステータスを変更"
              aria-expanded={statusMenuOpen}
            >
              <StatusChip status={summary.event.status} withChevron />
            </button>
            {statusMenuOpen ? (
              <div
                className="absolute left-0 top-8 z-20 w-32 overflow-hidden rounded-xl border border-[#e8dfd8] bg-white py-1 shadow-[0_8px_22px_rgba(45,33,22,0.12)]"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              >
                {statusMenuOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    disabled={changingStatus}
                    onClick={() => chooseStatus(option.value)}
                    className="block w-full px-3 py-2 text-left text-xs font-extrabold text-[#3b3530] hover:bg-[#fff7f2] disabled:opacity-50"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <Link
            href={`/marketnote/${summary.event.id}`}
            onClick={(event) => event.stopPropagation()}
            className="shrink-0 text-[#7b736d]"
            aria-label="詳細を開く"
          >
            <Edit3 size={16} />
          </Link>
        </div>
        <h2 className="mt-3 truncate text-lg font-bold tracking-normal text-[#1f1b18]">{summary.event.title}</h2>
        <p className="mt-2 truncate text-xs font-semibold text-[#5f5a55]">{eventDateRangeLabel(summary.event, eventMeta)} / {eventTimeLabel(eventMeta)}</p>
        <p className="mt-1 truncate text-xs font-semibold text-[#5f5a55]">{[summary.event.venue_name, summary.event.area].filter(Boolean).join(" / ") || "会場未設定"}</p>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="font-semibold text-[#3b3530]">支払い：<PaymentChip payment={payment} /></span>
          <span className="font-semibold text-[#3b3530]">タスク {done}/{summary.checks.length}</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#eee8e2]">
          <div className="h-full rounded-full bg-[#f46a14]" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </section>
  );
}

function CompletedEventCard({ summary }: { summary: EventSummary }) {
  const totals = getTotals(summary.finances);
  const reflection = summary.reflection?.public_summary || summary.reflection?.good_points || "振り返りはまだ未記録です。";

  return (
    <section className="mt-4 rounded-[22px] border border-[#eee9e4] bg-white p-4 shadow-[0_5px_18px_rgba(45,33,22,0.045)]">
      <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-[#d8d3cf]" />
      <div className="mb-3 flex items-center gap-3">
        <div className="flex items-center gap-3">
          <p className="text-3xl font-semibold tracking-normal text-[#1f1b18]">{shortDate(summary.event.event_date)}</p>
          <span className="rounded-full bg-[#f3f0ed] px-3 py-1 text-xs font-bold text-[#5f5a55]">終了</span>
        </div>
      </div>
      <h2 className="text-xl font-bold tracking-normal text-[#1f1b18]">{summary.event.title}</h2>

      <div className="mt-4 grid grid-cols-[1fr_1px_1fr_1px_1fr_auto] items-center rounded-2xl border border-[#eee9e4] bg-white p-2.5">
        <MoneyCell label="売上" value={totals.revenue} />
        <span className="h-10 bg-[#eee9e4]" />
        <MoneyCell label="経費" value={totals.expense} muted />
        <span className="h-10 bg-[#eee9e4]" />
        <MoneyCell label="利益" value={totals.profit} profit />
        <Edit3 size={18} className="ml-2 text-[#5f5a55]" />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-extrabold text-[#1f1b18]">振り返り</h3>
          <div className="flex items-center gap-3 text-[#5f5a55]">
            <ChevronDown size={18} />
            <Edit3 size={17} />
          </div>
        </div>
        <p className="mt-2 truncate text-sm font-semibold leading-6 text-[#2f2a26]">{reflection}</p>
      </div>

      <div className="mt-4">
        <h3 className="text-base font-extrabold text-[#1f1b18]">写真</h3>
        <div className="mt-3 grid grid-cols-[1fr_1fr_96px] gap-2.5">
          <PhotoThumb className="h-20 rounded-xl" tone="green" />
          <PhotoThumb className="h-20 rounded-xl" tone="warm" />
          <button className="grid h-20 place-items-center rounded-xl border border-[#f3d0be] bg-white text-[#f46a14]" aria-label="写真を追加">
            <Plus size={28} strokeWidth={1.7} />
          </button>
        </div>
        <p className="mt-2 text-right text-xs font-semibold text-[#1f1b18]">2/5 枚</p>
      </div>

      <div className="mt-4 border-t border-[#f0ebe6] pt-3">
        <Link href={`/marketnote/${summary.event.id}`} className="inline-flex items-center gap-2 text-sm font-extrabold text-[#f46a14]">
          詳細を見る <ChevronRight size={17} />
        </Link>
      </div>
    </section>
  );
}

function MoneyCell({ label, value, muted = false, profit = false }: { label: string; value: number; muted?: boolean; profit?: boolean }) {
  return (
    <div className="text-center">
      <p className="text-xs font-bold text-[#1f1b18]">{label}</p>
      <p className={`mt-1 text-base font-semibold ${profit ? "text-[#16833b]" : muted ? "text-[#6f6862]" : "text-[#1f1b18]"}`}>{formatYen(value)}</p>
    </div>
  );
}

function StatusChip({ status, withChevron = false }: { status: MarketEvent["status"]; withChevron?: boolean }) {
  const label = statusLabel(status);
  const tone = status === "preparing"
    ? "bg-[#fff0e7] text-[#f46a14]"
    : status === "planned"
      ? "bg-[#f1eeea] text-[#6f6862]"
      : status === "completed"
        ? "bg-[#f1eeea] text-[#6f6862]"
        : "bg-[#f1eeea] text-[#6f6862]";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${tone}`}>
      {label}{withChevron ? <ChevronDown size={14} /> : null}
    </span>
  );
}

function PaymentChip({ payment, short = false }: { payment: PaymentState; short?: boolean }) {
  const tone = payment === "paid"
    ? "border-[#8fd3a7] bg-[#eefaf1] text-[#16833b]"
    : payment === "unpaid"
      ? "border-[#f4b28d] bg-[#fff1e8] text-[#f46a14]"
      : "border-[#ded9d4] bg-[#f5f3f1] text-[#6f6862]";

  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[10px] font-bold leading-none ${tone}`}>
      {short ? shortPaymentLabel(payment) : paymentLabel(payment)}
    </span>
  );
}

function PhotoThumb({ className, tone }: { className: string; tone: "green" | "warm" }) {
  const background = tone === "green"
    ? "linear-gradient(160deg, rgba(255,255,255,.12), rgba(255,255,255,0) 35%), radial-gradient(circle at 28% 62%, #6b8f69 0 11%, transparent 12%), radial-gradient(circle at 62% 56%, #e7d8b6 0 9%, transparent 10%), linear-gradient(180deg, #b9d6c1 0 45%, #6f9b76 46% 100%)"
    : "linear-gradient(160deg, rgba(255,255,255,.18), rgba(255,255,255,0) 36%), radial-gradient(circle at 30% 62%, #8a6449 0 10%, transparent 11%), radial-gradient(circle at 66% 50%, #f2d6af 0 12%, transparent 13%), linear-gradient(180deg, #e6c69f 0 42%, #b9875f 43% 100%)";

  return <div className={`${className} border border-white/70 bg-cover bg-center shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]`} style={{ backgroundImage: background }} />;
}

function getPaymentState(summary: EventSummary): PaymentState {
  const paymentCheck = summary.checks.find((check) => check.title.includes("支払い"));
  if (paymentCheck) return paymentCheck.is_done ? "paid" : "unpaid";
  const eventPayments = summary.finances.filter((row) => row.record_type === "expense" && row.title.includes("出店"));
  if (eventPayments.length === 0) return "not_required";
  return eventPayments.every((row) => row.payment_status === "paid") ? "paid" : "unpaid";
}

function getTotals(finances: MarketFinancialRecord[]) {
  const revenue = finances.filter((row) => row.record_type === "revenue").reduce((sum, row) => sum + Number(row.amount), 0);
  const expense = finances.filter((row) => row.record_type === "expense").reduce((sum, row) => sum + Number(row.amount), 0);
  return { revenue, expense, profit: revenue - expense };
}

function getDueSoon(summaries: EventSummary[]) {
  return summaries
    .flatMap((summary) => summary.checks
      .filter((check) => !check.is_done)
      .map((check) => ({ check, summary })))
    .sort((a, b) => (a.check.due_date ?? a.summary.event.event_date).localeCompare(b.check.due_date ?? b.summary.event.event_date));
}

function parseEventMeta(event: MarketEvent): EventMeta {
  const note = event.private_note ?? "";
  return {
    endDate: matchNoteValue(note, "end_date"),
    startTime: matchNoteValue(note, "開始時間"),
    endTime: matchNoteValue(note, "終了時間")
  };
}

function matchNoteValue(note: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matched = note.match(new RegExp(`(?:^|\\n)${escaped}:\\s*([^\\n]+)`));
  return matched?.[1]?.trim() || null;
}

function eventDateRangeLabel(event: MarketEvent, meta: EventMeta) {
  const endDate = meta.endDate && meta.endDate !== event.event_date ? meta.endDate : null;
  if (!endDate) return formatDate(event.event_date);
  return `${formatDate(event.event_date)} - ${formatMonthDay(endDate)}`;
}

function eventTimeLabel(meta: EventMeta) {
  if (meta.startTime && meta.endTime) return `${meta.startTime} - ${meta.endTime}`;
  if (meta.startTime) return `${meta.startTime}開始`;
  if (meta.endTime) return `${meta.endTime}終了`;
  return "時間未設定";
}

function buildMonthCells(month: Date) {
  const start = startOfMonth(month);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  const first = new Date(start);
  first.setDate(start.getDate() - start.getDay());
  const last = new Date(end);
  last.setDate(end.getDate() + (6 - end.getDay()));
  const dayCount = Math.round((last.getTime() - first.getTime()) / 86400000) + 1;
  return Array.from({ length: dayCount }, (_, index) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + index));
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function parseDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shortDate(value: string) {
  const date = parseDate(value);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function weekdayLabel(value: string) {
  return ["日", "月", "火", "水", "木", "金", "土"][parseDate(value).getDay()];
}

function dateWithWeekdayLabel(value: string) {
  const date = parseDate(value);
  return `${date.getMonth() + 1}/${date.getDate()}（${weekdayLabel(value)}）`;
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

function shortPaymentLabel(payment: PaymentState) {
  if (payment === "paid") return "支払済";
  if (payment === "unpaid") return "未払い";
  return "不要";
}

export default function HomePage() {
  return (
    <AuthGate>
      <HomeContent />
    </AuthGate>
  );
}
