"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

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

const projectDotColors = [
  "bg-[var(--mikke-primary)]",
  "bg-[var(--mikke-accent)]",
  "bg-amber-500",
  "bg-sky-500",
  "bg-violet-500",
  "bg-emerald-500"
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
  const [monthDate, setMonthDate] = useState(() => new Date());
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
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-extrabold">{monthDate.getFullYear()}年 {monthDate.getMonth() + 1}月</p>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="前の月" onClick={() => setMonthDate((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))} className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--mikke-line)] bg-white"><ChevronLeft size={15} /></button>
          <button type="button" aria-label="次の月" onClick={() => setMonthDate((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))} className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--mikke-line)] bg-white"><ChevronRight size={15} /></button>
        </div>
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
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDate(key)}
              className={`min-h-16 rounded-lg border p-1.5 text-left ${key === selectedDate ? "border-[var(--mikke-primary)] bg-[var(--mikke-primary-soft)]" : "border-[var(--mikke-line)] bg-white"} ${inMonth ? "" : "opacity-40"}`}
            >
              <span className="block text-[10px] font-bold">{date.getDate()}</span>
              <span className="mt-1 flex flex-wrap gap-1">
                {daySessions.slice(0, 3).map((session) => (
                  <span key={session.id} className="inline-flex items-center gap-0.5 rounded bg-[var(--mikke-primary)] px-1 py-0.5 text-[8px] font-bold text-white">
                    {showProjectDot ? <span className={`h-1.5 w-1.5 rounded-full ${dotColorByProject.get(session.projectId) ?? "bg-white"}`} /> : null}
                    {session.startTime}
                  </span>
                ))}
                {dayHolidays.length > 0 ? <span className="rounded bg-[var(--mikke-pink)] px-1 py-0.5 text-[8px] font-bold">休講</span> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
