"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, MapPin, X } from "lucide-react";
import { formatMonthDayWeekday, toDateKey } from "@/lib/format";
import { getMarketEventWorkflowStatus, marketEventWorkflowLabel, type MarketEventWorkflowStatus } from "@/lib/marketnote";
import { defaultMarketEventTypeSettings, getMarketEventType, getMarketEventTypeColor, loadMarketEventTypeSettingsForProfile, readableTextColor, type MarketEventTypeSettings } from "@/lib/marketnote-event-types";
import { getMarketNoteStoryAchievement, hasMyStory, stageMarketNoteStoryAchievement, withdrawMarketNoteStoryAchievement, type MarketNoteStoryAchievement, type StoryAchievementDisplayMode } from "@/lib/marketnote-story";
import { defaultReminderSettings, loadReminderSettings } from "@/lib/reminders";
import type { MarketCheckItem, MarketEvent, MarketFinancialRecord, Profile } from "@/types/database";

type PaymentState = "paid" | "unpaid" | "not_required";

type Props = {
  profile: Profile;
  events: MarketEvent[];
  checksByEvent: Record<string, MarketCheckItem[]>;
  financesByEvent: Record<string, MarketFinancialRecord[]>;
  viewToggle: ReactNode;
  onStatusChange: (event: MarketEvent, workflow: MarketEventWorkflowStatus) => Promise<void>;
  onPaymentStatusChange: (event: MarketEvent, paymentStatus: "unpaid" | "paid") => Promise<void>;
  onToggleCheck: (item: MarketCheckItem, nextValue: boolean) => Promise<void>;
  onSelectedDateChange?: (dateKey: string) => void;
};

const weekdayLabels = ["日", "月", "火", "水", "木", "金", "土"];

