"use client";

import { CalendarCheck2, CheckCircle2, CircleAlert, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { confirmStaffPartnerShift, type PartnerShiftSubmission } from "@/lib/team-works-shifts";
import { supabase } from "@/lib/supabase/client";

function formatAvailableDate(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`);
  return `${date.getMonth() + 1}/${date.getDate()}（${["日", "月", "火", "水", "木", "金", "土"][date.getDay()]}）`;
}

export function TeamWorksShiftAdminPanel({
  targetMonth,
  submissions,
  onRefresh
}: {
  targetMonth: Date;
  submissions: PartnerShiftSubmission[];
  onRefresh: () => Promise<void>;
}) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  async function confirm(submission: PartnerShiftSubmission) {
    setConfirmingId(submission.id);
    setNotice(null);
    try {
      await confirmStaffPartnerShift(supabase, submission.id);
      setNotice({ tone: "success", text: `${submission.partnerName}さんの希望シフトを確認済みにしました。` });
      await onRefresh();
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "確認状態を更新できませんでした。" });
    } finally {
      setConfirmingId(null);
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-sm font-extrabold text-[var(--mikke-primary)]">
            <CalendarCheck2 size={18} />パートナー希望シフト
          </p>
          <p className="mt-1 text-xs font-semibold text-[var(--mikke-muted)]">
            {targetMonth.getFullYear()}年{targetMonth.getMonth() + 1}月分・カレンダーの黄色表示と同じ提出内容です。
          </p>
        </div>
        <span className="rounded-full bg-[var(--mikke-surface-soft)] px-3 py-1.5 text-xs font-extrabold">{submissions.length}件</span>
      </div>

      {submissions.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-[var(--mikke-line)] px-4 py-6 text-center text-xs font-bold text-[var(--mikke-muted)]">
          この月の希望シフトはまだ提出されていません。
        </p>
      ) : (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {submissions.map((submission) => (
            <article key={submission.id} className="rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-extrabold">{submission.partnerName}</p>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${submission.status === "confirmed" ? "bg-[var(--tw-done)] text-[var(--tw-on-tint)]" : "bg-[var(--tw-planned)] text-[var(--tw-on-tint)]"}`}>
                  {submission.status === "confirmed" ? "確認済み" : "提出済み"}
                </span>
              </div>
              <p className="mt-2 text-xs font-bold">希望 {submission.desiredDays}日／候補 {submission.availableDates.length}日</p>
              <p className="mt-2 text-xs font-semibold leading-6 text-[var(--mikke-muted)]">
                {submission.availableDates.map(formatAvailableDate).join("、")}
              </p>
              {submission.note ? <p className="mt-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold leading-5">{submission.note}</p> : null}
              {submission.status !== "confirmed" ? (
                <button type="button" disabled={confirmingId === submission.id} onClick={() => void confirm(submission)} className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg bg-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-on-solid)] disabled:bg-[var(--mikke-line)] disabled:text-[var(--mikke-muted)]">
                  {confirmingId === submission.id ? <LoaderCircle size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  内容を確認済みにする
                </button>
              ) : null}
            </article>
          ))}
        </div>
      )}

      {notice ? (
        <p className={`mt-3 inline-flex items-center gap-1 text-xs font-bold ${notice.tone === "success" ? "text-[var(--tw-on-tint)]" : "text-[var(--tw-action)]"}`}>
          {notice.tone === "success" ? <CheckCircle2 size={15} /> : <CircleAlert size={15} />}{notice.text}
        </p>
      ) : null}
    </section>
  );
}
