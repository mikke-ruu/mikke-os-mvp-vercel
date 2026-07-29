"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { CalendarDays, ChevronDown, ChevronUp, ClipboardList, ListChecks, Plus, UsersRound } from "lucide-react";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeListRow } from "@/components/mikkeos/MikkeListRow";
import { MikkeSection } from "@/components/mikkeos/MikkeSection";
import { supabase } from "@/lib/supabase/client";
import {
  createDeliveryTask,
  deliveryTaskOwnerRoleLabels,
  deliveryTaskStatusLabels,
  deliveryTaskSubmissionTypeLabels,
  loadDeliveryProjectDetail,
  updateDeliveryTask,
  type DeliveryProjectDetail,
  type DeliveryTask,
  type DeliveryTaskOwnerRole,
  type DeliveryTaskStatus,
  type DeliveryTaskSubmissionType
} from "@/lib/team-works-delivery";
import {
  archiveTaskForm,
  createTaskForm,
  fetchTaskForms,
  updateTaskForm,
  type DeliveryFormInputActor,
  type DeliveryProjectForm
} from "@/lib/team-works-delivery-forms";
import { TeamWorksDeliveryCalendar } from "./TeamWorksDeliveryCalendar";
import { TeamWorksProjectFormBuilder, type DeliveryFormPatch } from "./TeamWorksProjectFormBuilder";
import { TeamWorksProjectField, teamWorksProjectInputClass } from "./TeamWorksProjectsShell";

const taskStatuses = Object.keys(deliveryTaskStatusLabels) as DeliveryTaskStatus[];
const ownerRoles = Object.keys(deliveryTaskOwnerRoleLabels) as DeliveryTaskOwnerRole[];
const submissionTypes = Object.keys(deliveryTaskSubmissionTypeLabels) as DeliveryTaskSubmissionType[];

// Supabase接続版の納品型プロジェクト詳細。フォーム・成果物・請求は
// まだこちらに移行しておらず(旧localStorage版のままの機能)。
// 工程には「誰が作業し・何を提出し・誰が確認するか」というバトンの
// 受け渡しを持たせている(Phase 1)。
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

type NewTaskForm = {
  title: string;
  dueOn: string;
  submitDueOn: string;
  assigneeMemberId: string;
  assigneeLabel: string;
  clientVisible: boolean;
  ownerRole: DeliveryTaskOwnerRole | "";
  submissionType: DeliveryTaskSubmissionType;
  needsInternalReview: boolean;
  needsClientReview: boolean;
};

const emptyNewTaskForm: NewTaskForm = {
  title: "",
  dueOn: "",
  submitDueOn: "",
  assigneeMemberId: "",
  assigneeLabel: "",
  clientVisible: false,
  ownerRole: "",
  submissionType: "none",
  needsInternalReview: false,
  needsClientReview: false
};

