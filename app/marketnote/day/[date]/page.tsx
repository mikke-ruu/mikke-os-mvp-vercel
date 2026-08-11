"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, Clock3, MapPin, Plus } from "lucide-react";
import { AuthGate, useAuth } from "@/components/AuthGate";
import { MarketNoteShell } from "@/components/marketnote/MarketNoteShell";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { formatYen } from "@/lib/format";
import { hasAppliedEntryStatus, listCheckItems, listFinancialRecords, listMarketEvents } from "@/lib/marketnote";
import type { MarketCheckItem, MarketEvent, MarketFinancialRecord } from "@/types/database";

function MarketNoteDayContent() {
  const params = useParams<{ date: string }>();
  const { profile, isGuest } = useAuth();
  const dateKey = params.date;
  const validDate = isDateKey(dateKey);
  const [events, setEvents] = useState<MarketEvent[]>([]);
  const [checksByEvent, setChecksByEvent] = useState<Record<string, MarketCheckItem[]>>({});
  const [financesByEvent, setFinancesByEvent] = useState<Record<string, MarketFinancialRecord[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!validDate) {
        setLoading(false);
        return;
      }
      const [allEvents, allFinances] = await Promise.all([
        listMarketEvents(profile.id),
        listFinancialRecords(profile.id)
      ]);
      const dayEvents = allEvents
        .filter((event) => event.event_date === dateKey)
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
      const checkPairs = await Promise.all(
        dayEvents.map(async (event) => [event.id, await listCheckItems(profile.id, event.id)] as const)
      );
      if (!active) return;
      setEvents(dayEvents);
      setChecksByEvent(Object.fromEntries(checkPairs));
      setFinancesByEvent(groupByEventId(allFinances));
      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [dateKey, profile.id, validDate]);

  const dateLabel = useMemo(() => validDate ? formatDateKey(dateKey) : "日付を確認できません", [dateKey, validDate]);
  const addHref = validDate ? `/marketnote/new?startDate=${dateKey}` : "/marketnote/new";

  return (
    <MarketNoteShell title="その日の予定" subtitle={dateLabel} isGuest={isGuest} addHref={addHref}>
      <div className="mx-auto w-full max-w-2xl pb-3">
        <header className="mb-4 grid grid-cols-[44px_1fr_44px] items-center border-b border-[var(--mikke-line)] pb-3">
          <Link href="/marketnote" aria-label="カレンダーに戻る" className="grid h-11 w-11 place-items-center rounded-full text-[var(--mikke-text)]">
            <ChevronLeft size={23} strokeWidth={1.8} />
          </Link>
          <div className="min-w-0 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--mikke-blue)]" style={{ fontFamily: "var(--mikke-font-display)" }}>DAY</p>
            <h1 className="mt-1 truncate text-lg font-bold text-[var(--mikke-text)]">{dateLabel}</h1>
          </div>
          <span />
        </header>

        {!validDate ? (
          <MikkeEmptyState title="日付を確認できません" helper="カレンダーから日付を選び直してください。" />
        ) : loading ? (
          <MikkeEmptyState title="予定を読み込んでいます" />
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-[var(--mikke-text)]">{events.length > 0 ? `${events.length}件の予定` : "予定はありません"}</p>
              <Link href={addHref} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-[var(--mikke-orange)] px-3.5 text-xs font-bold text-white">
                <Plus size={16} />
                この日に追加
              </Link>
            </div>

            {events.length > 0 ? (
              <div className="space-y-3">
                {events.map((event) => (
                  <DayEventCard
                    key={event.id}
                    event={event}
                    checks={checksByEvent[event.id] ?? []}
                    finances={financesByEvent[event.id] ?? []}
                  />
                ))}
              </div>
            ) : (
              <MikkeEmptyState title="この日の予定はありません" helper="「この日に追加」から、日付を選び直さずに登録できます。" />
            )}
          </>
        )}
      </div>
    </MarketNoteShell>
  );
}

function DayEventCard({ event, checks, finances }: { event: MarketEvent; checks: MarketCheckItem[]; finances: MarketFinancialRecord[] }) {
  const done = checks.filter((check) => check.is_done).length;
  const revenue = finances.filter((record) => record.record_type === "revenue" && record.payment_status === "paid").reduce((sum, record) => sum + Number(record.amount), 0);
  const expense = finances.filter((record) => record.record_type === "expense" && record.payment_status === "paid").reduce((sum, record) => sum + Number(record.amount), 0);
  const status = hasAppliedEntryStatus(event.private_note) && event.status === "planned" ? "申込済み" : statusLabel(event.status);

  return (
    <Link href={`/marketnote/${event.id}`} className="block rounded-xl border border-[var(--mikke-line)] bg-white p-4 transition hover:border-[var(--mikke-blue)]">
      <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClass(event)}`}>{status}</span>
      <h2 className="mt-2 text-lg font-bold text-[var(--mikke-text)]">{event.title}</h2>
      {event.venue_name || event.area ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--mikke-muted)]">
          <MapPin size={14} className="shrink-0" />
          <span className="truncate">{[event.venue_name, event.area].filter(Boolean).join(" / ")}</span>
        </p>
      ) : null}
      <div className="mt-3 flex items-center justify-between gap-3 text-xs font-semibold text-[var(--mikke-text-soft)]">
        <span className="inline-flex items-center gap-1.5"><Clock3 size={14} />タスク {done}/{checks.length}</span>
        {finances.length > 0 ? <span>収支 {formatYen(revenue - expense)}</span> : <span>収支未記録</span>}
      </div>
    </Link>
  );
}

function statusClass(event: MarketEvent) {
  if (event.status === "completed") return "bg-[var(--mikke-green)] text-[var(--mikke-text)]";
  if (event.status === "preparing") return "bg-[var(--mikke-orange)] text-white";
  if (hasAppliedEntryStatus(event.private_note) && event.status === "planned") return "bg-[var(--mikke-yellow)] text-[var(--mikke-text)]";
  if (event.status === "planned") return "bg-[var(--mikke-blue)] text-white";
  return "border border-[var(--mikke-line)] text-[var(--mikke-muted)]";
}

function statusLabel(status: MarketEvent["status"]) {
  if (status === "completed") return "終了";
  if (status === "preparing") return "確定";
  if (status === "cancelled") return "中止";
  return "検討中";
}

function groupByEventId(records: MarketFinancialRecord[]) {
  const result: Record<string, MarketFinancialRecord[]> = {};
  for (const record of records) {
    if (!record.market_event_id) continue;
    if (!result[record.market_event_id]) result[record.market_event_id] = [];
    result[record.market_event_id].push(record);
  }
  return result;
}

function isDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function formatDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
}

export default function MarketNoteDayPage() {
  return (
    <AuthGate allowGuest>
      <MarketNoteDayContent />
    </AuthGate>
  );
}
