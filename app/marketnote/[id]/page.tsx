"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  Circle,
  ClipboardList,
  Clock3,
  FileText,
  Image as ImageIcon,
  MapPin,
  Plus,
  ReceiptText,
  WalletCards,
  X
} from "lucide-react";
import { MarketNoteShell } from "@/components/marketnote/MarketNoteShell";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import { AuthGate, useAuth } from "@/components/AuthGate";
import { formatDate, formatMonthDay, formatYen } from "@/lib/format";
import {
  addCheckItem,
  getMarketEventBundle,
  saveEventPaymentRecord,
  saveReflection,
  toggleCheckItem,
  updateMarketEventDetails
} from "@/lib/marketnote";
import { defaultPaymentMethodSettings, getPaymentMethodNames, loadPaymentMethodSettings } from "@/lib/payment-methods";
import type { MarketCheckItem, MarketEvent, MarketFinancialRecord, MarketReflection } from "@/types/database";

type PaymentStatus = "unpaid" | "paid" | "not_required";
type PaymentMethod = string;

type EventMeta = {
  endDate: string;
  multiDay: boolean;
  startTime: string;
  endTime: string;
  meetTime: string;
  packUpTime: string;
  paymentMethod: PaymentMethod;
};

const statusOptions: Array<{ label: string; value: MarketEvent["status"] }> = [
  { label: "検討中", value: "planned" },
  { label: "出店確定", value: "preparing" },
  { label: "終了", value: "completed" },
  { label: "中止", value: "cancelled" }
];

const paymentStatusOptions: Array<{ label: string; value: PaymentStatus }> = [
  { label: "未払い", value: "unpaid" },
  { label: "支払済", value: "paid" },
  { label: "不要", value: "not_required" }
];

const defaultPaymentMethodNames = getPaymentMethodNames(defaultPaymentMethodSettings);

function MarketDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { profile, isGuest } = useAuth();
  const [event, setEvent] = useState<MarketEvent | null>(null);
  const [checks, setChecks] = useState<MarketCheckItem[]>([]);
  const [finances, setFinances] = useState<MarketFinancialRecord[]>([]);
  const [reflection, setReflection] = useState<MarketReflection | null>(null);
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [multiDay, setMultiDay] = useState(false);
  const [status, setStatus] = useState<MarketEvent["status"]>("planned");
  const [applied, setApplied] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [meetTime, setMeetTime] = useState("");
  const [packUpTime, setPackUpTime] = useState("");
  const [venueName, setVenueName] = useState("");
  const [address, setAddress] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("not_required");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("現金");
  const [paymentMethodOptions, setPaymentMethodOptions] = useState<string[]>(defaultPaymentMethodNames);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [customCheck, setCustomCheck] = useState("");
  const [goodPoints, setGoodPoints] = useState("");
  const [nextActions, setNextActions] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [editOpen, setEditOpen] = useState(false);

  async function load() {
    const bundle = await getMarketEventBundle(profile.id, params.id);
    applyBundle(bundle.event, bundle.checks, bundle.finances, bundle.reflection);
  }

  function applyBundle(
    nextEvent: MarketEvent,
    nextChecks: MarketCheckItem[],
    nextFinances: MarketFinancialRecord[],
    nextReflection: MarketReflection | null
  ) {
    const meta = parseEventMeta(nextEvent);
    const payment = getEventPayment(nextChecks, nextFinances, meta.paymentMethod);

    setEvent(nextEvent);
    setChecks(nextChecks);
    setFinances(nextFinances);
    setReflection(nextReflection);
    setTitle(nextEvent.title);
    setEventDate(nextEvent.event_date);
    setEndDate(meta.endDate || nextEvent.event_date);
    setMultiDay(meta.multiDay || Boolean(meta.endDate && meta.endDate !== nextEvent.event_date));
    setStatus(nextEvent.status);
    setApplied(nextEvent.status === "planned" && matchNoteValue(nextEvent.private_note ?? "", "入力ステータス") === "申込済み");
    setStartTime(meta.startTime);
    setEndTime(meta.endTime);
    setMeetTime(meta.meetTime);
    setPackUpTime(meta.packUpTime);
    setVenueName(nextEvent.venue_name ?? "");
    setAddress(nextEvent.area ?? "");
    setPaymentStatus(payment.status);
    setPaymentMethod(payment.method);
    setPaymentAmount(payment.amount > 0 ? String(payment.amount) : "");
    setMemo(nextEvent.public_note ?? "");
    setGoodPoints(nextReflection?.good_points ?? "");
    setNextActions(nextReflection?.next_actions ?? "");
  }

  useEffect(() => {
    setPaymentMethodOptions(getPaymentMethodNames(loadPaymentMethodSettings()));
    load();
  }, [params.id, profile.id]);

  const totals = useMemo(() => getTotals(finances), [finances]);
  const done = checks.filter((check) => check.is_done).length;
  const progress = checks.length ? Math.round((done / checks.length) * 100) : 0;
  const normalizedEndDate = multiDay ? (endDate || eventDate) : eventDate;
  const canSave = title.trim().length > 0 && eventDate.length > 0 && !saving;

  async function submit(saveEvent: FormEvent<HTMLFormElement>) {
    saveEvent.preventDefault();
    if (!event || !canSave) return;

    setSaving(true);
    setMessage("");

    try {
      const privateNote = buildPrivateNote({
        status,
        applied,
        startDate: eventDate,
        endDate: normalizedEndDate,
        multiDay,
        startTime,
        endTime,
        meetTime,
        packUpTime,
        paymentStatus,
        paymentMethod,
        paymentAmount
      });

      await updateMarketEventDetails(profile, event.id, {
        title: title.trim(),
        eventDate,
        venueName: venueName.trim(),
        area: address.trim(),
        status,
        publicNote: memo.trim(),
        privateNote
      });

      await saveEventPaymentRecord(profile, {
        marketEventId: event.id,
        eventDate,
        amount: Number(paymentAmount || 0),
        method: paymentMethod,
        paymentStatus
      });

      await saveReflection(profile, {
        marketEventId: event.id,
        publicSummary: goodPoints,
        privateNote: "",
        goodPoints,
        nextActions: ""
      });

      await load();
      setMessage("変更を保存しました");
    } finally {
      setSaving(false);
    }
  }

  async function addCustomCheck() {
    if (!event || !customCheck.trim()) return;
    await addCheckItem(profile, event.id, customCheck.trim());
    setCustomCheck("");
    await load();
  }

  if (!event) {
    return (
      <MarketNoteShell title="出店詳細" subtitle="MarketNote" isGuest={isGuest}>
        <MikkeEmptyState title="読み込み中です" />
      </MarketNoteShell>
    );
  }

  return (
    <MarketNoteShell title="出店詳細" subtitle="MarketNote" isGuest={isGuest}>
      <form onSubmit={submit} className="pb-5">
        <header className="mb-4 grid grid-cols-[40px_1fr_40px] items-center pt-1">
          <button type="button" onClick={() => router.back()} className="grid h-9 w-9 place-items-center rounded-full text-[var(--mikke-text)]" aria-label="戻る">
            <ArrowLeft size={22} strokeWidth={1.7} />
          </button>
          <h1 className="text-center text-xl font-semibold tracking-normal text-[var(--mikke-text)]">出店詳細</h1>
          <span />
        </header>

        {isGuest ? <GuestNotice /> : null}

        <SummaryCard
          event={event}
          title={title}
          eventDate={eventDate}
          endDate={normalizedEndDate}
          startTime={startTime}
          endTime={endTime}
          meetTime={meetTime}
          packUpTime={packUpTime}
          venueName={venueName}
          address={address}
          status={status}
          applied={applied}
          paymentStatus={paymentStatus}
          paymentMethod={paymentMethod}
          paymentAmount={paymentAmount}
          done={done}
          total={checks.length}
          progress={progress}
          checks={checks}
          onStatusChange={(nextStatus) => {
            setStatus(nextStatus);
            setApplied(false);
          }}
          onToggleCheck={async (item, nextValue) => {
            await toggleCheckItem(profile, item, nextValue);
            await load();
          }}
        />

        <div className="mt-3 space-y-3">
          <FormCard title="メモ" icon={<FileText size={16} strokeWidth={1.8} />}>
            <textarea value={memo} onChange={(inputEvent) => setMemo(inputEvent.target.value)} rows={2} className="w-full resize-none rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-3 py-2.5 text-sm leading-6 text-[var(--mikke-text)] outline-none focus:border-[var(--mikke-accent)]" />
          </FormCard>

          <CollapsibleCard title="各項目編集" icon={<ClipboardList size={16} strokeWidth={1.8} />} open={editOpen} onToggle={() => setEditOpen((current) => !current)}>
            <SectionLabel>基本情報</SectionLabel>
            <Field label="イベント名"><TextInput value={title} onChange={setTitle} /></Field>
            <Field label={multiDay ? "開始日" : "開催日"}><TextInput value={eventDate} onChange={(value) => {
              setEventDate(value);
              if (!multiDay) setEndDate(value);
            }} type="date" icon={<CalendarDays size={15} />} /></Field>
            <button type="button" onClick={() => setMultiDay((current) => !current)} className="inline-flex items-center gap-2 text-xs font-bold text-[var(--mikke-muted)]">
              <span className={`grid h-4 w-4 place-items-center rounded border ${multiDay ? "border-[var(--mikke-accent)] bg-[var(--mikke-accent)] text-[var(--mikke-surface)]" : "border-[var(--mikke-line)] bg-[var(--mikke-surface)] text-transparent"}`}>
                <Check size={11} strokeWidth={2} />
              </span>
              複数日イベント
            </button>
            {multiDay ? <Field label="終了日"><TextInput value={endDate} onChange={setEndDate} type="date" icon={<CalendarDays size={15} />} /></Field> : null}
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="開始時間"><TextInput value={startTime} onChange={setStartTime} type="time" /></Field>
              <Field label="終了時間"><TextInput value={endTime} onChange={setEndTime} type="time" /></Field>
              <Field label="集合時間"><TextInput value={meetTime} onChange={setMeetTime} type="time" /></Field>
              <Field label="撤収時間"><TextInput value={packUpTime} onChange={setPackUpTime} type="time" /></Field>
            </div>

            <SectionLabel>会場情報</SectionLabel>
            <Field label="会場名"><TextInput value={venueName} onChange={setVenueName} placeholder="例）東京ビッグサイト 西1・2ホール" /></Field>
            <Field label="住所"><TextInput value={address} onChange={setAddress} placeholder="例）東京都江東区有明3-11-1" /></Field>

            <SectionLabel>支払い情報</SectionLabel>
            <div className="grid grid-cols-[1fr_1fr_0.95fr] gap-2">
              <SelectBox value={paymentStatus} onChange={(value) => setPaymentStatus(value as PaymentStatus)} options={paymentStatusOptions} tone={paymentTone(paymentStatus)} />
              <SelectBox value={paymentMethod} onChange={setPaymentMethod} options={getPaymentMethodOptions(paymentMethodOptions, paymentMethod)} tone="gray" />
              <MoneyInput value={paymentAmount} onChange={setPaymentAmount} />
            </div>
            <p className="text-[11px] font-bold leading-5 text-[var(--mikke-muted-light)]">支払い情報の変更は、下部の「変更を保存」で収支に反映されます。</p>
            <div className="mt-2.5 flex w-full select-none items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] px-3 py-2 text-xs font-bold text-[var(--mikke-muted-light)]" aria-hidden="true">
              <Plus size={14} strokeWidth={1.7} />
              支払い追加
            </div>

            <SectionLabel>チェック項目</SectionLabel>
            <div className="grid gap-2 sm:grid-cols-2">
              {checks.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={async () => {
                    await toggleCheckItem(profile, item, !item.is_done);
                    await load();
                  }}
                  className="grid grid-cols-[22px_1fr] items-center gap-2 rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-2.5 py-2 text-left"
                >
                  <span className={`grid h-5 w-5 place-items-center rounded-full border ${item.is_done ? "border-[var(--mikke-success)] bg-[var(--mikke-success-soft)] text-[var(--mikke-success)]" : "border-[var(--mikke-line)] text-transparent"}`}>
                    <Check size={13} strokeWidth={2} />
                  </span>
                  <span className="min-w-0 truncate text-xs font-bold text-[var(--mikke-text-soft)]">{item.title}</span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-[1fr_40px] gap-2">
              <TextInput value={customCheck} onChange={setCustomCheck} placeholder="項目を追加" />
              <button type="button" onClick={addCustomCheck} className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--mikke-primary-border)] bg-[var(--mikke-surface)] text-[var(--mikke-accent)]" aria-label="項目追加">
                <Plus size={17} />
              </button>
            </div>
          </CollapsibleCard>

          <FinanceMemo eventId={event.id} totals={totals} />

          <FormCard title="振り返り" icon={<ReceiptText size={16} strokeWidth={1.8} />}>
            <textarea value={goodPoints} onChange={(inputEvent) => setGoodPoints(inputEvent.target.value)} rows={4} placeholder="今日の反応、気づいたこと、次回やることなど" className="w-full resize-none rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-3 py-2.5 text-sm leading-6 outline-none focus:border-[var(--mikke-accent)]" />
          </FormCard>

          <FormCard title="写真" icon={<ImageIcon size={16} strokeWidth={1.8} />}>
            <div className="grid grid-cols-[72px_1fr] gap-3">
              <div className="h-16 rounded-xl border border-[var(--mikke-line)] bg-[linear-gradient(135deg,var(--mikke-line),var(--mikke-accent-soft)_55%,var(--mikke-accent))]" />
              <button type="button" className="flex h-16 items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--mikke-primary-border)] bg-[var(--mikke-surface)] text-sm font-extrabold text-[var(--mikke-accent)]">
                <Camera size={16} />
                写真を追加
              </button>
            </div>
          </FormCard>

          {message ? <p className="rounded-xl bg-[var(--mikke-accent-soft)] px-4 py-3 text-sm font-bold text-[var(--mikke-accent-strong)]">{message}</p> : null}

          <div className="space-y-2.5 pt-0.5">
            <button type="submit" disabled={!canSave} className="w-full rounded-xl bg-[var(--mikke-accent)] px-4 py-3.5 text-base font-extrabold text-[var(--mikke-surface)] shadow-[0_8px_18px_rgba(255,90,31,0.16)] disabled:opacity-50">
              {saving ? "保存中..." : "変更を保存"}
            </button>
            <Link href="/marketnote" className="block w-full rounded-xl border border-[var(--mikke-primary-border)] bg-[var(--mikke-surface)] px-4 py-3 text-center text-sm font-extrabold text-[var(--mikke-accent)]">
              閉じる
            </Link>
          </div>
        </div>
      </form>
    </MarketNoteShell>
  );
}

