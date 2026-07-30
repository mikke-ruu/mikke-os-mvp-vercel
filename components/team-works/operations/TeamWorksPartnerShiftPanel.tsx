"use client";

import { CalendarCheck2, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { buildCalendarGridDates, formatDateKey } from "@/lib/team-works-operations";
import {
  loadMyPartnerShift,
  submitMyPartnerShift,
  type PartnerShiftSubmission
} from "@/lib/team-works-shifts";
import { supabase } from "@/lib/supabase/client";
import { getJapanDayOff } from "@/lib/japanese-calendar";
import { useTeamWorksLabels } from "@/components/team-works/useTeamWorksLabels";

const weekdayLabels = ["日", "月", "火", "水", "木", "金", "土"];

function nextMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

function submissionDeadline(targetMonth: Date, configuredDay: number): Date {
  const lastDayOfPreviousMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 0).getDate();
  const day = Math.min(Math.max(1, configuredDay), lastDayOfPreviousMonth);
  return new Date(targetMonth.getFullYear(), targetMonth.getMonth() - 1, day, 23, 59, 59);
}

function statusLabel(status: PartnerShiftSubmission["status"]): string {
  return ({ draft: "下書き", submitted: "提出済み", confirmed: "本部確認済み", returned: "再提出待ち" })[status];
}

