"use client";

import { FormEvent, useState } from "react";
import { ArrowLeft, CalendarDays, CheckCircle2, ExternalLink, FileCheck2, ListChecks, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeSection } from "@/components/mikkeos/MikkeSection";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import { TeamWorksProjectFormResponse } from "@/components/team-works/projects/TeamWorksProjectFormResponse";
import { useTeamWorksPortalActor } from "@/components/team-works/useTeamWorksPortalActor";
import { transitionProjectDeliverable } from "@/lib/team-works-project-deliverables";
import { saveProjectFormAnswers, transitionProjectFormSubmission } from "@/lib/team-works-project-forms";
import {
  createTeamWorksProjectId,
  projectDeliverableStatusLabels,
  projectPhaseStatusLabels,
  projectStatusLabels,
  projectTaskPriorityLabels,
  projectTaskStatusLabels,
  useTeamWorksProjectStore,
  type ProjectDeliverable,
  type ProjectFormAnswerValue
} from "@/lib/team-works-projects";
import {
  createTeamWorksWorkerProjectDetail,
  TEAM_WORKS_WORKER_PORTAL_DEMO_WORKER_ID,
  type WorkerProjectCommentView,
  type WorkerProjectDeliverableView,
  type WorkerProjectFormView,
  type WorkerProjectTaskView
} from "@/lib/team-works-worker-projects";
import { saveTeamWorksPortalFormSubmission, saveTeamWorksWorkerDeliverable } from "@/lib/team-works-portal-database";

