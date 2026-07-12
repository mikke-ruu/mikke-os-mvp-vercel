"use client";

import { useMemo, useState } from "react";
import { ActivityLogList } from "@/components/mikkeos/ActivityLogList";
import { MetricCard } from "@/components/mikkeos/MetricCard";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import { SupabaseLogReadTest } from "@/components/mikkeos/SupabaseLogReadTest";
import { mikkeApps } from "@/lib/mikkeos/apps";
import { useUnifiedActivityLogs } from "@/lib/mikkeos/activity-client-store";
import { filterLogs, getOsSummary } from "@/lib/mikkeos/selectors";
import type { AppKey } from "@/lib/mikkeos/types";

type LogFilter = "all" | AppKey | "income" | "expense" | "public" | "private";

const baseFilters: Array<{ key: LogFilter; label: string }> = [
  { key: "all", label: "すべて" },
  { key: "income", label: "売上" },
  { key: "expense", label: "経費" },
  { key: "public", label: "公開中" },
  { key: "private", label: "非公開" }
];

export default function LogPage() {
  const { logs } = useUnifiedActivityLogs();
  const summary = getOsSummary(logs);
  const [filter, setFilter] = useState<LogFilter>("all");
  const filteredLogs = useMemo(() => filterLogs(logs, filter), [filter, logs]);

  return (
    <MikkeAppShell
      appName="Activity Log"
      title="Activity Log"
      subtitle="各アプリから発生した活動の共通台帳です。"
      currentApp={{ label: "Apps", href: "/apps" }}
      footerLabel="Activity Log by mikke"
    >
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="全ログ" value={`${summary.allLogs}件`} helper="アプリ横断" />
        <MetricCard label="Story公開中" value={`${summary.storyLogs}件`} helper="公開ページに表示する活動" tone="green" />
        <MetricCard label="DESK集計" value={`${summary.deskLogs}件`} helper="数字として集計する記録" tone="navy" />
        <MetricCard label="接続アプリ" value={`${summary.activeApps}個`} helper="Activity Logにつながる入口" tone="gray" />
      </section>

      <section className="mt-6 rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4 shadow-sm">
        <h2 className="text-sm font-bold tracking-normal">フィルター</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {[...baseFilters, ...mikkeApps.map((app) => ({ key: app.key, label: app.name }))].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={`rounded-full border px-3 py-2 text-sm font-bold ${
                filter === item.key
                  ? "border-[var(--mikke-primary-border)] bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent)]"
                  : "border-[var(--mikke-line)] bg-[var(--mikke-surface)] text-[var(--mikke-text-soft)]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-3">
          <h2 className="text-lg font-bold tracking-normal">ログ一覧</h2>
          <p className="mt-1 text-sm text-[var(--mikke-muted)]">Storyに公開する活動と、DESKに集計する記録をログごとに確認できます。</p>
        </div>
        <ActivityLogList logs={filteredLogs} />
      </section>

      <SupabaseLogReadTest />
    </MikkeAppShell>
  );
}
