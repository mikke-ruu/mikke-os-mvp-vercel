"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { CalendarDays, ListChecks, Plus, UsersRound } from "lucide-react";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeListRow } from "@/components/mikkeos/MikkeListRow";
import { MikkeSection } from "@/components/mikkeos/MikkeSection";
import { supabase } from "@/lib/supabase/client";
import {
  createDeliveryTask,
  deliveryTaskStatusLabels,
  loadDeliveryProjectDetail,
  updateDeliveryTask,
  type DeliveryProjectDetail,
  type DeliveryTaskStatus
} from "@/lib/team-works-delivery";
import { TeamWorksDeliveryCalendar } from "./TeamWorksDeliveryCalendar";
import { TeamWorksProjectField, teamWorksProjectInputClass } from "./TeamWorksProjectsShell";

const taskStatuses = Object.keys(deliveryTaskStatusLabels) as DeliveryTaskStatus[];

// Supabase接続版の納品型プロジェクト詳細。工程・フォーム・成果物・請求は
// まだこちらに移行しておらず(旧localStorage版のままの機能)、ここでは
// プロジェクト作成直後から実際に使える「タスクと期日のカレンダー」に絞っている。
export function TeamWorksDeliveryProjectDetail({ projectId }: { projectId: string }) {
  const [detail, setDetail] = useState<DeliveryProjectDetail | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setDetail(await loadDeliveryProjectDetail(supabase, projectId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "プロジェクトを読み込めませんでした。");
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <MikkeEmptyState title="読み込みに失敗しました" helper={error} />;
  if (detail === undefined) return <p className="text-sm font-semibold text-[var(--mikke-muted)]">読み込んでいます…</p>;
  if (detail === null) return <MikkeEmptyState title="このプロジェクトは見つかりませんでした" />;

  const { project, tasks, members } = detail;
  const calendarItems = tasks
    .filter((task) => task.dueOn)
    .map((task) => ({ id: task.id, title: task.title, status: task.status, dueOn: task.dueOn as string }));
  const selectedDayTasks = selectedDay ? tasks.filter((task) => task.dueOn === selectedDay) : [];

  return (
    <div className="space-y-6">
      <section className="border-b border-[var(--mikke-line)] pb-5">
        <h2 className="text-2xl font-bold tracking-normal">{project.title}</h2>
        <p className="mt-1 text-xs font-bold text-[var(--mikke-muted)]">参加メンバー {members.length}名 ・ タスク {tasks.length}件</p>
      </section>

      <MikkeSection title="Schedule" tone="editorial">
        <p className="-mt-2 mb-3 text-xs font-semibold text-[var(--mikke-muted)]">タスクの期日を一目で確認します。日付をクリックするとその日のタスクを表示します。</p>
        <TeamWorksDeliveryCalendar items={calendarItems} onSelectDay={setSelectedDay} />
        {selectedDay ? (
          <div className="mt-3 rounded-xl border border-[var(--mikke-line)] bg-white p-3">
            <p className="text-xs font-extrabold">{selectedDay} のタスク</p>
            {selectedDayTasks.length === 0 ? (
              <p className="mt-2 text-xs font-semibold text-[var(--mikke-muted)]">この日のタスクはありません。</p>
            ) : (
              <div className="mt-2 space-y-1.5">
                {selectedDayTasks.map((task) => (
                  <p key={task.id} className="text-xs font-semibold">{task.title}・{deliveryTaskStatusLabels[task.status]}</p>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </MikkeSection>

      <TaskListSection detail={detail} onReload={load} />

      <MikkeSection title="Members" tone="editorial">
        {members.length === 0 ? (
          <MikkeEmptyState title="参加メンバーはまだいません" />
        ) : (
          <div className="space-y-2">
            {members.map((member) => (
              <MikkeListRow key={member.organizationMemberId} title={member.displayName} label={projectRoleLabel(member.projectRole)} icon={UsersRound} />
            ))}
          </div>
        )}
      </MikkeSection>
    </div>
  );
}

function projectRoleLabel(role: "owner" | "manager" | "client" | "worker"): string {
  if (role === "owner") return "オーナー";
  if (role === "manager") return "マネージャー";
  if (role === "client") return "クライアント";
  return "担当メンバー";
}

function TaskListSection({ detail, onReload }: { detail: DeliveryProjectDetail; onReload: () => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [assigneeMemberId, setAssigneeMemberId] = useState("");
  const [clientVisible, setClientVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError("");
    try {
      await createDeliveryTask(supabase, {
        projectId: detail.project.id,
        title: title.trim(),
        assigneeMemberId: assigneeMemberId || null,
        dueOn: dueOn || null,
        clientVisible
      });
      setTitle("");
      setDueOn("");
      setClientVisible(false);
      await onReload();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "タスクを追加できませんでした。");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(taskId: string, status: DeliveryTaskStatus) {
    setBusyTaskId(taskId);
    setError("");
    try {
      await updateDeliveryTask(supabase, taskId, { status });
      await onReload();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "状態を更新できませんでした。");
    } finally {
      setBusyTaskId(null);
    }
  }

  return (
    <MikkeSection title="Tasks" tone="editorial">
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-[1.5fr_150px_1fr_auto] md:items-end">
        <TeamWorksProjectField label="タスク名" required>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例：第9章 教材ドラフト" className={teamWorksProjectInputClass} required />
        </TeamWorksProjectField>
        <TeamWorksProjectField label="期日">
          <input type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} className={teamWorksProjectInputClass} />
        </TeamWorksProjectField>
        <TeamWorksProjectField label="担当">
          <select value={assigneeMemberId} onChange={(event) => setAssigneeMemberId(event.target.value)} className={teamWorksProjectInputClass}>
            <option value="">未割当</option>
            {detail.members.map((member) => <option key={member.organizationMemberId} value={member.organizationMemberId}>{member.displayName}</option>)}
          </select>
        </TeamWorksProjectField>
        <button type="submit" disabled={saving || !title.trim()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--tw-action)] px-3 py-2.5 text-xs font-bold text-[var(--tw-on-solid)] disabled:bg-[var(--mikke-line)] disabled:text-[var(--mikke-muted)]">
          <Plus size={15} /> 追加
        </button>
      </form>
      <label className="mt-2 flex items-center gap-2 text-xs font-bold">
        <input type="checkbox" checked={clientVisible} onChange={(event) => setClientVisible(event.target.checked)} />
        クライアントに表示する
      </label>

      {error ? <p role="alert" className="mt-3 rounded-xl border border-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-action)]">{error}</p> : null}

      <div className="mt-4">
        {detail.tasks.length === 0 ? (
          <MikkeEmptyState title="タスクはまだありません" helper="上のフォームから追加してください。" />
        ) : (
          <div className="divide-y divide-[var(--mikke-line)] overflow-hidden rounded-2xl border border-[var(--mikke-line)] bg-white">
            {detail.tasks.map((task) => {
              const assignee = detail.members.find((member) => member.organizationMemberId === task.assigneeMemberId);
              return (
                <div key={task.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <ListChecks size={16} className="shrink-0 text-[var(--mikke-muted)]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{task.title}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--mikke-muted)]">
                      {task.dueOn ? <span className="inline-flex items-center gap-1"><CalendarDays size={12} />{task.dueOn}</span> : "期日未設定"}
                      {assignee ? ` ・ ${assignee.displayName}` : ""}
                      {task.clientVisible ? " ・ クライアント公開" : ""}
                    </p>
                  </div>
                  <select
                    value={task.status}
                    disabled={busyTaskId === task.id}
                    onChange={(event) => void changeStatus(task.id, event.target.value as DeliveryTaskStatus)}
                    className="shrink-0 rounded-lg border border-[var(--mikke-line)] px-2 py-1.5 text-xs font-bold"
                  >
                    {taskStatuses.map((status) => <option key={status} value={status}>{deliveryTaskStatusLabels[status]}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MikkeSection>
  );
}