function GuestNotice() {
  return (
    <div className="mb-3 rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] px-4 py-3 text-xs font-bold leading-5 text-[var(--mikke-text-soft)]">
      この記録はこのブラウザに保存されています。同じアイコン・同じブラウザから続きが見られます。STORY掲載や他アプリ連携は、まだ自動では行いません。
    </div>
  );
}

function SummaryCard({
  title,
  eventDate,
  endDate,
  startTime,
  endTime,
  meetTime,
  packUpTime,
  venueName,
  address,
  status,
  applied,
  paymentStatus,
  paymentMethod,
  paymentAmount,
  done,
  total,
  progress,
  checks,
  onStatusChange,
  onToggleCheck
}: {
  event: MarketEvent;
  title: string;
  eventDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  meetTime: string;
  packUpTime: string;
  venueName: string;
  address: string;
  status: MarketEvent["status"];
  applied: boolean;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  paymentAmount: string;
  done: number;
  total: number;
  progress: number;
  checks: MarketCheckItem[];
  onStatusChange: (status: MarketEvent["status"]) => void;
  onToggleCheck: (item: MarketCheckItem, nextValue: boolean) => Promise<void>;
}) {
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);

  return (
    <section className="rounded-[18px] border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4 shadow-[0_4px_14px_rgba(45,33,22,0.04)]">
      <div className="relative w-fit">
        <button type="button" onClick={() => setStatusMenuOpen((current) => !current)} aria-expanded={statusMenuOpen}>
          <StatusChip status={status} applied={applied} withChevron />
        </button>
        {statusMenuOpen ? (
          <div className="absolute left-0 top-8 z-20 w-32 overflow-hidden rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] py-1 shadow-[0_8px_22px_rgba(45,33,22,0.12)]">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onStatusChange(option.value);
                  setStatusMenuOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-xs font-extrabold text-[var(--mikke-text-soft)] hover:bg-[var(--mikke-accent-soft)]"
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <h2 className="mt-3 truncate text-xl font-extrabold tracking-normal text-[var(--mikke-text)]">{title}</h2>
      <div className="mt-3 grid gap-1.5 text-sm font-semibold text-[var(--mikke-text-soft)]">
        <span className="flex min-w-0 items-center gap-2"><Clock3 size={16} className="text-[var(--mikke-muted-light)]" />{dateRangeLabel(eventDate, endDate)} / {timeLabel(startTime, endTime)}</span>
        <span className="flex min-w-0 items-center gap-2"><Clock3 size={16} className="text-[var(--mikke-muted-light)]" />集合 {meetTime || "未設定"} / 撤収 {packUpTime || "未設定"}</span>
        <span className="flex min-w-0 items-center gap-2"><MapPin size={16} className="text-[var(--mikke-muted-light)]" />{[venueName, address].filter(Boolean).join(" / ") || "会場未設定"}</span>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs font-bold text-[var(--mikke-text-soft)]">
        <span className="min-w-0 truncate">支払い：<PaymentChip status={paymentStatus} /> <span className="ml-1 text-[var(--mikke-muted)]">{paymentMethod} / {formatYen(Number(paymentAmount || 0))}</span></span>
        <span>タスク {done}/{total}</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--mikke-line-soft)]">
        <div className="h-full rounded-full bg-[var(--mikke-accent)]" style={{ width: `${progress}%` }} />
      </div>
      {checks.length > 0 ? (
        <div className="mt-3 grid gap-1.5">
          {checks.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggleCheck(item, !item.is_done)}
              className="grid grid-cols-[20px_1fr] items-center gap-2 text-left"
            >
              <span className={`grid h-5 w-5 place-items-center rounded-full border ${item.is_done ? "border-[var(--mikke-success)] bg-[var(--mikke-success-soft)] text-[var(--mikke-success)]" : "border-[var(--mikke-line)] text-transparent"}`}>
                <Check size={12} strokeWidth={2} />
              </span>
              <span className="truncate text-xs font-bold text-[var(--mikke-text-soft)]">{item.title}</span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function FinanceMemo({ eventId, totals }: { eventId: string; totals: { revenue: number; expense: number; profit: number } }) {
  return (
    <FormCard title="収支メモ" icon={<ReceiptText size={16} strokeWidth={1.8} />}>
      <div className="grid grid-cols-[1fr_1px_1fr_1px_1fr] items-center">
        <MoneyCell label="売上" value={totals.revenue} />
        <span className="h-9 bg-[var(--mikke-line)]" />
        <MoneyCell label="経費" value={totals.expense} muted />
        <span className="h-9 bg-[var(--mikke-line)]" />
        <MoneyCell label="利益" value={totals.profit} profit />
      </div>
      <Link href={`/marketnote/finance?eventId=${eventId}`} className="block text-right text-xs font-extrabold text-[var(--mikke-success)]">収支を詳しく見る →</Link>
    </FormCard>
  );
}

function MoneyCell({ label, value, muted = false, profit = false }: { label: string; value: number; muted?: boolean; profit?: boolean }) {
  return (
    <div className="text-center">
      <p className="text-xs font-bold text-[var(--mikke-text)]">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${profit ? "text-[var(--mikke-success)]" : muted ? "text-[var(--mikke-muted)]" : "text-[var(--mikke-text)]"}`}>{formatYen(value)}</p>
    </div>
  );
}

function FormCard({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[18px] border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-3.5 shadow-[0_4px_14px_rgba(45,33,22,0.035)]">
      <div className="flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-full text-[var(--mikke-accent)]">{icon}</span>
        <h2 className="text-sm font-extrabold text-[var(--mikke-text)]">{title}</h2>
      </div>
      <div className="mt-3 space-y-2.5">{children}</div>
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="pt-1 text-xs font-extrabold text-[var(--mikke-muted-light)]">{children}</p>;
}

function CollapsibleCard({
  title,
  icon,
  open,
  onToggle,
  children
}: {
  title: string;
  icon?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[18px] border border-[var(--mikke-line)] bg-[var(--mikke-surface)] shadow-[0_4px_14px_rgba(45,33,22,0.035)]">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-2 p-3.5 text-left">
        <span className="grid h-6 w-6 place-items-center rounded-full text-[var(--mikke-accent)]">{icon}</span>
        <h2 className="text-sm font-extrabold text-[var(--mikke-text)]">{title}</h2>
        <ChevronDown size={16} className={`ml-auto text-[var(--mikke-muted)] transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? <div className="space-y-2.5 border-t border-[var(--mikke-line-soft)] px-3.5 pb-3.5 pt-3">{children}</div> : null}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-extrabold text-[var(--mikke-text-soft)]">{label}</span>
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  type = "text",
  placeholder,
  icon
}: {
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="relative">
      <input value={value} onChange={(event) => onChange(event.target.value)} type={type} placeholder={placeholder} className="h-10 w-full rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-3 pr-9 text-sm font-semibold text-[var(--mikke-text)] outline-none transition placeholder:text-[var(--mikke-muted-light)] focus:border-[var(--mikke-accent)]" />
      {icon ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--mikke-muted)]">{icon}</span> : null}
    </div>
  );
}

function SelectBox({
  value,
  options,
  onChange,
  tone
}: {
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
  tone: "orange" | "green" | "gray";
}) {
  const toneClass = tone === "green"
    ? "border-[var(--mikke-success)] bg-[var(--mikke-success-soft)] text-[var(--mikke-success)]"
    : tone === "orange"
      ? "border-[var(--mikke-primary-border)] bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent)]"
      : "border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] text-[var(--mikke-muted)]";

  return (
    <label className="relative block">
      <select value={value} onChange={(event) => onChange(event.target.value)} className={`h-10 w-full appearance-none rounded-xl border px-3 pr-7 text-xs font-extrabold outline-none ${toneClass}`}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-current" />
    </label>
  );
}

function MoneyInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="grid h-10 grid-cols-[24px_1fr] overflow-hidden rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)]">
      <span className="grid place-items-center text-xs font-bold text-[var(--mikke-muted)]">¥</span>
      <input value={value} onChange={(event) => onChange(event.target.value.replace(/\D/g, ""))} type="text" inputMode="numeric" pattern="[0-9]*" placeholder="0" className="min-w-0 bg-[var(--mikke-surface)] pr-2 text-right text-sm font-extrabold text-[var(--mikke-text)] outline-none" />
    </div>
  );
}

