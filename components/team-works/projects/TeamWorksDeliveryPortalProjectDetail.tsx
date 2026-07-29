"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, ListChecks } from "lucide-react";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeSection } from "@/components/mikkeos/MikkeSection";
import { supabase } from "@/lib/supabase/client";
import {
  deliveryTaskStatusLabels,
  loadDeliveryProjectDetail,
  resolveMyDeliveryProjectMembership,
  type DeliveryProjectDetail,
  type DeliveryProjectMember,
  type DeliveryTask
} from "@/lib/team-works-delivery";
import { fetchTaskForms, type DeliveryProjectForm } from "@/lib/team-works-delivery-forms";
import { buildDeliveryCalendarItems, TeamWorksDeliveryCalendar } from "./TeamWorksDeliveryCalendar";
import { TeamWorksDeliveryClientDeliverablePanel } from "./TeamWorksDeliveryClientDeliverablePanel";
import { TeamWorksDeliveryFormSubmissionPanel } from "./TeamWorksDeliveryFormSubmissionPanel";
import { TeamWorksDeliveryMyActionsPanel } from "./TeamWorksDeliveryMyActionsPanel";
import { TeamWorksDeliveryWorkerDeliverablePanel } from "./TeamWorksDeliveryWorkerDeliverablePanel";

// ワーカー・クライアント共通の閲覧用ビュー。タスクの作成・状態変更は本部のみの
// 権限(RLS)のため、ここでは期日・状態の確認と、自分が対応すべき提出物
// (フォーム記入・成果物提出・成果物承認)に絞っている。
export function TeamWorksDeliveryPortalProjectDetail({ projectId }: { projectId: string }) {
  const [detail, setDetail] = useState<DeliveryProjectDetail | null | undefined>(undefined);
  const [myMembership, setMyMembership] = useState<DeliveryProjectMember | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [nextDetail, nextMembership] = await Promise.all([
        loadDeliveryProjectDetail(supabase, projectId),
        resolveMyDeliveryProjectMembership(supabase, projectId)
      ]);
      setDetail(nextDetail);
      setMyMembership(nextMembership);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "プロジェクトを読み込めませんでした。");
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <MikkeEmptyState title="読み込みに失敗しました" helper={error} />;
  if (detail === undefined) return <p className="text-sm font-semibold text-[var(--mikke-muted)]">読み込んでいます…</p>;
  if (detail === null) return <MikkeEmptyState title="このプロジェクトは表示できません" helper="担当から外れたか、閲覧できるプロジェクトではありません。" />;

  const { project, tasks } = detail;
  const calendarItems = buildDeliveryCalendarItems(tasks);
  const selectedDayTasks = selectedDay ? tasks.filter((task) => task.dueOn === selectedDay || task.submitDueOn === selectedDay) : [];

  return (
    <div className="space-y-6">
      <section className="border-b border-[var(--mikke-line)] pb-5">
        <h2 className="text-2xl font-bold tracking-normal">{project.title}</h2>
        <p className="mt-1 text-xs font-bold text-[var(--mikke-muted)]">タスク {tasks.length}件</p>
      </section>

      {myMembership ? <TeamWorksDeliveryMyActionsPanel detail={detail} myMembership={myMembership} /> : null}

      <MikkeSection title="Schedule" tone="editorial">
        <p className="-mt-2 mb-3 text-xs font-semibold text-[var(--mikke-muted)]">期日を一目で確認できます。日付をクリックするとその日のタスクを表示します。</p>
        <TeamWorksDeliveryCalendar items={calendarItems} onSelectDay={setSelectedDay} />
        {selectedDay ? (
          <div className="mt-3 rounded-xl border border-[var(--mikke-line)] bg-white p-3">
            <p className="text-xs font-extrabold">{selectedDay} のタスク</p>
            {selectedDayTasks.length === 0 ? (
              <p className="mt-2 text-xs font-semibold text-[var(--mikke-muted)]">この日のタスクはありません。</p>
            ) : (
              <div className="mt-2 space-y-1.5">
                {selectedDayTasks.map((task) => (
                  <p key={task.id} className="text-xs font-semibold">
                    {task.title}・{deliveryTaskStatusLabels[task.status]}
                    {task.submitDueOn === selectedDay ? "・提出期日" : ""}
                    {task.dueOn === selectedDay ? "・完了期日" : ""}
                  </p>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </MikkeSection>

      <MikkeSection title="Tasks" tone="editorial">
        {tasks.length === 0 ? (
          <MikkeEmptyState title="タスクはまだありません" />
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <PortalTaskCard key={task.id} projectId={project.id} task={task} myMembership={myMembership} />
            ))}
          </div>
        )}
      </MikkeSection>
    </div>
  );
}

function PortalTaskCard({ projectId, task, myMembership }: { projectId: string; task: DeliveryTask; myMembership: DeliveryProjectMember | null }) {
  const [forms, setForms] = useState<DeliveryProjectForm[] | undefined>(undefined);

  useEffect(() => {
    if (task.submissionType !== "form") return;
    let cancelled = false;
    fetchTaskForms(supabase, task.id)
      .then((rows) => { if (!cancelled) setForms(rows); })
      .catch(() => { if (!cancelled) setForms([]); });
    return () => { cancelled = true; };
  }, [task.id, task.submissionType]);

  const isAssignedWorker = myMembership?.projectRole === "worker" && task.assigneeMemberId === myMembership.organizationMemberId;
  const isClient = myMembership?.projectRole === "client";

  return (
    <div id={`task-${task.id}`} className="scroll-mt-24 overflow-hidden rounded-2xl border border-[var(--mikke-line)] bg-white">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <ListChecks size={16} className="shrink-0 text-[var(--mikke-muted)]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{task.title}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--mikke-muted)]">
            {task.dueOn ? <span className="inline-flex items-center gap-1"><CalendarDays size={12} />{task.dueOn}</span> : "期日未設定"}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-[var(--mikke-line)] px-2.5 py-1 text-[11px] font-bold text-[var(--mikke-muted)]">
          {deliveryTaskStatusLabels[task.status]}
        </span>
      </div>

      {task.submissionType === "form" && myMembership && forms && forms.length > 0 ? (
        <div className="space-y-3 border-t border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-3">
          {forms.map((form) => (
            <TeamWorksDeliveryFormSubmissionPanel key={form.id} projectId={projectId} form={form} memberId={myMembership.organizationMemberId} />
          ))}
        </div>
      ) : null}

      {(task.submissionType === "file" || task.submissionType === "url") && isAssignedWorker && myMembership ? (
        <div className="border-t border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-3">
          <TeamWorksDeliveryWorkerDeliverablePanel projectId={projectId} task={task} memberId={myMembership.organizationMemberId} />
        </div>
      ) : null}

      {(task.submissionType === "file" || task.submissionType === "url") && isClient && myMembership ? (
        <div className="border-t border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-3">
          <TeamWorksDeliveryClientDeliverablePanel projectId={projectId} task={task} memberId={myMembership.organizationMemberId} />
        </div>
      ) : null}
    </div>
  );
}
