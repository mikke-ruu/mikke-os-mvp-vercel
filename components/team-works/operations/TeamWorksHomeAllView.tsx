"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Clock, FileCheck2 } from "lucide-react";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeSection } from "@/components/mikkeos/MikkeSection";
import { supabase } from "@/lib/supabase/client";
import { fetchDeliveryProjects, loadDeliveryCalendarTasks } from "@/lib/team-works-delivery";
import {
  buildDeliveryCalendarItems,
  itemTone,
  type DeliveryCalendarItem
} from "@/components/team-works/projects/TeamWorksDeliveryCalendar";
import { loadDeliveryHomeSummary, type DeliveryHomeSummary, type DeliveryHomeUpcoming } from "@/lib/team-works-delivery-home";
import { formatDateKey, type OperationsCalendarEvent, type OperationsDashboardData } from "@/lib/team-works-operations";
import { TeamWorksMonthCalendar, type CalendarExtraItem } from "./TeamWorksMonthCalendar";
import { fallbackDotColors } from "./TeamWorksCalendarProjectLinks";
import { FinanceCard, MessagesCard } from "./TeamWorksHomeCards";
import { TEAM_WORKS_POLL_INTERVAL_MS } from "@/lib/team-works-constants";

function chipText(item: DeliveryCalendarItem): string {
  const prefix = item.kind === "submit" ? "提出" : item.kind === "due" ? "完了" : "提出・完了";
  return `${prefix} ${item.title}`;
}

function kindLabel(kind: "submit" | "due" | "both"): string {
  return kind === "submit" ? "提出期日" : kind === "due" ? "完了期日" : "提出・完了期日";
}