function StatusChip({ status, applied = false, withChevron = false }: { status: MarketEvent["status"]; applied?: boolean; withChevron?: boolean }) {
  const showApplied = applied && status === "planned";
  const tone = status === "completed" ? "success" : showApplied || status === "preparing" ? "primary" : "muted";
  return (
    <MikkeStatusBadge tone={tone} className="rounded-full py-1">
      {showApplied ? "申込済み" : statusLabel(status)}{withChevron ? <ChevronDown size={13} /> : null}
    </MikkeStatusBadge>
  );
}

function PaymentChip({ status }: { status: PaymentStatus }) {
  const tone = status === "paid" ? "success" : status === "unpaid" ? "primary" : "muted";
  return <MikkeStatusBadge tone={tone} className="rounded-full px-2 py-0.5">{paymentLabel(status)}</MikkeStatusBadge>;
}

function parseEventMeta(event: MarketEvent): EventMeta {
  const note = event.private_note ?? "";
  const endDate = matchNoteValue(note, "end_date") || event.event_date;
  const paymentMethod = normalizePaymentMethod(matchNoteValue(note, "支払い")?.split("/")[1]?.trim());

  return {
    endDate,
    multiDay: matchNoteValue(note, "複数日イベント") === "true" || endDate !== event.event_date,
    startTime: matchNoteValue(note, "開始時間") ?? "",
    endTime: matchNoteValue(note, "終了時間") ?? "",
    meetTime: matchNoteValue(note, "集合時間") ?? "",
    packUpTime: matchNoteValue(note, "撤収時間") ?? "",
    paymentMethod
  };
}