function TaskListSection({ detail, onReload }: { detail: DeliveryProjectDetail; onReload: () => Promise<void> }) {
  const [form, setForm] = useState<NewTaskForm>(emptyNewTaskForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    setError("");
    try {
      await createDeliveryTask(supabase, {
        projectId: detail.project.id,
        title: form.title.trim(),
        assigneeMemberId: form.assigneeMemberId || null,
        assigneeLabel: form.assigneeMemberId ? null : form.assigneeLabel.trim() || null,
        dueOn: form.dueOn || null,
        submitDueOn: form.submitDueOn || null,
        clientVisible: form.clientVisible,
        ownerRole: form.ownerRole || null,
        submissionType: form.submissionType,
        needsInternalReview: form.needsInternalReview,
        needsClientReview: form.needsClientReview
      });
      setForm(emptyNewTaskForm);
      await onReload();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "タスクを追加できませんでした。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <MikkeSection title="Tasks" tone="editorial">
      <form onSubmit={submit} className="space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <TeamWorksProjectField label="工程名" required className="md:col-span-2">
            <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="例：テキスト・ディプロマ作成" className={teamWorksProjectInputClass} required />
          </TeamWorksProjectField>
          <TeamWorksProjectField label="誰が作業するか">
            <select value={form.ownerRole} onChange={(event) => setForm({ ...form, ownerRole: event.target.value as DeliveryTaskOwnerRole | "" })} className={teamWorksProjectInputClass}>
              <option value="">未設定</option>
              {ownerRoles.map((role) => <option key={role} value={role}>{deliveryTaskOwnerRoleLabels[role]}</option>)}
            </select>
          </TeamWorksProjectField>
          <TeamWorksProjectField label="担当メンバー" helper="名簿にまだいない場合は下の「仮の担当名」を使ってください。">
            <select value={form.assigneeMemberId} onChange={(event) => setForm({ ...form, assigneeMemberId: event.target.value })} className={teamWorksProjectInputClass}>
              <option value="">未割当</option>
              {detail.members.map((member) => <option key={member.organizationMemberId} value={member.organizationMemberId}>{member.displayName}</option>)}
            </select>
          </TeamWorksProjectField>
          {!form.assigneeMemberId ? (
            <TeamWorksProjectField label="仮の担当名(任意)" helper="例：ネオン、カメラマン(未定)">
              <input value={form.assigneeLabel} onChange={(event) => setForm({ ...form, assigneeLabel: event.target.value })} className={teamWorksProjectInputClass} />
            </TeamWorksProjectField>
          ) : null}
          <TeamWorksProjectField label="提出期日" helper="担当者がこの日までに提出する">
            <input type="date" value={form.submitDueOn} onChange={(event) => setForm({ ...form, submitDueOn: event.target.value })} className={teamWorksProjectInputClass} />
          </TeamWorksProjectField>
          <TeamWorksProjectField label="完了期日" helper="この工程自体が完了する日">
            <input type="date" value={form.dueOn} onChange={(event) => setForm({ ...form, dueOn: event.target.value })} className={teamWorksProjectInputClass} />
          </TeamWorksProjectField>
          <TeamWorksProjectField label="何を提出するか">
            <select value={form.submissionType} onChange={(event) => setForm({ ...form, submissionType: event.target.value as DeliveryTaskSubmissionType })} className={teamWorksProjectInputClass}>
              {submissionTypes.map((type) => <option key={type} value={type}>{deliveryTaskSubmissionTypeLabels[type]}</option>)}
            </select>
          </TeamWorksProjectField>
        </div>
        <div className="flex flex-wrap gap-4 text-xs font-bold">
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.needsInternalReview} onChange={(event) => setForm({ ...form, needsInternalReview: event.target.checked })} />本部の確認が必要</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.needsClientReview} onChange={(event) => setForm({ ...form, needsClientReview: event.target.checked })} />クライアントの確認が必要</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.clientVisible} onChange={(event) => setForm({ ...form, clientVisible: event.target.checked })} />クライアントに表示する</label>
        </div>
        <button type="submit" disabled={saving || !form.title.trim()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--tw-action)] px-4 py-2.5 text-xs font-bold text-[var(--tw-on-solid)] disabled:bg-[var(--mikke-line)] disabled:text-[var(--mikke-muted)]">
          <Plus size={15} /> 工程を追加
        </button>
      </form>

      {error ? <p role="alert" className="mt-3 rounded-xl border border-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-action)]">{error}</p> : null}

      <div className="mt-4">
        {detail.tasks.length === 0 ? (
          <MikkeEmptyState title="タスクはまだありません" helper="上のフォームから追加してください。" />
        ) : (
          <div className="divide-y divide-[var(--mikke-line)] overflow-hidden rounded-2xl border border-[var(--mikke-line)] bg-white">
            {detail.tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                members={detail.members}
                expanded={expandedTaskId === task.id}
                onToggle={() => setExpandedTaskId((current) => (current === task.id ? null : task.id))}
                onReload={onReload}
              />
            ))}
          </div>
        )}
      </div>
    </MikkeSection>
  );
}

