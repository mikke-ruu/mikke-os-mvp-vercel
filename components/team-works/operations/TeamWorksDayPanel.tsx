"use client";

import { Clock, Users, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { OperationsCalendarEvent, OperationsHoliday } from "@/lib/team-works-operations";

const weekdayLabels = ["日", "月", "火", "水", "木", "金", "土"];

function formatPanelTitle(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`);
  return `${date.getMonth() + 1}月${date.getDate()}日（${weekdayLabels[date.getDay()]}）`;
}

/**
 * プロトタイプの daypanel/openDay() を、DOM書き換えではなく実データを受け取る
 * Reactコンポーネントとして再実装したもの。休講/予定なし/予定ありの3状態を表示する。
 */
export function TeamWorksDayPanel({
  dateKey,
  events,
  holidays,
  onClose
}: {
  dateKey: string;
  events: OperationsCalendarEvent[];
  holidays: OperationsHoliday[];
  onClose: () => void;
}) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleClose = () => {
    setEntered(false);
    window.setTimeout(onClose, 150);
  };

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        type="button"
        aria-label="閉じる"
        onClick={handleClose}
        className={`absolute inset-0 bg-[var(--mikke-backdrop)] transition-opacity duration-150 ${entered ? "opacity-100" : "opacity-0"}`}
      />
      <div
        className={`absolute inset-x-0 bottom-0 mx-auto max-w-xl rounded-t-2xl border border-b-0 border-[var(--mikke-line)] bg-white p-4 pb-6 shadow-2xl transition-transform duration-150 ease-out ${
          entered ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[15px] font-bold">{formatPanelTitle(dateKey)}</p>
          <button
            type="button"
            aria-label="閉じる"
            onClick={handleClose}
            className="grid h-7 w-7 place-items-center rounded-full bg-[var(--mikke-line-soft)] text-[var(--mikke-muted)]"
          >
            <X size={14} />
          </button>
        </div>

        {holidays.length > 0 ? (
          <p className="mb-3 rounded-lg bg-[var(--mikke-accent-soft)] px-3 py-2 text-xs font-bold text-[var(--mikke-accent)]">
            休講日{holidays.some((holiday) => holiday.memo) ? `：${holidays.map((holiday) => holiday.memo).filter(Boolean).join(" / ")}` : ""}
          </p>
        ) : null}

        {events.length === 0 ? (
          <p className="py-6 text-center text-xs font-semibold text-[var(--mikke-muted)]">この日の予定はありません</p>
        ) : (
          <div className="divide-y divide-[var(--mikke-line)] rounded-xl border border-[var(--mikke-line)]">
            {events.map((event) => (
              <div key={event.id} className="flex items-center gap-3 px-3 py-3">
                <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: event.bg }} />
                <span className="w-12 shrink-0 text-sm font-bold">{event.startTime}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{event.projectTitle}</span>
                  <span className="mt-0.5 flex items-center gap-2 text-xs font-semibold text-[var(--mikke-muted)]">
                    <span className="inline-flex items-center gap-1">
                      <Clock size={12} /> {event.durationMin}分
                    </span>
                    {event.partnerName ? <span>担当 {event.partnerName}</span> : <span className="text-[var(--mikke-accent)]">担当未定</span>}
                    {event.participantCount > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <Users size={12} /> {event.participantCount}名
                      </span>
                    ) : null}
                  </span>
                </span>
                <Link
                  href={`/apps/team-works/projects/${event.projectId}`}
                  className="shrink-0 rounded-full border border-[var(--mikke-line)] px-3 py-1.5 text-xs font-bold text-[var(--mikke-primary)]"
                >
                  詳細
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