export function TeamWorksWorkerProjectDetail({ projectId }: { projectId: string }) {
  const { hydrated, projectState, saveProjectState } = useTeamWorksProjectStore();
  const actor = useTeamWorksPortalActor("worker", { projectState, saveProjectState });
  const membership = actor.membershipBySourceProjectId.get(projectId);
  const actorMemberships = new Map(membership ? [[projectId, { memberId: membership.memberId, memberName: membership.memberName }]] : []);
  const detail = createTeamWorksWorkerProjectDetail(projectState, TEAM_WORKS_WORKER_PORTAL_DEMO_WORKER_ID, projectId, { memberships: actorMemberships });
  const [databaseError, setDatabaseError] = useState("");

  if (!hydrated || actor.status === "loading") return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">担当内容を読み込んでいます。</p>;
  if (actor.status === "error") return <MikkeEmptyState title="案件所属を確認できません" helper={actor.errorMessage} />;
  if (!detail) {
    return (
      <div className="space-y-4">
        <MikkeEmptyState title="このプロジェクトは表示できません" helper="担当から外れたか、閲覧できるプロジェクトではありません。" />
        <Link href="/apps/team-works/portal/worker/projects" className="mx-auto flex w-fit items-center gap-2 text-sm font-bold text-[var(--mikke-primary)]">
          <ArrowLeft size={16} /> 一覧へ戻る
        </Link>
      </div>
    );
  }

  const { project, memberId, phases, tasks, forms, deliverables, resources, comments } = detail;
  const actionTasks = tasks.filter((task) => !["approved", "completed"].includes(task.status));
  const actionForms = forms.filter((form) => !form.submission || ["draft", "revision_requested"].includes(form.submission.status));
  const deliverableTaskIds = new Set(deliverables.map((deliverable) => deliverable.taskId));
  const missingDeliverableTasks = tasks.filter((task) => task.requiresDeliverable && !deliverableTaskIds.has(task.id));

  async function saveForm(form: WorkerProjectFormView, answers: Record<string, ProjectFormAnswerValue>, submit: boolean) {
    if (!membership) return;
    const now = new Date().toISOString();
    const saved = saveProjectFormAnswers({ submission: form.submission, projectId: project.id, formId: form.id, actor: { kind: "worker", id: memberId }, answers, editableAfterSubmit: form.editableAfterSubmit, now, createId: createTeamWorksProjectId });
    const next = submit ? transitionProjectFormSubmission({ submission: saved, nextStatus: "submitted", actor: { kind: "worker", id: memberId }, now }) : saved;
    try {
      setDatabaseError("");
      await saveTeamWorksPortalFormSubmission({ membership, formSourceId: form.id, submissionSourceId: next.id, answers: next.answers, status: submit ? "submitted" : "draft" });
    } catch (error) {
      setDatabaseError(error instanceof Error ? error.message : "DBへ保存できませんでした。");
      return;
    }
    saveProjectState({
      ...projectState,
      projects: projectState.projects.map((item) => item.id === project.id ? { ...item, updatedAt: now } : item),
      formSubmissions: form.submission ? projectState.formSubmissions.map((item) => item.id === next.id ? next : item) : [...projectState.formSubmissions, next]
    });
  }

  async function submitDeliverable(input: { deliverable?: WorkerProjectDeliverableView; task?: WorkerProjectTaskView; url: string }) {
    if (!membership) return;
    const sourceTask = input.task ?? tasks.find((task) => task.id === input.deliverable?.taskId);
    if (!sourceTask) return;
    const existing = input.deliverable ? projectState.deliverables.find((item) => item.id === input.deliverable?.id) : null;
    const now = new Date().toISOString();
    const base: ProjectDeliverable = existing ?? {
      id: createTeamWorksProjectId("team_works_project_deliverable"),
      projectId: project.id,
      phaseId: sourceTask.phaseId,
      taskId: sourceTask.id,
      title: sourceTask.title,
      type: "url",
      url: "",
      version: 1,
      status: "draft",
      submittedByMemberId: memberId,
      reviewedByMemberId: "",
      clientVisible: false,
      createdAt: now,
      updatedAt: now
    };
    const ready = { ...base, url: input.url.trim(), submittedByMemberId: memberId, updatedAt: now };
    const next = transitionProjectDeliverable({ deliverable: ready, nextStatus: "submitted", actor: "worker", memberId, now });
    try {
      setDatabaseError("");
      await saveTeamWorksWorkerDeliverable({
        membership,
        taskSourceId: sourceTask.id,
        deliverableSourceId: next.id,
        title: next.title,
        type: next.type,
        url: next.url,
        version: next.version,
        status: "submitted",
        clientVisible: next.clientVisible
      });
    } catch (error) {
      setDatabaseError(error instanceof Error ? error.message : "DBへ成果物を保存できませんでした。");
      return;
    }
    saveProjectState({
      ...projectState,
      projects: projectState.projects.map((item) => item.id === project.id ? { ...item, updatedAt: now } : item),
      deliverables: existing
        ? projectState.deliverables.map((item) => item.id === next.id ? next : item)
        : [...projectState.deliverables, next]
    });
  }

  return (
    <div className="space-y-6">
      {databaseError ? <p role="alert" className="rounded-lg border border-[var(--mikke-danger)] bg-red-50 px-3 py-2 text-sm font-bold text-[var(--mikke-danger)]">{databaseError}</p> : null}
      <Link href="/apps/team-works/portal/worker/projects" className="inline-flex items-center gap-2 text-xs font-bold text-[var(--mikke-primary)]">
        <ArrowLeft size={15} /> 担当プロジェクト一覧
      </Link>
      <section className="border-b border-[var(--mikke-line)] pb-5">
        <MikkeStatusBadge tone={project.status === "completed" ? "success" : "primary"} className="px-2 py-1">{projectStatusLabels[project.status]}</MikkeStatusBadge>
        <h2 className="mt-3 text-2xl font-bold tracking-normal">{project.name}</h2>
        {project.description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--mikke-text-soft)]">{project.description}</p> : null}
      </section>
      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="全体進捗" value={`${project.progressPercent}%`} icon={CheckCircle2} />
        <SummaryCard label="自分の現在工程" value={project.currentPhaseName} icon={ListChecks} />
        <SummaryCard label="納期" value={formatDate(project.dueDate)} icon={CalendarDays} />
      </section>

      <MikkeSection title="今やること">
        {actionTasks.length + actionForms.length > 0 ? (
          <div className="space-y-2">
            {actionForms.map((form) => (
              <div key={form.id} className="rounded-lg border border-[var(--mikke-primary-border)] bg-[var(--mikke-accent-soft)] p-3">
                <p className="text-sm font-bold">{form.name}</p>
                <p className="mt-1 text-xs text-[var(--mikke-muted)]">{form.submission?.status === "revision_requested" ? "修正内容を確認して再提出してください" : "担当フォームを入力して提出してください"}</p>
              </div>
            ))}
            {actionTasks.map((task) => (
              <div key={task.id} className="rounded-lg border border-[var(--mikke-primary-border)] bg-[var(--mikke-accent-soft)] p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><p className="text-sm font-bold">{task.title}</p>{task.description ? <p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">{task.description}</p> : null}</div>
                  <span className="text-xs font-bold text-[var(--mikke-accent)]">{projectTaskStatusLabels[task.status]}</span>
                </div>
                <p className="mt-2 text-xs font-bold text-[var(--mikke-muted)]">期限 {formatDate(task.dueDate)}・優先度 {projectTaskPriorityLabels[task.priority]}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg bg-[var(--mikke-success-soft)] p-4 text-[var(--mikke-success)]">
            <CheckCircle2 size={20} /><p className="text-sm font-bold">現在、対応が必要な項目はありません。</p>
          </div>
        )}
      </MikkeSection>

      <MikkeSection title="自分の工程とタスク">
        {phases.length > 0 ? (
          <div className="space-y-4">
            {phases.map((phase) => {
              const phaseTasks = tasks.filter((task) => task.phaseId === phase.id);
              return (
                <article key={phase.id} className="rounded-xl border border-[var(--mikke-line)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><p className="text-xs font-bold text-[var(--mikke-muted)]">工程{phase.position + 1}{phase.ownedByWorker ? "・工程担当" : ""}</p><h3 className="mt-1 text-base font-bold">{phase.name}</h3></div>
                    <MikkeStatusBadge tone={phase.status === "completed" ? "success" : phase.status === "not_started" ? "muted" : "primary"} className="px-2 py-1">{projectPhaseStatusLabels[phase.status]}</MikkeStatusBadge>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--mikke-line-soft)]"><div className="h-full rounded-full bg-[var(--mikke-accent)]" style={{ width: `${phase.progressPercent}%` }} /></div>
                  {phaseTasks.length > 0 ? <div className="mt-4 divide-y divide-[var(--mikke-line)] border-t border-[var(--mikke-line)]">{phaseTasks.map((task) => <div key={task.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold">{task.title}</p>{task.description ? <p className="mt-1 text-xs text-[var(--mikke-muted)]">{task.description}</p> : null}</div><p className="shrink-0 text-xs font-bold text-[var(--mikke-muted)]">{formatDate(task.dueDate)}・{projectTaskStatusLabels[task.status]}</p></div>)}</div> : null}
                </article>
              );
            })}
          </div>
        ) : <MikkeEmptyState title="担当工程はありません" />}
      </MikkeSection>

      <MikkeSection title="担当フォーム">
        {forms.length > 0 ? <div className="space-y-3">{forms.map((form) => <TeamWorksProjectFormResponse key={form.id} form={form} onSave={(answers) => saveForm(form, answers, false)} onSubmit={(answers) => saveForm(form, answers, true)} />)}</div> : <p className="text-sm text-[var(--mikke-muted)]">担当フォームはありません。</p>}
      </MikkeSection>

      <div className="grid gap-6 lg:grid-cols-2">
        <MikkeSection title="担当成果物">
          {deliverables.length + missingDeliverableTasks.length > 0 ? (
            <div className="space-y-2">
              {deliverables.map((item) => <WorkerDeliverableCard key={item.id} item={item} onSubmit={(url) => submitDeliverable({ deliverable: item, url })} />)}
              {missingDeliverableTasks.map((task) => <WorkerDeliverableCard key={task.id} task={task} onSubmit={(url) => submitDeliverable({ task, url })} />)}
            </div>
          ) : <p className="text-sm text-[var(--mikke-muted)]">担当成果物はありません。</p>}
        </MikkeSection>
        <MikkeSection title="関連コメント"><WorkerComments comments={comments} /></MikkeSection>
      </div>

      <MikkeSection title="担当資料">
        {resources.length > 0 ? <div className="space-y-2">{resources.map((resource) => <article key={resource.id} className="rounded-lg border border-[var(--mikke-line)] p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold">{resource.title}</p>{resource.type === "note" ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--mikke-text-soft)]">{resource.memo}</p> : null}</div>{resource.type === "url" && resource.url ? <a href={resource.url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[var(--mikke-primary)]">開く <ExternalLink size={13} /></a> : null}</div></article>)}</div> : <p className="text-sm text-[var(--mikke-muted)]">担当者向けの資料はありません。</p>}
      </MikkeSection>
    </div>
  );
}

function WorkerDeliverableCard({ item, task, onSubmit }: { item?: WorkerProjectDeliverableView; task?: WorkerProjectTaskView; onSubmit: (url: string) => void }) {
  const editable = !item || ["draft", "revision_requested"].includes(item.status);
  const [url, setUrl] = useState(item?.url ?? "");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!url.trim()) return;
    onSubmit(url);
  }

  return (
    <article className="rounded-lg border border-[var(--mikke-line)] p-3">
      <div className="flex items-start gap-3">
        <FileCheck2 size={18} className="mt-0.5 shrink-0 text-[var(--mikke-primary)]" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{item?.title ?? task?.title ?? "成果物"}</p>
          <p className="mt-1 text-xs text-[var(--mikke-muted)]">
            {item ? `Ver.${item.version}・${projectDeliverableStatusLabels[item.status]}・${item.clientVisible ? "クライアント共有" : "内部のみ"}` : "新規提出"}
          </p>
        </div>
        {item?.type === "url" && item.url ? <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[var(--mikke-primary)]">開く <ExternalLink size={13} /></a> : null}
      </div>
      {editable ? (
        <form onSubmit={submit} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input type="url" value={url} onChange={(event) => setUrl(event.target.value)} className="min-h-10 flex-1 rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--mikke-primary)]" placeholder="https://" required />
          <button type="submit" className="rounded-lg bg-[var(--mikke-primary)] px-4 py-2 text-xs font-bold text-white">{item?.status === "revision_requested" ? "再提出する" : "提出する"}</button>
        </form>
      ) : null}
    </article>
  );
}

function WorkerComments({ comments }: { comments: WorkerProjectCommentView[] }) {
  if (comments.length === 0) return <p className="text-sm text-[var(--mikke-muted)]">関連コメントはありません。</p>;
  return <div className="space-y-2">{comments.map((comment) => <div key={comment.id} className="rounded-lg bg-[var(--mikke-bg)] p-3"><div className="flex items-center gap-2 text-[11px] font-bold text-[var(--mikke-muted)]"><MessageSquareText size={13} /><span>{comment.authorLabel}</span><span>{comment.audience === "client" ? "クライアント共有" : "内部のみ"}</span></div><p className="mt-1 text-sm leading-6">{comment.body}</p></div>)}</div>;
}

function SummaryCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof CheckCircle2 }) {
  return <div className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4"><Icon size={18} className="text-[var(--mikke-primary)]" /><p className="mt-3 text-xs font-bold text-[var(--mikke-muted)]">{label}</p><p className="mt-1 text-lg font-bold">{value}</p></div>;
}

function formatDate(value: string) {
  if (!value) return "未設定";
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "numeric", day: "numeric" }).format(new Date(`${value}T00:00:00`));
}
