"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Clock3, Edit3, Filter, MapPin, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AuthGate, useAuth } from "@/components/AuthGate";
import { formatDate } from "@/lib/format";
import { listCheckItems, listMarketEvents } from "@/lib/marketnote";
import type { MarketCheckItem, MarketEvent } from "@/types/database";

type ListTab = "confirmed" | "all";
type PaymentState = "paid" | "unpaid" | "not_required";
type EventSummary = {
  event: MarketEvent;
  checks: MarketCheckItem[];
};

function MarketNoteContent() {
  const { profile } = useAuth();
  const [events, setEvents] = useState<MarketEvent[]>([]);
  const [checksByEvent, setChecksByEvent] = useState<Record<string, MarketCheckItem[]>>({});
  const [activeTab, setActiveTab] = useState<ListTab>("confirmed");

  useEffect(() => {
    let active = true;

    async function load() {
      const nextEvents = await listMarketEvents(profile.id);
      const checkPairs = await Promise.all(
        nextEvents.map(async (event) => [event.id, await listCheckItems(profile.id, event.id)] as const)
      );

      if (!active) return;
      setEvents(nextEvents);
      setChecksByEvent(Object.fromEntries(checkPairs));
    }

    load();
    return () => {
      active = false;
    };
  }, [profile.id]);

  const summaries = useMemo<EventSummary[]>(() => {
    return events.map((event) => ({
      event,
      checks: checksByEvent[event.id] ?? []
    }));
  }, [checksByEvent, events]);

  const filtered = useMemo(() => {
    return summaries
      .filter(({ event }) => event.status !== "completed" && event.status !== "cancelled")
      .filter(({ event }) => activeTab === "all" || event.status === "preparing")
      .sort((a, b) => a.event.event_date.localeCompare(b.event.event_date));
  }, [activeTab, summaries]);

  return (
    <AppShell title="MarketNote" hideHeader>
      <div className="-mx-1 pb-2">
        <header className="mb-5 pt-2">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-semibold tracking-normal text-[#1f1b18]">一覧</h1>
            <button className="grid h-11 w-11 place-items-center rounded-full text-[#f46a14]" aria-label="フィルター">
              <Filter size={25} strokeWidth={1.7} />
            </button>
          </div>
        </header>

        <div className="-mx-4 mb-4 border-b border-[#eee9e4]">
          <div className="grid grid-cols-2 text-center text-sm font-bold">
            <TabButton active={activeTab === "confirmed"} onClick={() => setActiveTab("confirmed")}>
              出店確定
            </TabButton>
            <TabButton active={activeTab === "all"} onClick={() => setActiveTab("all")}>
              すべて
            </TabButton>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between px-1">
          <button className="inline-flex items-center gap-2 text-sm font-semibold text-[#3b3530]" type="button">
            日付が近い順
            <ChevronDown size={17} strokeWidth={1.7} />
          </button>
          <Link href="/marketnote/new" className="inline-flex items-center gap-1 rounded-full border border-[#f3d0be] bg-white px-3 py-1.5 text-xs font-bold text-[#f46a14]">
            <Plus size={15} strokeWidth={1.8} />
            追加
          </Link>
        </div>

        {filtered.length > 0 ? (
          <div className="space-y-3">
            {filtered.map((summary) => (
              <EventListCard key={summary.event.id} summary={summary} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-[#eee9e4] bg-white p-6 text-center shadow-[0_4px_16px_rgba(45,33,22,0.04)]">
            <p className="text-sm font-bold text-[#1f1b18]">表示できる予定がありません</p>
            <p className="mt-2 text-xs font-semibold leading-5 text-[#8a817a]">出店予定を追加すると、ここに日付順で表示されます。</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative pb-3 pt-1 transition ${active ? "text-[#f46a14]" : "text-[#1f1b18]"}`}
    >
      {children}
      {active ? <span className="absolute inset-x-0 bottom-[-1px] mx-auto h-0.5 w-full rounded-full bg-[#f46a14]" /> : null}
    </button>
  );
}

function EventListCard({ summary }: { summary: EventSummary }) {
  const { event, checks } = summary;
  const done = checks.filter((check) => check.is_done).length;
  const progress = checks.length ? Math.round((done / checks.length) * 100) : 0;
  const payment = getPaymentState(checks);

  return (
    <Link
      href={`/marketnote/${event.id}`}
      className="block rounded-2xl border border-[#eee9e4] bg-white p-4 shadow-[0_5px_16px_rgba(45,33,22,0.045)] transition hover:border-[#f3d0be]"
    >
      <div className="flex items-start justify-between gap-3">
        <StatusChip status={event.status} />
        <Edit3 size={17} strokeWidth={1.6} className="mt-1 shrink-0 text-[#7b736d]" />
      </div>

      <h2 className="mt-3 truncate text-xl font-bold tracking-normal text-[#1f1b18]">{event.title}</h2>

      <div className="mt-3 space-y-1.5">
        <p className="flex items-center gap-2 truncate text-sm font-semibold text-[#5f5a55]">
          <Clock3 size={15} strokeWidth={1.7} className="shrink-0 text-[#7b736d]" />
          <span className="truncate">{formatDate(event.event_date)} 10:00 - 17:00</span>
        </p>
        <p className="flex items-center gap-2 truncate text-sm font-semibold text-[#5f5a55]">
          <MapPin size={15} strokeWidth={1.7} className="shrink-0 text-[#7b736d]" />
          <span className="truncate">{[event.venue_name, event.area].filter(Boolean).join(" / ") || "会場未設定"}</span>
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-xs">
        <span className="inline-flex items-center gap-1.5 font-semibold text-[#3b3530]">
          支払い：
          <PaymentChip payment={payment} />
        </span>
        <span className="whitespace-nowrap font-semibold text-[#3b3530]">タスク {done}/{checks.length}</span>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#eee8e2]">
        <div className="h-full rounded-full bg-[#f46a14]" style={{ width: `${progress}%` }} />
      </div>
    </Link>
  );
}

function StatusChip({ status }: { status: MarketEvent["status"] }) {
  const tone = status === "preparing"
    ? "bg-[#fff0e7] text-[#f46a14]"
    : status === "planned"
      ? "bg-[#f1eeea] text-[#6f6862]"
      : "bg-[#f1eeea] text-[#6f6862]";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${tone}`}>
      {statusLabel(status)}
      <ChevronDown size={14} strokeWidth={1.7} />
    </span>
  );
}

function PaymentChip({ payment }: { payment: PaymentState }) {
  const tone = payment === "paid"
    ? "border-[#8fd3a7] bg-[#eefaf1] text-[#16833b]"
    : payment === "unpaid"
      ? "border-[#f4b28d] bg-[#fff1e8] text-[#f46a14]"
      : "border-[#ded9d4] bg-[#f5f3f1] text-[#6f6862]";

  return <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold leading-none ${tone}`}>{paymentLabel(payment)}</span>;
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

export default function MarketNotePage() {
  return (
    <AuthGate>
      <MarketNoteContent />
    </AuthGate>
  );
}
