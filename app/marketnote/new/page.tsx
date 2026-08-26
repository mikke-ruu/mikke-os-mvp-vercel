"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardList,
  Clock3,
  FileText,
  MapPin,
  Plus,
  WalletCards,
  X
} from "lucide-react";
import { MarketNoteShell } from "@/components/marketnote/MarketNoteShell";
import { AuthGate, useAuth } from "@/components/AuthGate";
import { getActiveCheckItems, getInitiallySelectedCheckItems, loadCheckTemplate, resolveDueDate } from "@/lib/check-templates";
import { formatMonthDayWeekday, toDateKey } from "@/lib/format";
import { addCheckItem, addFinancialRecord, createMarketEvent, createMarketEvents } from "@/lib/marketnote";
import { getMarketEventTypeNames, loadMarketEventTypeSettingsForProfile } from "@/lib/marketnote-event-types";
import {
  addDaysToDateKey,
  buildRecurringEventDates,
  daysBetweenDateKeys,
  marketEventRecurrenceOptions,
  MAX_RECURRING_EVENTS,
  recurringEventDatesExceedLimit,
  type MarketEventRecurrence
} from "@/lib/marketnote-recurrence";
import { fixedPaymentMethodNames } from "@/lib/payment-methods";
import type { MarketEvent } from "@/types/database";

type EntryStatus = "planned" | "applied" | "preparing";
type PaymentStatus = "unpaid" | "paid" | "not_required";
type PaymentMethod = string;
type PaymentEntry = {
  id: string;
  title: string;
  status: PaymentStatus;
  method: PaymentMethod;
  amount: string;
};

const paymentStatusOptions: Array<{ label: string; value: PaymentStatus }> = [
  { label: "未払い", value: "unpaid" },
  { label: "支払済", value: "paid" },
  { label: "不要", value: "not_required" }
];

