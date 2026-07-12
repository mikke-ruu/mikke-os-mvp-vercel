"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { CalendarDays, Clock3, MapPin } from "lucide-react";
import { EventPublicShell } from "@/components/event/EventPublicShell";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import { formatMonthDayWeekday, formatYen } from "@/lib/format";
import { useMikkeEvents } from "@/lib/event/store";

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const { events } = useMikkeEvents();
  const event = events.find((item) => item.id === params.id);

  if (!event) {
    return (
      <EventPublicShell title="Event" backHref="/event">
        <p className="text-sm text-[var(--mikke-muted)]">このイベントは見つかりませんでした。</p>
      </EventPublicShell>
    );
  }

  const canApply = event.status === "published" && event.applicationOpen;

  return (
    <EventPublicShell title="Event" backHref="/event">
      {event.status === "finished" ? (
        <MikkeStatusBadge tone="muted" className="mb-2">終了しました</MikkeStatusBadge>
      ) : null}
      {event.status === "published" && !event.applicationOpen ? (
        <MikkeStatusBadge tone="muted" className="mb-2">申込は締め切りました</MikkeStatusBadge>
      ) : null}

      <h1 className="text-2xl font-bold tracking-normal text-[var(--mikke-text)]">{event.title}</h1>
      {event.summary ? <p className="mt-2 text-sm leading-6 text-[var(--mikke-text-soft)]">{event.summary}</p> : null}

      <div className="mt-4 space-y-2 rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-[var(--mikke-text)]">
          <CalendarDays size={16} className="shrink-0 text-[var(--mikke-muted)]" />
          {formatMonthDayWeekday(event.eventDate)}
        </p>
        {event.startTime ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-[var(--mikke-text)]">
            <Clock3 size={16} className="shrink-0 text-[var(--mikke-muted)]" />
            {event.startTime}{event.endTime ? ` 〜 ${event.endTime}` : ""}
          </p>
        ) : null}
        {event.venueName ? (
          <p className="flex items-start gap-2 text-sm font-semibold text-[var(--mikke-text)]">
            <MapPin size={16} className="mt-0.5 shrink-0 text-[var(--mikke-muted)]" />
            <span>
              {event.venueName}
              {event.venueAddress ? <span className="block text-xs font-semibold text-[var(--mikke-muted)]">{event.venueAddress}</span> : null}
              {event.mapUrl ? (
                <a href={event.mapUrl} target="_blank" rel="noreferrer" className="mt-1 block text-xs font-bold text-[var(--mikke-accent)]">
                  地図を見る
                </a>
              ) : null}
            </span>
          </p>
        ) : null}
        {event.feeAmount ? (
          <p className="text-sm font-semibold text-[var(--mikke-text)]">
            {event.feeLabel || "参加費"}：{formatYen(event.feeAmount)}
          </p>
        ) : null}
        {event.capacity ? (
          <p className="text-sm font-semibold text-[var(--mikke-text)]">定員：{event.capacity}名</p>
        ) : null}
      </div>

      {event.description ? (
        <div className="mt-4">
          <h2 className="text-sm font-bold text-[var(--mikke-text)]">詳細</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[var(--mikke-text-soft)]">{event.description}</p>
        </div>
      ) : null}

      {event.organizerNotice ? (
        <div className="mt-4 rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-accent-soft)] p-4">
          <h2 className="text-sm font-bold text-[var(--mikke-accent-strong)]">主催者からのお知らせ</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--mikke-text-soft)]">{event.organizerNotice}</p>
        </div>
      ) : null}

      {canApply ? (
        <Link
          href={`/event/${event.id}/apply`}
          className="mt-6 block rounded-full bg-[var(--mikke-accent)] px-4 py-3 text-center text-sm font-bold text-white shadow-sm"
        >
          このイベントに申し込む
        </Link>
      ) : null}
    </EventPublicShell>
  );
}