function matchNoteValue(note: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matched = note.match(new RegExp(`(?:^|\\n)${escaped}:\\s*([^\\n]+)`));
  return matched?.[1]?.trim() || null;
}

function buildPrivateNote(input: {
  status: MarketEvent["status"];
  applied: boolean;
  startDate: string;
  endDate: string;
  multiDay: boolean;
  startTime: string;
  endTime: string;
  meetTime: string;
  packUpTime: string;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  paymentAmount: string;
}) {
  return [
    `入力ステータス: ${input.applied && input.status === "planned" ? "申込済み" : statusLabel(input.status)}`,
    input.startDate ? `start_date: ${input.startDate}` : "",
    input.endDate ? `end_date: ${input.endDate}` : "",
    `複数日イベント: ${input.multiDay ? "true" : "false"}`,
    input.startTime ? `開始時間: ${input.startTime}` : "",
    input.endTime ? `終了時間: ${input.endTime}` : "",
    input.meetTime ? `集合時間: ${input.meetTime}` : "",
    input.packUpTime ? `撤収時間: ${input.packUpTime}` : "",
    input.paymentStatus !== "not_required"
      ? `支払い: ${paymentLabel(input.paymentStatus)} / ${input.paymentMethod} / ${input.paymentAmount || 0}円`
      : "支払い: 不要"
  ].filter(Boolean).join("\n");
}

