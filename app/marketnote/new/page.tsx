"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  FileText,
  MapPin,
  Plus,
  X
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AuthGate, useAuth } from "@/components/AuthGate";
import { addCheckItem, addFinancialRecord, createMarketEvent, toggleCheckItem } from "@/lib/marketnote";
import type { MarketEvent } from "@/types/database";

type EntryStatus = "planned" | "applied" | "preparing";
type PaymentStatus = "unpaid" | "paid" | "not_required";

const statusOptions: Array<{ label: string; value: EntryStatus }> = [
  { label: "検討中", value: "planned" },
  { label: "申込済み", value: "applied" },
  { label: "出店確定", value: "preparing" }
];

const paymentStatusOptions: Array<{ label: string; value: PaymentStatus }> = [
  { label: "未払い", value: "unpaid" },
  { label: "支払済", value: "paid" },
  { label: "不要", value: "not_required" }
];

const paymentMethods = ["現金", "QR", "カード", "ポイント", "その他"] as const;

const commonCheckItems = [
  "出店料を支払う",
  "ブース位置を確認",
  "持ち物を準備",
  "搬入時間を確認",
  "告知文を投稿"
];

function NewMarketEventContent() {
  const router = useRouter();
  const { profile } = useAuth();
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [multiDay, setMultiDay] = useState(false);
  const [status, setStatus] = useState<EntryStatus>("preparing");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [meetTime, setMeetTime] = useState("");
  const [packUpTime, setPackUpTime] = useState("");
  const [venueName, setVenueName] = useState("");
  const [address, setAddress] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("unpaid");
  const [paymentMethod, setPaymentMethod] = useState<(typeof paymentMethods)[number]>("QR");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [selectedChecks, setSelectedChecks] = useState<string[]>(commonCheckItems.slice(0, 3));
  const [customCheck, setCustomCheck] = useState("");
  const [timeOpen, setTimeOpen] = useState(false);
  const [venueOpen, setVenueOpen] = useState(false);
  const [checksOpen, setChecksOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const initialStartDate = new URLSearchParams(window.location.search).get("startDate");
    if (initialStartDate) {
      setStartDate(initialStartDate);
      setEndDate(initialStartDate);
    }
  }, []);

  const normalizedEndDate = multiDay ? (endDate || startDate) : startDate;
  const canSave = title.trim().length > 0 && startDate.length > 0 && !saving;

  const privateNote = useMemo(() => {
    return [
      `入力ステータス: ${statusLabel(status)}`,
      startDate ? `start_date: ${startDate}` : "",
      normalizedEndDate ? `end_date: ${normalizedEndDate}` : "",
      `複数日イベント: ${multiDay ? "true" : "false"}`,
      startTime ? `開始時間: ${startTime}` : "",
      endTime ? `終了時間: ${endTime}` : "",
      meetTime ? `集合時間: ${meetTime}` : "",
      packUpTime ? `撤収時間: ${packUpTime}` : "",
      paymentStatus !== "not_required"
        ? `支払い: ${paymentLabel(paymentStatus)} / ${paymentMethod} / ${paymentAmount || 0}円`
        : "支払い: 不要"
    ].filter(Boolean).join("\n");
  }, [endTime, meetTime, multiDay, normalizedEndDate, packUpTime, paymentAmount, paymentMethod, paymentStatus, startDate, startTime, status]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) return;

    if (multiDay && normalizedEndDate < startDate) {
      setError("終了日は開始日以降にしてください。");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const created = await createMarketEvent(profile, {
        title: title.trim(),
        eventDate: startDate,
        venueName: venueName.trim(),
        area: address.trim(),
        genre: "出店",
        status: status === "preparing" ? "preparing" : "planned",
        publicNote: memo.trim(),
        privateNote
      });

      await savePayment(created);
      await saveChecks(created);

      router.replace(`/marketnote/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました。");
      setSaving(false);
    }
  }

  async function savePayment(created: MarketEvent) {
    if (paymentStatus === "not_required") return;

    const paymentCheck = await addCheckItem(profile, created.id, "支払い済み");
    if (paymentStatus === "paid") {
      await toggleCheckItem(profile, paymentCheck, true);
    }

    const amount = Number(paymentAmount || 0);
    if (amount > 0) {
      await addFinancialRecord(profile, {
        marketEventId: created.id,
        recordType: "expense",
        title: "出店料",
        amount,
        occurredAt: startDate,
        category: "出店料",
        memo: paymentMethod,
        paymentStatus
      });
    }
  }

  async function saveChecks(created: MarketEvent) {
    const items = Array.from(new Set([
      ...selectedChecks,
      customCheck.trim()
    ].filter(Boolean)));

    await Promise.all(items.map((item) => addCheckItem(profile, created.id, item)));
  }

  function toggleCheck(label: string) {
    setSelectedChecks((current) => (
      current.includes(label)
        ? current.filter((item) => item !== label)
        : [...current, label]
    ));
  }

  return (
    <AppShell title="出店予定を追加" hideHeader>
      <form onSubmit={submit} className="pb-6">
        <header className="mb-5 flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="grid h-10 w-10 place-items-center rounded-full border border-[#eee9e4] bg-white text-[#5f5a55] shadow-[0_4px_12px_rgba(45,33,22,0.035)]"
            aria-label="戻る"
          >
            <ArrowLeft size={20} strokeWidth={1.7} />
          </button>
          <h1 className="text-xl font-semibold tracking-normal text-[#1f1b18]">出店予定を追加</h1>
          <Link
            href="/marketnote"
            className="grid h-10 w-10 place-items-center rounded-full border border-[#f3d0be] bg-white text-[#f46a14] shadow-[0_4px_12px_rgba(45,33,22,0.035)]"
            aria-label="閉じる"
          >
            <X size={20} strokeWidth={1.7} />
          </Link>
        </header>

        <div className="space-y-4">
          <FormCard title="基本情報">
            <Field label="イベント名" required>
              <TextInput value={title} onChange={setTitle} placeholder="Mikke bazar vol.12" required />
            </Field>

            {multiDay ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="開始日" required compact>
                  <TextInput
                    value={startDate}
                    onChange={(value) => {
                      setStartDate(value);
                      if (!endDate || endDate < value) setEndDate(value);
                    }}
                    type="date"
                    required
                    icon={<CalendarDays size={17} />}
                  />
                </Field>
                <Field label="終了日" required compact>
                  <TextInput value={endDate} onChange={setEndDate} type="date" required icon={<CalendarDays size={17} />} />
                </Field>
              </div>
            ) : (
              <Field label="開催日" required>
                <TextInput
                  value={startDate}
                  onChange={(value) => {
                    setStartDate(value);
                    setEndDate(value);
                  }}
                  type="date"
                  required
                  icon={<CalendarDays size={17} />}
                />
              </Field>
            )}

            <button
              type="button"
              onClick={() => {
                setMultiDay((current) => {
                  const next = !current;
                  if (next && !endDate) setEndDate(startDate);
                  return next;
                });
              }}
              className="inline-flex items-center gap-2 text-xs font-bold text-[#5f5a55]"
            >
              <span className={`grid h-4 w-4 place-items-center rounded border ${multiDay ? "border-[#f46a14] bg-[#f46a14] text-white" : "border-[#d8d2cc] bg-white text-transparent"}`}>
                <Check size={11} strokeWidth={2} />
              </span>
              複数日イベント
            </button>

            <Field label="ステータス">
              <Segmented
                options={statusOptions}
                value={status}
                onChange={setStatus}
                getTone={(value) => value === "preparing" ? "orange" : value === "applied" ? "green" : "gray"}
              />
            </Field>
          </FormCard>

          <AccordionCard title="日時詳細" icon={<Clock3 size={18} />} open={timeOpen} onToggle={() => setTimeOpen((value) => !value)}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="開始時間" compact>
                <TextInput value={startTime} onChange={setStartTime} type="time" />
              </Field>
              <Field label="終了時間" compact>
                <TextInput value={endTime} onChange={setEndTime} type="time" />
              </Field>
              <Field label="集合時間" compact>
                <TextInput value={meetTime} onChange={setMeetTime} type="time" />
              </Field>
              <Field label="撤収時間" compact>
                <TextInput value={packUpTime} onChange={setPackUpTime} type="time" />
              </Field>
            </div>
          </AccordionCard>

          <AccordionCard title="会場情報" icon={<MapPin size={18} />} open={venueOpen} onToggle={() => setVenueOpen((value) => !value)}>
            <Field label="会場名">
              <TextInput value={venueName} onChange={setVenueName} placeholder="MILKROAD CAFE" />
            </Field>
            <Field label="住所">
              <TextInput value={address} onChange={setAddress} placeholder="東京都墨田区..." />
            </Field>
          </AccordionCard>

          <FormCard title="支払い情報">
            <Field label="状況">
              <Segmented
                options={paymentStatusOptions}
                value={paymentStatus}
                onChange={setPaymentStatus}
                getTone={(value) => value === "paid" ? "green" : value === "unpaid" ? "orange" : "gray"}
              />
            </Field>
            <Field label="方法">
              <div className="grid grid-cols-5 gap-1.5">
                {paymentMethods.map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`min-h-10 rounded-xl border px-1 text-xs font-bold transition ${
                      paymentMethod === method
                        ? "border-[#f46a14] bg-[#fff2e8] text-[#f46a14]"
                        : "border-[#eee9e4] bg-white text-[#6f6862]"
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="金額">
              <div className="grid grid-cols-[44px_1fr] overflow-hidden rounded-xl border border-[#eee9e4] bg-white">
                <span className="grid place-items-center border-r border-[#eee9e4] text-sm font-bold text-[#9a9089]">¥</span>
                <input
                  value={paymentAmount}
                  onChange={(event) => setPaymentAmount(event.target.value)}
                  inputMode="numeric"
                  placeholder="0"
                  className="min-h-11 min-w-0 bg-white px-3 text-right text-sm font-bold text-[#1f1b18] outline-none"
                />
              </div>
            </Field>
            <button
              type="button"
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[#f3d0be] bg-white px-4 py-3 text-sm font-extrabold text-[#f46a14]"
            >
              <Plus size={16} strokeWidth={1.8} />
              支払い追加
            </button>
          </FormCard>

          <FormCard title="メモ" icon={<FileText size={18} />}>
            <textarea
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              rows={5}
              placeholder="出店条件、搬入メモ、主催者からの連絡など"
              className="w-full resize-none rounded-2xl border border-[#eee9e4] bg-white px-4 py-3 text-sm leading-6 text-[#1f1b18] outline-none transition placeholder:text-[#b4aaa2] focus:border-[#f46a14]"
            />
          </FormCard>

          <AccordionCard title="チェック項目" open={checksOpen} onToggle={() => setChecksOpen((value) => !value)}>
            <div className="flex flex-wrap gap-2">
              {commonCheckItems.map((item) => {
                const active = selectedChecks.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleCheck(item)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-bold ${
                      active
                        ? "border-[#f3d0be] bg-[#fff2e8] text-[#f46a14]"
                        : "border-[#eee9e4] bg-white text-[#6f6862]"
                    }`}
                  >
                    {active ? <Check size={13} strokeWidth={1.8} /> : null}
                    {item}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
              <TextInput value={customCheck} onChange={setCustomCheck} placeholder="項目を追加" />
              <button
                type="button"
                onClick={() => {
                  if (!customCheck.trim()) return;
                  setSelectedChecks((current) => Array.from(new Set([...current, customCheck.trim()])));
                  setCustomCheck("");
                }}
                className="grid h-11 w-11 place-items-center rounded-xl border border-[#f3d0be] bg-white text-[#f46a14]"
                aria-label="項目追加"
              >
                <Plus size={18} />
              </button>
            </div>
          </AccordionCard>

          {error ? <p className="rounded-2xl bg-[#fff0e9] px-4 py-3 text-sm font-bold text-[#8f3d22]">{error}</p> : null}

          <div className="space-y-3 pt-1">
            <p className="text-center text-xs font-bold text-[#8a817a]">イベント名と開催日だけでも保存できます</p>
            <button
              type="submit"
              disabled={!canSave}
              className="w-full rounded-2xl bg-[#f46a14] px-4 py-4 text-base font-extrabold text-white shadow-[0_8px_18px_rgba(244,106,20,0.18)] disabled:opacity-50"
            >
              {saving ? "保存中..." : "出店予定を保存"}
            </button>
            <Link
              href="/marketnote"
              className="block w-full rounded-2xl border border-[#f3d0be] bg-white px-4 py-3 text-center text-sm font-extrabold text-[#f46a14]"
            >
              閉じる
            </Link>
          </div>
        </div>
      </form>
    </AppShell>
  );
}

function FormCard({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[22px] border border-[#eee9e4] bg-white p-4 shadow-[0_5px_16px_rgba(45,33,22,0.04)]">
      <SectionHeading title={title} icon={icon} />
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function AccordionCard({
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
    <section className="rounded-[22px] border border-[#eee9e4] bg-white shadow-[0_5px_16px_rgba(45,33,22,0.04)]">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-3 p-4 text-left">
        <SectionHeading title={title} icon={icon} />
        <ChevronDown size={19} className={`shrink-0 text-[#8a817a] transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? <div className="border-t border-[#f3eee9] px-4 pb-4 pt-3">{children}</div> : null}
    </section>
  );
}

function SectionHeading({ title, icon }: { title: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-8 w-8 place-items-center rounded-full bg-[#fff2e8] text-[#f46a14]">
        {icon ?? <span className="h-2 w-2 rounded-full bg-[#f46a14]" />}
      </span>
      <h2 className="text-base font-extrabold text-[#1f1b18]">{title}</h2>
    </div>
  );
}

function Field({
  label,
  required = false,
  compact = false,
  children
}: {
  label: string;
  required?: boolean;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={compact ? "block" : "grid gap-2"}>
      <span className="text-xs font-extrabold text-[#4c433d]">
        {label}{required ? <span className="text-[#f46a14]">*</span> : null}
      </span>
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
  icon
}: {
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="relative">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        required={required}
        placeholder={placeholder}
        className="min-h-11 w-full rounded-xl border border-[#eee9e4] bg-white px-3 py-3 pr-10 text-sm font-semibold text-[#1f1b18] outline-none transition placeholder:text-[#b4aaa2] focus:border-[#f46a14]"
      />
      {icon ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8a817a]">{icon}</span> : null}
    </div>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  getTone
}: {
  options: Array<{ label: string; value: T }>;
  value: T;
  onChange: (value: T) => void;
  getTone: (value: T) => "orange" | "green" | "gray";
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {options.map((option) => {
        const active = option.value === value;
        const tone = getTone(option.value);
        const activeClass = tone === "green"
          ? "border-[#9ed8ae] bg-[#eefaf1] text-[#16833b]"
          : tone === "orange"
            ? "border-[#f3d0be] bg-[#fff2e8] text-[#f46a14]"
            : "border-[#ded9d4] bg-[#f5f3f1] text-[#5f5a55]";

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`min-h-10 rounded-xl border px-1.5 text-xs font-extrabold transition ${
              active ? activeClass : "border-[#eee9e4] bg-white text-[#6f6862]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function statusLabel(status: EntryStatus) {
  if (status === "preparing") return "出店確定";
  if (status === "applied") return "申込済み";
  return "検討中";
}

function paymentLabel(status: PaymentStatus) {
  if (status === "paid") return "支払済";
  if (status === "unpaid") return "未払い";
  return "不要";
}

export default function NewMarketEventPage() {
  return (
    <AuthGate>
      <NewMarketEventContent />
    </AuthGate>
  );
}
