"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { getJapanDayOff } from "@/lib/japanese-calendar";
import { useTeamWorksLabels } from "@/components/team-works/useTeamWorksLabels";

type CalendarSession = {
  id: string;
  projectId: string;
  sessionDate: string;
  startTime: string;
  status: string;
};

type CalendarHoliday = {
  date: string;
};

const weekdays = ["日", "月", "火", "水", "木", "金", "土"];

// プロジェクトの見分け用ドット。役割色ではなく識別色として5色を巡回させる。
const projectDotColors = [
  "bg-[var(--mikke-blue)]",
  "bg-[var(--mikke-orange)]",
  "bg-[var(--mikke-green)]",
  "bg-[var(--mikke-yellow)]",
  "bg-[var(--mikke-pink)]"
];

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function monthCalendarDates(monthDate: Date): Date[] {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

export function ClientMonthCalendar({
  sessions,
  holidays,
  selectedDate,
  onSelectDate
}: {
  sessions: CalendarSession[];
  holidays: CalendarHoliday[];
  selectedDate: string | null;
  onSelectDate: (dateKey: string) => void;
}) {
  const labels = useTeamWorksLabels();
  const [monthDate, setMonthDate] = useState(() => {
    const now = new Date();
    const todayKey = toDateKey(now);
    const currentMonthKey = todayKey.slice(0, 7);
    const upcoming = sessions
      .filter((session) => session.status !== "cancelled" && session.sessionDate >= todayKey)
      .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
    const hasUpcomingThisMonth = upcoming.some((session) => session.sessionDate.startsWith(currentMonthKey));
    if (!hasUpcomingThisMonth && upcoming[0]) {
      const nextDate = new Date(`${upcoming[0].sessionDate}T00:00:00`);
      return new Date(nextDate.getFullYear(), nextDate.getMonth(), 1);
    }
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const calendarDates = useMemo(() => monthCalendarDates(monthDate), [monthDate]);

  const projectIds = useMemo(() => [...new Set(sessions.map((session) => session.projectId))], [sessions]);
  const showProjectDot = projectIds.length > 1;
  const dotColorByProject = useMemo(
    () => new Map(projectIds.map((id, index) => [id, projectDotColors[index % projectDotColors.length]])),
    [projectIds]
  );

  const sessionsByDate = useMemo(() => {
    const result = new Map<string, CalendarSession[]>();
    for (const session of sessions) {
      if (session.status === "cancelled") continue;
      result.set(session.sessionDate, [...(result.get(session.sessionDate) ?? []), session]);
    }
    return result;
  }, [sessions]);

  const holidaysByDate = useMemo(() => {
    const result = new Map<string, CalendarHoliday[]>();
    for (const holiday of holidays) {
      result.set(holiday.date, [...(result.get(holiday.date) ?? []), holiday]);
    }
    return result;
  }, [holidays]);

  return (
    <div className="rounded-2xl border border-[var(--mikke-line)] bg-white p-3">
      <div className="mb-3 flex items-center gap-2">
        <button type="button" aria-label="前の月" onClick={() => setMonthDate((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))} className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--mikke-line)] bg-white text-[var(--mikke-muted)]"><ChevronLeft size={15} /></button>
        <p className="text-sm font-extrabold">{monthDate.getFullYear()}年 {monthDate.getMonth() + 1}月</p>
        <button type="button" aria-label="次の月" onClick={() => setMonthDate((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))} className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--mikke-line)] bg-white text-[var(--mikke-muted)]"><ChevronRight size={15} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-[var(--mikke-muted)]">
        {weekdays.map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {calendarDates.map((date) => {
          const key = toDateKey(date);
          const inMonth = date.getMonth() === monthDate.getMonth();
          const daySessions = sessionsByDate.get(key) ?? [];
          const dayHolidays = holidaysByDate.get(key) ?? [];
          const japanDayOff = getJapanDayOff(date);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDate(key)}
              className={`min-h-16 rounded-lg border p-1.5 text-left ${
                key === selectedDate
                  ? "border-[var(--mikke-primary)] bg-[var(--mikke-primary-soft)]"
                  : japanDayOff.isDayOff
                    ? "border-[var(--mikke-pink)] bg-[var(--mikke-pink)]"
                    : "border-[var(--mikke-line)] bg-white"
              } ${inMonth ? "" : "opacity-40"}`}
            >
              <span className="block text-[10px] font-bold">{date.getDate()}</span>
              <span className="mt-1 flex flex-wrap gap-1">
                {daySessions.slice(0, 2).map((session) => (
                  <span key={session.id} className="inline-flex items-center gap-0.5 rounded bg-[var(--mikke-primary)] px-1 py-0.5 text-[8px] font-bold text-white">
                    {showProjectDot ? <span className={`h-1.5 w-1.5 rounded-full ${dotColorByProject.get(session.projectId) ?? "bg-white"}`} /> : null}
                    {session.startTime}
                  </span>
                ))}
                {daySessions.length >= 3 ? (
                  <span className="rounded bg-[var(--mikke-yellow)] px-1 py-0.5 text-[8px] font-extrabold text-[var(--tw-on-tint)]">
                    全{daySessions.length}件
                  </span>
                ) : null}
                {dayHolidays.length > 0 ? <span className="rounded bg-[var(--mikke-pink)] px-1 py-0.5 text-[8px] font-bold">休講</span> : null}
                {dayHolidays.length === 0 && japanDayOff.isDayOff ? (
                  <span title={japanDayOff.label ?? undefined} className="truncate rounded bg-[var(--mikke-pink)] px-1 py-0.5 text-[8px] font-bold text-[var(--tw-on-tint)]">
                    {japanDayOff.isNationalHoliday ? japanDayOff.label : labels.holidayLabel}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-bold text-[var(--mikke-muted)]">
        <span className="h-2.5 w-2.5 rounded-[3px] bg-[var(--mikke-pink)]" />
        土日祝
      </p>
    </div>
  );
}