function getEventPayment(checks: MarketCheckItem[], finances: MarketFinancialRecord[], fallbackMethod: PaymentMethod) {
  const paymentCheck = checks.find((check) => check.title.includes("支払い") || check.title.includes("謾ｯ謇"));
  const paymentRecord = finances.find((row) => row.record_type === "expense" && (row.title.includes("出店") || row.title.includes("蜃ｺ蠎") || row.category === "出店料"));

  if (paymentRecord) {
    return {
      status: paymentRecord.payment_status as PaymentStatus,
      method: normalizePaymentMethod(paymentRecord.memo) || fallbackMethod,
      amount: Number(paymentRecord.amount)
    };
  }

  if (paymentCheck) {
    return { status: paymentCheck.is_done ? "paid" as PaymentStatus : "unpaid" as PaymentStatus, method: fallbackMethod, amount: 0 };
  }

  return { status: "not_required" as PaymentStatus, method: fallbackMethod, amount: 0 };
}

function normalizePaymentMethod(value: string | null | undefined): PaymentMethod {
  return value?.trim() || "現金";
}

function getTotals(finances: MarketFinancialRecord[]) {
  const revenue = finances.filter((row) => row.record_type === "revenue").reduce((sum, row) => sum + Number(row.amount), 0);
  const expense = finances.filter((row) => row.record_type === "expense").reduce((sum, row) => sum + Number(row.amount), 0);
  return { revenue, expense, profit: revenue - expense };
}