function NewMarketEventContent() {
  const router = useRouter();
  const { profile, isGuest } = useAuth();
  const [eventType, setEventType] = useState("出店");
  const [eventTypes, setEventTypes] = useState<string[]>(["出店"]);
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [multiDay, setMultiDay] = useState(false);
  const [recurrence, setRecurrence] = useState<MarketEventRecurrence>("none");
  const [repeatUntil, setRepeatUntil] = useState("");
  const [copyPaymentsToRecurring, setCopyPaymentsToRecurring] = useState(false);
  const [copyChecksToRecurring, setCopyChecksToRecurring] = useState(false);
  const [status, setStatus] = useState<EntryStatus>("preparing");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [meetTime, setMeetTime] = useState("");
  const [packUpTime, setPackUpTime] = useState("");
  const [venueName, setVenueName] = useState("");
  const [address, setAddress] = useState("");
  const [payments, setPayments] = useState<PaymentEntry[]>([
    { id: "payment-1", title: "出店料", status: "unpaid", method: "現金", amount: "" }
  ]);
  const [memo, setMemo] = useState("");
  const [templateChecks, setTemplateChecks] = useState<string[]>([]);
  const [templateDueRules, setTemplateDueRules] = useState<Record<string, string>>({});
  const [selectedChecks, setSelectedChecks] = useState<string[]>([]);
  const [customChecks, setCustomChecks] = useState<string[]>([]);
  const [customCheck, setCustomCheck] = useState("");
  const [timeOpen, setTimeOpen] = useState(false);
  const [venueOpen, setVenueOpen] = useState(false);
  const [checksOpen, setChecksOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const initialStartDate = new URLSearchParams(window.location.search).get("startDate") || toDateKey(new Date());
    setStartDate(initialStartDate);
    setEndDate(initialStartDate);
    void loadMarketEventTypeSettingsForProfile(profile).then((settings) => {
      const nextEventTypes = getMarketEventTypeNames(settings);
      setEventTypes(nextEventTypes.length ? nextEventTypes : ["出店"]);
      setEventType((current) => nextEventTypes.includes(current) ? current : (nextEventTypes[0] ?? "出店"));
    }).catch(() => setError("予定の種類を読み込めませんでした。"));

    const template = loadCheckTemplate();
    const activeTemplateItems = getActiveCheckItems(template);
    setTemplateChecks(activeTemplateItems.map((item) => item.title));
    setTemplateDueRules(Object.fromEntries(activeTemplateItems.map((item) => [item.title, item.dueRule])));
    setSelectedChecks(getInitiallySelectedCheckItems(template).map((item) => item.title));
  }, [profile]);

  const normalizedEndDate = multiDay ? (endDate || startDate) : startDate;
  const canSave = title.trim().length > 0 && startDate.length > 0 && !saving;
  const statusOptions = useMemo<Array<{ label: string; value: EntryStatus }>>(() => [
    { label: "検討中", value: "planned" },
    { label: eventType === "出店" ? "申込済み" : "調整中", value: "applied" },
    { label: "確定", value: "preparing" }
  ], [eventType]);

  const recurringDates = useMemo(() => buildRecurringEventDates(startDate, repeatUntil, recurrence), [recurrence, repeatUntil, startDate]);
  const recurrenceTooLong = useMemo(() => recurringEventDatesExceedLimit(startDate, repeatUntil, recurrence), [recurrence, repeatUntil, startDate]);

  function buildPrivateNote(occurrenceStartDate: string, occurrenceEndDate: string, recurrenceId: string | null) {
    return [
      `入力ステータス: ${statusLabel(status, eventType)}`,
      occurrenceStartDate ? `start_date: ${occurrenceStartDate}` : "",
      occurrenceEndDate ? `end_date: ${occurrenceEndDate}` : "",
      `複数日イベント: ${multiDay ? "true" : "false"}`,
      recurrenceId ? "繰り返し予定: true" : "",
      recurrenceId ? `繰り返しID: ${recurrenceId}` : "",
      recurrenceId ? `繰り返しルール: ${recurrence}` : "",
      startTime ? `開始時間: ${startTime}` : "",
      endTime ? `終了時間: ${endTime}` : "",
      meetTime ? `集合時間: ${meetTime}` : "",
      packUpTime ? `撤収時間: ${packUpTime}` : "",
      ...payments.filter((payment) => payment.title.trim() || payment.amount).map((payment) => payment.status !== "not_required"
        ? `事前経費: ${payment.title || "経費"} / ${paymentLabel(payment.status)} / ${payment.method} / ${payment.amount || 0}円`
        : `事前経費: ${payment.title || "経費"} / 不要`)
    ].filter(Boolean).join("\n");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) return;

    if (multiDay && normalizedEndDate < startDate) {
      setError("終了日は開始日以降にしてください。");
      return;
    }
    if (recurrence !== "none" && (!repeatUntil || repeatUntil < startDate)) {
      setError("繰り返しの終了日は予定日以降にしてください。");
      return;
    }
    if (recurrenceTooLong) {
      setError(`繰り返し予定は一度に${MAX_RECURRING_EVENTS}件まで作成できます。終了日を短くしてください。`);
      return;
    }

    setSaving(true);
    setError("");

    try {
      const dates = recurrence === "none" ? [startDate] : recurringDates;
      const recurrenceId = dates.length > 1 ? createRecurrenceId() : null;
      const durationDays = multiDay ? daysBetweenDateKeys(startDate, normalizedEndDate) : 0;
      const eventInputs = dates.map((occurrenceStartDate) => {
        const occurrenceEndDate = addDaysToDateKey(occurrenceStartDate, durationDays);
        return {
          title: title.trim(),
          eventDate: occurrenceStartDate,
          venueName: venueName.trim(),
          area: address.trim(),
          genre: eventType,
          status: status === "preparing" ? "preparing" : "planned",
          publicNote: memo.trim(),
          privateNote: buildPrivateNote(occurrenceStartDate, occurrenceEndDate, recurrenceId)
        } as const;
      });
      const createdEvents = dates.length === 1 ? [await createMarketEvent(profile, eventInputs[0])] : await createMarketEvents(profile, eventInputs);
      for (let offset = 0; offset < createdEvents.length; offset += 4) {
        const batch = createdEvents.slice(offset, offset + 4);
        await Promise.all(batch.map((created) => Promise.all([
          recurrence === "none" || copyPaymentsToRecurring ? savePayment(created, created.event_date) : Promise.resolve(),
          recurrence === "none" || copyChecksToRecurring ? saveChecks(created, created.event_date) : Promise.resolve()
        ])));
      }
      if (createdEvents.length === 1) router.replace(`/marketnote/${createdEvents[0].id}`);
      else router.replace("/marketnote");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました。");
      setSaving(false);
    }
  }

  async function savePayment(created: MarketEvent, occurrenceDate: string) {
    const requiredPayments = payments.filter((payment) => payment.status !== "not_required" && Number(payment.amount || 0) > 0);
    if (requiredPayments.length === 0) return;

    await Promise.all(requiredPayments.map((payment) => {
      const amount = Number(payment.amount || 0);
      if (amount <= 0) return Promise.resolve(null);
      return addFinancialRecord(profile, {
        marketEventId: created.id,
        recordType: "expense",
        title: payment.title.trim() || "事前経費",
        amount,
        occurredAt: payment.status === "paid" ? toDateKey(new Date()) : occurrenceDate,
        category: payment.title.trim() || "事前経費",
        memo: "",
        paymentStatus: payment.status,
        paymentMethod: payment.method,
        entryKind: "advance_expense"
      });
    }));
  }

  function updatePayment(id: string, patch: Partial<Omit<PaymentEntry, "id">>) {
    setPayments((current) => current.map((payment) => payment.id === id ? { ...payment, ...patch } : payment));
  }

  function selectEventType(nextType: string) {
    setEventType(nextType);
    setPayments((current) => current.map((payment, index) => (
      index === 0 && (payment.title === "出店料" || payment.title === "事前経費")
        ? { ...payment, title: nextType === "出店" ? "出店料" : "事前経費" }
        : payment
    )));
  }

  function addPayment() {
    setPayments((current) => [
      ...current,
      { id: `payment-${Date.now()}`, title: "", status: "unpaid", method: fixedPaymentMethodNames[0] ?? "現金", amount: "" }
    ]);
  }

  async function saveChecks(created: MarketEvent, occurrenceDate: string) {
    const items = Array.from(new Set([
      ...selectedChecks,
      customCheck.trim()
    ].filter(Boolean)));

    await Promise.all(items.map((item) => {
      const rule = templateDueRules[item];
      const dueDate = rule ? resolveDueDate(rule as Parameters<typeof resolveDueDate>[0], occurrenceDate) : null;
      return addCheckItem(profile, created.id, item, dueDate);
    }));
  }

  function toggleCheck(label: string) {
    setSelectedChecks((current) => (
      current.includes(label)
        ? current.filter((item) => item !== label)
        : [...current, label]
    ));
  }

  return (
    <MarketNoteShell title="予定を追加" subtitle="MarketNote" isGuest={isGuest} hideBottomNav>
      <form onSubmit={submit} className="min-w-0 max-w-full overflow-x-clip pb-28">
        <header className="mb-4 grid grid-cols-[40px_1fr_40px] items-center pt-1">
          <button
            type="button"
            onClick={() => router.back()}
            className="grid h-9 w-9 place-items-center rounded-full text-[var(--mikke-text)]"
            aria-label="戻る"
          >
            <ArrowLeft size={22} strokeWidth={1.7} />
          </button>
          <h1 className="text-center text-xl font-semibold tracking-normal text-[var(--mikke-text)]">予定を追加</h1>
          <Link href="/marketnote" className="grid h-9 w-9 place-items-center rounded-full text-[var(--mikke-muted)]" aria-label="閉じる">
            <X size={20} strokeWidth={1.7} />
          </Link>
        </header>

        <div className="space-y-3">
          {isGuest ? <GuestNotice /> : null}

          <FormCard title="予定の種類" tone="blue" icon={<CalendarDays size={16} />}>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {eventTypes.map((type) => (
                <button key={type} type="button" onClick={() => selectEventType(type)} className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold ${eventType === type ? "border-[var(--mikke-blue)] bg-[var(--mikke-blue)] text-white" : "border-[var(--mikke-line)] bg-white text-[var(--mikke-muted)]"}`}>{type}</button>
              ))}
            </div>
            <Link href="/settings/event-types" className="inline-flex min-h-9 items-center text-xs font-bold text-[var(--mikke-blue)]">予定の種類を設定</Link>
          </FormCard>

          <FormCard title="基本情報" tone="blue" icon={<ClipboardList size={16} strokeWidth={1.8} />}>
            <div className="grid min-w-0 grid-cols-1 gap-3 min-[360px]:grid-cols-[minmax(0,1fr)_minmax(0,0.86fr)]">
              <Field label="予定名" required compact>
                <TextInput value={title} onChange={setTitle} placeholder="例）ハンドメイドフェス" required />
              </Field>
              {multiDay ? (
                <Field label="開始日" required compact>
                  <TextInput
                    value={startDate}
                    onChange={(value) => {
                      setStartDate(value);
                      if (!endDate || endDate < value) setEndDate(value);
                    }}
                    type="date"
                    required
                    icon={<CalendarDays size={15} />}
                  />
                </Field>
              ) : (
                <Field label="予定日" required compact>
                  <TextInput
                    value={startDate}
                    onChange={(value) => {
                      setStartDate(value);
                      setEndDate(value);
                    }}
                    type="date"
                    required
                    icon={<CalendarDays size={15} />}
                  />
                </Field>
              )}
            </div>

            {multiDay ? (
              <div className="grid min-w-0 grid-cols-1 gap-3 min-[360px]:grid-cols-[minmax(0,1fr)_minmax(0,0.86fr)]">
                <span className="hidden min-[360px]:block" />
                <Field label="終了日" required compact>
                  <TextInput value={endDate} onChange={setEndDate} type="date" required icon={<CalendarDays size={15} />} />
                </Field>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => {
                setMultiDay((current) => {
                  const next = !current;
                  if (next && !endDate) setEndDate(startDate);
                  return next;
                });
              }}
              className="inline-flex min-h-10 items-center gap-2 text-xs font-bold text-[var(--mikke-muted)]"
            >
              <span className={`grid h-4 w-4 place-items-center rounded border ${multiDay ? "border-[var(--mikke-blue)] bg-[var(--mikke-blue)] text-white" : "border-[var(--mikke-line)] bg-white text-transparent"}`}>
                <Check size={11} strokeWidth={2} />
              </span>
              複数日の予定
            </button>

            <button
              type="button"
              onClick={() => {
                setRecurrence((current) => {
                  const next = current === "none" ? "weekly" : "none";
                  if (next !== "none" && (!repeatUntil || repeatUntil < startDate)) setRepeatUntil(addDaysToDateKey(startDate, 28));
                  return next;
                });
              }}
              className="inline-flex min-h-10 items-center gap-2 text-xs font-bold text-[var(--mikke-muted)]"
            >
              <span className={`grid h-4 w-4 place-items-center rounded border ${recurrence !== "none" ? "border-[var(--mikke-blue)] bg-[var(--mikke-blue)] text-white" : "border-[var(--mikke-line)] bg-white text-transparent"}`}>
                <Check size={11} strokeWidth={2} />
              </span>
              繰り返し予定
            </button>

            {recurrence !== "none" ? (
              <div className="rounded-xl border border-[var(--mikke-line-soft)] bg-[var(--mikke-surface-soft)] p-3">
                <div className="flex flex-wrap gap-2">
                  {marketEventRecurrenceOptions.map((option) => (
                    <button key={option.value} type="button" onClick={() => setRecurrence(option.value)} className={`rounded-full border px-3 py-2 text-xs font-bold ${recurrence === option.value ? "border-[var(--mikke-blue)] bg-[var(--mikke-blue)] text-white" : "border-[var(--mikke-line)] bg-white text-[var(--mikke-muted)]"}`}>
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 min-[360px]:grid-cols-[1fr_auto] min-[360px]:items-end">
                  <Field label="繰り返しの終了日" required compact>
                    <TextInput value={repeatUntil} onChange={setRepeatUntil} type="date" required icon={<CalendarDays size={15} />} />
                  </Field>
                  <p className={`pb-2 text-xs font-bold ${recurrenceTooLong ? "text-[var(--mikke-orange)]" : "text-[var(--mikke-blue)]"}`}>
                    {recurrenceTooLong ? `${MAX_RECURRING_EVENTS}件を超えます` : `${recurringDates.length}件の予定を作成`}
                  </p>
                </div>
                {recurringDates.length > 0 && !recurrenceTooLong ? (
                  <div className="mt-2 max-h-32 overflow-y-auto rounded-lg border border-[var(--mikke-line-soft)] bg-white p-2" aria-label="作成される日付">
                    <div className="flex flex-wrap gap-1.5">
                      {recurringDates.map((date) => <span key={date} className="rounded-full bg-[var(--mikke-surface-soft)] px-2 py-1 text-[10px] font-bold text-[var(--mikke-text-soft)]">{formatMonthDayWeekday(date)}</span>)}
                    </div>
                  </div>
                ) : null}
                <div className="mt-2 space-y-1">
                  <RecurrenceCopyOption checked={copyPaymentsToRecurring} onChange={setCopyPaymentsToRecurring} label="入力した事前経費も各予定に追加" />
                  <RecurrenceCopyOption checked={copyChecksToRecurring} onChange={setCopyChecksToRecurring} label="選んだチェック項目も各予定に追加" />
                </div>
                <p className="mt-1 text-[11px] font-semibold leading-5 text-[var(--mikke-muted)]">各日付を独立した予定として保存します。あとから1件ずつ編集できます。</p>
              </div>
            ) : null}
          </FormCard>

          <FormCard title="ステータス" tone="orange" icon={<Check size={16} strokeWidth={1.8} />}>
            <Segmented
              options={statusOptions}
              value={status}
              onChange={setStatus}
              getTone={(value) => value === "preparing" ? "orange" : value === "applied" ? "yellow" : "blue"}
            />
          </FormCard>

          <AccordionCard title="日時（任意）" tone="yellow" icon={<Clock3 size={16} />} open={timeOpen} onToggle={() => setTimeOpen((value) => !value)}>
            <div className="grid min-w-0 grid-cols-1 gap-3 min-[360px]:grid-cols-2">
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

          <AccordionCard title="会場情報（任意）" tone="blue" icon={<MapPin size={16} />} open={venueOpen} onToggle={() => setVenueOpen((value) => !value)}>
            <div className="space-y-2.5">
              <Field label="会場名" compact>
                <TextInput value={venueName} onChange={setVenueName} placeholder="例）東京ビッグサイト 西1・2ホール" />
              </Field>
              <Field label="住所" compact>
                <TextInput value={address} onChange={setAddress} placeholder="例）東京都江東区有明3-11-1" />
              </Field>
            </div>
          </AccordionCard>

          <FormCard title="事前経費" tone="orange" icon={<WalletCards size={16} />}>
            <p className="text-xs font-bold leading-5 text-[var(--mikke-muted)]">入力しなくても予定は保存できます。支払済みの項目だけが経費に反映されます。</p>
            <div className="space-y-2.5">
              {payments.map((payment, index) => (
                <div key={payment.id} className="min-w-0 rounded-xl border border-[var(--mikke-line-soft)] bg-[var(--mikke-surface-soft)] p-2.5">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[var(--mikke-muted)]">事前経費 {index + 1}</span>
                    {payments.length > 1 ? (
                      <button type="button" onClick={() => setPayments((current) => current.filter((item) => item.id !== payment.id))} className="grid h-7 w-7 place-items-center rounded-full text-[var(--mikke-muted)]" aria-label={`支払い ${index + 1} を削除`}>
                        <X size={15} />
                      </button>
                    ) : null}
                  </div>
                  <div className="grid min-w-0 grid-cols-2 gap-2">
                    <TextInput value={payment.title} onChange={(value) => updatePayment(payment.id, { title: value })} placeholder="項目" />
                    <SelectBox value={payment.status} onChange={(value) => updatePayment(payment.id, { status: value as PaymentStatus })} options={paymentStatusOptions} tone={payment.status === "paid" ? "green" : payment.status === "unpaid" ? "orange" : "gray"} />
                    <SelectBox value={payment.method} onChange={(value) => updatePayment(payment.id, { method: value })} options={getPaymentMethodOptions(fixedPaymentMethodNames, payment.method)} tone="gray" />
                    <div>
                      <MoneyInput value={payment.amount} onChange={(value) => updatePayment(payment.id, { amount: value })} />
                    </div>
                  </div>
                  {payment.status === "unpaid" && Number(payment.amount || 0) > 0 ? <p className="mt-2 rounded-lg bg-[var(--mikke-yellow)] px-2.5 py-2 text-[11px] font-bold leading-4 text-[var(--mikke-text)]">未払いの事前経費は、支払済みにすると経費へ反映されます。</p> : null}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addPayment}
              className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--mikke-primary-border)] bg-[var(--mikke-surface)] px-3 py-2 text-xs font-bold text-[var(--mikke-accent)]"
            >
              <Plus size={14} strokeWidth={1.7} />
              事前経費を追加
            </button>
          </FormCard>

          <FormCard title="メモ" tone="pink" icon={<FileText size={16} />}>
            <textarea
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              rows={4}
              placeholder="電源使用予定、搬入時間、主催者からの連絡など"
              className="scroll-mb-28 block min-w-0 max-w-full w-full resize-none rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2.5 text-base leading-6 text-[var(--mikke-text)] outline-none transition placeholder:text-[var(--mikke-muted-light)] focus:border-[var(--mikke-blue)] sm:text-sm"
            />
          </FormCard>

          <AccordionCard title="チェック項目（任意）" tone="yellow" icon={<ClipboardList size={16} />} open={checksOpen} onToggle={() => setChecksOpen((value) => !value)}>
            <div className="flex flex-wrap gap-2">
              {Array.from(new Set([...templateChecks, ...customChecks])).map((item) => {
                const active = selectedChecks.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleCheck(item)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-bold ${
                      active
                        ? "border-[var(--mikke-yellow)] bg-[var(--mikke-yellow)] text-[var(--mikke-text)]"
                        : "border-[var(--mikke-line)] bg-[var(--mikke-surface)] text-[var(--mikke-muted)]"
                    }`}
                  >
                    {active ? <Check size={12} strokeWidth={1.8} /> : null}
                    {item}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2">
              <TextInput value={customCheck} onChange={setCustomCheck} placeholder="項目を追加" />
              <button
                type="button"
                onClick={() => {
                  const item = customCheck.trim();
                  if (!item) return;
                  setCustomChecks((current) => Array.from(new Set([...current, item])));
                  setSelectedChecks((current) => Array.from(new Set([...current, item])));
                  setCustomCheck("");
                }}
                className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--mikke-primary-border)] bg-[var(--mikke-surface)] text-[var(--mikke-accent)]"
                aria-label="項目追加"
              >
                <Plus size={17} />
              </button>
            </div>
            <Link href="/settings/check-templates" className="inline-flex min-h-10 items-center text-xs font-extrabold text-[var(--mikke-blue)]">
              チェック項目設定
            </Link>
          </AccordionCard>

          {error ? <p className="rounded-xl bg-[var(--mikke-pink)] px-4 py-3 text-sm font-bold text-[var(--mikke-text)]">{error}</p> : null}

          <div className="space-y-2.5 pt-0.5">
            <p className="text-center text-xs font-bold text-[var(--mikke-muted-light)]">予定名と予定日だけでも保存できます</p>
            <button
              type="submit"
              disabled={!canSave}
              className="w-full rounded-xl bg-[var(--mikke-orange)] px-4 py-3.5 text-base font-extrabold text-white disabled:opacity-50"
            >
              {saving ? "保存中..." : "予定を保存"}
            </button>
            <Link
              href="/marketnote"
              className="block w-full rounded-xl border border-[var(--mikke-blue)] bg-white px-4 py-3 text-center text-sm font-extrabold text-[var(--mikke-blue)]"
            >
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
    <div className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] px-4 py-3 text-xs font-bold leading-5 text-[var(--mikke-text-soft)]">
      保存すると、このブラウザに予定が残ります。同じアイコン・同じブラウザから続きが見られ、あとでログインするとクラウド保存へ進めます。
    </div>
  );
}

