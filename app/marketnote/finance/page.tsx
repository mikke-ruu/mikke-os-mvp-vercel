"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleX,
  Clock3,
  MapPin,
  Plus,
  ReceiptText
} from "lucide-react";
import { MarketNoteShell } from "@/components/marketnote/MarketNoteShell";
import { AuthGate, useAuth } from "@/components/AuthGate";
import { defaultFinanceCategorySettings, getFinanceCategoryNames, loadFinanceCategorySettings } from "@/lib/finance-categories";
import { formatMonthDay, formatYen } from "@/lib/format";
import {
  addFinancialRecord,
  deleteFinancialRecord,
  listFinancialRecords,
  listMarketEvents,
  updateFinancialRecord
} from "@/lib/marketnote";
import type { MarketEvent, MarketFinancialRecord } from "@/types/database";

type FinanceDraft = {
  id: string;
  persistedId?: string;
  recordType: "revenue" | "expense";
  title: string;
  amount: string;
  occurredAt: string;
  category: string;
  memo: string;
  paymentStatus: "unpaid" | "paid" | "not_required";
};

type EventFinanceRow = {
  event: MarketEvent;
  records: MarketFinancialRecord[];
  revenue: number;
  expense: number;
  profit: number;
};

function MarketFinanceContent() {
  const router = useRouter();
  const { profile, isGuest } = useAuth();
  const [events, setEvents] = useState<MarketEvent[]>([]);
  const [records, setRecords] = useState<MarketFinancialRecord[]>([]);
  const [categorySettings, setCategorySettings] = useState(defaultFinanceCategorySettings);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [openEventId, setOpenEventId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, FinanceDraft[]>>({});
  const [savingEventId, setSavingEventId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function load() {
    const [nextEvents, nextRecords] = await Promise.all([
      listMarketEvents(profile.id),
      listFinancialRecords(profile.id)
    ]);

    setEvents(nextEvents);
    setRecords(nextRecords);
    setDrafts(hydrateDrafts(nextEvents, nextRecords));

    const focusId = getInitialEventId();
    if (focusId) {
      const focusEvent = nextEvents.find((event) => event.id === focusId);
      if (focusEvent) {
        setVisibleMonth(startOfMonth(parseDate(focusEvent.event_date)));
        setOpenEventId(focusId);
      }
    }
  }

  useEffect(() => {
    setCategorySettings(loadFinanceCategorySettings());
    load();
  }, [profile.id]);

  const revenueCategories = useMemo(() => getFinanceCategoryNames(categorySettings, "revenue"), [categorySettings]);
  const expenseCategories = useMemo(() => getFinanceCategoryNames(categorySettings, "expense"), [categorySettings]);

  const rows = useMemo<EventFinanceRow[]>(() => {
    return events
      .filter((event) => isSameMonth(parseDate(event.event_date), visibleMonth))
      .sort((a, b) => a.event_date.localeCompare(b.event_date))
      .map((event) => {
        const eventRecords = records.filter((record) => record.market_event_id === event.id);
        const revenue = sumRecords(eventRecords, "revenue");
        const expense = sumRecords(eventRecords, "expense");
        return { event, records: eventRecords, revenue, expense, profit: revenue - expense };
      });
  }, [events, records, visibleMonth]);

  const monthly = useMemo(() => {
    const monthEventIds = new Set(rows.map((row) => row.event.id));
    const monthRecords = records.filter((record) => record.market_event_id && monthEventIds.has(record.market_event_id));
    const revenue = sumRecords(monthRecords, "revenue");
    const expense = sumRecords(monthRecords, "expense");
    return { revenue, expense, profit: revenue - expense };
  }, [records, rows]);

  function moveMonth(diff: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + diff, 1));
    setOpenEventId(null);
    setMessage("");
  }

  function goToCurrentMonth() {
    setVisibleMonth(startOfMonth(new Date()));
    setOpenEventId(null);
    setMessage("");
  }

  function updateDraft(eventId: string, draftId: string, patch: Partial<FinanceDraft>) {
    setDrafts((current) => ({
      ...current,
      [eventId]: (current[eventId] ?? []).map((draft) => draft.id === draftId ? { ...draft, ...patch } : draft)
    }));
  }

  function addDraft(event: MarketEvent, recordType: "revenue" | "expense", defaultCategory: string) {
    const title = defaultCategory || (recordType === "revenue" ? "売上" : "経費");
    setDrafts((current) => ({
      ...current,
      [event.id]: [
        ...(current[event.id] ?? []),
        {
          id: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          recordType,
          title,
          amount: "",
          occurredAt: event.event_date,
          category: title,
          memo: "",
          paymentStatus: "paid"
        }
      ]
    }));
    setOpenEventId(event.id);
  }

  async function removeDraft(eventId: string, draft: FinanceDraft) {
    if (draft.persistedId) {
      await deleteFinancialRecord(profile, draft.persistedId);
      await load();
      return;
    }

    setDrafts((current) => ({
      ...current,
      [eventId]: (current[eventId] ?? []).filter((item) => item.id !== draft.id)
    }));
  }

  async function saveEventFinance(event: MarketEvent) {
    setSavingEventId(event.id);
    setMessage("");

    try {
      const eventDrafts = (drafts[event.id] ?? []).filter((draft) => draft.title.trim() || draft.amount.trim());
      await Promise.all(eventDrafts.map((draft) => {
        const input = {
          recordType: draft.recordType,
          title: draft.title.trim() || (draft.recordType === "revenue" ? "売上" : "経費"),
          amount: Number(draft.amount || 0),
          occurredAt: draft.occurredAt || event.event_date,
          category: draft.category.trim() || draft.title.trim(),
          memo: draft.memo.trim(),
          paymentStatus: draft.paymentStatus
        };

        if (draft.persistedId) {
          return updateFinancialRecord(profile, draft.persistedId, input);
        }

        return addFinancialRecord(profile, {
          marketEventId: event.id,
          ...input
        });
      }));

      await load();
      setOpenEventId(event.id);
      setMessage("収支を保存しました");
    } finally {
      setSavingEventId(null);
    }
  }

  return (
    <MarketNoteShell title="MarketNote" subtitle="Events and finance" isGuest={isGuest}>
      <div className="-mx-1 pb-2">
        {isGuest ? <GuestNotice /> : null}

        <header className="mb-4 pt-2">
          <div className="grid grid-cols-[40px_1fr_40px] items-center">
            <button type="button" onClick={() => router.back()} className="grid h-10 w-10 place-items-center rounded-full text-[var(--mikke-text)]" aria-label="戻る">
              <ChevronLeft size={24} strokeWidth={1.7} />
            </button>
            <h1 className="text-center text-[28px] font-semibold tracking-normal text-[var(--mikke-text)]">収支</h1>
            <span className="h-10 w-10" aria-hidden="true" />
          </div>

          <div className="mt-5 grid grid-cols-[44px_1fr_44px] items-center gap-3">
            <button type="button" className="grid h-10 place-items-center rounded-full text-[var(--mikke-muted)]" onClick={() => moveMonth(-1)} aria-label="前の月">
              <ChevronLeft size={24} />
            </button>
            <h2 className="text-center text-[22px] font-semibold tracking-normal text-[var(--mikke-text)]">
              {visibleMonth.getFullYear()}年{visibleMonth.getMonth() + 1}月
            </h2>
            <button type="button" className="grid h-10 place-items-center rounded-full text-[var(--mikke-muted)]" onClick={() => moveMonth(1)} aria-label="次の月">
              <ChevronRight size={24} />
            </button>
          </div>
          <div className="mt-2 text-center">
            <button type="button" onClick={goToCurrentMonth} className="min-h-9 rounded-full border border-[var(--mikke-blue)] px-3 text-xs font-bold text-[var(--mikke-blue)]">
              今月
            </button>
          </div>
        </header>

        <MonthlySummary totals={monthly} />

        {message ? <p className="mt-3 rounded-xl bg-[var(--mikke-accent-soft)] px-4 py-3 text-sm font-bold text-[var(--mikke-accent-strong)]">{message}</p> : null}

        <section className="mt-3.5 space-y-2.5">
          {rows.length > 0 ? rows.map((row) => {
            const open = openEventId === row.event.id;
            const eventDrafts = drafts[row.event.id] ?? [];

            return (
              <article key={row.event.id} className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] shadow-[0_4px_14px_rgba(45,33,22,0.04)]">
                <button
                  type="button"
                  onClick={() => setOpenEventId(open ? null : row.event.id)}
                  className="block w-full p-3.5 text-left"
                  aria-expanded={open}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-extrabold tracking-normal text-[var(--mikke-text)]">{row.event.title}</h3>
                      <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-bold text-[var(--mikke-muted)]">
                        <span className="inline-flex items-center gap-1"><Clock3 size={13} />{formatMonthDay(row.event.event_date)}</span>
                        <span className="inline-flex min-w-0 items-center gap-1"><MapPin size={13} /><span className="truncate">{row.event.venue_name || row.event.area || "会場未設定"}</span></span>
                      </div>
                    </div>
                    <ChevronDown size={18} className={`mt-1 shrink-0 text-[var(--mikke-text)] transition ${open ? "rotate-180" : ""}`} />
                  </div>

                  <div className="mt-3 border-t border-[var(--mikke-line-soft)] pt-2.5">
                    <FinanceSummaryGrid revenue={row.revenue} expense={row.expense} profit={row.profit} compact />
                    <p className="mt-2.5 text-right text-[11px] font-extrabold text-[var(--mikke-accent)]">収支を編集 〉</p>
                  </div>
                </button>

                {open ? (
                  <div className="border-t border-[var(--mikke-line-soft)] px-3.5 pb-3.5 pt-3">
                    <h4 className="mb-2.5 text-sm font-extrabold text-[var(--mikke-text)]">収支詳細</h4>
                    <FinanceDraftSection
                      title="売上内訳"
                      actionLabel="売上を追加"
                      recordType="revenue"
                      event={row.event}
                      drafts={eventDrafts.filter((draft) => draft.recordType === "revenue")}
                      categoryOptions={revenueCategories}
                      onAdd={() => addDraft(row.event, "revenue", revenueCategories[0] ?? "売上")}
                      onChange={(draftId, patch) => updateDraft(row.event.id, draftId, patch)}
                      onRemove={(draft) => removeDraft(row.event.id, draft)}
                    />
                    <FinanceDraftSection
                      title="経費内訳"
                      actionLabel="経費を追加"
                      recordType="expense"
                      event={row.event}
                      drafts={eventDrafts.filter((draft) => draft.recordType === "expense")}
                      categoryOptions={expenseCategories}
                      onAdd={() => addDraft(row.event, "expense", expenseCategories[0] ?? "経費")}
                      onChange={(draftId, patch) => updateDraft(row.event.id, draftId, patch)}
                      onRemove={(draft) => removeDraft(row.event.id, draft)}
                    />
                    <div className="mt-3.5 flex items-end justify-between border-t border-[var(--mikke-line-soft)] pt-3">
                      <span className="text-sm font-extrabold text-[var(--mikke-text)]">利益</span>
                      <span className="text-xl font-semibold tracking-normal text-[var(--mikke-success)]">{formatYen(getDraftTotals(eventDrafts).profit)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => saveEventFinance(row.event)}
                      disabled={savingEventId === row.event.id}
                      className="mt-3.5 w-full rounded-xl bg-[var(--mikke-accent)] px-4 py-2.5 text-sm font-extrabold text-[var(--mikke-surface)] shadow-[0_8px_18px_rgba(255,90,31,0.16)] disabled:opacity-50"
                    >
                      {savingEventId === row.event.id ? "保存中..." : "保存"}
                    </button>
                  </div>
                ) : null}
              </article>
            );
          }) : (
            <div className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-6 text-center shadow-[0_4px_16px_rgba(45,33,22,0.04)]">
              <p className="text-sm font-bold text-[var(--mikke-text)]">この月の出店予定はありません</p>
              <Link href="/marketnote/new" className="mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--mikke-primary-border)] bg-[var(--mikke-surface)] px-4 py-2 text-sm font-extrabold text-[var(--mikke-accent)]">
                <Plus size={16} strokeWidth={1.8} />
                出店予定を追加
              </Link>
            </div>
          )}
        </section>
      </div>
    </MarketNoteShell>
  );
}

