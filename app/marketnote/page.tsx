"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Clock3, Edit3, MapPin, X } from "lucide-react";
import { HomeCalendar } from "@/components/marketnote/HomeCalendar";
import { MarketNoteShell } from "@/components/marketnote/MarketNoteShell";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { AuthGate, useAuth } from "@/components/AuthGate";
import { formatDate, toDateKey } from "@/lib/format";
import {
  getGuestMarketNoteImportStats,
  hasAppliedEntryStatus,
  importGuestMarketNoteRecords,
  listCheckItems,
  listFinancialRecords,
  listMarketEvents,
  listReflections,
  saveEventPaymentRecord,
  toggleCheckItem,
  updateMarketEventWorkflowStatus,
  type MarketEventWorkflowStatus
} from "@/lib/marketnote";
import { listMarketNotePhotoPreviews, retryPendingMarketNotePhotoCleanup, type MarketNotePhotoPreviewMap } from "@/lib/marketnote-photos";
import type { MarketCheckItem, MarketEvent, MarketFinancialRecord, MarketReflection } from "@/types/database";

type HomeTab = "calendar" | "list";
type ListTab = "upcoming" | "past";
type PaymentState = "paid" | "unpaid" | "not_required";
type EventSummary = {
  event: MarketEvent;
  checks: MarketCheckItem[];
  finances: MarketFinancialRecord[];
};
type GuestImportStats = ReturnType<typeof getGuestMarketNoteImportStats>;