export function HomeCalendar({ profile, events, checksByEvent, financesByEvent, viewToggle, onStatusChange, onPaymentStatusChange, onToggleCheck, onSelectedDateChange }: Props) {
  const todayKey = toDateKey(new Date());
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [reminderSettings, setReminderSettings] = useState(defaultReminderSettings);
  const [eventTypeSettings, setEventTypeSettings] = useState<MarketEventTypeSettings>(defaultMarketEventTypeSettings);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [busyKey, setBusyKey] = useState("");
  const [message, setMessage] = useState("");
  const [overdueOpen, setOverdueOpen] = useState(false);
  const [storyEvent, setStoryEvent] = useState<MarketEvent | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    setReminderSettings(loadReminderSettings());
    void loadMarketEventTypeSettingsForProfile(profile).then((settings) => {
      if (active) setEventTypeSettings(settings);
    }).catch(() => {
      // Keep the built-in colors if cloud settings are temporarily unavailable.
    });
    return () => { active = false; };
  }, [profile]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, MarketEvent[]> = {};
    for (const event of events) {
      if (!map[event.event_date]) map[event.event_date] = [];
      map[event.event_date].push(event);
    }
    return map;
  }, [events]);

  const weeks = useMemo(() => buildMonthMatrix(visibleMonth), [visibleMonth]);
  const activeEvents = useMemo(
    () => events
      .filter((event) => event.status !== "completed" && event.status !== "cancelled")
      .sort((a, b) => a.event_date.localeCompare(b.event_date)),
    [events]
  );
  const taskGroups = useMemo(() => {
    if (!reminderSettings.enabled || !reminderSettings.targets.checkItemDue) return { current: [], overdue: [] };
    const tasks: Array<{ event: MarketEvent; item: MarketCheckItem; effectiveDue: string }> = [];
    for (const event of activeEvents) {
      for (const item of checksByEvent[event.id] ?? []) {
        if (item.is_done) continue;
        const effectiveDue = item.due_date ?? event.event_date;
        const daysUntilDue = daysBetween(todayKey, effectiveDue);
        const shouldShow = daysUntilDue === 0 && reminderSettings.timings.sameDay
          || daysUntilDue === 1 && reminderSettings.timings.oneDayBefore
          || daysUntilDue === 3 && reminderSettings.timings.threeDaysBefore
          || daysUntilDue === 7 && reminderSettings.timings.sevenDaysBefore;
        if (daysUntilDue < 0 || shouldShow) tasks.push({ event, item, effectiveDue });
      }
    }
    return {
      current: tasks
        .filter((task) => task.effectiveDue >= todayKey)
        .sort((a, b) => a.effectiveDue.localeCompare(b.effectiveDue))
        .slice(0, 3),
      overdue: tasks
        .filter((task) => task.effectiveDue < todayKey)
        .sort((a, b) => b.effectiveDue.localeCompare(a.effectiveDue))
    };
  }, [activeEvents, checksByEvent, reminderSettings, todayKey]);
  const currentTasks = taskGroups.current;
  const overdueTasks = taskGroups.overdue;
  const selectedEvents = useMemo(() => eventsByDate[selectedDate] ?? [], [eventsByDate, selectedDate]);

  function moveMonth(delta: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  function goToToday() {
    const now = new Date();
    setVisibleMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    selectDate(todayKey);
  }

  function selectDate(dateKey: string) {
    setSelectedDate(dateKey);
    onSelectedDateChange?.(dateKey);
  }

  async function changeStatus(event: MarketEvent, workflow: MarketEventWorkflowStatus) {
    setBusyKey(`status:${event.id}`);
    setMessage("");
    try {
      await onStatusChange(event, workflow);
      setMessage("ステータスを変更しました");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ステータスを変更できませんでした");
    } finally {
      setBusyKey("");
    }
  }

  async function changeCheck(item: MarketCheckItem, nextValue: boolean) {
    setBusyKey(`check:${item.id}`);
    setMessage("");
    try {
      await onToggleCheck(item, nextValue);
      setMessage("タスクを更新しました");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "タスクを更新できませんでした");
    } finally {
      setBusyKey("");
    }
  }

  async function changePayment(event: MarketEvent, paymentStatus: "unpaid" | "paid") {
    setBusyKey(`payment:${event.id}`);
    setMessage("");
    try {
      await onPaymentStatusChange(event, paymentStatus);
      setMessage("支払ステータスを変更しました");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "支払ステータスを変更できませんでした");
    } finally {
      setBusyKey("");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 px-1">
        {viewToggle}
        <div className="flex min-w-0 items-center justify-end gap-0.5">
          <button type="button" onClick={() => moveMonth(-1)} aria-label="前の月" className="grid h-8 w-7 shrink-0 place-items-center rounded-full text-[var(--mikke-blue)] hover:bg-[var(--mikke-surface-soft)]">
            <ChevronLeft size={17} />
          </button>
          <h2 className="whitespace-nowrap text-sm font-bold tracking-normal text-[var(--mikke-blue)]">
            {visibleMonth.getFullYear()}年{visibleMonth.getMonth() + 1}月
          </h2>
          <button type="button" onClick={goToToday} className="min-h-8 shrink-0 rounded-full border border-[var(--mikke-blue)] px-2 text-[10px] font-bold text-[var(--mikke-blue)]">
            今日
          </button>
          <button type="button" onClick={() => moveMonth(1)} aria-label="次の月" className="grid h-8 w-7 shrink-0 place-items-center rounded-full text-[var(--mikke-blue)] hover:bg-[var(--mikke-surface-soft)]">
            <ChevronRight size={17} />
          </button>
        </div>
      </div>

      <div
        className="mt-2 grid touch-pan-y grid-cols-7 gap-1 rounded-xl border border-[var(--mikke-line)] bg-white p-2"
        onTouchStart={(event) => {
          touchStartX.current = event.touches[0]?.clientX ?? null;
          touchStartY.current = event.touches[0]?.clientY ?? null;
        }}
        onTouchEnd={(event) => {
          if (touchStartX.current === null || touchStartY.current === null) return;
          const endTouch = event.changedTouches[0];
          if (!endTouch) return;
          const deltaX = endTouch.clientX - touchStartX.current;
          const deltaY = endTouch.clientY - touchStartY.current;
          touchStartX.current = null;
          touchStartY.current = null;
          if (Math.abs(deltaX) >= 54 && Math.abs(deltaX) > Math.abs(deltaY)) moveMonth(deltaX > 0 ? -1 : 1);
        }}
      >
        {weekdayLabels.map((label) => (
          <div key={label} className="py-1 text-center text-[11px] font-bold text-[var(--mikke-muted-light)]">{label}</div>
        ))}
        {weeks.flat().map((date) => {
          const key = toDateKey(date);
          const inMonth = date.getMonth() === visibleMonth.getMonth();
          const dayEvents = eventsByDate[key] ?? [];
          const today = key === todayKey;
          const hasStoryCandidate = dayEvents.some((event) => isStoryEligible(event, todayKey));
          return (
            <button
              type="button"
              key={key}
              onClick={() => selectDate(key)}
              aria-label={calendarDayLabel(date, dayEvents)}
              aria-pressed={selectedDate === key}
              className={`flex h-[68px] min-w-0 flex-col items-stretch rounded-lg border p-0.5 text-center hover:border-[var(--mikke-blue)] hover:bg-[var(--mikke-surface-soft)] sm:h-[74px] ${selectedDate === key ? "border-[var(--mikke-blue)] bg-[var(--mikke-surface-soft)]" : "border-transparent"} ${inMonth ? "" : "opacity-40"}`}
            >
              <span className="mx-auto flex h-6 items-center justify-center gap-0.5">
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${today ? "border border-[var(--mikke-blue)] text-[var(--mikke-blue)]" : "text-[var(--mikke-text)]"}`}>{date.getDate()}</span>
                {hasStoryCandidate ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--mikke-yellow)]" title="+STORYに追加できます" /> : null}
              </span>
              <CalendarCellBody events={dayEvents} settings={eventTypeSettings} />
            </button>
          );
        })}
      </div>

      <SelectedDayEvents
        dateKey={selectedDate}
        todayKey={todayKey}
        events={selectedEvents}
        checksByEvent={checksByEvent}
        financesByEvent={financesByEvent}
        settings={eventTypeSettings}
        busyKey={busyKey}
        onStatusChange={changeStatus}
        onPaymentStatusChange={changePayment}
        onToggleCheck={changeCheck}
        onStory={setStoryEvent}
      />
      {storyEvent ? <StoryAchievementDialog profile={profile} event={storyEvent} onClose={() => setStoryEvent(null)} /> : null}
      {message ? <p className="mt-2 rounded-lg bg-[var(--mikke-accent-soft)] px-3 py-2 text-xs font-bold text-[var(--mikke-text)]">{message}</p> : null}

      {currentTasks.length > 0 || overdueTasks.length > 0 ? (
        <div className="mt-5 space-y-4">
          {currentTasks.length > 0 || overdueTasks.length > 0 ? (
            <section className="border-t border-[var(--mikke-line)] pt-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--mikke-blue)]" style={{ fontFamily: "var(--mikke-font-display)" }}>TODO</p>
              <h3 className="mt-1 text-sm font-bold text-[var(--mikke-text)]">やること（期限順）</h3>
              <TaskList tasks={currentTasks} />
              {overdueTasks.length > 0 ? (
                <div className="mt-2 border-t border-[var(--mikke-line-soft)] pt-2">
                  <button
                    type="button"
                    onClick={() => setOverdueOpen((current) => !current)}
                    className="flex min-h-10 w-full items-center justify-between rounded-lg px-1 text-xs font-extrabold text-[var(--mikke-text)]"
                    aria-expanded={overdueOpen}
                  >
                    <span>期限切れ {overdueTasks.length}件</span>
                    <ChevronDown size={16} className={`transition ${overdueOpen ? "rotate-180" : ""}`} />
                  </button>
                  {overdueOpen ? <TaskList tasks={overdueTasks} overdue /> : null}
                </div>
              ) : null}
            </section>
          ) : null}

        </div>
      ) : null}
    </div>
  );
}

function CalendarCellBody({ events, settings }: { events: MarketEvent[]; settings: MarketEventTypeSettings }) {
  if (events.length === 0) return null;
  return (
    <div className="mt-0.5 min-w-0 space-y-0.5" aria-hidden="true">
      {events.slice(0, 2).map((event) => {
        const color = getMarketEventTypeColor(getMarketEventType(event), settings);
        return <span key={event.id} className="block h-3 truncate rounded-[3px] px-0.5 text-left text-[9px] font-bold leading-3" style={{ backgroundColor: color, color: readableTextColor(color) }}>
          {event.title}
        </span>;
      })}
      {events.length > 2 ? <span className="block truncate text-right text-[8px] font-bold leading-none text-[var(--mikke-muted)]">＋残り{events.length - 2}件</span> : null}
    </div>
  );
}

function SelectedDayEvents({
  dateKey,
  todayKey,
  events,
  checksByEvent,
  financesByEvent,
  settings,
  busyKey,
  onStatusChange,
  onPaymentStatusChange,
  onToggleCheck,
  onStory
}: {
  dateKey: string;
  todayKey: string;
  events: MarketEvent[];
  checksByEvent: Record<string, MarketCheckItem[]>;
  financesByEvent: Record<string, MarketFinancialRecord[]>;
  settings: MarketEventTypeSettings;
  busyKey: string;
  onStatusChange: (event: MarketEvent, workflow: MarketEventWorkflowStatus) => Promise<void>;
  onPaymentStatusChange: (event: MarketEvent, paymentStatus: "unpaid" | "paid") => Promise<void>;
  onToggleCheck: (item: MarketCheckItem, nextValue: boolean) => Promise<void>;
  onStory: (event: MarketEvent) => void;
}) {
  return (
    <section className="mt-3 border-t border-[var(--mikke-line)] pt-3">
      <div className="flex items-center justify-between gap-3 px-1">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--mikke-blue)]" style={{ fontFamily: "var(--mikke-font-display)" }}>SCHEDULE</p>
          <h3 className="mt-0.5 text-sm font-extrabold text-[var(--mikke-text)]">{dateKey === todayKey ? "本日の予定" : `${formatMonthDayWeekday(dateKey)}の予定`}</h3>
        </div>
        <span className="text-xs font-bold text-[var(--mikke-muted)]">{events.length}件</span>
      </div>

      {events.length === 0 ? (
        <p className="mt-2 rounded-xl border border-dashed border-[var(--mikke-line)] px-3 py-5 text-center text-xs font-bold text-[var(--mikke-muted)]">この日の予定はありません</p>
      ) : (
        <div className="mt-2 space-y-2.5">
          {events.map((event) => {
            const checks = checksByEvent[event.id] ?? [];
            const done = checks.filter((item) => item.is_done).length;
            const progress = checks.length ? Math.round((done / checks.length) * 100) : 0;
            const eventType = getMarketEventType(event);
            const color = getMarketEventTypeColor(eventType, settings);
            const workflow = getMarketEventWorkflowStatus(event);
            const paymentState = getPaymentState(financesByEvent[event.id] ?? []);
            return (
              <article key={event.id} className="overflow-hidden rounded-xl border border-[var(--mikke-line)] bg-white">
                <div className="h-1.5" style={{ backgroundColor: color }} />
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/marketnote/${event.id}`} className="min-w-0 flex-1">
                      <span className="inline-flex max-w-full rounded-full px-2 py-1 text-[10px] font-extrabold" style={{ backgroundColor: color, color: readableTextColor(color) }}>{eventType}</span>
                      <h4 className="mt-1.5 truncate text-base font-extrabold text-[var(--mikke-text)]">{event.title}</h4>
                    </Link>
                    <select value={workflow} onChange={(input) => onStatusChange(event, input.target.value as MarketEventWorkflowStatus)} disabled={busyKey === `status:${event.id}`} aria-label={`${event.title}のステータス`} className={`min-h-9 shrink-0 rounded-lg border px-2 text-[11px] font-bold outline-none disabled:opacity-50 ${workflow === "confirmed" ? "border-[var(--mikke-orange)] bg-[var(--mikke-orange)] text-white" : workflow === "intermediate" ? "border-[var(--mikke-yellow)] bg-[var(--mikke-yellow)] text-[var(--mikke-text)]" : "border-[var(--mikke-line)] bg-white text-[var(--mikke-text)]"}`}>
                      <option value="considering">検討中</option>
                      <option value="intermediate">{marketEventWorkflowLabel("intermediate", event.genre)}</option>
                      <option value="confirmed">確定</option>
                    </select>
                  </div>

                  <Link href={`/marketnote/${event.id}`} className="mt-2 grid gap-1 text-[11px] font-semibold text-[var(--mikke-muted)]">
                    <span className="flex items-center gap-1.5"><Clock3 size={13} />{eventTimeLabel(event)}</span>
                    <span className="flex items-center gap-1.5 truncate"><MapPin size={13} className="shrink-0" /><span className="truncate">{[event.venue_name, event.area].filter(Boolean).join(" / ") || "場所未設定"}</span></span>
                  </Link>

                  <div className="mt-3 flex items-center justify-between gap-3 text-[11px] font-bold text-[var(--mikke-text-soft)]">
                    <span>タスク {done}/{checks.length}</span>
                    {paymentState !== "not_required" ? (
                      <select value={paymentState} onChange={(input) => onPaymentStatusChange(event, input.target.value as "unpaid" | "paid")} disabled={busyKey === `payment:${event.id}`} aria-label={`${event.title}の支払ステータス`} className={`min-h-8 rounded-full border px-2 text-[10px] font-extrabold outline-none disabled:opacity-50 ${paymentState === "unpaid" ? "border-[var(--mikke-yellow)] bg-[var(--mikke-yellow)] text-[var(--mikke-text)]" : "border-[var(--mikke-green)] bg-[var(--mikke-green)] text-[var(--mikke-text)]"}`}>
                        <option value="unpaid">未払い</option>
                        <option value="paid">支払済み</option>
                      </select>
                    ) : null}
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--mikke-line-soft)]"><div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: color }} /></div>

                  {checks.length ? (
                    <div className="mt-2 space-y-1 border-t border-[var(--mikke-line-soft)] pt-2">
                      {checks.map((item) => (
                        <button key={item.id} type="button" onClick={() => onToggleCheck(item, !item.is_done)} disabled={busyKey === `check:${item.id}`} className="flex min-h-9 w-full items-center gap-2 rounded-lg px-1 text-left text-xs font-semibold text-[var(--mikke-text-soft)] hover:bg-[var(--mikke-surface-soft)] disabled:opacity-50">
                          <span className={`grid h-5 w-5 shrink-0 place-items-center rounded border ${item.is_done ? "border-[var(--mikke-green)] bg-[var(--mikke-green)] text-[var(--mikke-text)]" : "border-[var(--mikke-line)] bg-white text-transparent"}`}><Check size={13} /></span>
                          <span className={`truncate ${item.is_done ? "line-through opacity-60" : ""}`}>{item.title}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <div className={`mt-2 grid gap-2 ${isStoryEligible(event, todayKey) ? "grid-cols-[auto_1fr]" : "grid-cols-1"}`}>
                    {isStoryEligible(event, todayKey) ? (
                      <button type="button" onClick={() => onStory(event)} className="inline-flex min-h-9 items-center justify-center rounded-lg border border-[var(--mikke-yellow)] bg-[var(--mikke-yellow)] px-3 text-xs font-extrabold text-[var(--mikke-text)]">+STORY</button>
                    ) : null}
                    <Link href={`/marketnote/${event.id}`} className="inline-flex min-h-9 items-center justify-center rounded-lg border border-[var(--mikke-line)] px-3 text-xs font-bold text-[var(--mikke-blue)]">詳細編集</Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function StoryAchievementDialog({ profile, event, onClose }: { profile: Profile; event: MarketEvent; onClose: () => void }) {
  const defaultDate = marketEventEndDate(event);
  const defaultLocation = [event.venue_name, event.area].filter(Boolean).join(" / ");
  const [displayMode, setDisplayMode] = useState<StoryAchievementDisplayMode>("card_and_count");
  const [title, setTitle] = useState(event.title);
  const [typeLabel, setTypeLabel] = useState(getMarketEventType(event));
  const [occurredOn, setOccurredOn] = useState(defaultDate);
  const [includeLocation, setIncludeLocation] = useState(false);
  const [location, setLocation] = useState(defaultLocation);
  const [storyExists, setStoryExists] = useState<boolean | null>(null);
  const [achievement, setAchievement] = useState<MarketNoteStoryAchievement | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    void hasMyStory(profile).then(async (exists) => {
      if (!active) return;
      setStoryExists(exists);
      if (!exists) return;
      const current = await getMarketNoteStoryAchievement(profile, event.id);
      if (!active || !current) return;
      setAchievement(current);
      setDisplayMode(current.display_mode);
      setTitle(current.public_title || event.title);
      setTypeLabel(current.public_type_label || getMarketEventType(event));
      setOccurredOn(current.occurred_on || defaultDate);
      setIncludeLocation(Boolean(current.public_location));
      setLocation(current.public_location || defaultLocation);
    }).catch((error) => {
      if (active) setMessage(error instanceof Error ? error.message : "STORYへ接続できませんでした。");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [defaultDate, defaultLocation, event, profile]);

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const saved = await stageMarketNoteStoryAchievement(profile, event.id, {
        displayMode,
        publicTitle: title,
        publicTypeLabel: typeLabel,
        occurredOn,
        publicLocation: includeLocation ? location : null
      });
      setAchievement(saved);
      setMessage("STORYの実績管理へ下書き保存しました。公開はSTORY側で行います。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "STORYへ追加できませんでした。");
    } finally {
      setSaving(false);
    }
  }

  async function withdraw() {
    setSaving(true);
    setMessage("");
    try {
      await withdrawMarketNoteStoryAchievement(profile, event.id);
      setAchievement((current) => current ? { ...current, publication_status: "withdrawn" } : current);
      setMessage("STORYへの掲載を取り下げました。記録は重複防止のため残ります。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "掲載を取り下げられませんでした。");
    } finally {
      setSaving(false);
    }
  }

  const cardEnabled = displayMode !== "count_only";
  const saveDisabled = saving || loading || !storyExists || (cardEnabled && (!title.trim() || !typeLabel.trim() || !occurredOn || (includeLocation && !location.trim())));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-2 sm:items-center" role="presentation" onMouseDown={(input) => { if (input.target === input.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="story-achievement-title" className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--mikke-blue)]">STORY</p><h2 id="story-achievement-title" className="mt-1 text-lg font-extrabold text-[var(--mikke-text)]">+STORY</h2></div>
          <button type="button" onClick={onClose} aria-label="閉じる" className="grid h-10 w-10 place-items-center rounded-full text-[var(--mikke-text)]"><X size={19} /></button>
        </div>

        {loading ? <p className="mt-4 rounded-xl bg-[var(--mikke-surface-soft)] p-4 text-sm font-bold text-[var(--mikke-muted)]">STORYを確認しています...</p> : null}
        {!loading && storyExists === false ? (
          <div className="mt-4 space-y-3">
            <p className="rounded-xl bg-[var(--mikke-surface-soft)] p-4 text-sm font-bold leading-6 text-[var(--mikke-text)]">活動実績を保存するSTORYがまだありません。先にSTORYを作りますか？</p>
            <Link href="/story/start" className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[var(--mikke-orange)] text-sm font-extrabold text-white">STORYを作る</Link>
            <button type="button" onClick={onClose} className="min-h-11 w-full rounded-xl border border-[var(--mikke-line)] text-sm font-bold text-[var(--mikke-muted)]">今回はやめる</button>
          </div>
        ) : null}

        {!loading && storyExists ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl bg-[var(--mikke-surface-soft)] p-3 text-xs font-semibold leading-5 text-[var(--mikke-muted)]">
              <p>ここではSTORY用の下書きを作ります。公開はSTORY側で確認してから行います。</p>
              {achievement ? <p className="mt-1 font-extrabold text-[var(--mikke-blue)]">現在：{publicationLabel(achievement.publication_status)}</p> : null}
            </div>

            <label className="block text-xs font-extrabold text-[var(--mikke-text)]">STORYへの表示方法
              <select value={displayMode} onChange={(input) => setDisplayMode(input.target.value as StoryAchievementDisplayMode)} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 text-sm font-bold outline-none">
                <option value="count_only">実績数だけ</option>
                <option value="card_only">活動実績カードだけ</option>
                <option value="card_and_count">実績数と活動実績カード</option>
              </select>
            </label>

            {cardEnabled ? (
              <div className="space-y-3">
                <StoryTextField label="実績名" value={title} onChange={setTitle} />
                <StoryTextField label="実績の種類" value={typeLabel} onChange={setTypeLabel} />
                <label className="block text-xs font-extrabold text-[var(--mikke-text)]">日付
                  <input type="date" value={occurredOn} onChange={(input) => setOccurredOn(input.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 text-sm font-semibold outline-none" />
                </label>
                <button type="button" onClick={() => setIncludeLocation((current) => !current)} className="flex min-h-10 w-full items-center gap-2 text-left text-xs font-bold text-[var(--mikke-text)]">
                  <span className={`grid h-5 w-5 place-items-center rounded border ${includeLocation ? "border-[var(--mikke-blue)] bg-[var(--mikke-blue)] text-white" : "border-[var(--mikke-line)] text-transparent"}`}><Check size={13} /></span>
                  場所を活動実績カードに掲載する
                </button>
                {includeLocation ? <StoryTextField label="公開する場所" value={location} onChange={setLocation} /> : null}
              </div>
            ) : <p className="rounded-xl border border-[var(--mikke-line-soft)] p-3 text-xs font-semibold leading-5 text-[var(--mikke-muted)]">実績数だけを加え、予定名・日付・場所などの個別情報は公開しません。</p>}

            <p className="text-[11px] font-semibold leading-5 text-[var(--mikke-muted)]">MarketNoteのメモ・写真・収支・支払い情報はSTORYへ渡しません。公開用の一言メモと写真はSTORY側で入力します。</p>
            {message ? <p className="rounded-xl bg-[var(--mikke-accent-soft)] p-3 text-xs font-bold leading-5 text-[var(--mikke-text)]">{message}</p> : null}
            <button type="button" onClick={() => void save()} disabled={saveDisabled} className="min-h-12 w-full rounded-xl bg-[var(--mikke-orange)] px-4 text-sm font-extrabold text-white disabled:opacity-50">{saving ? "保存中..." : "STORYへ下書き保存"}</button>
            {achievement ? <Link href="/story/achievements" className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[var(--mikke-blue)] text-sm font-extrabold text-[var(--mikke-blue)]">STORYで確認する</Link> : null}
            {achievement && achievement.publication_status !== "withdrawn" ? <button type="button" onClick={() => void withdraw()} disabled={saving} className="min-h-10 w-full text-xs font-bold text-[var(--mikke-muted)] disabled:opacity-50">掲載を取り下げる</button> : null}
          </div>
        ) : null}
        {!loading && message && !storyExists ? <p className="mt-3 rounded-xl bg-[var(--mikke-accent-soft)] p-3 text-xs font-bold leading-5 text-[var(--mikke-text)]">{message}</p> : null}
      </section>
    </div>
  );
}

function StoryTextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-xs font-extrabold text-[var(--mikke-text)]">{label}<input value={value} onChange={(input) => onChange(input.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 text-sm font-semibold outline-none" /></label>;
}

function publicationLabel(status: MarketNoteStoryAchievement["publication_status"]) {
  if (status === "published") return "STORYで公開中";
  if (status === "withdrawn") return "取り下げ済み";
  return "STORYで確認待ち";
}

function TaskList({
  tasks,
  overdue = false
}: {
  tasks: Array<{ event: MarketEvent; item: MarketCheckItem; effectiveDue: string }>;
  overdue?: boolean;
}) {
  if (tasks.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1.5">
      {tasks.map(({ event, item, effectiveDue }) => (
        <li key={item.id}>
          <Link
            href={`/marketnote/${event.id}`}
            className={`grid min-h-11 grid-cols-[12px_1fr_auto] items-center gap-2 rounded-lg px-1 text-xs font-semibold hover:bg-[var(--mikke-surface-soft)] ${overdue ? "text-[var(--mikke-text)]" : "text-[var(--mikke-text-soft)]"}`}
            aria-label={`${item.title}、${event.title}を開く`}
          >
            <span className={`h-3 w-3 rounded-full ${overdue ? "bg-[var(--mikke-pink)]" : "bg-[var(--mikke-yellow)]"}`} />
            <span className="min-w-0">
              <span className="block truncate">{item.title}</span>
              <span className={`mt-0.5 block truncate text-[10px] ${overdue ? "text-[var(--mikke-text-soft)]" : "text-[var(--mikke-muted)]"}`}>{event.title}</span>
            </span>
            <span className={`shrink-0 ${overdue ? "font-extrabold text-[var(--mikke-accent)]" : "text-[var(--mikke-muted)]"}`}>
              {formatMonthDayWeekday(effectiveDue)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function calendarDayLabel(date: Date, events: MarketEvent[]) {
  const dateLabel = date.toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" });
  if (events.length === 0) return `${dateLabel}、予定なし`;
  return `${dateLabel}、${events.map((event) => `${event.title}（${statusLabel(event.status)}）`).join("、")}`;
}

function buildMonthMatrix(monthStart: Date) {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  const gridEnd = new Date(lastOfMonth);
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));
  const weeks: Date[][] = [];
  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i += 1) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

function daysBetween(fromDateKey: string, toDateKeyValue: string) {
  const from = Date.parse(`${fromDateKey}T00:00:00Z`);
  const to = Date.parse(`${toDateKeyValue}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.round((to - from) / 86_400_000);
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

function isStoryEligible(event: MarketEvent, todayKey: string) {
  return getMarketEventWorkflowStatus(event) === "confirmed" && marketEventEndDate(event) < todayKey;
}

function marketEventEndDate(event: MarketEvent) {
  const matched = (event.private_note ?? "").match(/(?:^|\n)end_date:\s*(\d{4}-\d{2}-\d{2})(?:\n|$)/);
  return matched?.[1] || event.event_date;
}

function eventTimeLabel(event: MarketEvent) {
  const note = event.private_note ?? "";
  const startTime = matchNoteValue(note, "開始時間");
  const endTime = matchNoteValue(note, "終了時間");
  if (startTime && endTime) return `${startTime} - ${endTime}`;
  return startTime || endTime || "時間未設定";
}

function matchNoteValue(note: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matched = note.match(new RegExp(`(?:^|\\n)${escaped}:\\s*([^\\n]+)`));
  return matched?.[1]?.trim() || null;
}