function GuestNotice() {
  return (
    <div className="mb-4 rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] px-4 py-3 text-xs font-bold leading-5 text-[var(--mikke-text-soft)]">
      会計もこのブラウザに保存されます。同じアイコン・同じブラウザから続きが見られます。クラウド保存とDESK連携は、ログイン後の検証が済んでから開放します。
    </div>
  );
}

function MonthlySummary({ totals }: { totals: { revenue: number; expense: number; profit: number } }) {
  return (
    <section className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-3 py-3.5 shadow-[0_4px_14px_rgba(45,33,22,0.04)]">
      <FinanceSummaryGrid revenue={totals.revenue} expense={totals.expense} profit={totals.profit} />
    </section>
  );
}

function FinanceSummaryGrid({
  revenue,
  expense,
  profit,
  compact = false
}: {
  revenue: number;
  expense: number;
  profit: number;
  compact?: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_1px_1fr_1px_1fr] items-center">
      <FinanceAmount label="売上" value={revenue} compact={compact} />
      <span className={compact ? "h-8 bg-[var(--mikke-line)]" : "h-10 bg-[var(--mikke-line)]"} />
      <FinanceAmount label="経費" value={expense} muted compact={compact} />
      <span className={compact ? "h-8 bg-[var(--mikke-line)]" : "h-10 bg-[var(--mikke-line)]"} />
      <FinanceAmount label="利益" value={profit} profit compact={compact} />
    </div>
  );
}