function dateRangeLabel(startDate: string, endDate: string) {
  if (!startDate) return "日付未設定";
  if (!endDate || startDate === endDate) return formatDate(startDate);
  return `${formatDate(startDate)} - ${formatMonthDay(endDate)}`;
}

function timeLabel(startTime: string, endTime: string) {
  if (startTime && endTime) return `${startTime} - ${endTime}`;
  if (startTime) return `${startTime}開始`;
  if (endTime) return `${endTime}終了`;
  return "時間未設定";
}

function statusLabel(status: MarketEvent["status"]) {
  if (status === "completed") return "終了";
  if (status === "preparing") return "出店確定";
  if (status === "cancelled") return "中止";
  return "検討中";
}

function paymentLabel(status: PaymentStatus) {
  if (status === "paid") return "支払済";
  if (status === "unpaid") return "未払い";
  return "不要";
}

function statusTone(status: MarketEvent["status"]) {
  if (status === "preparing") return "orange";
  if (status === "completed") return "green";
  return "gray";
}

function paymentTone(status: PaymentStatus) {
  if (status === "paid") return "green";
  if (status === "unpaid") return "orange";
  return "gray";
}

function statusChipClass(status: MarketEvent["status"]) {
  if (status === "preparing") return "bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent)]";
  if (status === "completed") return "bg-[var(--mikke-success-soft)] text-[var(--mikke-success)]";
  return "bg-[var(--mikke-surface-soft)] text-[var(--mikke-muted)]";
}

function paymentChipClass(status: PaymentStatus) {
  if (status === "paid") return "bg-[var(--mikke-success-soft)] text-[var(--mikke-success)]";
  if (status === "unpaid") return "bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent)]";
  return "bg-[var(--mikke-surface-soft)] text-[var(--mikke-muted)]";
}

function getPaymentMethodOptions(options: string[], selected: string) {
  const values = Array.from(new Set([...options, selected].filter(Boolean)));
  return values.map((method) => ({ label: method, value: method }));
}

export default function MarketDetailPage() {
  return (
    <AuthGate allowGuest>
      <MarketDetailContent />
    </AuthGate>
  );
}
