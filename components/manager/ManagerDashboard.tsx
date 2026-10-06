"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { useOwnedMikkeApps } from "@/components/mikkeos/useOwnedMikkeApps";
import { useManagerSnapshot } from "@/lib/manager/collect-manager-items";
import { ManagerMetricCard, ManagerProgressList, ManagerScheduleList, ManagerTaskListRows } from "./ManagerCards";
import { ManagerShell } from "./ManagerShell";

export function ManagerDashboard() {
  const { profile, isGuest } = useAuth();
  const ownedAppState = useOwnedMikkeApps({ userId: profile.user_id, isGuest });
  const snapshot = useManagerSnapshot(profile.id, profile.user_id);
  const todaySchedules = snapshot.schedules.filter((item) => item.urgency === "today" && item.source.appKey !== "manager");
  const urgentTasks = snapshot.tasks.filter((task) => task.urgency === "today" || task.urgency === "overdue" || task.priority === "high");
  const hasMarketNote = "ownedAppKeys" in ownedAppState && Array.isArray(ownedAppState.ownedAppKeys)
    ? ownedAppState.ownedAppKeys.includes("marketnote")
    : ownedAppState.ownedApps.some((app) => app.title === "MarketNote");
  const displayName = profile.display_name?.trim() || profile.handle || "あなた";
  const [welcome, setWelcome] = useState(() => ({
    greeting: `こんにちは、${displayName}さん`,
    message: "今日もManagerを開いてくださって、ありがとうございます。",
    note: "今日の大切なことから、ひとつずつで大丈夫です。",
    href: "#manager-today-schedule",
    actionLabel: "今日を見る"
  }));

  useEffect(() => {
    setWelcome(createManagerWelcome({
      displayName,
      todayScheduleCount: todaySchedules.length,
      todayScheduleTitle: todaySchedules[0]?.title,
      urgentTaskCount: urgentTasks.length,
      urgentTaskTitle: urgentTasks[0]?.title,
      progressCount: snapshot.progress.length,
      progressTitle: snapshot.progress[0]?.title,
    }));
  }, [
    displayName,
    snapshot.progress.length,
    snapshot.progress[0]?.title,
    todaySchedules.length,
    todaySchedules[0]?.title,
    urgentTasks.length,
    urgentTasks[0]?.title
  ]);

  return (
    <ManagerShell title="今日のManager" subtitle="今日の予定、各アプリからのお知らせ、設定をまとめて確認します。">
      <section className="rounded-xl border border-[var(--mikke-line)] border-l-[4px] border-l-[var(--mikke-blue)] bg-white p-3 shadow-sm sm:rounded-2xl sm:p-4">
        <p className="text-[10px] font-bold tracking-[0.18em] text-[var(--mikke-orange)] sm:text-xs">今日のひとこと</p>
        <div className="mt-1.5 flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-end sm:gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[var(--mikke-text)] sm:text-lg">{welcome.greeting}</h2>
            <p className="mt-1 text-sm font-semibold leading-5 text-[var(--mikke-text)]">{welcome.message}</p>
            <p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">{welcome.note}</p>
          </div>
          <Link href={welcome.href} className="shrink-0 text-xs font-bold text-[var(--mikke-blue)] sm:pb-0.5">
            {welcome.actionLabel} →
          </Link>
        </div>
      </section>

      <section className="mt-3 grid grid-cols-3 gap-2 sm:mt-4 sm:gap-3">
        <ManagerMetricCard label="今日の予定" value={`${todaySchedules.length}件`} helper="各アプリから集まる予定" tone="yellow" href="#manager-today-schedule" />
        <ManagerMetricCard label="対応すること" value={`${snapshot.tasks.length}件`} helper="確認や対応が必要なもの" tone="orange" href="/manager/notifications#manager-tasks" />
        <ManagerMetricCard label="進行中" value={`${snapshot.progress.length}件`} helper="各アプリの進み具合" tone="green" href="/manager/notifications#manager-progress" />
      </section>

      <section className="mt-4 grid gap-4 sm:mt-6 xl:grid-cols-[1.1fr_1fr]">
        <Panel
          id="manager-today-schedule"
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
          helper="各アプリで進んでいるものをまとめます。"
          action={<Link href="/manager/notifications" className="shrink-0 text-xs font-bold text-[var(--mikke-primary)]">すべて見る</Link>}
        >
          <ManagerProgressList progress={snapshot.progress.slice(0, 3)} />
        </Panel>
      </section>

    </ManagerShell>
  );
}

function Panel({
  id,
  title,
  helper,
  action,
  children
}: {
  id?: string;
  title: string;
  helper: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-3 shadow-sm sm:rounded-2xl sm:p-4">
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

function createManagerWelcome({
  displayName,
  todayScheduleCount,
  todayScheduleTitle,
  urgentTaskCount,
  urgentTaskTitle,
  progressCount,
  progressTitle
}: {
  displayName: string;
  todayScheduleCount: number;
  todayScheduleTitle?: string;
  urgentTaskCount: number;
  urgentTaskTitle?: string;
  progressCount: number;
  progressTitle?: string;
}) {
  const now = new Date();
  const hourPart = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "numeric",
    hour12: false
  }).formatToParts(now).find((part) => part.type === "hour")?.value;
  const hour = Number(hourPart ?? 12) % 24;
  const greeting = hour < 11
    ? `おはようございます、${displayName}さん`
    : hour < 18
      ? `こんにちは、${displayName}さん`
      : `こんばんは、${displayName}さん`;
  const dailyNotes = [
    "急がず、今日の大切なことから進めましょう。",
    "ひとつ済んだら、少し休むことも忘れずに。",
    "できたことも、Managerでそっと振り返れます。",
    "全部を一度に片づけなくても大丈夫です。",
    "今日も、よい一日になりますように。"
  ];
  const dayPart = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    day: "numeric"
  }).formatToParts(now).find((part) => part.type === "day")?.value;
  const day = Number(dayPart ?? 1);
  const note = dailyNotes[(day - 1) % dailyNotes.length];

  if (todayScheduleTitle) {
    return {
      greeting,
      message: todayScheduleCount > 1
        ? `今日は「${todayScheduleTitle}」など、${todayScheduleCount}件の予定があります。`
        : `今日は「${todayScheduleTitle}」の予定があります。`,
      note,
      href: "#manager-today-schedule",
      actionLabel: "予定を見る"
    };
  }
  if (urgentTaskTitle) {
    return {
      greeting,
      message: `まずは「${urgentTaskTitle}」を確認して、ひとつ済ませましょう。`,
      note: urgentTaskCount > 1 ? `ほかにも${urgentTaskCount - 1}件あります。${note}` : note,
      href: "/manager/notifications#manager-tasks",
      actionLabel: "確認する"
    };
  }
  if (progressTitle) {
    return {
      greeting,
      message: `「${progressTitle}」が進行中です。続きは少しずつで大丈夫です。`,
      note: progressCount > 1 ? `ほかの${progressCount - 1}件も、いつでもここから確認できます。` : note,
      href: "/manager/notifications#manager-progress",
      actionLabel: "進み具合を見る"
    };
  }
  return {
    greeting,
    message: "今日は少し余白がありそうです。Managerは必要なときに、いつでもここにいます。",
    note,
    href: "/manager/history",
    actionLabel: "最近の動きを見る"
  };
}