type SectionTone = "blue" | "orange" | "green" | "yellow" | "pink";

function FormCard({ title, icon, tone = "blue", children }: { title: string; icon?: React.ReactNode; tone?: SectionTone; children: React.ReactNode }) {
  return (
    <section className="min-w-0 max-w-full rounded-xl border border-[var(--mikke-line)] bg-white p-3.5">
      <SectionHeading title={title} icon={icon} tone={tone} />
      <div className="mt-3 min-w-0 space-y-2.5">{children}</div>
    </section>
  );
}

function AccordionCard({
  title,
  icon,
  tone = "blue",
  open,
  onToggle,
  children
}: {
  title: string;
  icon?: React.ReactNode;
  tone?: SectionTone;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 max-w-full rounded-xl border border-[var(--mikke-line)] bg-white">
      <button type="button" onClick={onToggle} className="flex min-h-12 w-full items-center justify-between gap-3 p-3.5 text-left">
        <SectionHeading title={title} icon={icon} tone={tone} />
        <ChevronDown size={17} className={`shrink-0 text-[var(--mikke-muted)] transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? <div className="min-w-0 border-t border-[var(--mikke-line-soft)] px-3.5 pb-3.5 pt-3">{children}</div> : null}
    </section>
  );
}

function SectionHeading({ title, icon, tone = "blue" }: { title: string; icon?: React.ReactNode; tone?: SectionTone }) {
  const toneClass = {
    blue: "text-[var(--mikke-blue)]",
    orange: "text-[var(--mikke-orange)]",
    green: "bg-[var(--mikke-green)] text-[var(--mikke-text)]",
    yellow: "bg-[var(--mikke-yellow)] text-[var(--mikke-text)]",
    pink: "bg-[var(--mikke-pink)] text-[var(--mikke-text)]"
  }[tone];
  const dotClass = {
    blue: "bg-[var(--mikke-blue)]",
    orange: "bg-[var(--mikke-orange)]",
    green: "bg-[var(--mikke-green)]",
    yellow: "bg-[var(--mikke-yellow)]",
    pink: "bg-[var(--mikke-pink)]"
  }[tone];
  return (
    <div className="flex items-center gap-2">
      <span className={`grid h-6 w-6 place-items-center rounded-full ${toneClass}`}>
        {icon ?? <span className={`h-2 w-2 rounded-full ${dotClass}`} />}
      </span>
      <h2 className="text-sm font-extrabold text-[var(--mikke-text)]">{title}</h2>
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
    <label className={compact ? "block min-w-0" : "grid min-w-0 gap-1.5"}>
      <span className="text-xs font-extrabold text-[var(--mikke-text-soft)]">
        {label}{required ? <span className="ml-0.5 text-[var(--mikke-accent)]">*</span> : null}
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
    <div className="relative min-w-0 max-w-full">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        required={required}
        placeholder={placeholder}
        className="scroll-mb-28 block h-11 min-w-0 max-w-full w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 pr-9 text-base font-semibold text-[var(--mikke-text)] outline-none transition placeholder:text-[var(--mikke-muted-light)] focus:border-[var(--mikke-blue)] sm:h-10 sm:text-sm"
      />
      {icon ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--mikke-muted)]">{icon}</span> : null}
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
  getTone: (value: T) => "blue" | "orange" | "green" | "yellow" | "gray";
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map((option) => {
        const active = option.value === value;
        const tone = getTone(option.value);
        const activeClass = tone === "green"
          ? "border-[var(--mikke-green)] bg-[var(--mikke-green)] text-[var(--mikke-text)]"
          : tone === "orange"
            ? "border-[var(--mikke-orange)] bg-[var(--mikke-orange)] text-white"
            : tone === "yellow"
              ? "border-[var(--mikke-yellow)] bg-[var(--mikke-yellow)] text-[var(--mikke-text)]"
              : tone === "blue"
                ? "border-[var(--mikke-blue)] bg-[var(--mikke-blue)] text-white"
                : "border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] text-[var(--mikke-text-soft)]";

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`min-h-10 whitespace-nowrap rounded-full border px-1 text-[11px] font-extrabold transition min-[360px]:px-2 min-[360px]:text-xs ${
              active ? activeClass : "border-[var(--mikke-line)] bg-[var(--mikke-surface)] text-[var(--mikke-muted)]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
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
    ? "border-[var(--mikke-green)] bg-[var(--mikke-green)] text-[var(--mikke-text)]"
    : tone === "orange"
      ? "border-[var(--mikke-orange)] bg-[var(--mikke-orange)] text-white"
      : "border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] text-[var(--mikke-muted)]";

  return (
    <label className="relative block min-w-0 max-w-full">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`scroll-mb-28 block h-11 min-w-0 max-w-full w-full appearance-none rounded-xl border px-3 pr-7 text-base font-extrabold outline-none sm:h-10 sm:text-xs ${toneClass}`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-current" />
    </label>
  );
}

function MoneyInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="grid h-9 min-w-0 max-w-full grid-cols-[24px_minmax(0,1fr)] overflow-hidden rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)]">
      <span className="grid place-items-center text-xs font-bold text-[var(--mikke-muted)]">¥</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, ""))}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder="0"
        className="scroll-mb-28 min-w-0 bg-[var(--mikke-surface)] pr-2 text-right text-base font-extrabold text-[var(--mikke-text)] outline-none sm:text-sm"
      />
    </div>
  );
}

function statusLabel(status: EntryStatus, eventType = "出店") {
  if (status === "preparing") return "確定";
  if (status === "applied") return eventType === "出店" ? "申込済み" : "調整中";
  return "検討中";
}

function paymentLabel(status: PaymentStatus) {
  if (status === "paid") return "支払済";
  if (status === "unpaid") return "未払い";
  return "不要";
}

function getPaymentMethodOptions(options: string[], selected: string) {
  const values = Array.from(new Set([...options, selected].filter(Boolean)));
  return values.map((method) => ({ label: method, value: method }));
}

function RecurrenceCopyOption({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex min-h-9 w-full items-center gap-2 rounded-lg px-1 text-left text-[11px] font-bold text-[var(--mikke-muted)]">
      <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${checked ? "border-[var(--mikke-blue)] bg-[var(--mikke-blue)] text-white" : "border-[var(--mikke-line)] bg-white text-transparent"}`}>
        <Check size={11} strokeWidth={2} />
      </span>
      {label}
    </button>
  );
}

function createRecurrenceId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `recurrence-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function NewMarketEventPage() {
  return (
    <AuthGate allowGuest>
      <NewMarketEventContent />
    </AuthGate>
  );
}
