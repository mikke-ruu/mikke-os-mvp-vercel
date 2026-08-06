"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Clock3, Edit3, MapPin, Plus } from "lucide-react";
import { HomeCalendar } from "@/components/marketnote/HomeCalendar";
import { MarketNoteShell } from "@/components/marketnote/MarketNoteShell";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import { AuthGate, useAuth } from "@/components/AuthGate";
import { formatDate } from "@/lib/format";
import {
  getGuestMarketNoteImportStats,
  hasAppliedEntryStatus,
  importGuestMarketNoteRecords,
  listCheckItems,
  listFinancialRecords,
  listMarketEvents,
  listReflections
} from "@/lib/marketnote";
import type { MarketCheckItem, MarketEvent, MarketFinancialRecord, MarketReflection } from "@/types/database";

type HomeTab = "calendar" | "list";
type ListTab = "confirmed" | "all";
type PaymentState = "paid" | "unpaid" | "not_required";
type EventSummary = {
  event: MarketEvent;
  checks: MarketCheckItem[];
};
type GuestImportStats = ReturnType<typeof getGuestMarketNoteImportStats>;

function MarketNoteContent() {
  const { profile, isGuest } = useAuth();
  const [homeTab, setHomeTab] = useState<HomeTab>("calendar");
  const [events, setEvents] = useState<MarketEvent[]>([]);
  const [checksByEvent, setChecksByEvent] = useState<Record<string, MarketCheckItem[]>>({});
  const [financesByEvent, setFinancesByEvent] = useState<Record<string, MarketFinancialRecord[]>>({});
  const [reflectionsByEvent, setReflectionsByEvent] = useState<Record<string, MarketReflection | undefined>>({});
  const [activeTab, setActiveTab] = useState<ListTab>("confirmed");
  const [guestStats, setGuestStats] = useState<GuestImportStats | null>(null);

  const loadMarketNoteData = useCallback(async () => {
    const [nextEvents, allFinances, allReflections] = await Promise.all([
      listMarketEvents(profile.id),
      listFinancialRecords(profile.id),
      listReflections(profile.id)
    ]);
    const checkPairs = await Promise.all(
      nextEvents.map(async (event) => [event.id, await listCheckItems(profile.id, event.id)] as const)
    );

    setEvents(nextEvents);
    setChecksByEvent(Object.fromEntries(checkPairs));
    setFinancesByEvent(groupByEventId(allFinances));
    setReflectionsByEvent(Object.fromEntries(allReflections.map((reflection) => [reflection.market_event_id, reflection])));
    setGuestStats(getGuestMarketNoteImportStats());
  }, [profile.id]);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!active) return;
      await loadMarketNoteData();
    }

    load();
    return () => {
      active = false;
    };
  }, [loadMarketNoteData]);

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
    <MarketNoteShell isGuest={isGuest}>
      <div className="-mx-1 pb-2">
        {isGuest ? <GuestNotice /> : null}
        {!isGuest && guestStats && guestStats.events > 0 ? (
          <CloudImportNotice stats={guestStats} profile={profile} onImported={loadMarketNoteData} />
        ) : null}

        <div className="mb-4 flex items-center justify-between gap-2 px-1">
          <div className="inline-flex rounded-full border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-1">
            <SegmentButton active={homeTab === "calendar"} onClick={() => setHomeTab("calendar")}>
              カレンダー
            </SegmentButton>
            <SegmentButton active={homeTab === "list"} onClick={() => setHomeTab("list")}>
              一覧
            </SegmentButton>
          </div>
          <Link href="/marketnote/new" className="inline-flex items-center gap-1 rounded-full border border-[var(--mikke-primary-border)] bg-[var(--mikke-surface)] px-3 py-1.5 text-xs font-bold text-[var(--mikke-accent)]">
            <Plus size={15} strokeWidth={1.8} />
            追加
          </Link>
        </div>

        {homeTab === "calendar" ? (
          <HomeCalendar
            events={events}
            checksByEvent={checksByEvent}
            financesByEvent={financesByEvent}
            reflectionsByEvent={reflectionsByEvent}
          />
        ) : (
          <div>
            <div className="-mx-4 mb-4 border-b border-[var(--mikke-line)]">
              <div className="grid grid-cols-2 text-center text-sm font-bold">
                <TabButton active={activeTab === "confirmed"} onClick={() => setActiveTab("confirmed")}>
                  出店確定
                </TabButton>
                <TabButton active={activeTab === "all"} onClick={() => setActiveTab("all")}>
                  すべて
                </TabButton>
              </div>
            </div>

            <div className="mb-4 px-1">
              <span className="text-sm font-semibold text-[var(--mikke-text-soft)]">日付が近い順</span>
            </div>

            {filtered.length > 0 ? (
              <div className="space-y-3">
                {filtered.map((summary) => (
                  <EventListCard key={summary.event.id} summary={summary} />
                ))}
              </div>
            ) : (
              <MikkeEmptyState title="表示できる予定がありません" helper="出店予定を追加すると、ここに日付順で表示されます。" />
            )}
          </div>
        )}
      </div>
    </MarketNoteShell>
  );
}

