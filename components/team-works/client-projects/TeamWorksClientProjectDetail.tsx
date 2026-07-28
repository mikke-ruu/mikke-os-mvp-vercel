"use client";

import { FormEvent, useState } from "react";
import { AlertCircle, ArrowLeft, CalendarDays, CheckCircle2, ExternalLink, FileCheck2, ListChecks, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeSection } from "@/components/mikkeos/MikkeSection";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import {
  createTeamWorksClientProjectDetail,
  TEAM_WORKS_CLIENT_PORTAL_DEMO_CLIENT_ID,
  TEAM_WORKS_CLIENT_PORTAL_DEMO_MEMBER_ID,
  type ClientProjectCommentView,
  type ClientProjectDeliverableView,
  type ClientProjectFormView
} from "@/lib/team-works-client-projects";
import { TeamWorksProjectFormResponse } from "@/components/team-works/projects/TeamWorksProjectFormResponse";
import { saveProjectFormAnswers, transitionProjectFormSubmission } from "@/lib/team-works-project-forms";
import { transitionProjectDeliverable } from "@/lib/team-works-project-deliverables";
import {
  createTeamWorksProjectId,
  projectDeliverableStatusLabels,
  projectPhaseStatusLabels,
  projectStatusLabels,
  projectTaskStatusLabels,
  useTeamWorksProjectStore,
  type ProjectFormAnswerValue,
  type ProjectDeliverableStatus
} from "@/lib/team-works-projects";
import { teamWorksProjectInputClass } from "@/components/team-works/projects/TeamWorksProjectsShell";
import { useTeamWorksPortalActor } from "@/components/team-works/useTeamWorksPortalActor";
import { reviewTeamWorksPortalDeliverable, saveTeamWorksPortalComment, saveTeamWorksPortalFormSubmission, uploadTeamWorksPortalFormAttachment } from "@/lib/team-works-portal-database";

