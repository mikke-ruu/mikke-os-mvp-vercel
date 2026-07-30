"use client";

import { CalendarDays, ChevronRight, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { supabase } from "@/lib/supabase/client";
import { formatDateKey, loadOperationsScheduleGroups, type OperationsScheduleGroup } from "@/lib/team-works-operations";
import { loadDeliveryCalendarTasks } from "@/lib/team-works-delivery";
import { buildDeliveryCalendarItems, itemTone } from "@/components/team-works/projects/TeamWorksDeliveryCalendar";
import { mergeScheduleTimeline, type ScheduleTimelineGroup } from "@/lib/team-works-schedule-timeline";

const SCHEDULE_WINDOW_DAYS = 60;

function kindLabel(kind: "submit" | "due" | "both"): string {
  return kind === "submit" ? "提出期日" : kind === "due" ? "完了期日" : "提出・完了期日";
}

// 運営型のコマと納品型の期日を、日付グループの中で1本の時系列にまとめる
// (あゆみ指摘 2026-07-30「納品型の期日ブロックが上にドンと乗っていて別物感がある」)。
// 各行に「運営型/納品型」の種別バッジを付けて見分けられるようにする。
export function TeamWorksScheduleList() {
  const [timeline, setTimeline] = useState<ScheduleTimelineGroup[] | null>(null);
  const [hasAnyProject, setHasAnyProject] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fromDate = new Date();
      const toKey = formatDateKey(new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate() + SCHEDULE_WINDOW_DAYS - 1));
      const fromKey = formatDateKey(fromDate);

      const [opsResult, deliveryTasks] = await Promise.all([
        loadOperationsScheduleGroups(supabase, { fromDate, days: SCHEDULE_WINDOW_DAYS }),
        loadDeliveryCalendarTasks(supabase)
      ]);

      const deliveryItems = buildDeliveryCalendarItems(deliveryTasks).filter(
        (item) => item.date >= fromKey && item.date <= toKey
      );

      setTimeline(mergeScheduleTimeline(opsResult.groups, deliveryItems));
      setHasAnyProject(opsResult.hasOperationsProjects || deliveryItems.length > 0 || deliveryTasks.length > 0);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "スケジュールの読み込みに失敗しました。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <p className="max-w-xl text-xs leading-6 text-[var(--mikke-muted)]">
        全プロジェクトの予定を日付順にまとめています。予定を押すと、そのプロジェクトのスケジュール編集へ移動します。
      </p>

      {loading && !timeline ? (
        <p className="text-sm text-[var(--mikke-muted)]">読み込んでいます…</p>
      ) : error ? (
        <MikkeEmptyState title="読み込みに失敗しました" helper={error} />
      ) : !hasAnyProject ? (
        <MikkeEmptyState
          title="プロジェクトがまだありません"
          helper="運営型または納品型のプロジェクトを作成すると、ここに時系列でスケジュールが表示されます。"
        />
      ) : !timeline || timeline.length === 0 ? (
        <MikkeEmptyState title="今後の予定はまだありません" helper="各プロジェクトのスケジュールから予定・期日を追加してください。" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--mikke-line)] bg-white">
          {timeline.map((group) => (
            <div key={group.dateKey} className="grid grid-cols-[88px_minmax(0,1fr)] border-b border-[var(--mikke-line)] last:border-b-0">
              <div className="m-2 grid h-14 place-items-center self-start rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] px-1 text-center text-[11px] font-extrabold whitespace-nowrap text-[var(--mikke-primary)]">
                {group.label}
              </div>
              <div className="divide-y divide-[var(--mikke-line)]">
                {group.entries.map((entry) =>
                  entry.kind === "ops" ? (
                    <Link
                      key={`ops-${entry.event.id}`}
                      href={`/apps/team-works/projects/${entry.event.projectId}?tab=schedule`}
                      className="flex min-h-[72px] items-center gap-3 px-2.5 py-2 transition hover:bg-[var(--mikke-surface-soft)] sm:px-3"
                    >
                      <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ background: entry.event.bg }} />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2">
                          <span className="rounded-full bg-[var(--mikke-primary-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--tw-title)]">運営型</span>
                          <span className="text-sm font-bold sm:truncate">
                            {entry.event.startTime}〜{addMinutes(entry.event.startTime, entry.event.durationMin)} {entry.event.projectTitle}
                          </span>
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-semibold text-[var(--mikke-muted)] sm:text-xs">
                          {entry.event.partnerName ? <span>担当 {entry.event.partnerName}</span> : <span className="text-[var(--mikke-accent)]">担当未定</span>}
                          {entry.event.participantCount > 0 ? (
                            <span className="inline-flex items-center gap-1">
                              <Users size={12} /> {entry.event.participantCount}名
                            </span>
                          ) : null}
                          {entry.event.zoomMeetingId ? <span>Zoom ID {entry.event.zoomMeetingId}</span> : null}
                        </span>
                      </span>
                      <ChevronRight size={16} className="shrink-0 text-[var(--mikke-muted-light)]" />
                    </Link>
                  ) : (
                    <Link
                      key={`delivery-${entry.item.id}-${entry.item.kind}`}
                      href={`/apps/team-works/projects/${entry.item.projectId}?tab=tasks`}
                      className="flex min-h-[72px] items-center gap-3 px-2.5 py-2 transition hover:bg-[var(--mikke-surface-soft)] sm:px-3"
                    >
                      <span
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
                        style={{ background: itemTone(entry.item).bg, color: itemTone(entry.item).text }}
                      >
                        <CalendarDays size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2">
                          <span className="rounded-full bg-[var(--tw-planned)] px-2 py-0.5 text-[10px] font-bold text-[var(--tw-on-tint)]">納品型</span>
                          <span className="text-sm font-bold sm:truncate">{entry.item.title}</span>
                        </span>
                        <span className="mt-0.5 block text-[11px] font-semibold text-[var(--mikke-muted)] sm:text-xs">
                          {entry.item.projectTitle}・{kindLabel(entry.item.kind)}
                        </span>
                      </span>
                      <ChevronRight size={16} className="shrink-0 text-[var(--mikke-muted-light)]" />
                    </Link>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function addMinutes(startTime: string, durationMin: number): string {
  const [hours, minutes] = startTime.split(":").map(Number);
  const total = hours * 60 + minutes + durationMin;
  const endHours = Math.floor(total / 60) % 24;
  const endMinutes = total % 60;
  return `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;
}
