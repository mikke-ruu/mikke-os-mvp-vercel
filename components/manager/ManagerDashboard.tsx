"use client";

import { useAuth } from "@/components/AuthGate";
import { collectManagerAppSuggestions } from "@/lib/manager/app-suggestions";
import { useManagerSnapshot } from "@/lib/manager/collect-manager-items";
import { ManagerAppSuggestions } from "./ManagerAppSuggestions";
import { ManagerMetricCard, ManagerProgressList, ManagerScheduleList, ManagerTaskListRows } from "./ManagerCards";
import { ManagerShell } from "./ManagerShell";

export function ManagerDashboard() {
  const { profile } = useAuth();
  const snapshot = useManagerSnapshot(profile.id);
  const todayItems = snapshot.schedules.filter((item) => item.urgency === "today" || item.urgency === "overdue");
  const urgentTasks = snapshot.tasks.filter((task) => task.urgency === "today" || task.urgency === "overdue" || task.priority === "high");
  const suggestions = collectManagerAppSuggestions(snapshot);

  return (
    <ManagerShell title="今日のManager" subtitle="入口は各アプリ。Managerでは、次に見ることと他アプリの動きを横断で参照します。">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <ManagerMetricCard label="今日まで" value={`${todayItems.length}件`} helper="期限超過と今日の予定" />
        <ManagerMetricCard label="タスク" value={`${snapshot.tasks.length}件`} helper="未完了の対応" />
        <ManagerMetricCard label="進行中" value={`${snapshot.progress.length}件`} helper="各アプリの進み具合" />
        <ManagerMetricCard label="個人予定" value={`${snapshot.personalEvents.length}件`} helper="Manager内だけに保存" />
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[1.1fr_1fr]">
        <Panel title="今日見るもの" helper="期限が近い予定と個人予定です。">
          <ManagerScheduleList items={todayItems.slice(0, 6)} emptyTitle="今日見る予定はありません" />
        </Panel>
        <Panel title="優先タスク" helper="新規申込や期限が近い対応です。">
          <ManagerTaskListRows tasks={urgentTasks.slice(0, 6)} emptyTitle="急ぎのタスクはありません" />
        </Panel>
      </section>

      <section className="mt-6">
        <Panel title="進行中のもの" helper="イベントやFundなどの進捗をまとめます。">
          <ManagerProgressList progress={snapshot.progress.slice(0, 5)} />
        </Panel>
      </section>

      <section className="mt-6">
        <Panel title="次に使えそうなアプリ" helper="今の動きに合わせて、押しつけずに候補だけ出します。">
          <ManagerAppSuggestions suggestions={suggestions} />
        </Panel>
      </section>
    </ManagerShell>
  );
}

function Panel({ title, helper, children }: { title: string; helper: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="text-lg font-bold tracking-normal">{title}</h2>
        <p className="mt-1 text-sm text-[var(--mikke-muted)]">{helper}</p>
      </div>
      {children}
    </section>
  );
}