function FinanceAmount({
  label,
  value,
  muted = false,
  profit = false,
  compact = false
}: {
  label: string;
  value: number;
  muted?: boolean;
  profit?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="text-center">
      <p className={`${compact ? "text-[11px]" : "text-xs"} font-bold ${profit ? "text-[var(--mikke-success)]" : "text-[var(--mikke-text-soft)]"}`}>{label}</p>
      <p className={`${compact ? "mt-0.5 text-[15px]" : "mt-1 text-xl"} font-semibold tracking-normal ${profit ? "text-[var(--mikke-success)]" : muted ? "text-[var(--mikke-muted)]" : "text-[var(--mikke-text)]"}`}>{formatYen(value)}</p>
    </div>
  );
}

function FinanceDraftSection({
  title,
  actionLabel,
  recordType,
  event,
  drafts,
  categoryOptions,
  onAdd,
  onChange,
  onRemove
}: {
  title: string;
  actionLabel: string;
  recordType: "revenue" | "expense";
  event: MarketEvent;
  drafts: FinanceDraft[];
  categoryOptions: string[];
  onAdd: () => void;
  onChange: (draftId: string, patch: Partial<FinanceDraft>) => void;
  onRemove: (draft: FinanceDraft) => void;
}) {
  const [customDraftIds, setCustomDraftIds] = useState<string[]>([]);

  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-center justify-between">
        <h5 className="text-xs font-extrabold text-[var(--mikke-text-soft)]">{title}</h5>
        <span className="text-[10px] font-bold text-[var(--mikke-muted-light)]">項目は設定で編集できます</span>
      </div>
      <div className="space-y-1.5">
        {drafts.map((draft) => (
          <div key={draft.id} className="grid grid-cols-[1fr_24px] items-center gap-1.5 rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-2 py-1.5 min-[360px]:grid-cols-[1fr_96px_24px]">
            <div className="relative min-w-0">
              {customDraftIds.includes(draft.id) ? (
                <input
                  value={draft.title}
                  onChange={(inputEvent) => onChange(draft.id, { title: inputEvent.target.value, category: inputEvent.target.value })}
                  placeholder="項目名を入力"
                  autoFocus
                  className="h-9 w-full min-w-0 rounded-lg bg-[var(--mikke-surface-soft)] px-2 text-base font-bold text-[var(--mikke-text)] outline-none min-[360px]:text-xs"
                />
              ) : (
                <>
                  <select
                    value={draft.title}
                    onChange={(inputEvent) => {
                      if (inputEvent.target.value === "__custom__") {
                        setCustomDraftIds((current) => [...current, draft.id]);
                        onChange(draft.id, { title: "", category: "" });
                        return;
                      }
                      onChange(draft.id, { title: inputEvent.target.value, category: inputEvent.target.value });
                    }}
                    className="h-9 w-full min-w-0 appearance-none rounded-lg bg-[var(--mikke-surface-soft)] px-2 pr-7 text-base font-bold text-[var(--mikke-text)] outline-none min-[360px]:text-xs"
                  >
                    {draft.title && !categoryOptions.includes(draft.title) ? <option value={draft.title} hidden>{draft.title}</option> : null}
                    {categoryOptions.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                    <option value="__custom__">自由入力…</option>
                  </select>
                  <ChevronDown size={13} className="pointer-events-none absolute right-2 top-2.5 text-[var(--mikke-accent)]" />
                </>
              )}
              {isPaymentLinkedDraft(draft) ? (
                <span className="mt-0.5 inline-flex rounded-full bg-[var(--mikke-surface-soft)] px-2 py-0.5 text-[10px] font-bold leading-none text-[var(--mikke-muted-light)]">支払い情報から反映</span>
              ) : null}
            </div>
            <div className="order-3 col-span-2 min-[360px]:order-2 min-[360px]:col-span-1">
              <MoneyInput value={draft.amount} onChange={(value) => onChange(draft.id, { amount: value, occurredAt: draft.occurredAt || event.event_date })} />
            </div>
            <button type="button" onClick={() => onRemove(draft)} className="order-2 grid h-6 w-6 place-items-center rounded-full text-[var(--mikke-muted-light)] min-[360px]:order-3" aria-label="削除">
              <CircleX size={15} strokeWidth={1.7} />
            </button>
          </div>
        ))}
        {drafts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] px-3 py-3 text-center text-xs font-bold text-[var(--mikke-muted-light)]">
            まだ{recordType === "revenue" ? "売上" : "経費"}内訳がありません
          </p>
        ) : null}
      </div>
      <button type="button" onClick={onAdd} className="mt-1.5 inline-flex items-center gap-1 rounded-full px-1 py-1 text-xs font-extrabold text-[var(--mikke-accent)]">
        <Plus size={15} strokeWidth={1.8} />
        {actionLabel}
      </button>
    </div>
  );
}

function MoneyInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="grid h-8 grid-cols-[20px_1fr] overflow-hidden rounded-lg bg-[var(--mikke-surface-soft)]">
      <span className="grid place-items-center text-xs font-bold text-[var(--mikke-muted)]">¥</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, ""))}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder="0"
        className="min-w-0 bg-transparent pr-1.5 text-right text-base font-extrabold text-[var(--mikke-text)] outline-none min-[360px]:text-xs"
      />
    </div>
  );
}

function hydrateDrafts(
  events: MarketEvent[],
  records: MarketFinancialRecord[]
) {
  const next: Record<string, FinanceDraft[]> = {};

  for (const event of events) {
    const eventRecords = records.filter((record) => record.market_event_id === event.id);
    next[event.id] = eventRecords.map((record) => recordToDraft(record));
  }

  return next;
}

function recordToDraft(record: MarketFinancialRecord): FinanceDraft {
  return {
    id: record.id,
    persistedId: record.id,
    recordType: record.record_type,
    title: record.title,
    amount: String(Number(record.amount || 0)),
    occurredAt: record.occurred_at,
    category: record.category ?? record.title,
    memo: record.memo ?? "",
    paymentStatus: record.payment_status
  };
}

function isPaymentLinkedDraft(draft: FinanceDraft) {
  if (draft.recordType !== "expense") return false;
  const text = `${draft.title} ${draft.category} ${draft.memo}`;
  return text.includes("出店") || text.includes("支払い") || draft.paymentStatus === "unpaid" || draft.paymentStatus === "not_required";
}

function getDraftTotals(drafts: FinanceDraft[]) {
  const revenue = drafts.filter((draft) => draft.recordType === "revenue").reduce((sum, draft) => sum + Number(draft.amount || 0), 0);
  const expense = drafts.filter((draft) => draft.recordType === "expense").reduce((sum, draft) => sum + Number(draft.amount || 0), 0);
  return { revenue, expense, profit: revenue - expense };
}

function sumRecords(records: MarketFinancialRecord[], type: "revenue" | "expense") {
  return records
    .filter((record) => record.record_type === type)
    .reduce((sum, record) => sum + Number(record.amount), 0);
}

function getInitialEventId() {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("eventId");
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function parseDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function isSameMonth(date: Date, month: Date) {
  return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();
}

export default function MarketFinancePage() {
  return (
    <AuthGate allowGuest>
      <MarketFinanceContent />
    </AuthGate>
  );
}