export function TeamWorksPartnerShiftPanel() {
  const labels = useTeamWorksLabels();
  const [targetMonth, setTargetMonth] = useState(nextMonth);
  const [submission, setSubmission] = useState<PartnerShiftSubmission | null>(null);
  const [desiredDays, setDesiredDays] = useState(4);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [shiftDeadlineDay, setShiftDeadlineDay] = useState(25);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setNotice(null);
    try {
      const result = await loadMyPartnerShift(supabase, targetMonth);
      setSubmission(result.submission);
      setShiftDeadlineDay(result.shiftDeadlineDay);
      setDesiredDays(result.submission?.desiredDays ?? 4);
      setAvailableDates(result.submission?.availableDates ?? []);
      setNote(result.submission?.note ?? "");
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "シフトを読み込めませんでした。" });
    } finally {
      setLoading(false);
    }
  }, [targetMonth]);

  useEffect(() => { void load(); }, [load]);

  const calendarDates = useMemo(() => buildCalendarGridDates(targetMonth), [targetMonth]);
  const deadline = submissionDeadline(targetMonth, shiftDeadlineDay);
  const deadlinePassed = Date.now() > deadline.getTime();
  const confirmed = submission?.status === "confirmed";

  function toggleDate(dateKey: string) {
    if (confirmed) return;
    setAvailableDates((current) =>
      current.includes(dateKey) ? current.filter((value) => value !== dateKey) : [...current, dateKey].sort()
    );
    setNotice(null);
  }

  async function submit() {
    setSaving(true);
    setNotice(null);
    try {
      const result = await submitMyPartnerShift(supabase, { targetMonth, desiredDays, availableDates, note });
      setSubmission(result);
      setNotice({ tone: "success", text: "希望シフトを本部へ提出しました。" });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "希望シフトを提出できませんでした。" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-[#f9d3d2] bg-[#f9d3d2]/25 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-extrabold text-[var(--mikke-primary)]">
              <CalendarCheck2 size={18} />希望シフト
            </p>
            <p className="mt-1 text-xs font-semibold leading-5 text-[var(--mikke-muted)]">
              稼働できる日と、入りたい日数を本部へ共有します。本部がこの内容を見て担当を確定します。
            </p>
          </div>
          {submission ? (
            <span className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${confirmed ? "bg-[var(--tw-done)] text-[var(--tw-on-tint)]" : "bg-[var(--tw-planned)] text-[var(--tw-on-tint)]"}`}>
              {statusLabel(submission.status)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-[#ffd370] bg-[#ffd370]/10 p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <button type="button" aria-label="前月" onClick={() => setTargetMonth((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))} className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--mikke-line)]">
            <ChevronLeft size={16} />
          </button>
          <div className="text-center">
            <p className="text-base font-extrabold">{targetMonth.getFullYear()}年{targetMonth.getMonth() + 1}月</p>
            <p className={`mt-0.5 text-[11px] font-bold ${deadlinePassed ? "text-[var(--tw-action)]" : "text-[var(--mikke-muted)]"}`}>
              提出期限 {deadline.getMonth() + 1}/{deadline.getDate()}
              {deadlinePassed ? "（期限後も提出できます）" : ""}
            </p>
          </div>
          <button type="button" aria-label="翌月" onClick={() => setTargetMonth((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))} className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--mikke-line)]">
            <ChevronRight size={16} />
          </button>
        </div>

        {loading ? (
          <div className="grid min-h-64 place-items-center"><LoaderCircle className="animate-spin text-[var(--mikke-primary)]" /></div>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-[var(--mikke-muted)]">
              {weekdayLabels.map((label) => <span key={label}>{label}</span>)}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {calendarDates.map((date) => {
                const key = formatDateKey(date);
                const inMonth = date.getMonth() === targetMonth.getMonth();
                const selected = availableDates.includes(key);
                const japanDayOff = getJapanDayOff(date);
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={!inMonth || confirmed}
                    onClick={() => toggleDate(key)}
                    className={`min-h-12 rounded-lg border text-xs font-extrabold transition sm:min-h-14 ${
                      selected
                        ? "border-[var(--mikke-primary)] bg-[var(--mikke-primary)] text-white"
                        : japanDayOff.isDayOff
                          ? "border-[var(--mikke-pink)] bg-[var(--mikke-pink)] text-[var(--tw-on-tint)]"
                          : "border-[var(--mikke-line)] bg-white text-[var(--mikke-text)]"
                    } ${inMonth ? "" : "opacity-25"} disabled:cursor-default`}
                  >
                    <span className="block">{date.getDate()}</span>
                    {japanDayOff.isDayOff ? <span className="block truncate text-[8px]">{japanDayOff.isNationalHoliday ? japanDayOff.label : labels.holidayLabel}</span> : null}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
        <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
          <label className="text-xs font-bold">
            何日入りたいですか
            <input type="number" min={1} max={31} disabled={confirmed} value={desiredDays} onChange={(event) => setDesiredDays(Number(event.target.value))} className="mt-1.5 w-full rounded-xl border border-[var(--mikke-line)] px-3 py-2.5 text-sm disabled:bg-[var(--mikke-surface-soft)]" />
          </label>
          <label className="text-xs font-bold">
            本部へのメモ（任意）
            <textarea rows={2} disabled={confirmed} value={note} onChange={(event) => setNote(event.target.value)} placeholder="時間帯の希望、入れない条件など" className="mt-1.5 w-full resize-none rounded-xl border border-[var(--mikke-line)] px-3 py-2.5 text-sm disabled:bg-[var(--mikke-surface-soft)]" />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" disabled={saving || loading || confirmed || availableDates.length === 0} onClick={() => void submit()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--tw-action)] px-4 py-2.5 text-sm font-bold text-[var(--tw-on-solid)] disabled:bg-[var(--mikke-line)] disabled:text-[var(--mikke-muted)]">
            {saving ? <LoaderCircle size={16} className="animate-spin" /> : <CalendarCheck2 size={16} />}
            {submission ? "希望シフトを更新" : "希望シフトを提出"}
          </button>
          <span className="text-xs font-bold text-[var(--mikke-muted)]">選択 {availableDates.length}日／希望 {desiredDays || 0}日</span>
          {notice ? (
            <span className={`inline-flex items-center gap-1 text-xs font-bold ${notice.tone === "success" ? "text-[var(--tw-on-tint)]" : "text-[var(--tw-action)]"}`}>
              {notice.tone === "success" ? <CheckCircle2 size={15} /> : <CircleAlert size={15} />}{notice.text}
            </span>
          ) : null}
        </div>
        {confirmed ? <p className="mt-3 text-xs font-bold text-[var(--tw-on-tint)]">本部確認済みです。変更が必要な場合は本部へ連絡してください。</p> : null}
      </div>
    </section>
  );
}
