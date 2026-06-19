"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AuthGate, useAuth } from "@/components/AuthGate";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { StatCard } from "@/components/StatCard";
import { currentMonthStartIso, formatYen } from "@/lib/format";
import { listActivityLogs, listFinancialRecords, listMarketEvents } from "@/lib/marketnote";
import type { ActivityLog, MarketEvent, MarketFinancialRecord } from "@/types/database";

function HomeContent() {
  const { profile } = useAuth();
  const [events, setEvents] = useState<MarketEvent[]>([]);
  const [finances, setFinances] = useState<MarketFinancialRecord[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  useEffect(() => {
    Promise.all([
      listMarketEvents(profile.id),
      listFinancialRecords(profile.id),
      listActivityLogs(profile.id)
    ]).then(([nextEvents, nextFinances, nextLogs]) => {
      setEvents(nextEvents);
      setFinances(nextFinances);
      setLogs(nextLogs);
    });
  }, [profile.id]);

  const monthly = useMemo(() => {
    const start = currentMonthStartIso().slice(0, 10);
    const rows = finances.filter((row) => row.occurred_at >= start);
    const revenue = rows.filter((row) => row.record_type === "revenue").reduce((sum, row) => sum + Number(row.amount), 0);
    const expense = rows.filter((row) => row.record_type === "expense").reduce((sum, row) => sum + Number(row.amount), 0);
    return { revenue, expense, profit: revenue - expense };
  }, [finances]);

  return (
    <AppShell title="ホーム" subtitle={`${profile.display_name}さんの活動ダッシュボード`}>
      <section className="grid grid-cols-2 gap-3">
        <StatCard label="今月の売上" value={formatYen(monthly.revenue)} tone="orange" />
        <StatCard label="今月の経費" value={formatYen(monthly.expense)} tone="navy" />
        <StatCard label="利益" value={formatYen(monthly.profit)} tone="green" />
        <StatCard label="出店予定" value={`${events.length}件`} tone="gray" />
      </section>

      <section className="mt-5 grid gap-3">
        <Link href="/marketnote/new" className="flex items-center justify-between rounded-2xl bg-[#d9643a] px-5 py-4 font-bold text-white">
          <span className="flex items-center gap-2"><Plus size={20} /> 出店予定を登録</span>
          <ArrowRight size={20} />
        </Link>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/story" className="rounded-2xl border border-[#e8e1da] bg-white p-4 font-bold text-[#25211f]">Storyを見る</Link>
          <Link href="/desk" className="rounded-2xl border border-[#e8e1da] bg-white p-4 font-bold text-[#25211f]">DESKを見る</Link>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-bold text-[#25211f]">最近の活動</h2>
        <ActivityTimeline logs={logs.slice(0, 5)} />
      </section>
    </AppShell>
  );
}

export default function HomePage() {
  return (
    <AuthGate>
      <HomeContent />
    </AuthGate>
  );
}
