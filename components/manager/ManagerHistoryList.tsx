"use client";

import Link from "next/link";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import { useUnifiedActivityLogs } from "@/lib/mikkeos/activity-client-store";
import { mikkeApps } from "@/lib/mikkeos/apps";
import { ManagerShell } from "./ManagerShell";

const appNameByKey = new Map(mikkeApps.map((app) => [app.key, app.name]));

export function ManagerHistoryList() {
  const { logs } = useUnifiedActivityLogs();
  const recentLogs = logs.slice(0, 30);

  return (
    <ManagerShell title="最近の動き" subtitle="各アプリで起きたことを、見返しやすい履歴として確認します。">
      <section className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4 shadow-sm">
        {recentLogs.length === 0 ? (
          <MikkeEmptyState title="最近の動きはまだありません" helper="各アプリの登録や更新がここに並びます。" />
        ) : (
          <div className="grid gap-2">
            {recentLogs.map((log) => (
              <Link
                key={log.id}
                href={log.metadata?.publicPath ?? "/manager/history"}
                className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-[var(--mikke-text)]">{log.title}</span>
                  <span className="mt-1 block truncate text-xs font-semibold text-[var(--mikke-muted)]">
                    {new Date(log.occurredAt).toLocaleDateString("ja-JP")} / {log.description ?? "更新"}
                  </span>
                </span>
                <MikkeStatusBadge tone="primary" className="shrink-0 px-2 py-1 text-[10px]">
                  {appNameByKey.get(log.appKey) ?? log.appKey}
                </MikkeStatusBadge>
              </Link>
            ))}
          </div>
        )}
      </section>
    </ManagerShell>
  );
}
