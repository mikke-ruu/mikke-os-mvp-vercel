"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Video, X } from "lucide-react";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import { toDateKey } from "@/lib/format";
import {
  createTeamWorksId,
  formatSessionTime,
  statusLabel,
  teamWorksTemplate,
  type TeamWorksHoliday,
  type TeamWorksSession,
  type TeamWorksState
} from "@/lib/team-works";
import { getJapanDayOff } from "@/lib/japanese-calendar";

type Props = {
  state: TeamWorksState;
  updateState: (next: TeamWorksState) => void;
};

const weekdayLabels = ["日", "月", "火", "水", "木", "金", "土"];

export function SchoolCalendar({ state, updateState }: Props) {
  const todayKey = toDateKey(new Date());
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const sessionsByDate = useMemo(() => {
    const map: Record<string, TeamWorksSession[]> = {};
    for (const session of state.sessions) {
      const key = session.startsAt.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(session);
    }
    for (const key of Object.keys(map)) {
      map[key] = map[key].slice().sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    }
    return map;
  }, [state.sessions]);

  // Whole-org holidays only for now (clientId omitted). Per-client holidays are supported
  // by the data model already; a per-client picker can be layered on later without
  // changing this lookup.
  const orgHolidayDates = useMemo(() => {
    const set = new Set<string>();
    for (const holiday of state.holidays) {
      if (!holiday.clientId) set.add(holiday.date);
    }
    return set;
  }, [state.holidays]);

  const weeks = useMemo(() => buildMonthMatrix(visibleMonth), [visibleMonth]);
  const selectedSession = state.sessions.find((session) => session.id === selectedSessionId) ?? null;

  function toggleHoliday(dateKey: string) {
    const existing = state.holidays.find((holiday) => holiday.date === dateKey && !holiday.clientId);
    if (existing) {
      updateState({ ...state, holidays: state.holidays.filter((holiday) => holiday.id !== existing.id) });
      return;
    }
    const next: TeamWorksHoliday = {
      id: createTeamWorksId("holiday"),
      organizationId: teamWorksTemplate.organizationId,
      date: dateKey
    };
    updateState({ ...state, holidays: [...state.holidays, next] });
  }

  return (
    <div className="grid gap-4">
      <div className="tw-card p-3.5 sm:p-[18px]">
        <div className="flex items-center justify-between px-1">
          <button
            type="button"
            onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
            aria-label="前の月"
            className="grid h-9 w-9 place-items-center rounded-full text-[var(--mikke-muted)] hover:bg-[var(--mikke-surface-soft)]"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <h3 className="tw-section-title">
              {visibleMonth.getFullYear()}年{visibleMonth.getMonth() + 1}月
            </h3>
            <button
              type="button"
              onClick={() => setVisibleMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
              className="rounded-full border border-[var(--mikke-line)] px-2 py-1 text-[11px] font-bold text-[var(--mikke-muted)]"
            >
              今日
            </button>
          </div>
          <button
            type="button"
            onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
            aria-label="次の月"
            className="grid h-9 w-9 place-items-center rounded-full text-[var(--mikke-muted)] hover:bg-[var(--mikke-surface-soft)]"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1">
          {weekdayLabels.map((label) => (
            <div key={label} className="py-1 text-center text-[11px] font-bold text-[var(--mikke-muted-light)]">
              {label}
            </div>
          ))}
          {weeks.flat().map((date) => {
            const key = toDateKey(date);
            const inMonth = date.getMonth() === visibleMonth.getMonth();
            const isToday = key === todayKey;
            const daySessions = sessionsByDate[key] ?? [];
            const isHoliday = orgHolidayDates.has(key);
            const japanDayOff = getJapanDayOff(date);

            return (
              <div
                key={key}
                role="button"
                tabIndex={0}
                onClick={() => toggleHoliday(key)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    toggleHoliday(key);
                  }
                }}
                aria-label={`${key}${isHoliday ? "（休講）" : ""}`}
                className={`flex min-h-[74px] cursor-pointer flex-col items-start gap-1 rounded-xl border p-1.5 text-left sm:min-h-[92px] ${
                  isHoliday
                    ? "border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)]"
                    : japanDayOff.isDayOff
                      ? "border-[var(--mikke-pink)] bg-[var(--mikke-pink)]"
                      : "border-transparent hover:bg-[var(--mikke-surface-soft)]"
                } ${inMonth ? "" : "opacity-40"}`}
              >
                <div className="flex w-full items-center justify-between">
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                      isToday ? "bg-[var(--mikke-primary)] text-[var(--mikke-surface)]" : "text-[var(--mikke-primary)]"
                    }`}
                  >
                    {date.getDate()}
                  </span>
                  {isHoliday ? (
                    <span className="rounded-full bg-[var(--mikke-accent-soft)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--mikke-accent)]">
                      休
                    </span>
                  ) : japanDayOff.isDayOff ? (
                    <span title={japanDayOff.label ?? undefined} className="max-w-[72%] truncate rounded-full bg-white px-1.5 py-0.5 text-[9px] font-bold text-[var(--tw-on-tint)]">
                      {japanDayOff.isNationalHoliday ? japanDayOff.label : "休校"}
                    </span>
                  ) : null}
                </div>
                <div className="flex w-full flex-wrap gap-0.5">
                  {daySessions.map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedSessionId(session.id);
                      }}
                      className={`truncate rounded-full px-1.5 py-0.5 text-[9px] font-bold sm:text-[10px] ${
                        session.status === "unassigned"
                          ? "bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent)]"
                          : "bg-[var(--mikke-primary-soft)] text-[var(--mikke-primary)]"
                      }`}
                    >
                      {startTimeLabel(session.startsAt)}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <p className="tw-helper mt-3">
          日付をクリックすると休講の登録・解除ができます。コマ（開始時間）をクリックすると詳細を確認できます。
        </p>
      </div>

      {selectedSession ? (
        <SessionDetailPanel state={state} session={selectedSession} onClose={() => setSelectedSessionId(null)} />
      ) : null}
    </div>
  );
}

/**
 * Phase 2 seam: this panel only shows read-only details (time / partner / status / Zoom link).
 * Phase 3 extends this same panel with the roster (attendance) builder — checkbox list of
 * participants, click-order numbering, and save-as-AttendanceEntry(orderIndex) — without
 * changing how SchoolCalendar opens it.
 */
function SessionDetailPanel({
  state,
  session,
  onClose
}: {
  state: TeamWorksState;
  session: TeamWorksSession;
  onClose: () => void;
}) {
  const worker = state.workers.find((item) => item.id === session.workerId);
  const client = state.clients.find((item) => item.id === session.clientId);

  return (
    <section className="tw-card p-4 sm:p-[18px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="tw-section-title">{formatSessionTime(session.startsAt)} のコマ</h3>
          <p className="tw-helper mt-1">
            {client?.name ?? "未設定"} / {session.className}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="閉じる" className="tw-text-button">
          <X size={16} />
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl bg-[var(--mikke-surface)] px-3 py-2">
          <p className="tw-helper font-bold">授業時間</p>
          <p className="mt-1 font-bold text-[var(--mikke-primary)]">{session.durationMinutes}分</p>
        </div>
        <div className="rounded-xl bg-[var(--mikke-surface)] px-3 py-2">
          <p className="tw-helper font-bold">担当パートナー</p>
          <p className="mt-1 font-bold text-[var(--mikke-primary)]">{worker?.name ?? "未割当"}</p>
        </div>
        <div className="rounded-xl bg-[var(--mikke-surface)] px-3 py-2">
          <p className="tw-helper font-bold">状態</p>
          <p className="mt-1">
            <MikkeStatusBadge tone={session.status === "unassigned" ? "primary" : "success"}>
              {statusLabel(session.status)}
            </MikkeStatusBadge>
          </p>
        </div>
      </div>

      <a href={session.zoomUrl} className="tw-secondary-button mt-3">
        <Video size={17} />
        Zoom開始（別ウィンドウで開きます）
      </a>
      <p className="tw-helper mt-2">出席簿づくり（受講順の設定）は次のフェーズで追加予定です。</p>
    </section>
  );
}

function startTimeLabel(startsAt: string) {
  const [, time] = startsAt.split("T");
  return time ? time.slice(0, 5) : formatSessionTime(startsAt);
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