function GuestNotice() {
  return (
    <div className="mb-4 rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] px-4 py-3 text-xs font-bold leading-5 text-[var(--mikke-text-soft)]">
      ログインなしですぐ使えます。記録はこのブラウザに保存され、同じアイコン・同じブラウザから続きが見られます。
      <Link href="/login?next=/marketnote" className="ml-2 text-[var(--mikke-accent)]">
        ログインしてクラウド保存
      </Link>
    </div>
  );
}

function CloudImportNotice({
  stats,
  profile,
  onImported
}: {
  stats: GuestImportStats;
  profile: Parameters<typeof importGuestMarketNoteRecords>[0];
  onImported: () => Promise<void>;
}) {
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");

  async function importRecords() {
    setImporting(true);
    setMessage("");

    try {
      const result = await importGuestMarketNoteRecords(profile);
      await onImported();
      setMessage(`${result.events}件の出店予定をクラウドへ保存しました。これからはログインした状態で続きが見られます。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "クラウド保存に失敗しました。端末内の記録は残っているので、時間をおいてもう一度お試しください。");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="mb-4 rounded-2xl border border-[var(--mikke-primary-border)] bg-[var(--mikke-surface)] px-4 py-3 text-xs font-bold leading-5 text-[var(--mikke-text-soft)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p>
          このブラウザに保存されたMarketNote記録があります。
          <span className="ml-1 text-[var(--mikke-accent)]">出店予定 {stats.events}件</span>
          <span className="mt-1 block text-[var(--mikke-muted)]">
            クラウド保存が完了するまで、端末内のゲスト記録は残ります。
          </span>
        </p>
        <button
          type="button"
          onClick={importRecords}
          disabled={importing}
          className="rounded-full bg-[var(--mikke-accent)] px-4 py-2 text-xs font-extrabold text-[var(--mikke-surface)] disabled:opacity-50"
        >
          {importing ? "保存中..." : "クラウドへ保存する"}
        </button>
      </div>
      {message ? <p className="mt-2 text-[var(--mikke-muted)]">{message}</p> : null}
    </div>
  );
}

function groupByEventId(records: MarketFinancialRecord[]) {
  const map: Record<string, MarketFinancialRecord[]> = {};
  for (const record of records) {
    if (!record.market_event_id) continue;
    if (!map[record.market_event_id]) map[record.market_event_id] = [];
    map[record.market_event_id].push(record);
  }
  return map;
}

function SegmentButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
        active ? "bg-[var(--mikke-accent)] text-white" : "text-[var(--mikke-text-soft)]"
      }`}
    >
      {children}
    </button>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative pb-3 pt-1 transition ${active ? "text-[var(--mikke-accent)]" : "text-[var(--mikke-text)]"}`}
    >
      {children}
      {active ? <span className="absolute inset-x-0 bottom-[-1px] mx-auto h-0.5 w-full rounded-full bg-[var(--mikke-accent)]" /> : null}
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
      className="block rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4 shadow-[0_5px_16px_rgba(45,33,22,0.045)] transition hover:border-[var(--mikke-primary-border)]"
    >
      <div className="flex items-start justify-between gap-3">
        <StatusChip status={event.status} applied={hasAppliedEntryStatus(event.private_note)} />
        <Edit3 size={17} strokeWidth={1.6} className="mt-1 shrink-0 text-[var(--mikke-muted)]" />
      </div>

      <h2 className="mt-3 truncate text-xl font-bold tracking-normal text-[var(--mikke-text)]">{event.title}</h2>

      <div className="mt-3 space-y-1.5">
        <p className="flex items-center gap-2 truncate text-sm font-semibold text-[var(--mikke-muted)]">
          <Clock3 size={15} strokeWidth={1.7} className="shrink-0 text-[var(--mikke-muted)]" />
          <span className="truncate">{formatDate(event.event_date)} 10:00 - 17:00</span>
        </p>
        <p className="flex items-center gap-2 truncate text-sm font-semibold text-[var(--mikke-muted)]">
          <MapPin size={15} strokeWidth={1.7} className="shrink-0 text-[var(--mikke-muted)]" />
          <span className="truncate">{[event.venue_name, event.area].filter(Boolean).join(" / ") || "会場未設定"}</span>
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-xs">
        <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--mikke-text-soft)]">
          支払い：
          <PaymentChip payment={payment} />
        </span>
        <span className="whitespace-nowrap font-semibold text-[var(--mikke-text-soft)]">タスク {done}/{checks.length}</span>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--mikke-line-soft)]">
        <div className="h-full rounded-full bg-[var(--mikke-accent)]" style={{ width: `${progress}%` }} />
      </div>
    </Link>
  );
}

function StatusChip({ status, applied = false }: { status: MarketEvent["status"]; applied?: boolean }) {
  const showApplied = applied && status === "planned";
  return (
    <MikkeStatusBadge tone={showApplied || status === "preparing" ? "primary" : "muted"} className="rounded-full py-1">
      {showApplied ? "申込済み" : statusLabel(status)}
      <ChevronDown size={14} strokeWidth={1.7} />
    </MikkeStatusBadge>
  );
}

function PaymentChip({ payment }: { payment: PaymentState }) {
  const tone = payment === "paid" ? "success" : payment === "unpaid" ? "primary" : "muted";
  return <MikkeStatusBadge tone={tone} className="rounded-full px-2 py-0.5 text-[10px] leading-none">{paymentLabel(payment)}</MikkeStatusBadge>;
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
    <AuthGate allowGuest>
      <MarketNoteContent />
    </AuthGate>
  );
}
