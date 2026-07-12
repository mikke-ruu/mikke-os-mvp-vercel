"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ClipboardList, ExternalLink, Users } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { EventForm } from "@/components/event/EventForm";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import { useMikkeEvents } from "@/lib/event/store";
import { eventStatusLabels } from "@/lib/event/types";

function EventAdminDetailContent() {
  const params = useParams<{ id: string }>();
  const { events, applications } = useMikkeEvents();
  const event = events.find((item) => item.id === params.id);
  const [editing, setEditing] = useState(false);

  if (!event) {
    return (
      <MikkeAppShell appName="Event" title="Event" currentApp={{ label: "Event", href: "/apps/event" }} footerLabel="Event by mikke">
        <p className="text-sm text-[var(--mikke-muted)]">このイベントは見つかりませんでした。</p>
      </MikkeAppShell>
    );
  }

  const eventApplications = applications.filter((application) => application.eventId === event.id);

  return (
    <MikkeAppShell appName="Event" title={event.title} currentApp={{ label: "Event", href: "/apps/event" }} footerLabel="Event by mikke">
      {editing ? (
        <div>
          <button type="button" onClick={() => setEditing(false)} className="mb-3 text-xs font-bold text-[var(--mikke-muted)]">
            ← 詳細に戻る
          </button>
          <EventForm event={event} />
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2">
            <MikkeStatusBadge tone={event.status === "published" ? "primary" : "muted"}>{eventStatusLabels[event.status]}</MikkeStatusBadge>
            <button type="button" onClick={() => setEditing(true)} className="text-xs font-bold text-[var(--mikke-accent)]">
              編集する
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/event/${event.id}`}
              target="_blank"
              className="inline-flex items-center gap-1 rounded-full border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-3 py-2 text-xs font-bold text-[var(--mikke-text-soft)]"
            >
              <ExternalLink size={14} />
              公開ページを見る
            </Link>
            <Link
              href={`/event/admin/${event.id}/applications`}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--mikke-accent)] px-3 py-2 text-xs font-bold text-white shadow-sm"
            >
              <Users size={14} />
              申込一覧（{eventApplications.length}）
            </Link>
          </div>

          <div className="mt-5 space-y-2 rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4 text-sm text-[var(--mikke-text-soft)]">
            <p className="flex items-center gap-2 font-semibold text-[var(--mikke-text)]">
              <ClipboardList size={16} className="shrink-0 text-[var(--mikke-muted)]" />
              {event.eventDate}{event.startTime ? ` ${event.startTime}〜${event.endTime || ""}` : ""}
            </p>
            {event.venueName ? <p>{event.venueName}{event.venueAddress ? `（${event.venueAddress}）` : ""}</p> : null}
            {event.feeAmount ? <p>{event.feeLabel || "参加費"}：{event.feeAmount}円</p> : null}
            {event.capacity ? <p>定員：{event.capacity}名</p> : null}
            <p>申込受付：{event.applicationOpen ? "受付中" : "停止中"}</p>
          </div>

          {event.summary ? <p className="mt-4 text-sm leading-6 text-[var(--mikke-text-soft)]">{event.summary}</p> : null}
        </div>
      )}
    </MikkeAppShell>
  );
}

export default function EventAdminDetailPage() {
  return (
    <AuthGate>
      <EventAdminDetailContent />
    </AuthGate>
  );
}