export function TeamWorksClientProjectDetail({ projectId }: { projectId: string }) {
  const { hydrated, projectState, saveProjectState } = useTeamWorksProjectStore();
  const actor = useTeamWorksPortalActor("client", { projectState, saveProjectState });
  const membership = actor.membershipBySourceProjectId.get(projectId);
  const actorMemberships = new Map(membership ? [[projectId, { memberId: membership.memberId }]] : []);
  const detail = createTeamWorksClientProjectDetail(projectState, TEAM_WORKS_CLIENT_PORTAL_DEMO_CLIENT_ID, projectId, { memberships: actorMemberships });
  const [databaseError, setDatabaseError] = useState("");
  const [submissionSourceIds, setSubmissionSourceIds] = useState<Record<string, string>>({});

  if (!hydrated || actor.status === "loading") return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">共有プロジェクトを読み込んでいます。</p>;
  if (actor.status === "error") return <MikkeEmptyState title="案件所属を確認できません" helper={actor.errorMessage} />;
  if (!detail) {
    return (
      <div className="space-y-4">
        <MikkeEmptyState title="このプロジェクトは表示できません" helper="共有が終了したか、閲覧できるプロジェクトではありません。" />
        <Link href="/apps/team-works/portal/client/projects" className="mx-auto flex w-fit items-center gap-2 text-sm font-bold text-[var(--mikke-primary)]"><ArrowLeft size={16} /> 一覧へ戻る</Link>
      </div>
    );
  }

  const { project, phases, tasks, forms, resources, comments, actions, reviewDeliverables, approvedDeliverables } = detail;

  async function saveForm(form: ClientProjectFormView, answers: Record<string, ProjectFormAnswerValue>, submit: boolean) {
    if (!membership) return;
    const now = new Date().toISOString();
    const submissionSourceId = form.submission?.id ?? submissionSourceIds[form.id] ?? createTeamWorksProjectId("team_works_project_form_submission");
    setSubmissionSourceIds((current) => current[form.id] ? current : { ...current, [form.id]: submissionSourceId });
    const saved = saveProjectFormAnswers({ submission: form.submission, projectId: project.id, formId: form.id, actor: { kind: "client", id: membership.memberId }, answers, editableAfterSubmit: form.editableAfterSubmit, now, createId: () => submissionSourceId });
    const next = submit ? transitionProjectFormSubmission({ submission: saved, nextStatus: "submitted", actor: { kind: "client", id: membership.memberId }, now }) : saved;
    try {
      setDatabaseError("");
      await saveTeamWorksPortalFormSubmission({ membership, formSourceId: form.id, submissionSourceId: next.id, answers: next.answers, status: submit ? "submitted" : "draft" });
    } catch (error) {
      setDatabaseError(databaseErrorMessage(error));
      return;
    }
    saveProjectState({ ...projectState, projects: projectState.projects.map((item) => item.id === project.id ? { ...item, updatedAt: now } : item), formSubmissions: form.submission ? projectState.formSubmissions.map((item) => item.id === next.id ? next : item) : [...projectState.formSubmissions, next] });
  }

  async function uploadFormAttachment(form: ClientProjectFormView, fieldId: string, file: File) {
    if (!membership) throw new Error("Team Worksポータルの所属を確認できません。");
    const submissionSourceId = form.submission?.id ?? submissionSourceIds[form.id] ?? createTeamWorksProjectId("team_works_project_form_submission");
    setSubmissionSourceIds((current) => current[form.id] ? current : { ...current, [form.id]: submissionSourceId });
    return uploadTeamWorksPortalFormAttachment({
      membership,
      formSourceId: form.id,
      submissionSourceId,
      fieldId,
      file
    });
  }

  async function updateDeliverable(deliverableId: string, nextStatus: ProjectDeliverableStatus, body: string) {
    if (!membership || (nextStatus !== "approved" && nextStatus !== "revision_requested")) return;
    const deliverable = projectState.deliverables.find((item) => item.id === deliverableId && item.projectId === project.id && item.clientVisible);
    if (!deliverable) return;
    const now = new Date().toISOString();
    const nextDeliverable = transitionProjectDeliverable({
      deliverable,
      nextStatus,
      actor: "client",
      memberId: membership.memberId,
      now
    });
    const comment = body.trim() ? {
      id: createTeamWorksProjectId("team_works_project_comment"),
      projectId: project.id,
      phaseId: deliverable.phaseId,
      taskId: deliverable.taskId,
      deliverableId: deliverable.id,
      authorMemberId: membership.memberId,
      audience: "client" as const,
      body: body.trim(),
      createdAt: now,
      updatedAt: now
    } : null;
    try {
      setDatabaseError("");
      await reviewTeamWorksPortalDeliverable({ membership, deliverableSourceId: deliverable.id, nextStatus });
      if (comment) await saveTeamWorksPortalComment({ membership, commentSourceId: comment.id, taskSourceId: deliverable.taskId, deliverableSourceId: deliverable.id, audience: "client", body: comment.body });
    } catch (error) {
      setDatabaseError(databaseErrorMessage(error));
      return;
    }
    saveProjectState({
      ...projectState,
      projects: projectState.projects.map((item) => item.id === project.id ? { ...item, updatedAt: now } : item),
      deliverables: projectState.deliverables.map((item) => item.id === deliverable.id ? nextDeliverable : item),
      comments: comment ? [...projectState.comments, comment] : projectState.comments
    });
  }

  async function addProjectComment(body: string) {
    if (!body.trim() || !membership) return;
    const now = new Date().toISOString();
    const comment = {
      id: createTeamWorksProjectId("team_works_project_comment"),
      projectId: project.id,
      phaseId: null,
      taskId: null,
      deliverableId: null,
      authorMemberId: membership.memberId,
      audience: "client" as const,
      body: body.trim(),
      createdAt: now,
      updatedAt: now
    };
    try {
      setDatabaseError("");
      await saveTeamWorksPortalComment({ membership, commentSourceId: comment.id, audience: "client", body: comment.body });
    } catch (error) {
      setDatabaseError(databaseErrorMessage(error));
      return;
    }
    saveProjectState({
      ...projectState,
      projects: projectState.projects.map((item) => item.id === project.id ? { ...item, updatedAt: now } : item),
      comments: [...projectState.comments, comment]
    });
  }

  return (
    <div className="space-y-6">
      {databaseError ? <p role="alert" className="rounded-lg border border-[var(--mikke-danger)] px-3 py-2 text-sm font-bold text-[var(--mikke-danger)]">{databaseError}</p> : null}
      <Link href="/apps/team-works/portal/client/projects" className="inline-flex items-center gap-2 text-xs font-bold text-[var(--mikke-primary)]"><ArrowLeft size={15} /> プロジェクト一覧</Link>

      <section className="border-b border-[var(--mikke-line)] pb-5">
        <MikkeStatusBadge tone={project.status === "completed" ? "success" : project.status === "on_hold" ? "muted" : "primary"} className="px-2 py-1">
          {projectStatusLabels[project.status]}
        </MikkeStatusBadge>
        <h2 className="mt-3 text-2xl font-bold tracking-normal">{project.name}</h2>
        {project.description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--mikke-text-soft)]">{project.description}</p> : null}
      </section>

      <MikkeSection title="あなたが今やること">
        {actions.length > 0 ? (
          <div className="space-y-2">
            {actions.map((action) => (
              <div key={`${action.kind}-${action.id}`} className="flex items-start gap-3 rounded-lg border border-[var(--mikke-primary-border)] bg-[var(--mikke-accent-soft)] p-3">
                <AlertCircle size={18} className="mt-0.5 shrink-0 text-[var(--mikke-accent)]" />
                <div>
                  <p className="text-sm font-bold">{action.title}</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">{action.helper}{action.dueDate ? `・期限 ${formatDate(action.dueDate)}` : ""}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg bg-[var(--mikke-success-soft)] p-4 text-[var(--mikke-success)]"><CheckCircle2 size={20} /><p className="text-sm font-bold">現在、対応が必要な項目はありません。</p></div>
        )}
      </MikkeSection>

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="全体進捗" value={`${project.progressPercent}%`} icon={CheckCircle2} />
        <SummaryCard label="現在の工程" value={project.currentPhaseName} icon={ListChecks} />
        <SummaryCard label="納期" value={formatDate(project.dueDate)} icon={CalendarDays} />
      </section>

      <MikkeSection title="目的・完成条件">
        <p className="text-sm leading-7 text-[var(--mikke-text-soft)]">{project.goal || "完成条件はまだ共有されていません。"}</p>
      </MikkeSection>

      <MikkeSection title="提出フォーム">{forms.length > 0 ? <div className="space-y-3">{forms.map((form) => <TeamWorksProjectFormResponse key={form.id} form={form} onSave={(answers) => saveForm(form, answers, false)} onSubmit={(answers) => saveForm(form, answers, true)} onUploadAttachment={(field, file) => uploadFormAttachment(form, field.id, file)} />)}</div> : <p className="text-sm text-[var(--mikke-muted)]">現在提出するフォームはありません。</p>}</MikkeSection>

      <MikkeSection title="工程と対応内容">
        {phases.length > 0 ? (
          <div className="space-y-4">
            {phases.map((phase) => {
              const phaseTasks = tasks.filter((task) => task.phaseId === phase.id);
              return (
                <article key={phase.id} className="rounded-lg border border-[var(--mikke-line)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-[var(--mikke-muted)]">工程 {phase.position + 1}</p>
                      <h3 className="mt-1 text-base font-bold">{phase.name}</h3>
                      {phase.description ? <p className="mt-2 text-sm leading-6 text-[var(--mikke-text-soft)]">{phase.description}</p> : null}
                    </div>
                    <MikkeStatusBadge tone={phase.status === "completed" ? "success" : phase.status === "not_started" ? "muted" : "primary"} className="px-2 py-1">{projectPhaseStatusLabels[phase.status]}</MikkeStatusBadge>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs font-bold"><span>工程進捗</span><span>{phase.progressPercent}%</span></div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--mikke-line-soft)]"><div className="h-full rounded-full bg-[var(--mikke-accent)]" style={{ width: `${phase.progressPercent}%` }} /></div>
                  {phaseTasks.length > 0 ? (
                    <div className="mt-4 divide-y divide-[var(--mikke-line)] border-t border-[var(--mikke-line)]">
                      {phaseTasks.map((task) => (
                        <div key={task.id} className="flex flex-col gap-2 py-3 first:pt-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-bold">{task.title}</p>
                            {task.description ? <p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">{task.description}</p> : null}
                          </div>
                          <div className="flex shrink-0 items-center gap-2 text-xs font-bold text-[var(--mikke-muted)]"><span>{formatDate(task.dueDate)}</span><span className="rounded-full bg-[var(--mikke-bg)] px-2 py-1">{projectTaskStatusLabels[task.status]}</span></div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : <MikkeEmptyState title="共有中の工程はありません" />}
      </MikkeSection>

      <div className="grid gap-6 lg:grid-cols-2">
        <DeliverableSection title="確認する成果物" items={reviewDeliverables} comments={comments} empty="確認待ちの成果物はありません。" onAction={updateDeliverable} />
        <DeliverableSection title="承認済み・納品済み" items={approvedDeliverables} comments={comments} empty="承認済みの成果物はまだありません。" />
      </div>

      <MikkeSection title="共有資料">
        {resources.length > 0 ? <div className="space-y-2">{resources.map((resource) => <article key={resource.id} className="rounded-lg border border-[var(--mikke-line)] p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold">{resource.title}</p>{resource.type === "note" ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--mikke-text-soft)]">{resource.memo}</p> : null}</div>{resource.type === "url" && resource.url ? <a href={resource.url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[var(--mikke-primary)]">開く <ExternalLink size={13} /></a> : null}</div></article>)}</div> : <p className="text-sm text-[var(--mikke-muted)]">共有中の資料はありません。</p>}
      </MikkeSection>

      <SharedComments comments={comments.filter((comment) => !comment.deliverableId)} onSubmit={addProjectComment} />
    </div>
  );
}

function databaseErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return message || "DBへ保存できませんでした。案件への招待と権限を確認してください。";
}

function SummaryCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof CheckCircle2 }) {
  return <div className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4"><Icon size={18} className="text-[var(--mikke-primary)]" /><p className="mt-3 text-xs font-bold text-[var(--mikke-muted)]">{label}</p><p className="mt-1 text-lg font-bold">{value}</p></div>;
}

function DeliverableSection({ title, items, comments, empty, onAction }: {
  title: string;
  items: ClientProjectDeliverableView[];
  comments: ClientProjectCommentView[];
  empty: string;
  onAction?: (deliverableId: string, status: ProjectDeliverableStatus, body: string) => void;
}) {
  return (
    <MikkeSection title={title}>
      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item) => (
            <ClientDeliverableCard key={item.id} item={item} comments={comments.filter((comment) => comment.deliverableId === item.id)} onAction={onAction} />
          ))}
        </div>
      ) : <p className="text-sm text-[var(--mikke-muted)]">{empty}</p>}
    </MikkeSection>
  );
}

function ClientDeliverableCard({ item, comments, onAction }: { item: ClientProjectDeliverableView; comments: ClientProjectCommentView[]; onAction?: (deliverableId: string, status: ProjectDeliverableStatus, body: string) => void }) {
  const [body, setBody] = useState("");
  const canReview = item.status === "client_review" && Boolean(onAction);

  function act(status: ProjectDeliverableStatus) {
    if (status === "revision_requested" && !body.trim()) return;
    onAction?.(item.id, status, body);
    setBody("");
  }

  return (
    <article className="rounded-lg border border-[var(--mikke-line)] p-3">
      <div className="flex items-start gap-3">
        <FileCheck2 size={18} className="mt-0.5 shrink-0 text-[var(--mikke-primary)]" />
        <div className="min-w-0 flex-1"><p className="text-sm font-bold">{item.title}</p><p className="mt-1 text-xs text-[var(--mikke-muted)]">Ver.{item.version}・{projectDeliverableStatusLabels[item.status]}</p></div>
        {item.type === "url" && item.url ? <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[var(--mikke-primary)]">開く <ExternalLink size={13} /></a> : null}
      </div>
      <ClientCommentList comments={comments} />
      {canReview ? (
        <div className="mt-3 border-t border-[var(--mikke-line)] pt-3">
          <textarea value={body} onChange={(event) => setBody(event.target.value)} className={`${teamWorksProjectInputClass} min-h-20 resize-y`} placeholder="修正依頼の場合は、直してほしい点を入力してください。" />
          <div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={() => act("approved")} className="rounded-lg bg-[var(--mikke-success)] px-3 py-2 text-xs font-bold text-white">承認する</button><button type="button" onClick={() => act("revision_requested")} disabled={!body.trim()} className="rounded-lg border border-[var(--mikke-danger)] px-3 py-2 text-xs font-bold text-[var(--mikke-danger)] disabled:cursor-not-allowed disabled:opacity-40">修正を依頼</button></div>
        </div>
      ) : null}
    </article>
  );
}

function SharedComments({ comments, onSubmit }: { comments: ClientProjectCommentView[]; onSubmit: (body: string) => void }) {
  const [body, setBody] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); onSubmit(body); setBody(""); }
  return (
    <MikkeSection title="共有コメント">
      <ClientCommentList comments={comments} empty="共有コメントはまだありません。" />
      <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row"><input value={body} onChange={(event) => setBody(event.target.value)} className={`${teamWorksProjectInputClass} flex-1`} placeholder="制作チームへのコメント" required /><button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--mikke-primary)] px-4 py-2 text-xs font-bold text-white"><MessageSquareText size={14} /> 送信</button></form>
    </MikkeSection>
  );
}

function ClientCommentList({ comments, empty }: { comments: ClientProjectCommentView[]; empty?: string }) {
  if (comments.length === 0) return empty ? <p className="text-sm text-[var(--mikke-muted)]">{empty}</p> : null;
  return <div className="mt-3 space-y-2">{comments.map((comment) => <div key={comment.id} className="rounded-lg bg-[var(--mikke-bg)] p-3"><p className="text-[11px] font-bold text-[var(--mikke-muted)]">{comment.authorLabel}・{formatDateTime(comment.createdAt)}</p><p className="mt-1 text-sm leading-6">{comment.body}</p></div>)}</div>;
}

function formatDate(value: string) {
  if (!value) return "未設定";
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "numeric", day: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
