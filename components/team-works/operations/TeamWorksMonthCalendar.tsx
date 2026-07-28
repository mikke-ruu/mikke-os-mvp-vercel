"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import {
  buildCalendarGridDates,
  formatDateKey,
  type OperationsCalendarEvent,
  type OperationsProjectSummary
} from "@/lib/team-works-operations";
import { getJapanDayOff } from "@/lib/japanese-calendar";
import { useTeamWorksLabels } from "@/components/team-works/useTeamWorksLabels";

const dowLabels = ["日", "月", "火", "水", "木", "金", "土"];
const maxChipsPerCell = 2;

type CalendarView = "month" | "week" | "day";

export function TeamWorksMonthCalendar({
  monthDate,
  onMonthChange,
  events,
  holidayDates,
  projects,
  shiftAvailability = [],
  onSelectDay
}: {
  monthDate: Date;
  onMonthChange: (nextMonth: Date) => void;
  events: OperationsCalendarEvent[];
  holidayDates: Set<string>;
  projects: OperationsProjectSummary[];
  shiftAvailability?: { date: string; names: string[] }[];
  onSelectDay: (dateKey: string) => void;
}) {
  const labels = useTeamWorksLabels();
  const [view, setView] = useState<CalendarView>("month");
  const todayKey = formatDateKey(new Date());
  const gridDates = useMemo(() => buildCalendarGridDates(monthDate), [monthDate]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, OperationsCalendarEvent[]>();
    for (const event of events) {
      const list = map.get(event.sessionDate) ?? [];
      list.push(event);
      map.set(event.sessionDate, list);
    }
    return map;
  }, [events]);
  const shiftsByDate = useMemo(
    () => new Map(shiftAvailability.map((item) => [item.date, item.names])),
    [shiftAvailability]
  );

  const goPrevMonth = () => onMonthChange(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1));
  const goNextMonth = () => onMonthChange(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1));

  return (
    <div className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrevMonth}
            aria-label="前の月"
            className="grid h-7 w-7 place-items-center rounded-lg border border-[var(--mikke-line)] text-[var(--mikke-muted)]"
          >
            <ChevronLeft size={14} />
          </button>
          <p className="text-sm font-bold">
            {monthDate.getFullYear()}年 {monthDate.getMonth() + 1}月
          </p>
          <button
            type="button"
            onClick={goNextMonth}
            aria-label="次の月"
            className="grid h-7 w-7 place-items-center rounded-lg border border-[var(--mikke-line)] text-[var(--mikke-muted)]"
          >
            <ChevronRight size={14} />
          </button>
        </div>
        <div className="flex overflow-hidden rounded-lg border border-[var(--mikke-line)]">
          {(["month", "week", "day"] as CalendarView[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setView(value)}
              className={`px-3 py-1.5 text-xs font-bold ${
                view === value ? "bg-[var(--mikke-primary)] text-white" : "bg-white text-[var(--mikke-muted)]"
              }`}
            >
              {value === "month" ? "月" : value === "week" ? "週" : "日"}
            </button>
          ))}
        </div>
      </div>

      {view === "month" ? (
        <div className="grid grid-cols-7 gap-1">
          {dowLabels.map((label) => (
            <div key={label} className="pb-1 text-center text-[10px] font-bold text-[var(--mikke-muted-light)]">
              {label}
            </div>
          ))}
          {gridDates.map((date) => {
            const dateKey = formatDateKey(date);
            const inMonth = date.getMonth() === monthDate.getMonth();
            const isToday = dateKey === todayKey;
            const isHoliday = holidayDates.has(dateKey);
            const japanDayOff = getJapanDayOff(date);
            const dayEvents = eventsByDate.get(dateKey) ?? [];
            const availablePartnerNames = shiftsByDate.get(dateKey) ?? [];
            const visibleEvents = dayEvents.slice(0, maxChipsPerCell);
            const overflowCount = dayEvents.length - visibleEvents.length;

            if (!inMonth) {
              return (
                <div key={dateKey} className="min-h-[60px] rounded-lg border border-[var(--mikke-line-soft)] p-1 opacity-35">
                  <span className="text-[10px] font-semibold text-[var(--mikke-muted-light)]">{date.getDate()}</span>
                </div>
              );
            }

            return (
              <button
                key={dateKey}
                type="button"
                onClick={() => onSelectDay(dateKey)}
                className={`min-h-[60px] rounded-lg border p-1 text-left ${
                  japanDayOff.isDayOff ? "border-[var(--mikke-pink)] bg-[var(--mikke-pink)]" : "border-[var(--mikke-line)] bg-white"
                } ${
                  isToday ? "border-[1.5px] border-[var(--mikke-green)]" : ""
                }`}
              >
                <span className={`text-[10px] font-bold ${isToday ? "text-[var(--mikke-success)]" : "text-[var(--mikke-muted)]"}`}>
                  {date.getDate()}
                </span>
                {isHoliday ? <span className="mt-0.5 block text-[8px] font-extrabold text-[var(--mikke-accent)]">休校</span> : null}
                {!isHoliday && japanDayOff.isDayOff ? (
                  <span title={japanDayOff.label ?? undefined} className="mt-0.5 block truncate text-[8px] font-extrabold text-[var(--tw-on-tint)]">
                    {japanDayOff.isNationalHoliday ? japanDayOff.label : "休校"}
                  </span>
                ) : null}
                {availablePartnerNames.length > 0 ? (
                  <span title={availablePartnerNames.join("、")} className="mt-0.5 block truncate rounded bg-[var(--mikke-yellow)] px-1 py-[1px] text-[8px] font-extrabold text-[#1b1b1f]">
                    希望 {availablePartnerNames.length}名
                  </span>
                ) : null}
                {visibleEvents.map((event) => (
                  <span
                    key={event.id}
                    className={`mt-0.5 block truncate rounded px-1 py-[1px] text-[8px] font-bold ${
                      event.partnerPresenceStatus === "in_progress"
                        ? "bg-[var(--tw-done)] text-[var(--tw-on-tint)]"
                        : event.partnerPresenceStatus === "standby"
                          ? "bg-[var(--tw-planned)] text-[var(--tw-on-tint)]"
                          : ""
                    }`}
                    style={event.partnerPresenceStatus === "not_started" || event.partnerPresenceStatus === "ended"
                      ? { background: event.bg, color: event.fg }
                      : undefined}
                  >
                    {event.projectTitle} {event.startTime}
                    {event.partnerPresenceStatus === "standby"
                      ? " スタンバイ"
                      : event.partnerPresenceStatus === "in_progress"
                        ? " 実施中"
                        : ""}
                  </span>
                ))}
                {overflowCount > 0 ? <span className="mt-0.5 block text-[8px] font-bold text-[var(--mikke-muted-light)]">+{overflowCount}</span> : null}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-[var(--mikke-line)] px-3 py-10 text-center text-xs text-[var(--mikke-muted-light)]">
          {view === "week"
            ? `週表示（次のモックで設計）— 1日ごとの時間割で担当${labels.workers}のシフト調整に使う想定`
            : "日表示（次のモックで設計）— 1日の全コマをタイムライン表示"}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-3 text-[10.5px] font-semibold text-[var(--mikke-muted)]">
        {projects.map((project) => (
          <span key={project.id} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: project.bg }} />
            {project.title}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-[var(--mikke-accent)]" />
          休校
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-[var(--mikke-pink)]" />
          土日祝
        </span>
        {shiftAvailability.length > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-[var(--mikke-yellow)]" />
            {labels.workers}希望日
          </span>
        ) : null}
      </div>
    </div>
  );
}
