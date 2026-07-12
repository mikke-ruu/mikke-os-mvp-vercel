"use client";

import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { EventPublicShell } from "@/components/event/EventPublicShell";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { formatMonthDayWeekday, formatYen } from "@/lib/format";
import { useMikkeEvents } from "@/lib/event/store";

export default function EventListPage() {
  const { events } = useMikkeEvents();
  const publicEvents = events
    .filter((event) => event.status === "published" || event.status === "finished")
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate));

  return (
    <EventPublicShell title="Event">
      <p className="text-sm leading-6 text-[var(--mikke-muted)]">開催予定のイベントを確認できます。</p>

      {publicEvents.length > 0 ? (
        <div className="mt-4 space-y-3">
          {publicEvents.map((event) => (
            <Link
              key={event.id}
              href={`/event/${event.id}`}
              className="block rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4 shadow-sm"
            >
              {event.status === "finished" ? (
                <span className="inline-block rounded-full bg-[var(--mikke-surface-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--mikke-muted)]">終了</span>
              ) : null}
              <h2 className="mt-1 text-lg font-bold tracking-normal text-[var(--mikke-text)]">{event.title}</h2>
              <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-[var(--mikke-muted)]">
                <CalendarDays size={14} />
                {formatMonthDayWeekday(event.eventDate)}
                {event.startTime ? ` ${event.startTime}〜` : ""}
              </p>
              {event.venueName ? (
                <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-[var(--mikke-muted)]">
                  <MapPin size={14} />
                  {event.venueName}
                </p>
              ) : null}
              {event.status === "published" && event.applicationOpen ? (
                <p className="mt-2 text-xs font-bold text-[var(--mikke-accent)]">
                  {event.feeLabel || "参加費"}：{event.feeAmount ? formatYen(event.feeAmount) : "お問い合わせ"}
                </p>
              ) : null}
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-4">
          <MikkeEmptyState title="公開中のイベントはまだありません" helper="イベントが公開されると、ここに表示されます。" />
        </div>
      )}
    </EventPublicShell>
  );
}
