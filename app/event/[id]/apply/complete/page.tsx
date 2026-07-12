"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { EventPublicShell } from "@/components/event/EventPublicShell";
import { useMikkeEvents } from "@/lib/event/store";

export default function EventApplyCompletePage() {
  const params = useParams<{ id: string }>();
  const { events } = useMikkeEvents();
  const event = events.find((item) => item.id === params.id);

  return (
    <EventPublicShell title="Event">
      <div className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-6 text-center">
        <CheckCircle2 size={40} className="mx-auto text-[var(--mikke-success)]" />
        <h1 className="mt-3 text-lg font-bold tracking-normal text-[var(--mikke-text)]">申込を受け付けました</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--mikke-text-soft)]">
          {event ? `${event.title}への申込を受け付けました。` : "申込を受け付けました。"}
          主催者からの確定連絡をお待ちください。
        </p>
        {event ? (
          <Link href={`/event/${event.id}`} className="mt-4 inline-block text-xs font-bold text-[var(--mikke-accent)]">
            イベントページに戻る
          </Link>
        ) : null}
      </div>
    </EventPublicShell>
  );
}
