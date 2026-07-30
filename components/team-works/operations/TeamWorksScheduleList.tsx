"use client";

import { CalendarDays, ChevronRight, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { supabase } from "@/lib/supabase/client";
import { loadOperationsScheduleGroups, type OperationsScheduleGroup } from "@/lib/team-works-operations";
import { loadDeliveryHomeSummary, type DeliveryHomeSummary } from "@/lib/team-works-delivery-home";

export function TeamWorksScheduleList() {
  const [groups, setGroups] = useState<OperationsScheduleGroup[] | null>(null);
  const [hasOperationsProjects, setHasOperationsProjects] = useState(true);
  const [deliveryHome, setDeliveryHome] = useState<DeliveryHomeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [result, deliverySummary] = await Promise.all([
        loadOperationsScheduleGroups(supabase),
        loadDeliveryHomeSummary(supabase)
      ]);
      setGroups(result.groups);
      setHasOperationsProjects(result.hasOperationsProjects);
      setDeliveryHome(deliverySummary);
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

      {deliveryHome && deliveryHome.upcoming.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-[var(--mikke-line)] bg-white">
          <p className="border-b border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] px-3 py-2 text-xs font-extrabold text-[var(--tw-title)]">納品型の期日</p>
          <div className="divide-y divide-[var(--mikke-line)]">
            {deliveryHome.upcoming.map((item, index) => (
              <Link
                key={`${item.taskId}-${item.kind}-${index}`}
                href={`/apps/team-works/projects/${item.projectId}?tab=schedule`}
                className="flex min-h-[64px] items-center gap-3 px-2.5 py-2 transition hover:bg-[var(--mikke-surface-soft)] sm:px-3"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--tw-planned)] text-[var(--tw-on-tint)]">
                  <CalendarDays size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold sm:truncate">{item.date} <span className="ml-1">{item.taskTitle}</span></span>
                  <span className="mt-0.5 block text-[11px] font-semibold text-[var(--mikke-muted)] sm:text-xs">
                    {item.projectTitle}・{item.kind === "submit" ? "提出期日" : item.kind === "due" ? "完了期日" : "提出・完了期日"}
                  </span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-[var(--mikke-muted-light)]" />
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {loading && !groups ? (
        <p className="text-sm text-[var(--mikke-muted)]">読み込んでいます…</p>
      ) : error ? (
        <MikkeEmptyState title="読み込みに失敗しました" helper={error} />
      ) : !hasOperationsProjects ? (
        deliveryHome && deliveryHome.upcoming.length > 0 ? null : (
          <MikkeEmptyState
            title="運営型プロジェクトがまだありません"
            helper="契約期間で回るプロジェクトを作成すると、ここに時系列でスケジュールが表示されます。"
          />
        )
      ) : !groups || groups.length === 0 ? (
        <MikkeEmptyState title="今後の予定はまだありません" helper="各プロジェクトのスケジュールから予定を追加してください。" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--mikke-line)] bg-white">
          {groups.map((group) => (
            <div key={group.dateKey} className="grid grid-cols-[88px_minmax(0,1fr)] border-b border-[var(--mikke-line)] last:border-b-0">
              <div className="m-2 grid h-14 place-items-center self-start rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] px-1 text-center text-[11px] font-extrabold whitespace-nowrap text-[var(--mikke-primary)]">
                {group.label}
              </div>
              <div className="divide-y divide-[var(--mikke-line)]">
                {group.events.map((event) => (
                  <Link
                    key={event.id}
                    href={`/apps/team-works/projects/${event.projectId}?tab=schedule`}
                    className="flex min-h-[72px] items-center gap-3 px-2.5 py-2 transition hover:bg-[var(--mikke-surface-soft)] sm:px-3"
                  >
                    <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ background: event.bg }} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold sm:truncate">
                        {event.startTime}〜{addMinutes(event.startTime, event.durationMin)} <span className="ml-1">{event.projectTitle}</span>
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-semibold text-[var(--mikke-muted)] sm:text-xs">
                        {event.partnerName ? <span>担当 {event.partnerName}</span> : <span className="text-[var(--mikke-accent)]">担当未定</span>}
                        {event.participantCount > 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <Users size={12} /> {event.participantCount}名
                          </span>
                        ) : null}
                        {event.zoomMeetingId ? <span>Zoom ID {event.zoomMeetingId}</span> : null}
                      </span>
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-[var(--mikke-muted-light)]" />
                  </Link>
                ))}
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
