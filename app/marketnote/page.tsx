"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AuthGate, useAuth } from "@/components/AuthGate";
import { EmptyState } from "@/components/EmptyState";
import { formatDate } from "@/lib/format";
import { listMarketEvents } from "@/lib/marketnote";
import type { MarketEvent } from "@/types/database";

function MarketNoteContent() {
  const { profile } = useAuth();
  const [events, setEvents] = useState<MarketEvent[]>([]);

  useEffect(() => {
    listMarketEvents(profile.id).then(setEvents);
  }, [profile.id]);

  return (
    <AppShell title="MarketNote" subtitle="出店予定・準備・振り返り">
      <Link href="/marketnote/new" className="mb-4 flex items-center justify-center gap-2 rounded-2xl bg-[#d9643a] px-4 py-3 font-bold text-white">
        <Plus size={20} /> 出店予定を登録
      </Link>

      {events.length === 0 ? (
        <EmptyState title="出店予定はまだありません" body="まずは次の出店予定を登録して、Mikke OSの活動ログを育てましょう。" />
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <Link key={event.id} href={`/marketnote/${event.id}`} className="block rounded-2xl border border-[#e8e1da] bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-[#fff0e9] p-3 text-[#d9643a]">
                  <CalendarDays size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[#79716b]">{formatDate(event.event_date)}</p>
                  <h2 className="mt-1 truncate text-lg font-bold text-[#25211f]">{event.title}</h2>
                  <p className="mt-1 text-sm text-[#79716b]">{[event.venue_name, event.area, event.genre].filter(Boolean).join(" / ")}</p>
                  <p className="mt-3 inline-flex rounded-full bg-[#f5f0eb] px-3 py-1 text-xs font-bold text-[#79716b]">{event.status}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}

export default function MarketNotePage() {
  return (
    <AuthGate>
      <MarketNoteContent />
    </AuthGate>
  );
}