function MarketNoteContent() {
  const { profile, isGuest } = useAuth();
  const [homeTab, setHomeTab] = useState<HomeTab>("calendar");
  const [selectedDateForAdd, setSelectedDateForAdd] = useState(() => toDateKey(new Date()));
  const [events, setEvents] = useState<MarketEvent[]>([]);
  const [checksByEvent, setChecksByEvent] = useState<Record<string, MarketCheckItem[]>>({});
  const [financesByEvent, setFinancesByEvent] = useState<Record<string, MarketFinancialRecord[]>>({});
  const [reflectionsByEvent, setReflectionsByEvent] = useState<Record<string, MarketReflection>>({});
  const [photoPreviewsByEvent, setPhotoPreviewsByEvent] = useState<MarketNotePhotoPreviewMap>({});
  const [activeTab, setActiveTab] = useState<ListTab>("upcoming");
  const [guestStats, setGuestStats] = useState<GuestImportStats | null>(null);
  const [photoCleanupPending, setPhotoCleanupPending] = useState(false);
  const [photoCleanupBusy, setPhotoCleanupBusy] = useState(false);

  const loadMarketNoteData = useCallback(async () => {
    const [nextEvents, allFinances, reflections] = await Promise.all([
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
    setReflectionsByEvent(Object.fromEntries(reflections.map((reflection) => [reflection.market_event_id, reflection])));
    setGuestStats(getGuestMarketNoteImportStats());

    try {
      const todayKey = toDateKey(new Date());
      const pastEventIds = nextEvents.filter((event) => event.event_date < todayKey).map((event) => event.id);
      setPhotoPreviewsByEvent(await listMarketNotePhotoPreviews(profile, pastEventIds));
    } catch {
      // The schedule remains usable if a signed photo preview cannot be loaded.
      setPhotoPreviewsByEvent({});
    }
  }, [profile]);

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

  const retryPhotoCleanup = useCallback(async () => {
    setPhotoCleanupBusy(true);
    try {
      setPhotoCleanupPending(await retryPendingMarketNotePhotoCleanup(profile));
    } finally {
      setPhotoCleanupBusy(false);
    }
  }, [profile]);

  useEffect(() => {
    void retryPhotoCleanup();
  }, [retryPhotoCleanup]);

  const summaries = useMemo<EventSummary[]>(() => {
    return events.map((event) => ({
      event,
      checks: checksByEvent[event.id] ?? [],
      finances: financesByEvent[event.id] ?? []
    }));
  }, [checksByEvent, events, financesByEvent]);

  const filtered = useMemo(() => {
    const todayKey = toDateKey(new Date());
    return summaries
      .filter(({ event }) => activeTab === "upcoming" ? event.event_date >= todayKey : event.event_date < todayKey)
      .sort((a, b) => activeTab === "upcoming"
        ? a.event.event_date.localeCompare(b.event.event_date)
        : b.event.event_date.localeCompare(a.event.event_date));
  }, [activeTab, summaries]);

  async function changeCalendarStatus(event: MarketEvent, workflow: MarketEventWorkflowStatus) {
    const updated = await updateMarketEventWorkflowStatus(profile, event, workflow);
    setEvents((current) => current.map((item) => item.id === updated.id ? updated : item));
  }

  async function changeCalendarCheck(item: MarketCheckItem, nextValue: boolean) {
    await toggleCheckItem(profile, item, nextValue);
    setChecksByEvent((current) => ({
      ...current,
      [item.market_event_id]: (current[item.market_event_id] ?? []).map((check) => check.id === item.id ? { ...check, is_done: nextValue } : check)
    }));
  }

  async function changeCalendarPayment(event: MarketEvent, paymentStatus: "unpaid" | "paid") {
    const records = financesByEvent[event.id] ?? [];
    const paymentRecord = records.find((record) => record.record_type === "expense" && record.entry_kind === "advance_expense")
      ?? records.find((record) => record.record_type === "expense" && (record.category === "出店料" || record.title.includes("出店")));
    if (!paymentRecord) throw new Error("変更できる事前経費がありません");

    const saved = await saveEventPaymentRecord(profile, {
      marketEventId: event.id,
      eventDate: event.event_date,
      amount: Number(paymentRecord.amount),
      method: paymentRecord.payment_method ?? "",
      paymentStatus
    });
    if (!saved) return;
    setFinancesByEvent((current) => ({
      ...current,
      [event.id]: (current[event.id] ?? []).map((record) => record.id === saved.id ? saved : record)
    }));
  }

  return (
    <MarketNoteShell isGuest={isGuest} addHref={`/marketnote/new?startDate=${selectedDateForAdd}`}>
      <div className="-mx-1 pb-2">
        {isGuest ? <GuestNotice /> : null}
        {!isGuest && guestStats && guestStats.events > 0 ? (
          <CloudImportNotice stats={guestStats} profile={profile} onImported={loadMarketNoteData} />
        ) : null}
        {photoCleanupPending ? (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-[var(--mikke-yellow)] bg-[var(--mikke-yellow)] px-3 py-2.5 text-xs font-bold text-[var(--mikke-text)]">
            <span>予定は削除済みです。写真の整理だけ完了していないため、オンライン時に再試行します。</span>
            <button type="button" onClick={() => void retryPhotoCleanup()} disabled={photoCleanupBusy} className="shrink-0 rounded-full border border-[var(--mikke-text)] px-3 py-1.5 disabled:opacity-50">{photoCleanupBusy ? "再試行中" : "今すぐ再試行"}</button>
          </div>
        ) : null}

        {homeTab === "list" ? <div className="mb-3 px-1">
          <div className="inline-flex rounded-full border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-1">
            <SegmentButton active={false} onClick={() => setHomeTab("calendar")}>
              カレンダー
            </SegmentButton>
            <SegmentButton active onClick={() => setHomeTab("list")}>
              一覧
            </SegmentButton>
          </div>
        </div> : null}

        {homeTab === "calendar" ? (
          <HomeCalendar
            profile={profile}
            events={events}
            checksByEvent={checksByEvent}
            financesByEvent={financesByEvent}
            reflectionsByEvent={reflectionsByEvent}
            photoPreviewsByEvent={photoPreviewsByEvent}
            viewToggle={(
              <div className="inline-flex shrink-0 rounded-full border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-0.5">
                <SegmentButton compact active onClick={() => setHomeTab("calendar")}>カレンダー</SegmentButton>
                <SegmentButton compact active={false} onClick={() => setHomeTab("list")}>一覧</SegmentButton>
              </div>
            )}
            onStatusChange={changeCalendarStatus}
            onPaymentStatusChange={changeCalendarPayment}
            onToggleCheck={changeCalendarCheck}
            onSelectedDateChange={setSelectedDateForAdd}
          />
        ) : (
          <div>
            <div className="-mx-4 mb-4 border-b border-[var(--mikke-line)]">
              <div className="grid grid-cols-2 text-center text-sm font-bold">
                <TabButton active={activeTab === "upcoming"} onClick={() => setActiveTab("upcoming")}>
                  これから
                </TabButton>
                <TabButton active={activeTab === "past"} onClick={() => setActiveTab("past")}>
                  過去
                </TabButton>
              </div>
            </div>

            <div className="mb-4 px-1">
              <span className="text-sm font-semibold text-[var(--mikke-text-soft)]">
                {activeTab === "upcoming" ? "今日以降・日付が近い順" : "新しい日付順"}
              </span>
            </div>

            {filtered.length > 0 ? (
              <div className="space-y-3">
                {filtered.map((summary) => (
                  <EventListCard key={summary.event.id} summary={summary} />
                ))}
              </div>
            ) : (
              <MikkeEmptyState
                title={activeTab === "upcoming" ? "これからの予定はありません" : "過去の予定はありません"}
                helper={activeTab === "upcoming" ? "予定を追加すると、日付が近い順に表示されます。" : "過去の予定ができると、新しい日付順に表示されます。"}
              />
            )}
          </div>
        )}
      </div>
    </MarketNoteShell>
  );
}

function GuestNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissedAt = Number(localStorage.getItem("mikke-marketnote-login-notice-dismissed-at") ?? "0");
      const oneWeek = 7 * 24 * 60 * 60 * 1000;
      setVisible(!dismissedAt || Date.now() - dismissedAt >= oneWeek);
    } catch {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem("mikke-marketnote-login-notice-dismissed-at", String(Date.now()));
    } catch {
      // Storage unavailable: hide for the current page view only.
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="relative mb-3 rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] px-3 py-2.5 pr-11 text-xs font-bold leading-5 text-[var(--mikke-text-soft)]">
      <button type="button" onClick={dismiss} aria-label="案内を閉じる" className="absolute right-1.5 top-1.5 grid h-9 w-9 place-items-center rounded-full text-[var(--mikke-muted)]">
        <X size={17} />
      </button>
      ログインせずに使えます。記録はこのブラウザに保存されます。
      <Link href="/login?next=/marketnote" className="ml-2 text-[var(--mikke-blue)] underline underline-offset-2">
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
      setMessage(`${result.events}件の予定${result.photos > 0 ? `と写真${result.photos}枚` : ""}をクラウドへ保存しました。これからはログインした状態で続きが見られます。`);
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
          <span className="ml-1 text-[var(--mikke-blue)]">予定 {stats.events}件</span>
          <span className="mt-1 block text-[var(--mikke-muted)]">
            クラウド保存が完了するまで、端末内のゲスト記録は残ります。
          </span>
        </p>
        <button
          type="button"
          onClick={importRecords}
          disabled={importing}
          className="min-h-11 rounded-xl bg-[var(--mikke-orange)] px-4 text-xs font-extrabold text-white disabled:opacity-50"
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

function SegmentButton({ active, onClick, children, compact = false }: { active: boolean; onClick: () => void; children: React.ReactNode; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${compact ? "min-h-8 px-2.5 text-[10px]" : "min-h-10 px-3.5 text-xs"} rounded-full font-bold transition ${
        active ? "bg-[var(--mikke-blue)] text-white" : "text-[var(--mikke-text-soft)]"
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
      className={`relative min-h-11 pb-3 pt-1 transition ${active ? "text-[var(--mikke-blue)]" : "text-[var(--mikke-text)]"}`}
    >
      {children}
      {active ? <span className="absolute inset-x-0 bottom-[-1px] mx-auto h-0.5 w-full rounded-full bg-[var(--mikke-blue)]" /> : null}
    </button>
  );
}

function EventListCard({ summary }: { summary: EventSummary }) {
  const { event, checks, finances } = summary;
  const done = checks.filter((check) => check.is_done).length;
  const progress = checks.length ? Math.round((done / checks.length) * 100) : 0;
  const payment = getPaymentState(finances);

  return (
    <Link
      href={`/marketnote/${event.id}`}
      className="block rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4 transition hover:border-[var(--mikke-blue)]"
    >
      <div className="flex items-start justify-between gap-3">
        <StatusChip status={event.status} applied={hasAppliedEntryStatus(event.private_note)} eventType={event.genre} />
        <Edit3 size={17} strokeWidth={1.6} className="mt-1 shrink-0 text-[var(--mikke-muted)]" />
      </div>

      <h2 className="mt-3 truncate text-xl font-bold tracking-normal text-[var(--mikke-text)]">{event.title}</h2>

      <div className="mt-3 space-y-1.5">
        <p className="flex items-center gap-2 truncate text-sm font-semibold text-[var(--mikke-muted)]">
          <Clock3 size={15} strokeWidth={1.7} className="shrink-0 text-[var(--mikke-muted)]" />
          <span className="truncate">{formatEventSchedule(event)}</span>
        </p>
        <p className="flex items-center gap-2 truncate text-sm font-semibold text-[var(--mikke-muted)]">
          <MapPin size={15} strokeWidth={1.7} className="shrink-0 text-[var(--mikke-muted)]" />
          <span className="truncate">{[event.venue_name, event.area].filter(Boolean).join(" / ") || "会場未設定"}</span>
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-xs">
        <span>{payment === "unpaid" ? <span className="rounded-full bg-[var(--mikke-yellow)] px-2 py-1 text-[10px] font-bold text-[var(--mikke-text)]">未払いあり</span> : null}</span>
        <span className="whitespace-nowrap font-semibold text-[var(--mikke-text-soft)]">タスク {done}/{checks.length}</span>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--mikke-line-soft)]">
        <div className="h-full rounded-full bg-[var(--mikke-yellow)]" style={{ width: `${progress}%` }} />
      </div>
    </Link>
  );
}

function StatusChip({ status, applied = false, eventType }: { status: MarketEvent["status"]; applied?: boolean; eventType?: string | null }) {
  const showApplied = applied && status === "planned";
  const toneClass = showApplied
    ? "bg-[var(--mikke-yellow)] text-[var(--mikke-text)]"
    : status !== "planned"
      ? "bg-[var(--mikke-orange)] text-white"
      : "bg-[var(--mikke-blue)] text-white";
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${toneClass}`}>
      {showApplied ? (eventType === "出店" ? "申込済み" : "調整中") : statusLabel(status)}
    </span>
  );
}

function PaymentChip({ payment }: { payment: PaymentState }) {
  const toneClass = payment === "paid"
    ? "bg-[var(--mikke-green)] text-[var(--mikke-text)]"
    : payment === "unpaid"
      ? "bg-[var(--mikke-orange)] text-white"
      : "border border-[var(--mikke-line)] bg-white text-[var(--mikke-muted)]";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold leading-none ${toneClass}`}>{paymentLabel(payment)}</span>;
}