function TaskRow({
  task,
  members,
  expanded,
  onToggle,
  onReload
}: {
  task: DeliveryTask;
  members: DeliveryProjectDetail["members"];
  expanded: boolean;
  onToggle: () => void;
  onReload: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const assignee = members.find((member) => member.organizationMemberId === task.assigneeMemberId);

  async function apply(patch: Parameters<typeof updateDeliveryTask>[2]) {
    setBusy(true);
    setError("");
    try {
      await updateDeliveryTask(supabase, task.id, patch);
      await onReload();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "更新できませんでした。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <ListChecks size={16} className="shrink-0 text-[var(--mikke-muted)]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{task.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-semibold text-[var(--mikke-muted)]">
            {task.submitDueOn ? <span className="inline-flex items-center gap-1"><CalendarDays size={12} />提出{task.submitDueOn}</span> : null}
            {task.dueOn ? <span className="inline-flex items-center gap-1"><CalendarDays size={12} />完了{task.dueOn}</span> : null}
            {!task.submitDueOn && !task.dueOn ? <span>期日未設定</span> : null}
            <span>{assignee ? assignee.displayName : task.assigneeLabel || "未割当"}</span>
            {task.ownerRole ? <span className="rounded-full border border-[var(--mikke-line)] px-1.5 py-0.5">{deliveryTaskOwnerRoleLabels[task.ownerRole]}</span> : null}
            {task.submissionType !== "none" ? <span className="rounded-full border border-[var(--mikke-line)] px-1.5 py-0.5">{deliveryTaskSubmissionTypeLabels[task.submissionType]}</span> : null}
            {task.clientVisible ? <span>・クライアント公開</span> : null}
          </p>
        </div>
        <select
          value={task.status}
          disabled={busy}
          onChange={(event) => void apply({ status: event.target.value as DeliveryTaskStatus })}
          className="shrink-0 rounded-lg border border-[var(--mikke-line)] px-2 py-1.5 text-xs font-bold"
        >
          {taskStatuses.map((status) => <option key={status} value={status}>{deliveryTaskStatusLabels[status]}</option>)}
        </select>
        <button type="button" onClick={onToggle} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[var(--mikke-line)] text-[var(--mikke-muted)]">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {error ? <p role="alert" className="mt-2 rounded-lg border border-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-action)]">{error}</p> : null}

      {expanded ? (
        <div className="mt-3 grid gap-3 rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-3 md:grid-cols-2">
          <TeamWorksProjectField label="誰が作業するか">
            <select defaultValue={task.ownerRole ?? ""} disabled={busy} onChange={(event) => void apply({ ownerRole: (event.target.value || null) as DeliveryTaskOwnerRole | null })} className={teamWorksProjectInputClass}>
              <option value="">未設定</option>
              {ownerRoles.map((role) => <option key={role} value={role}>{deliveryTaskOwnerRoleLabels[role]}</option>)}
            </select>
          </TeamWorksProjectField>
          <TeamWorksProjectField label="担当メンバー">
            <select defaultValue={task.assigneeMemberId ?? ""} disabled={busy} onChange={(event) => void apply({ assigneeMemberId: event.target.value || null })} className={teamWorksProjectInputClass}>
              <option value="">未割当</option>
              {members.map((member) => <option key={member.organizationMemberId} value={member.organizationMemberId}>{member.displayName}</option>)}
            </select>
          </TeamWorksProjectField>
          {!task.assigneeMemberId ? (
            <TeamWorksProjectField label="仮の担当名">
              <input defaultValue={task.assigneeLabel ?? ""} disabled={busy} onBlur={(event) => void apply({ assigneeLabel: event.target.value || null })} className={teamWorksProjectInputClass} />
            </TeamWorksProjectField>
          ) : null}
          <TeamWorksProjectField label="提出期日">
            <input type="date" defaultValue={task.submitDueOn ?? ""} disabled={busy} onChange={(event) => void apply({ submitDueOn: event.target.value || null })} className={teamWorksProjectInputClass} />
          </TeamWorksProjectField>
          <TeamWorksProjectField label="完了期日">
            <input type="date" defaultValue={task.dueOn ?? ""} disabled={busy} onChange={(event) => void apply({ dueOn: event.target.value || null })} className={teamWorksProjectInputClass} />
          </TeamWorksProjectField>
          <TeamWorksProjectField label="何を提出するか">
            <select defaultValue={task.submissionType} disabled={busy} onChange={(event) => void apply({ submissionType: event.target.value as DeliveryTaskSubmissionType })} className={teamWorksProjectInputClass}>
              {submissionTypes.map((type) => <option key={type} value={type}>{deliveryTaskSubmissionTypeLabels[type]}</option>)}
            </select>
          </TeamWorksProjectField>
          <div className="flex flex-wrap items-center gap-4 text-xs font-bold md:col-span-2">
            <label className="flex items-center gap-2"><input type="checkbox" defaultChecked={task.needsInternalReview} disabled={busy} onChange={(event) => void apply({ needsInternalReview: event.target.checked })} />本部の確認が必要</label>
            <label className="flex items-center gap-2"><input type="checkbox" defaultChecked={task.needsClientReview} disabled={busy} onChange={(event) => void apply({ needsClientReview: event.target.checked })} />クライアントの確認が必要</label>
            <label className="flex items-center gap-2"><input type="checkbox" defaultChecked={task.clientVisible} disabled={busy} onChange={(event) => void apply({ clientVisible: event.target.checked })} />クライアントに表示する</label>
          </div>
          {task.submissionType === "form" ? (
            <div className="md:col-span-2">
              <TaskFormsPanel task={task} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function TaskFormsPanel({ task }: { task: DeliveryTask }) {
  const [forms, setForms] = useState<DeliveryProjectForm[] | undefined>(undefined);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      setForms(await fetchTaskForms(supabase, task.id));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "フォームを読み込めませんでした。");
    }
  }, [task.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addForm() {
    setCreating(true);
    setError("");
    try {
      const defaultActor: DeliveryFormInputActor = task.ownerRole === "client" ? "client" : task.ownerRole === "admin" ? "admin" : "worker";
      await createTaskForm(supabase, { projectId: task.projectId, taskId: task.id, name: task.title, inputActor: defaultActor });
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "フォームを作成できませんでした。");
    } finally {
      setCreating(false);
    }
  }

  async function applyPatch(formId: string, patch: DeliveryFormPatch) {
    await updateTaskForm(supabase, formId, patch);
    await load();
  }

  async function remove(formId: string) {
    await archiveTaskForm(supabase, formId);
    await load();
  }

  return (
    <div className="rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-3">
      <p className="flex items-center gap-2 text-xs font-extrabold">
        <ClipboardList size={14} /> この工程のフォーム
      </p>
      {error ? <p role="alert" className="mt-2 rounded-lg border border-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-action)]">{error}</p> : null}
      {forms === undefined ? (
        <p className="mt-2 text-xs font-semibold text-[var(--mikke-muted)]">読み込んでいます…</p>
      ) : (
        <div className="mt-2 space-y-2">
          {forms.map((form) => (
            <TeamWorksProjectFormBuilder
              key={form.id}
              form={form}
              onUpdate={(patch) => applyPatch(form.id, patch)}
              onArchive={() => remove(form.id)}
            />
          ))}
        </div>
      )}
      <button type="button" onClick={() => void addForm()} disabled={creating} className="mt-2 inline-flex items-center gap-1 rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-xs font-bold">
        <Plus size={14} /> フォームを追加
      </button>
    </div>
  );
}
