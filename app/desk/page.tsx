"use client";

import { useEffect, useMemo, useState } from "react";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { AppShell } from "@/components/AppShell";
import { AuthGate, useAuth } from "@/components/AuthGate";
import { StatCard } from "@/components/StatCard";
import { currentMonthStartIso, formatDate, formatYen } from "@/lib/format";
import { listActivityLogs, listFinancialRecords, listMarketEvents } from "@/lib/marketnote";
import type { ActivityLog, MarketEvent, MarketFinancialRecord } from "@/types/database";

function DeskContent() {
  const { profile } = useAuth();
  const [finances, setFinances] = useState<MarketFinancialRecord[]>([]);
  const [events, setEvents] = useState<MarketEvent[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  useEffect(() => {
    Promise.all([
      listFinancialRecords(profile.id),
      listMarketEvents(profile.id),
      listActivityLogs(profile.id)
    ]).then(([nextFinances, nextEvents, nextLogs]) => {
      setFinances(nextFinances);
      setEvents(nextEvents);
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

  const eventRows = useMemo(() => {
    return events.map((event) => {
      const rows = finances.filter((row) => row.market_event_id === event.id);
      const revenue = rows.filter((row) => row.record_type === "revenue").reduce((sum, row) => sum + Number(row.amount), 0);
      const expense = rows.filter((row) => row.record_type === "expense").reduce((sum, row) => sum + Number(row.amount), 0);
      return { event, revenue, expense, profit: revenue - expense };
    });
  }, [events, finances]);

  return (
    <AppShell title="DESK" subtitle="売上・経費・利益をざっくり把握">
      <section className="grid grid-cols-2 gap-3">
        <StatCard label="今月の売上" value={formatYen(monthly.revenue)} tone="orange" />
        <StatCard label="今月の経費" value={formatYen(monthly.expense)} tone="navy" />
        <StatCard label="利益" value={formatYen(monthly.profit)} tone="green" />
        <StatCard label="記録" value={`${finances.length}件`} tone="gray" />
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-bold">イベント別収支</h2>
        <div className="space-y-3">
          {eventRows.map((row) => (
            <article key={row.event.id} className="rounded-2xl border border-[#e8e1da] bg-white p-4 shadow-sm">
              <p className="text-xs font-bold text-[#79716b]">{formatDate(row.event.event_date)}</p>
              <h3 className="mt-1 font-bold">{row.event.title}</h3>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-xl bg-[#fff7f3] p-2">
                  <p className="text-xs text-[#8f3d22]">売上</p>
                  <p className="font-bold text-[#d9643a]">{formatYen(row.revenue)}</p>
                </div>
                <div className="rounded-xl bg-[#f5f8fb] p-2">
                  <p className="text-xs text-[#243447]">経費</p>
                  <p className="font-bold">{formatYen(row.expense)}</p>
                </div>
                <div className="rounded-xl bg-[#f3fbf4] p-2">
                  <p className="text-xs text-[#4f8a61]">利益</p>
                  <p className="font-bold text-[#4f8a61]">{formatYen(row.profit)}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-bold">最近の活動</h2>
        <ActivityTimeline logs={logs.slice(0, 8)} />
      </section>
    </AppShell>
  );
}

export default function DeskPage() {
  return (
    <AuthGate>
      <DeskContent />
    </AuthGate>
  );
}
