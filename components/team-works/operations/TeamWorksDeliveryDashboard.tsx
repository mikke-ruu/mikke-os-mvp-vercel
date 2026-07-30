"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, FileCheck2 } from "lucide-react";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeSection } from "@/components/mikkeos/MikkeSection";
import { supabase } from "@/lib/supabase/client";
import { fetchDeliveryProjects, loadDeliveryCalendarTasks, type DeliveryProjectSummary } from "@/lib/team-works-delivery";
import { buildDeliveryCalendarItems, TeamWorksDeliveryCalendar, type DeliveryCalendarItem } from "@/components/team-works/projects/TeamWorksDeliveryCalendar";
import { loadDeliveryHomeSummary, loadDeliveryRecentComments, type DeliveryHomeSummary } from "@/lib/team-works-delivery-home";
import type { RecentOperationsComment } from "@/lib/team-works-operations";
import { TeamWorksCalendarProjectLinks } from "./TeamWorksCalendarProjectLinks";
import { FinanceCard, MessagesCard } from "./TeamWorksHomeCards";
import { TEAM_WORKS_POLL_INTERVAL_MS } from "@/lib/team-works-constants";

// 納品型プロジェクトだけのホーム。運営型のコマ管理とは仕事の形が違う(名簿・シフトの
// 概念が無い)ため、運営ホームとは別の画面として作る。カレンダーを冒頭に置き、
// 希望シフトのような運営型専用の要素は出さない(あゆみ指摘 2026-07-30)。
export function TeamWorksDeliveryDashboard() {
  const [projects, setProjects] = useState<DeliveryProjectSummary[]>([]);
  const [calendarItems, setCalendarItems] = useState<DeliveryCalendarItem[]>([]);
  const [comments, setComments] = useState<RecentOperationsComment[]>([]);
  const [summary, setSummary] = useState<DeliveryHomeSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [projectRows, tasks, homeSummary, recentComments] = await Promise.all([
        fetchDeliveryProjects(supabase),
        loadDeliveryCalendarTasks(supabase),
        loadDeliveryHomeSummary(supabase),
        loadDeliveryRecentComments(supabase)
      ]);
      setProjects(projectRows);
      setCalendarItems(buildDeliveryCalendarItems(tasks));
      setSummary(homeSummary);
      setComments(recentComments);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "納品ダッシュボードの読み込みに失敗しました。");
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

  if (summary === null) {
    return <p className="text-sm text-[var(--mikke-muted)]">読み込んでいます…</p>;
  }

  const projectLinks = projects.map((project) => ({ id: project.id, title: project.title }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.7fr_1fr]">
        <div className="flex flex-col gap-0">
          <TeamWorksDeliveryCalendar items={calendarItems} />
          <TeamWorksCalendarProjectLinks projects={projectLinks} />
        </div>

        <div className="flex flex-col gap-4">
          <FinanceCard />
          <MessagesCard comments={comments} />
        </div>
      </div>

      <MikkeSection title="Needs attention" tone="editorial">
        <p className="mb-2 -mt-2 text-xs font-semibold text-[var(--mikke-muted)]">緊急・期日が近い・大事なこと</p>

        <div className="grid gap-3 sm:grid-cols-3">
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

        {summary.items.length > 0 ? (
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
        ) : (
          <div className="mt-3">
            <MikkeEmptyState title="対応が必要なことはありません" helper="期限超過・本部確認待ち・クライアント待ちの工程はありません。" />
          </div>
        )}

        <div className="mt-4 border-t border-[var(--mikke-line)] pt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-extrabold text-[var(--mikke-primary)]">今後の期日（{summary.upcoming.length}件）</p>
            <Link href="/apps/team-works/schedule" className="text-xs font-bold text-[var(--mikke-primary)]">すべて見る</Link>
          </div>
          {summary.upcoming.length === 0 ? (
            <p className="text-xs font-semibold text-[var(--mikke-muted)]">今後の期日はありません。</p>
          ) : (
            <div className="grid gap-2">
              {summary.upcoming.map((item, index) => (
                <Link
                  key={`${item.taskId}-${item.kind}-${index}`}
                  href={`/apps/team-works/projects/${item.projectId}?tab=tasks`}
                  className="grid gap-2 rounded-xl border border-[var(--mikke-line)] bg-white p-3 transition hover:border-[var(--tw-done)] sm:grid-cols-[100px_1fr_auto] sm:items-center"
                >
                  <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--tw-planned)] px-2 py-2 text-center text-xs font-extrabold text-[var(--tw-on-tint)]">
                    <CalendarDays size={12} /> {item.date.slice(5)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{item.taskTitle}</span>
                    <span className="block text-[11px] font-semibold text-[var(--mikke-muted)]">
                      {item.projectTitle}・{item.kind === "submit" ? "提出期日" : item.kind === "due" ? "完了期日" : "提出・完了期日"}
                    </span>
                  </span>
                  <span className="text-xs font-bold text-[var(--mikke-primary)]">開く</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </MikkeSection>
    </div>
  );
}
