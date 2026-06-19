"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, MapPin, QrCode, UserRound } from "lucide-react";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { AppShell } from "@/components/AppShell";
import { AuthGate, useAuth } from "@/components/AuthGate";
import { StatCard } from "@/components/StatCard";
import { formatDate } from "@/lib/format";
import { listActivityLogs, listMarketEvents } from "@/lib/marketnote";
import type { ActivityLog, MarketEvent } from "@/types/database";

function StoryContent() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [events, setEvents] = useState<MarketEvent[]>([]);

  useEffect(() => {
    Promise.all([listActivityLogs(profile.id, true), listMarketEvents(profile.id)]).then(([nextLogs, nextEvents]) => {
      setLogs(nextLogs);
      setEvents(nextEvents);
    });
  }, [profile.id]);

  const summary = useMemo(() => {
    const completed = events.filter((event) => event.status === "completed").length;
    const publicLogs = logs.length;
    const last = logs[0]?.occurred_at;
    return { completed, publicLogs, last };
  }, [events, logs]);

  return (
    <AppShell title="Story" subtitle="活動を信用として見せるページ">
      <section className="rounded-3xl border border-[#e8e1da] bg-white p-5 shadow-sm">
        <div className="flex gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[#fff0e9] text-[#d9643a]">
            <UserRound size={34} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-[#d9643a]">#{String(profile.member_number ?? 1).padStart(6, "0")}</p>
            <h2 className="mt-1 text-2xl font-bold">{profile.display_name}</h2>
            <p className="mt-1 text-sm text-[#79716b]">@{profile.handle}</p>
            {profile.area ? (
              <p className="mt-2 flex items-center gap-1 text-sm text-[#79716b]">
                <MapPin size={15} /> {profile.area}
              </p>
            ) : null}
          </div>
        </div>
        {profile.bio ? <p className="mt-4 text-sm leading-7 text-[#25211f]">{profile.bio}</p> : null}
      </section>

      <section className="mt-5">
        <h2 className="mb-3 text-lg font-bold">活動サマリー</h2>
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="活動" value={`${summary.publicLogs}件`} />
          <StatCard label="出店" value={`${summary.completed}回`} tone="green" />
          <StatCard label="最新" value={summary.last ? formatDate(summary.last).slice(5) : "-"} tone="gray" />
        </div>
      </section>

      <section className="mt-5">
        <h2 className="mb-3 text-lg font-bold">出店履歴</h2>
        <div className="space-y-3">
          {events.filter((event) => event.display_on_story).map((event) => (
            <article key={event.id} className="rounded-2xl border border-[#e8e1da] bg-white p-4 shadow-sm">
              <p className="flex items-center gap-2 text-xs font-bold text-[#d9643a]">
                <CalendarDays size={15} /> {formatDate(event.event_date)}
              </p>
              <h3 className="mt-2 font-bold">{event.title}</h3>
              <p className="mt-1 text-sm text-[#79716b]">{[event.venue_name, event.area, event.genre].filter(Boolean).join(" / ")}</p>
              {event.public_note ? <p className="mt-2 text-sm leading-6 text-[#25211f]">{event.public_note}</p> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="mt-5">
        <h2 className="mb-3 text-lg font-bold">活動タイムライン</h2>
        <ActivityTimeline logs={logs} />
      </section>

      <section className="mt-5 rounded-2xl border border-[#e8e1da] bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-[#fff0e9] p-3 text-[#d9643a]">
            <QrCode size={24} />
          </div>
          <div>
            <h2 className="font-bold">Mikke Story QR</h2>
            <p className="mt-1 text-sm text-[#79716b]">QR表示は次の段階で実装します。</p>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

export default function StoryPage() {
  return (
    <AuthGate>
      <StoryContent />
    </AuthGate>
  );
}
