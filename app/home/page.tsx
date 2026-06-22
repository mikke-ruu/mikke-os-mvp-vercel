"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bell, CalendarDays, Check, ChevronRight, Circle, Clock, MapPin, Minus, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AuthGate, useAuth } from "@/components/AuthGate";
import { EmptyState } from "@/components/EmptyState";
import { formatDate } from "@/lib/format";
import { listCheckItems, listFinancialRecords, listMarketEvents } from "@/lib/marketnote";
import type { MarketCheckItem, MarketEvent, MarketFinancialRecord } from "@/types/database";

type StatusFilter = "all" | "confirmed" | "unpaid" | "considering" | "completed";

const filterLabels: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "confirmed", label: "出店確定" },
  { value: "unpaid", label: "未払い" },
  { value: "considering", label: "検討中" },
  { value: "completed", label: "終了" }
];

function HomeContent() {
  const { profile } = useAuth();
  const [events, setEvents] = useState<MarketEvent[]>([]);
  const [checksByEvent, setChecksByEvent] = useState<Record<string, MarketCheckItem[]>>({});
  const [finances, setFinances] = useState<MarketFinancialRecord[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    let active = true;

    async function load() {
      const nextEvents = await listMarketEvents(profile.id);
      const [nextFinances, checkPairs] = await Promise.all([
        listFinancialRecords(profile.id),
        Promise.all(nextEvents.map(async (event) => [event.id, await listCheckItems(profile.id, event.id)] as const))
      ]);

      if (!active) return;
      setEvents(nextEvents);
      setFinances(nextFinances);
      setChecksByEvent(Object.fromEntries(checkPairs));
    }

    load();
    return () => {
      active = false;
    };
  }, [profile.id]);

  const upcomingEvents = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return [...events]
      .filter((event) => event.status !== "completed" && event.status !== "cancelled" && event.event_date >= today)
      .sort((a, b) => a.event_date.localeCompare(b.event_date));
  }, [events]);

  const nextEvent = upcomingEvents[0] ?? [...events].sort((a, b) => b.event_date.localeCompare(a.event_date))[0];

  const dueSoonChecks = useMemo(() => {
    return Object.entries(checksByEvent)
      .flatMap(([eventId, checks]) => {
        const event = events.find((row) => row.id === eventId);
        return checks
          .filter((check) => !check.is_done)
          .map((check) => ({ check, event }))
          .filter((row): row is { check: MarketCheckItem; event: MarketEvent } => Boolean(row.event));
      })
      .sort((a, b) => (a.check.due_date ?? a.event.event_date).localeCompare(b.check.due_date ?? b.event.event_date))
      .slice(0, 4);
  }, [checksByEvent, events]);

  const filteredEvents = useMemo(() => {
    return upcomingEvents.filter((event) => {
      const checks = checksByEvent[event.id] ?? [];
      const payment = getPaymentState(event, checks, finances);
      if (filter === "all") return true;
      if (filter === "confirmed") return event.status === "preparing" || event.status === "planned";
      if (filter === "unpaid") return payment === "unpaid";
      if (filter === "considering") return event.status === "planned";
      return event.status === "completed";
    });
  }, [checksByEvent, filter, finances, upcomingEvents]);

  return (
    <AppShell title="MarketNote" subtitle="出店予定・準備・振り返り">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-extrabold text-[#e8612c]">MarketNote</p>
          <h2 className="mt-1 text-2xl font-black tracking-normal text-[#1f1b18]">出店管理</h2>
        </div>
        <button className="rounded-full border border-[#e8e1da] bg-white p-3 text-[#4a423c]" aria-label="通知">
          <Bell size={20} />
        </button>
      </div>

      {nextEvent ? (
        <section>
          <SectionHeader title="次の出店" href="/marketnote" />
          <NextEventCard event={nextEvent} checks={checksByEvent[nextEvent.id] ?? []} finances={finances} />
        </section>
      ) : (
        <EmptyState title="出店予定はまだありません" body="まずはイベント名と開催日だけ登録して、準備チェックを作りましょう。" />
      )}

      <section className="mt-5">
        <SectionHeader title="期限が近いチェック" />
        <div className="rounded-2xl border border-[#eceae5] bg-white px-4 py-2 shadow-sm">
          {dueSoonChecks.length > 0 ? (
            dueSoonChecks.map(({ check, event }) => <CheckRow key={check.id} check={check} event={event} />)
          ) : (
            <p className="py-4 text-sm font-semibold text-[#8a817a]">期限が近い未完了チェックはありません。</p>
          )}
        </div>
      </section>

      <section className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-[#1f1b18]">出店カード一覧</h2>
          <Link href="/marketnote/new" className="inline-flex items-center gap-1 text-sm font-extrabold text-[#e8612c]">
            <Plus size={16} /> 追加
          </Link>
        </div>
        <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
          {filterLabels.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={`shrink-0 rounded-full border px-4 py-2 text-xs font-extrabold ${
                filter === item.value ? "border-[#e8612c] bg-[#e8612c] text-white" : "border-[#e4ddd4] bg-white text-[#8a817a]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="grid gap-3">
          {filteredEvents.map((event) => (
            <EventCard key={event.id} event={event} checks={checksByEvent[event.id] ?? []} finances={finances} />
          ))}
        </div>
      </section>

      <Link href="/marketnote/new" className="mt-5 flex items-center justify-center gap-2 rounded-2xl border border-[#e8612c] bg-white px-4 py-4 font-extrabold text-[#e8612c]">
        <Plus size={20} /> 出店予定を追加
      </Link>
    </AppShell>
  );
}

function SectionHeader({ title, href }: { title: string; href?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-lg font-extrabold text-[#1f1b18]">{title}</h2>
      {href ? (
        <Link href={href} className="inline-flex items-center gap-1 text-xs font-bold text-[#9a9089]">
          すべて見る <ChevronRight size={14} />
        </Link>
      ) : null}
    </div>
  );
}

function NextEventCard({ event, checks, finances }: { event: MarketEvent; checks: MarketCheckItem[]; finances: MarketFinancialRecord[] }) {
  const done = checks.filter((check) => check.is_done).length;
  const percent = checks.length ? Math.round((done / checks.length) * 100) : 0;

  return (
    <Link href={`/marketnote/${event.id}`} className="block rounded-2xl border border-[#f2cdbd] bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap gap-2">
        <StatusBadge event={event} />
        <PaymentBadge payment={getPaymentState(event, checks, finances)} />
      </div>
      <h3 className="text-2xl font-black tracking-normal text-[#1f1b18]">{event.title}</h3>
      <div className="mt-3 grid gap-2 text-sm font-semibold text-[#4a423c]">
        <MetaRow icon={<CalendarDays size={16} />} text={formatDate(event.event_date)} />
        <MetaRow icon={<Clock size={16} />} text="時間未設定" />
        <MetaRow icon={<MapPin size={16} />} text={[event.venue_name, event.area].filter(Boolean).join("（") || "会場未設定"} />
      </div>
      <div className="mt-4 border-t border-[#f2efea] pt-4">
        <div className="mb-2 flex items-center justify-between text-xs font-bold">
          <span className="text-[#6b635c]">
            チェック <strong className="text-[#e8612c]">{done}</strong> / {checks.length} 完了
          </span>
          <span className="inline-flex items-center gap-1 text-[#9a9089]">
            タップで詳細へ <ChevronRight size={13} />
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#eee7df]">
          <div className="h-full rounded-full bg-[#e8612c]" style={{ width: `${percent}%` }} />
        </div>
      </div>
    </Link>
  );
}

function EventCard({ event, checks, finances }: { event: MarketEvent; checks: MarketCheckItem[]; finances: MarketFinancialRecord[] }) {
  const date = new Date(`${event.event_date}T00:00:00`);
  const remaining = checks.filter((check) => !check.is_done).length;

  return (
    <Link href={`/marketnote/${event.id}`} className="grid grid-cols-[54px_1fr_auto] items-center gap-3 rounded-2xl border border-[#eceae5] bg-white p-3 shadow-sm">
      <div className="grid h-14 w-14 place-items-center rounded-2xl border border-[#f6ddd0] bg-[#fceee7] text-[#c24e1e]">
        <span className="text-[10px] font-extrabold">{date.getMonth() + 1}月</span>
        <span className="-mt-2 text-2xl font-black">{date.getDate()}</span>
      </div>
      <div className="min-w-0">
        <h3 className="truncate text-[15px] font-black text-[#1f1b18]">{event.title}</h3>
        <p className="mt-1 truncate text-xs font-semibold text-[#9a9089]">{formatDate(event.event_date)} | {event.venue_name ?? "会場未設定"}</p>
        <p className={`mt-1 text-xs font-extrabold ${remaining ? "text-[#e8612c]" : "text-[#9a9089]"}`}>未完了チェック {remaining}件</p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <StatusBadge event={event} compact />
        <PaymentBadge payment={getPaymentState(event, checks, finances)} compact />
        <ChevronRight size={16} className="text-[#c2b9b0]" />
      </div>
    </Link>
  );
}

function CheckRow({ check, event }: { check: MarketCheckItem; event: MarketEvent }) {
  return (
    <Link href={`/marketnote/${event.id}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-[#f2efea] py-3 last:border-b-0">
      <span className="grid h-6 w-6 place-items-center rounded-full bg-[#e8612c] text-white">
        <Minus size={14} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-[#1f1b18]">{check.title}</span>
        <span className="block truncate text-xs font-semibold text-[#9a9089]">{event.title}</span>
      </span>
      <span className="text-xs font-extrabold text-[#e8612c]">{check.due_date ? `期限 ${shortDate(check.due_date)}` : `期限 ${shortDate(event.event_date)}`}</span>
    </Link>
  );
}

function MetaRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[#9a9089]">{icon}</span>
      <span className="min-w-0 truncate">{text}</span>
    </div>
  );
}

function StatusBadge({ event, compact = false }: { event: MarketEvent; compact?: boolean }) {
  const label = event.status === "completed" ? "終了" : event.status === "preparing" ? "出店確定" : event.status === "cancelled" ? "中止" : "検討中";
  const tone = event.status === "completed" ? "bg-[#f1eeea] text-[#8a817a] border-[#e4ddd4]" : event.status === "planned" ? "bg-[#eaf1fa] text-[#3a6fb0] border-[#d3e1f2]" : "bg-[#e6f1e7] text-[#2e7d46] border-[#cfe6d2]";
  return <span className={`inline-flex rounded-md border font-extrabold ${compact ? "px-2 py-1 text-[10px]" : "px-3 py-1 text-xs"} ${tone}`}>{label}</span>;
}

function PaymentBadge({ payment, compact = false }: { payment: "paid" | "unpaid" | "not_required"; compact?: boolean }) {
  const label = payment === "paid" ? "支払済" : payment === "not_required" ? "未登録" : "未払い";
  const tone = payment === "paid" ? "bg-[#e6f1e7] text-[#2e7d46] border-[#cfe6d2]" : payment === "not_required" ? "bg-[#f1eeea] text-[#8a817a] border-[#e4ddd4]" : "bg-[#fcebe7] text-[#d94a2f] border-[#f2cfc6]";
  return <span className={`inline-flex rounded-md border font-extrabold ${compact ? "px-2 py-1 text-[10px]" : "px-3 py-1 text-xs"} ${tone}`}>{label}</span>;
}

function getPaymentState(event: MarketEvent, checks: MarketCheckItem[], finances: MarketFinancialRecord[]): "paid" | "unpaid" | "not_required" {
  const paymentCheck = checks.find((check) => check.title.includes("支払い"));
  if (paymentCheck) return paymentCheck.is_done ? "paid" : "unpaid";
  const eventPayments = finances.filter((row) => row.market_event_id === event.id && row.record_type === "expense" && row.title.includes("出店"));
  if (eventPayments.length === 0) return "not_required";
  return eventPayments.every((row) => row.payment_status === "paid") ? "paid" : "unpaid";
}

function shortDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export default function HomePage() {
  return (
    <AuthGate>
      <HomeContent />
    </AuthGate>
  );
}