function getPaymentState(finances: MarketFinancialRecord[]): PaymentState {
  const advanceExpenses = finances.filter((record) => record.record_type === "expense" && (record.entry_kind === "advance_expense" || record.category === "出店料"));
  if (advanceExpenses.some((record) => record.payment_status === "unpaid")) return "unpaid";
  if (advanceExpenses.some((record) => record.payment_status === "paid")) return "paid";
  return "not_required";
}

function statusLabel(status: MarketEvent["status"]) {
  if (status !== "planned") return "確定";
  return "検討中";
}

function paymentLabel(payment: PaymentState) {
  if (payment === "paid") return "支払済";
  if (payment === "unpaid") return "未払い";
  return "不要";
}

function formatEventSchedule(event: MarketEvent) {
  const note = event.private_note ?? "";
  const startTime = matchNoteValue(note, "開始時間");
  const endTime = matchNoteValue(note, "終了時間");
  const time = startTime && endTime
    ? `${startTime} - ${endTime}`
    : startTime || endTime || "時間未設定";
  return `${formatDate(event.event_date)} ${time}`;
}

function matchNoteValue(note: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matched = note.match(new RegExp(`(?:^|\\n)${escaped}:\\s*([^\\n]+)`));
  return matched?.[1]?.trim() || null;
}

export default function MarketNotePage() {
  return (
    <AuthGate allowGuest>
      <MarketNoteContent />
    </AuthGate>
  );
}
