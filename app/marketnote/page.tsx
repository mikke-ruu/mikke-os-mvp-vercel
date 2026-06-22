"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronRight, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AuthGate, useAuth } from "@/components/AuthGate";
import { EmptyState } from "@/components/EmptyState";
import { formatDate } from "@/lib/format";
import { listCheckItems, listMarketEvents } from "@/lib/marketnote";
import type { MarketCheckItem, MarketEvent } from "@/types/database";

type Filter = "all" | "planned" | "preparing" | "completed";

function MarketNoteContent() {
  const { profile } = useAuth();
  const [events, setEvents] = useState<MarketEvent[]>([]);
  const [checksByEvent, setChecksByEvent] = useState<Record<string, MarketCheckItem[]>>({});
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    let active = true;

    async function load() {
      const nextEvents = await listMarketEvents(profile.id);
      const checkPairs = await Promise.all(nextEvents.map(async (event) => [event.id, await listCheckItems(profile.id, event.id)] as const));
      if (!active) return;
      setEvents(nextEvents);
      setChecksByEvent(Object.fromEntries(checkPairs));
    }

    load();
    return () => {
      active = false;
    };
  }, [profile.id]);

  const filtered = useMemo(() => {
    return [...events]
      .filter((event) => filter === "all" || event.status === filter)
      .sort((a, b) => a.event_date.localeCompare(b.event_date));
  }, [events, filter]);

  return (
    <AppShell title="出店" subtitle="出店予定・準備チェック">
      <Link href="/marketnote/new" className="mb-4 flex items-center justify-center gap-2 rounded-2xl bg-[#e8612c] px-4 py-4 font-extrabold text-white shadow-sm">
        <Plus size={20} /> 出店予定を追加
      </Link>

      <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
        {[
          ["all", "すべて"],
          ["preparing", "確定"],
          ["planned", "検討中"],
          ["completed", "終了"]
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value as Filter)}
            className={`shrink-0 rounded-full border px-4 py-2 text-xs font-extrabold ${
              filter === value ? "border-[#e8612c] bg-[#e8612c] text-white" : "border-[#e4ddd4] bg-white text-[#8a817a]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="表示できる出店予定がありません" body="条件を変えるか、新しい出店予定を追加してください。" />
      ) : (
        <div className="space-y-3">
          {filtered.map((event) => {
            const checks = checksByEvent[event.id] ?? [];
            const done = checks.filter((check) => check.is_done).length;
            const date = new Date(`${event.event_date}T00:00:00`);
            return (
              <Link key={event.id} href={`/marketnote/${event.id}`} className="grid grid-cols-[54px_1fr_auto] items-center gap-3 rounded-2xl border border-[#eceae5] bg-white p-3 shadow-sm">
                <div className="grid h-14 w-14 place-items-center rounded-2xl border border-[#f6ddd0] bg-[#fceee7] text-[#c24e1e]">
                  <CalendarDays size={18} />
                  <span className="-mt-2 text-xs font-black">{date.getMonth() + 1}/{date.getDate()}</span>
                </div>
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap gap-2">
                    <StatusBadge status={event.status} />
                    <span className="rounded-md border border-[#e4ddd4] bg-[#f1eeea] px-2 py-1 text-[10px] font-extrabold text-[#8a817a]">
                      チェック {done}/{checks.length}
                    </span>
                  </div>
                  <h2 className="truncate text-lg font-black text-[#1f1b18]">{event.title}</h2>
                  <p className="mt-1 truncate text-xs font-semibold text-[#9a9089]">{formatDate(event.event_date)} | {[event.venue_name, event.area].filter(Boolean).join(" / ") || "会場未設定"}</p>
                </div>
                <ChevronRight size={18} className="text-[#c2b9b0]" />
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

function StatusBadge({ status }: { status: MarketEvent["status"] }) {
  const label = status === "completed" ? "終了" : status === "preparing" ? "確定" : status === "cancelled" ? "中止" : "検討中";
  const tone = status === "preparing" ? "border-[#cfe6d2] bg-[#e6f1e7] text-[#2e7d46]" : status === "planned" ? "border-[#d3e1f2] bg-[#eaf1fa] text-[#3a6fb0]" : "border-[#e4ddd4] bg-[#f1eeea] text-[#8a817a]";
  return <span className={`rounded-md border px-2 py-1 text-[10px] font-extrabold ${tone}`}>{label}</span>;
}

export default function MarketNotePage() {
  return (
    <AuthGate>
      <MarketNoteContent />
    </AuthGate>
  );
}