function formatShortDate(dateKey: string, todayKey: string): string {
  if (dateKey === todayKey) return "本日";
  const date = new Date(`${dateKey}T00:00:00`);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

type MergedUpcoming =
  | { kind: "ops"; sortKey: string; event: OperationsCalendarEvent }
  | { kind: "delivery"; sortKey: string; item: DeliveryHomeUpcoming };

// 「すべて」タブ専用のホームビュー。あゆみ指摘(2026-07-30)「混合のスケジュールを
// 一目で見たいだけ」に応え、運営ダッシュボードの全セクションを足すのではなく、
// カレンダー・FINANCE/MESSAGES・TODAY・NEEDS ATTENTIONだけに絞った軽い画面にする。
// 希望シフトパネルはここには置かない(「運営」タブのみ)。
// 納品側の重いデータ(loadDeliveryHomeSummaryはプロジェクト数×4-5クエリ)は、
// このタブが実際に開かれたときだけ自分で読みに行く(TeamWorksDeliveryDashboardと同じ設計)。
export function TeamWorksHomeAllView({
  opsData,
  monthDate,
  onMonthChange,
  onSelectDay
}: {
  opsData: OperationsDashboardData;
  monthDate: Date;
  onMonthChange: (nextMonth: Date) => void;
  onSelectDay: (dateKey: string) => void;
}) {
  const [calendarItems, setCalendarItems] = useState<DeliveryCalendarItem[]>([]);
  const [projectColorById, setProjectColorById] = useState<Map<string, string>>(new Map());
  const [summary, setSummary] = useState<DeliveryHomeSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [projects, tasks, homeSummary] = await Promise.all([
        fetchDeliveryProjects(supabase),
        loadDeliveryCalendarTasks(supabase),
        loadDeliveryHomeSummary(supabase)
      ]);
      setProjectColorById(new Map(projects.map((project, index) => [project.id, fallbackDotColors[index % fallbackDotColors.length]])));
      setCalendarItems(buildDeliveryCalendarItems(tasks));
      setSummary(homeSummary);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "納品型データの読み込みに失敗しました。");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void load();
    }, TEAM_WORKS_POLL_INTERVAL_MS);
    return () => window.clearInterval(timerId);
  }, [load]);

  if (error) {
    return <MikkeEmptyState title="読み込みに失敗しました" helper={error} />;
  }

  const extraItems: CalendarExtraItem[] = calendarItems.map((item) => {
    const tone = itemTone(item);
    return {
      dateKey: item.date,
      text: chipText(item),
      bg: tone.bg,
      fg: tone.text,
      dotColor: projectColorById.get(item.projectId),
      projectId: item.projectId,
      projectTitle: item.projectTitle
    };
  });

  const extraLegend = summary && summary.projectCount > 0
    ? [
        { label: "提出期日", color: "var(--tw-deadline)" },
        { label: "完了期日", color: "var(--tw-title)" },
        { label: "期限超過", color: "var(--tw-action)" },
        { label: "完了", color: "var(--tw-done)" },
        ...[...projectColorById.entries()].map(([id, color]) => {
          const title = calendarItems.find((item) => item.projectId === id)?.projectTitle;
          return title ? { label: title, color, dot: true } : null;
        }).filter((entry): entry is { label: string; color: string; dot: boolean } => entry !== null)
      ]
    : undefined;

  const todayKey = formatDateKey(new Date());
  const merged: MergedUpcoming[] = [
    ...opsData.upcomingEvents.map((event) => ({ kind: "ops" as const, sortKey: `${event.sessionDate} ${event.startTime}`, event })),
    ...(summary?.upcoming ?? []).map((item) => ({ kind: "delivery" as const, sortKey: `${item.date} 99:99`, item }))
  ]
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .slice(0, 8);

  const hasDelivery = Boolean(summary && summary.projectCount > 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.7fr_1fr]">
        <TeamWorksMonthCalendar
          monthDate={monthDate}
          onMonthChange={onMonthChange}
          events={opsData.monthEvents}
          holidayDates={opsData.monthHolidayDates}
          projects={opsData.projects}
          onSelectDay={onSelectDay}
          operationSettings={opsData.operationSettings}
          extraItems={extraItems}
          extraLegend={extraLegend}
        />

        <div className="flex flex-col gap-4">
          <FinanceCard />
          <MessagesCard comments={opsData.recentComments} />
        </div>
      </div>

      <MikkeSection title="Today" tone="editorial">
        <p className="mb-2 -mt-2 text-xs font-semibold text-[var(--mikke-muted)]">本日のスケジュール（本部）</p>
        {opsData.todayEvents.length === 0 ? (
          <MikkeEmptyState title="本日の予定はありません" />
        ) : (
          <div className="divide-y divide-[var(--mikke-line)] rounded-xl border border-[var(--mikke-line)] bg-white">
            {opsData.todayEvents.map((event) => (
              <div key={event.id} className="flex items-center gap-3 px-3 py-3">
                <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: event.bg }} />
                <span className="w-12 shrink-0 text-sm font-bold">{event.startTime}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">
                    {event.projectTitle}
                    {event.participantCount > 0 ? ` · 参加${event.participantCount}名` : ""}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 text-xs font-semibold text-[var(--mikke-muted)]">
                    {event.partnerName ? <span>担当 {event.partnerName}</span> : <span className="text-[var(--mikke-accent)]">担当未定</span>}
                    <span className="inline-flex items-center gap-1">
                      <Clock size={12} /> {event.durationMin}分
                    </span>
                  </span>
                </span>
                <Link
                  href={`/apps/team-works/projects/${event.projectId}?tab=schedule`}
                  className="shrink-0 rounded-full border border-[var(--mikke-line)] px-3 py-1.5 text-xs font-bold text-[var(--mikke-primary)]"
                >
                  スケジュール
                </Link>
              </div>
            ))}
          </div>
        )}
      </MikkeSection>

      <MikkeSection title="Needs attention" tone="editorial">
        <p className="mb-2 -mt-2 text-xs font-semibold text-[var(--mikke-muted)]">
          緊急・期日が近い・大事なこと{hasDelivery ? "（運営・納品の両方）" : ""}
        </p>

        {opsData.needsAttentionUnassigned.length === 0 ? (
          <MikkeEmptyState title="対応が必要なことはありません" helper="今後7日間、担当未定のコマはありません。" />
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {opsData.needsAttentionUnassigned.map((event) => (
              <Link
                key={event.id}
                href={`/apps/team-works/projects/${event.projectId}?tab=schedule`}
                className="rounded-xl border border-l-4 border-[var(--mikke-line)] p-3 text-left"
                style={{ borderLeftColor: "var(--mikke-orange)" }}
              >
                <span className="float-right text-lg font-extrabold text-[var(--mikke-orange)]">!</span>
                <span className="block text-sm font-bold text-[var(--mikke-orange)]">シフト未決定</span>
                <span className="mt-1 block text-xs leading-5 text-[var(--mikke-muted)]">
                  {formatShortDate(event.sessionDate, todayKey)} {event.startTime} {event.projectTitle}、担当未定。
                </span>
              </Link>
            ))}
          </div>
        )}

        {hasDelivery && summary ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[var(--mikke-line)] bg-white p-3">
              <p className="text-[11px] font-bold text-[var(--mikke-muted)]">クライアント待ち</p>
              <p className="text-lg font-extrabold text-[var(--tw-deadline)]">{summary.clientWaitingCount}件</p>
            </div>
            <div className="rounded-xl border border-[var(--mikke-line)] bg-white p-3">
              <p className="text-[11px] font-bold text-[var(--mikke-muted)]">本部確認待ち</p>
              <p className="text-lg font-extrabold text-[var(--tw-title)]">{summary.staffReviewCount}件</p>
            </div>
            <div className="rounded-xl border border-[var(--mikke-line)] bg-white p-3">
              <p className="text-[11px] font-bold text-[var(--mikke-muted)]">期限超過</p>
              <p className="text-lg font-extrabold text-[var(--tw-action)]">{summary.overdueCount}件</p>
            </div>
          </div>
        ) : null}

        {hasDelivery && summary && summary.items.length > 0 ? (
          <div className="mt-3 space-y-1.5">
            {summary.items.map((item, index) => (
              <Link
                key={`${item.projectId}-${item.taskId}-${item.urgency}-${index}`}
                href={`/apps/team-works/projects/${item.projectId}?tab=tasks`}
                className="flex items-center gap-2 rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-xs font-semibold hover:border-[var(--tw-done)]"
              >
                <FileCheck2 size={13} className="shrink-0 text-[var(--mikke-muted)]" />
                <span className="min-w-0 flex-1 truncate">{item.detail}</span>
                <span className="shrink-0 text-[var(--mikke-muted)]">{item.projectTitle}</span>
              </Link>
            ))}
          </div>
        ) : null}

        <div className="mt-4 border-t border-[var(--mikke-line)] pt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-extrabold text-[var(--mikke-primary)]">今後の予定（{merged.length}件）</p>
            <Link href="/apps/team-works/schedule" className="text-xs font-bold text-[var(--mikke-primary)]">すべて見る</Link>
          </div>
          {merged.length === 0 ? (
            <p className="text-xs font-semibold text-[var(--mikke-muted)]">今後の予定はありません。</p>
          ) : (
            <div className="grid gap-2">
              {merged.map((entry, index) =>
                entry.kind === "ops" ? (
                  <Link
                    key={`ops-${entry.event.id}`}
                    href={`/apps/team-works/projects/${entry.event.projectId}?tab=schedule`}
                    className="grid gap-2 rounded-xl border border-[var(--mikke-line)] bg-white p-3 transition hover:border-[var(--tw-done)] sm:grid-cols-[90px_1fr_auto] sm:items-center"
                  >
                    <span className="rounded-lg bg-[var(--tw-planned)] px-2 py-2 text-center text-xs font-extrabold text-[var(--tw-on-tint)]">
                      {formatShortDate(entry.event.sessionDate, todayKey)} {entry.event.startTime}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{entry.event.projectTitle}</span>
                      <span className="block text-[11px] font-semibold text-[var(--mikke-muted)]">
                        運営型・{entry.event.partnerName ? `担当 ${entry.event.partnerName}` : "担当未定"}
                      </span>
                    </span>
                    <span className="text-xs font-bold text-[var(--mikke-primary)]">開く</span>
                  </Link>
                ) : (
                  <Link
                    key={`delivery-${entry.item.taskId}-${index}`}
                    href={`/apps/team-works/projects/${entry.item.projectId}?tab=tasks`}
                    className="grid gap-2 rounded-xl border border-[var(--mikke-line)] bg-white p-3 transition hover:border-[var(--tw-done)] sm:grid-cols-[90px_1fr_auto] sm:items-center"
                  >
                    <span className="rounded-lg bg-[var(--tw-planned)] px-2 py-2 text-center text-xs font-extrabold text-[var(--tw-on-tint)]">
                      {formatShortDate(entry.item.date, todayKey)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{entry.item.taskTitle}</span>
                      <span className="block text-[11px] font-semibold text-[var(--mikke-muted)]">
                        納品型・{entry.item.projectTitle}・{kindLabel(entry.item.kind)}
                      </span>
                    </span>
                    <span className="text-xs font-bold text-[var(--mikke-primary)]">開く</span>
                  </Link>
                )
              )}
            </div>
          )}
        </div>
      </MikkeSection>
    </div>
  );
}
