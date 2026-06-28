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
import { AppShell } from "@/components/AppShell";
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
import type { MarketCheckItem, MarketEvent, MarketFinancialRecord, MarketReflection } from "@/types/database";

type PaymentStatus = "unpaid" | "paid" | "not_required";
type PaymentMethod = "現金" | "QR" | "カード" | "ポイント" | "その他";

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

const paymentMethods: PaymentMethod[] = ["現金", "QR", "カード", "ポイント", "その他"];

function MarketDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const [event, setEvent] = useState<MarketEvent | null>(null);
  const [checks, setChecks] = useState<MarketCheckItem[]>([]);
  const [finances, setFinances] = useState<MarketFinancialRecord[]>([]);
  const [reflection, setReflection] = useState<MarketReflection | null>(null);
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [multiDay, setMultiDay] = useState(false);
  const [status, setStatus] = useState<MarketEvent["status"]>("planned");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [meetTime, setMeetTime] = useState("");
  const [packUpTime, setPackUpTime] = useState("");
  const [venueName, setVenueName] = useState("");
  const [address, setAddress] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("not_required");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("現金");
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
      <AppShell title="出店詳細" hideHeader hideBottomNav>
        <div className="rounded-2xl border border-[#e8e1da] bg-white p-5 text-sm font-bold text-[#79716b]">読み込み中です</div>
      </AppShell>
    );
  }

  return (
    <AppShell title="出店詳細" hideHeader hideBottomNav>
      <form onSubmit={submit} className="pb-5">
        <header className="mb-4 grid grid-cols-[40px_1fr_40px] items-center pt-1">
          <button type="button" onClick={() => router.back()} className="grid h-9 w-9 place-items-center rounded-full text-[#1f1b18]" aria-label="戻る">
            <ArrowLeft size={22} strokeWidth={1.7} />
          </button>
          <h1 className="text-center text-xl font-semibold tracking-normal text-[#1f1b18]">出店詳細</h1>
          <span />
        </header>

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
          paymentStatus={paymentStatus}
          paymentMethod={paymentMethod}
          paymentAmount={paymentAmount}
          done={done}
          total={checks.length}
          progress={progress}
          checks={checks}
          onStatusChange={setStatus}
          onToggleCheck={async (item, nextValue) => {
            await toggleCheckItem(profile, item, nextValue);
            await load();
          }}
        />

        <div className="mt-3 space-y-3">
          <FormCard title="メモ" icon={<FileText size={16} strokeWidth={1.8} />}>
            <textarea value={memo} onChange={(inputEvent) => setMemo(inputEvent.target.value)} rows={2} className="w-full resize-none rounded-xl border border-[#e7e1dc] bg-white px-3 py-2.5 text-sm leading-6 text-[#1f1b18] outline-none focus:border-[#ff5a1f]" />
          </FormCard>

          <CollapsibleCard title="各項目編集" icon={<ClipboardList size={16} strokeWidth={1.8} />} open={editOpen} onToggle={() => setEditOpen((current) => !current)}>
            <SectionLabel>基本情報</SectionLabel>
            <Field label="イベント名"><TextInput value={title} onChange={setTitle} /></Field>
            <Field label={multiDay ? "開始日" : "開催日"}><TextInput value={eventDate} onChange={(value) => {
              setEventDate(value);
              if (!multiDay) setEndDate(value);
            }} type="date" icon={<CalendarDays size={15} />} /></Field>
            <button type="button" onClick={() => setMultiDay((current) => !current)} className="inline-flex items-center gap-2 text-xs font-bold text-[#6f6862]">
              <span className={`grid h-4 w-4 place-items-center rounded border ${multiDay ? "border-[#ff5a1f] bg-[#ff5a1f] text-white" : "border-[#d8d2cc] bg-white text-transparent"}`}>
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
              <SelectBox value={paymentMethod} onChange={(value) => setPaymentMethod(value as PaymentMethod)} options={paymentMethods.map((method) => ({ label: method, value: method }))} tone="gray" />
              <MoneyInput value={paymentAmount} onChange={setPaymentAmount} />
            </div>
            <div className="mt-2.5 flex w-full select-none items-center justify-center gap-2 rounded-xl border border-dashed border-[#eadfd7] bg-[#fbfaf8] px-3 py-2 text-xs font-bold text-[#b8aaa0]" aria-hidden="true">
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
                  className="grid grid-cols-[22px_1fr] items-center gap-2 rounded-xl border border-[#eee9e4] bg-white px-2.5 py-2 text-left"
                >
                  <span className={`grid h-5 w-5 place-items-center rounded-full border ${item.is_done ? "border-[#5fb878] bg-[#eaf8ee] text-[#16833b]" : "border-[#d8d2cc] text-transparent"}`}>
                    <Check size={13} strokeWidth={2} />
                  </span>
                  <span className="min-w-0 truncate text-xs font-bold text-[#3b3530]">{item.title}</span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-[1fr_40px] gap-2">
              <TextInput value={customCheck} onChange={setCustomCheck} placeholder="項目を追加" />
              <button type="button" onClick={addCustomCheck} className="grid h-10 w-10 place-items-center rounded-xl border border-[#ffb996] bg-white text-[#ff5a1f]" aria-label="項目追加">
                <Plus size={17} />
              </button>
            </div>
          </CollapsibleCard>

          <FinanceMemo totals={totals} />

          <FormCard title="振り返り" icon={<ReceiptText size={16} strokeWidth={1.8} />}>
            <textarea value={goodPoints} onChange={(inputEvent) => setGoodPoints(inputEvent.target.value)} rows={4} placeholder="今日の反応、気づいたこと、次回やることなど" className="w-full resize-none rounded-xl border border-[#e7e1dc] bg-white px-3 py-2.5 text-sm leading-6 outline-none focus:border-[#ff5a1f]" />
          </FormCard>

          <FormCard title="写真" icon={<ImageIcon size={16} strokeWidth={1.8} />}>
            <div className="grid grid-cols-[72px_1fr] gap-3">
              <div className="h-16 rounded-xl border border-[#e9dfd5] bg-[linear-gradient(135deg,#d8c2a4,#f7ead2_55%,#a97952)]" />
              <button type="button" className="flex h-16 items-center justify-center gap-2 rounded-xl border border-dashed border-[#ffb996] bg-white text-sm font-extrabold text-[#ff5a1f]">
                <Camera size={16} />
                写真を追加
              </button>
            </div>
          </FormCard>

          {message ? <p className="rounded-xl bg-[#fff0e9] px-4 py-3 text-sm font-bold text-[#8f3d22]">{message}</p> : null}

          <div className="space-y-2.5 pt-0.5">
            <button type="submit" disabled={!canSave} className="w-full rounded-xl bg-[#ff5a1f] px-4 py-3.5 text-base font-extrabold text-white shadow-[0_8px_18px_rgba(255,90,31,0.16)] disabled:opacity-50">
              {saving ? "保存中..." : "変更を保存"}
            </button>
            <Link href="/marketnote" className="block w-full rounded-xl border border-[#ff8a5c] bg-white px-4 py-3 text-center text-sm font-extrabold text-[#ff5a1f]">
              閉じる
            </Link>
          </div>
        </div>
      </form>
    </AppShell>
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
    <section className="rounded-[18px] border border-[#e7e1dc] bg-white p-4 shadow-[0_4px_14px_rgba(45,33,22,0.04)]">
      <div className="relative w-fit">
        <button type="button" onClick={() => setStatusMenuOpen((current) => !current)} aria-expanded={statusMenuOpen}>
          <StatusChip status={status} withChevron />
        </button>
        {statusMenuOpen ? (
          <div className="absolute left-0 top-8 z-20 w-32 overflow-hidden rounded-xl border border-[#e8dfd8] bg-white py-1 shadow-[0_8px_22px_rgba(45,33,22,0.12)]">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onStatusChange(option.value);
                  setStatusMenuOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-xs font-extrabold text-[#3b3530] hover:bg-[#fff7f2]"
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <h2 className="mt-3 truncate text-xl font-extrabold tracking-normal text-[#1f1b18]">{title}</h2>
      <div className="mt-3 grid gap-1.5 text-sm font-semibold text-[#4a423c]">
        <span className="flex min-w-0 items-center gap-2"><Clock3 size={16} className="text-[#8a817a]" />{dateRangeLabel(eventDate, endDate)} / {timeLabel(startTime, endTime)}</span>
        <span className="flex min-w-0 items-center gap-2"><Clock3 size={16} className="text-[#8a817a]" />集合 {meetTime || "未設定"} / 撤収 {packUpTime || "未設定"}</span>
        <span className="flex min-w-0 items-center gap-2"><MapPin size={16} className="text-[#8a817a]" />{[venueName, address].filter(Boolean).join(" / ") || "会場未設定"}</span>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs font-bold text-[#3b3530]">
        <span className="min-w-0 truncate">支払い：<PaymentChip status={paymentStatus} /> <span className="ml-1 text-[#6f6862]">{paymentMethod} / {formatYen(Number(paymentAmount || 0))}</span></span>
        <span>タスク {done}/{total}</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#eee8e2]">
        <div className="h-full rounded-full bg-[#ff5a1f]" style={{ width: `${progress}%` }} />
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
              <span className={`grid h-5 w-5 place-items-center rounded-full border ${item.is_done ? "border-[#5fb878] bg-[#eaf8ee] text-[#16833b]" : "border-[#d8d2cc] text-transparent"}`}>
                <Check size={12} strokeWidth={2} />
              </span>
              <span className="truncate text-xs font-bold text-[#3b3530]">{item.title}</span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function FinanceMemo({ totals }: { totals: { revenue: number; expense: number; profit: number } }) {
  return (
    <FormCard title="収支メモ" icon={<ReceiptText size={16} strokeWidth={1.8} />}>
      <div className="grid grid-cols-[1fr_1px_1fr_1px_1fr] items-center">
        <MoneyCell label="売上" value={totals.revenue} />
        <span className="h-9 bg-[#eee9e4]" />
        <MoneyCell label="経費" value={totals.expense} muted />
        <span className="h-9 bg-[#eee9e4]" />
        <MoneyCell label="利益" value={totals.profit} profit />
      </div>
      <div className="text-right text-xs font-extrabold text-[#16833b]">収支を詳しく見る →</div>
    </FormCard>
  );
}

function MoneyCell({ label, value, muted = false, profit = false }: { label: string; value: number; muted?: boolean; profit?: boolean }) {
  return (
    <div className="text-center">
      <p className="text-xs font-bold text-[#1f1b18]">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${profit ? "text-[#16833b]" : muted ? "text-[#6f6862]" : "text-[#1f1b18]"}`}>{formatYen(value)}</p>
    </div>
  );
}

function FormCard({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[18px] border border-[#e7e1dc] bg-white p-3.5 shadow-[0_4px_14px_rgba(45,33,22,0.035)]">
      <div className="flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-full text-[#ff5a1f]">{icon}</span>
        <h2 className="text-sm font-extrabold text-[#1f1b18]">{title}</h2>
      </div>
      <div className="mt-3 space-y-2.5">{children}</div>
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="pt-1 text-xs font-extrabold text-[#8a817a]">{children}</p>;
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
    <section className="rounded-[18px] border border-[#e7e1dc] bg-white shadow-[0_4px_14px_rgba(45,33,22,0.035)]">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-2 p-3.5 text-left">
        <span className="grid h-6 w-6 place-items-center rounded-full text-[#ff5a1f]">{icon}</span>
        <h2 className="text-sm font-extrabold text-[#1f1b18]">{title}</h2>
        <ChevronDown size={16} className={`ml-auto text-[#5f5a55] transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? <div className="space-y-2.5 border-t border-[#f3eee9] px-3.5 pb-3.5 pt-3">{children}</div> : null}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-extrabold text-[#3b3530]">{label}</span>
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
      <input value={value} onChange={(event) => onChange(event.target.value)} type={type} placeholder={placeholder} className="h-10 w-full rounded-xl border border-[#e7e1dc] bg-white px-3 pr-9 text-sm font-semibold text-[#1f1b18] outline-none transition placeholder:text-[#b4aaa2] focus:border-[#ff5a1f]" />
      {icon ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#5f5a55]">{icon}</span> : null}
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
    ? "border-[#68bd7d] bg-[#f1fbf3] text-[#16833b]"
    : tone === "orange"
      ? "border-[#ffb996] bg-[#fff6f1] text-[#ff5a1f]"
      : "border-[#cbc4bd] bg-[#f7f5f2] text-[#5f5a55]";

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
    <div className="grid h-10 grid-cols-[24px_1fr] overflow-hidden rounded-xl border border-[#e7e1dc] bg-white">
      <span className="grid place-items-center text-xs font-bold text-[#5f5a55]">¥</span>
      <input value={value} onChange={(event) => onChange(event.target.value.replace(/\D/g, ""))} type="text" inputMode="numeric" pattern="[0-9]*" placeholder="0" className="min-w-0 bg-white pr-2 text-right text-sm font-extrabold text-[#1f1b18] outline-none" />
    </div>
  );
}

function StatusChip({ status, withChevron = false }: { status: MarketEvent["status"]; withChevron?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-extrabold ${statusChipClass(status)}`}>
      {statusLabel(status)}{withChevron ? <ChevronDown size={13} /> : null}
    </span>
  );
}

function PaymentChip({ status }: { status: PaymentStatus }) {
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-extrabold ${paymentChipClass(status)}`}>{paymentLabel(status)}</span>;
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
    `入力ステータス: ${statusLabel(input.status)}`,
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
  if (value === "QR" || value === "カード" || value === "ポイント" || value === "その他") return value;
  return "現金";
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
  if (status === "preparing") return "bg-[#fff0e7] text-[#ff5a1f]";
  if (status === "completed") return "bg-[#eaf8ee] text-[#16833b]";
  return "bg-[#f3f0ed] text-[#6f6862]";
}

function paymentChipClass(status: PaymentStatus) {
  if (status === "paid") return "bg-[#eaf8ee] text-[#16833b]";
  if (status === "unpaid") return "bg-[#fff0e7] text-[#ff5a1f]";
  return "bg-[#f3f0ed] text-[#6f6862]";
}

export default function MarketDetailPage() {
  return (
    <AuthGate>
      <MarketDetailContent />
    </AuthGate>
  );
}
