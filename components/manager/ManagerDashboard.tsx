"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthGate";
import { useOwnedMikkeApps } from "@/components/mikkeos/useOwnedMikkeApps";
import { collectManagerAppSuggestions } from "@/lib/manager/app-suggestions";
import { useManagerSnapshot } from "@/lib/manager/collect-manager-items";
import { ManagerAppSuggestions } from "./ManagerAppSuggestions";
import { ManagerMetricCard, ManagerProgressList, ManagerScheduleList, ManagerTaskListRows } from "./ManagerCards";
import { ManagerShell } from "./ManagerShell";

export function ManagerDashboard() {
  const { profile, isGuest } = useAuth();
  const ownedAppState = useOwnedMikkeApps({ userId: profile.user_id, isGuest });
  const snapshot = useManagerSnapshot(profile.id, profile.user_id);
  const todaySchedules = snapshot.schedules.filter((item) => item.urgency === "today" && item.source.appKey !== "manager");
  const urgentTasks = snapshot.tasks.filter((task) => task.urgency === "today" || task.urgency === "overdue" || task.priority === "high");
  const suggestions = collectManagerAppSuggestions(snapshot);
  const hasMarketNote = "ownedAppKeys" in ownedAppState && Array.isArray(ownedAppState.ownedAppKeys)
    ? ownedAppState.ownedAppKeys.includes("marketnote")
    : ownedAppState.ownedApps.some((app) => app.title === "MarketNote");

  return (
    <ManagerShell title="今日のManager" subtitle="今日の予定、各アプリからのお知らせ、設定をまとめて確認します。">
      <section className="grid grid-cols-3 gap-2 sm:gap-3">
        <ManagerMetricCard label="今日の予定" value={`${todaySchedules.length}件`} helper="各アプリから集まる予定" tone="yellow" />
        <ManagerMetricCard label="対応すること" value={`${snapshot.tasks.length}件`} helper="確認や対応が必要なもの" tone="orange" />
        <ManagerMetricCard label="進行中" value={`${snapshot.progress.length}件`} helper="各アプリの進み具合" tone="green" />
      </section>

      <section className="mt-4 grid gap-4 sm:mt-6 xl:grid-cols-[1.1fr_1fr]">
        <Panel
          title="今日の予定"
          helper="詳しい予定や別の日のカレンダーはMarketNoteで確認できます。"
          action={(
            <Link
              href="/marketnote?from=manager"
              className="shrink-0 rounded-full border border-[var(--mikke-line)] bg-white px-3 py-2 text-xs font-bold text-[var(--mikke-primary)]"
            >
              {hasMarketNote ? "カレンダーで見る" : "MarketNoteを使ってみる"}
            </Link>
          )}
        >
          <ManagerScheduleList items={todaySchedules.slice(0, 6)} emptyTitle="今日の予定はありません" />
        </Panel>
        <Panel
          title="お知らせ"
          helper="各アプリで、いま対応が必要なものです。"
          action={(
            <Link
              href="/manager/notifications"
              className="shrink-0 rounded-full border border-[var(--mikke-line)] bg-white px-3 py-2 text-xs font-bold text-[var(--mikke-primary)]"
            >
              すべて見る
            </Link>
          )}
        >
          <ManagerTaskListRows tasks={urgentTasks.slice(0, 3)} emptyTitle="新しいお知らせはありません" />
        </Panel>
      </section>

      <section className="mt-4 sm:mt-6">
        <Panel
          title="進行中のもの"
          helper="イベントやFundなどの進捗をまとめます。"
          action={<Link href="/manager/notifications" className="shrink-0 text-xs font-bold text-[var(--mikke-primary)]">すべて見る</Link>}
        >
          <ManagerProgressList progress={snapshot.progress.slice(0, 3)} />
        </Panel>
      </section>

      <section className="mt-4 sm:mt-6">
        <Panel title="次に使えそうなアプリ" helper="今の動きに合わせて、押しつけずに候補だけ出します。">
          <ManagerAppSuggestions suggestions={suggestions} />
        </Panel>
      </section>
    </ManagerShell>
  );
}

function Panel({
  title,
  helper,
  action,
  children
}: {
  title: string;
  helper: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-3 shadow-sm sm:rounded-2xl sm:p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold tracking-normal sm:text-lg">{title}</h2>
          <p className="mt-0.5 text-xs leading-5 text-[var(--mikke-muted)] sm:mt-1 sm:text-sm">{helper}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
