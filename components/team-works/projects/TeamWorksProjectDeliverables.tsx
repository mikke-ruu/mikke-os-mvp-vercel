"use client";

import { FormEvent, useState } from "react";
import { ExternalLink, FileCheck2, MessageSquareText, Plus } from "lucide-react";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeSection } from "@/components/mikkeos/MikkeSection";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import {
  getProjectDeliverableTransitions,
  transitionProjectDeliverable
} from "@/lib/team-works-project-deliverables";
import {
  createTeamWorksProjectId,
  projectDeliverableStatusLabels,
  type ProjectCommentAudience,
  type ProjectDeliverable,
  type ProjectDeliverableStatus,
  type TeamWorksProjectStoreState
} from "@/lib/team-works-projects";
import { TeamWorksProjectField, teamWorksProjectInputClass } from "./TeamWorksProjectsShell";

type Props = {
  project: TeamWorksProjectStoreState["projects"][number];
  phases: TeamWorksProjectStoreState["phases"];
  tasks: TeamWorksProjectStoreState["tasks"];
  members: TeamWorksProjectStoreState["projectMembers"];
  state: TeamWorksProjectStoreState;
  save: (next: TeamWorksProjectStoreState) => void;
};

export function TeamWorksProjectDeliverables({ project, phases, tasks, members, state, save }: Props) {
  const deliverables = state.deliverables.filter((item) => item.projectId === project.id);
  const actorMemberId = project.leaderMemberId || members[0]?.id || "team_works_internal_user";
  const [title, setTitle] = useState("");
  const [taskId, setTaskId] = useState(tasks.find((task) => task.requiresDeliverable)?.id ?? tasks[0]?.id ?? "");
  const [type, setType] = useState<ProjectDeliverable["type"]>("url");
  const [url, setUrl] = useState("");
  const [clientVisible, setClientVisible] = useState(project.clientVisible);
  const [reportBody, setReportBody] = useState("");
  const [reportTaskId, setReportTaskId] = useState("");
  const [reportAudience, setReportAudience] = useState<ProjectCommentAudience>("internal");

  function saveWithProjectTimestamp(patch: Partial<TeamWorksProjectStoreState>) {
    const now = new Date().toISOString();
    save({
      ...state,
      ...patch,
      projects: state.projects.map((item) => item.id === project.id ? { ...item, updatedAt: now } : item)
    });
  }

  function addDeliverable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const task = tasks.find((item) => item.id === taskId);
    if (!title.trim() || !task) return;
    const now = new Date().toISOString();
    const deliverable: ProjectDeliverable = {
      id: createTeamWorksProjectId("team_works_project_deliverable"),
      projectId: project.id,
      phaseId: task.phaseId,
      taskId: task.id,
      title: title.trim(),
      type,
      url: type === "url" ? url.trim() : "",
      version: 1,
      status: "draft",
      submittedByMemberId: task.assigneeMemberId || actorMemberId,
      reviewedByMemberId: "",
      clientVisible: project.clientVisible && clientVisible,
      createdAt: now,
      updatedAt: now
    };
    saveWithProjectTimestamp({ deliverables: [...state.deliverables, deliverable] });
    setTitle("");
    setUrl("");
  }

  function changeStatus(deliverable: ProjectDeliverable, nextStatus: ProjectDeliverableStatus) {
    const next = transitionProjectDeliverable({ deliverable, nextStatus, actor: "internal", memberId: actorMemberId });
    saveWithProjectTimestamp({
      deliverables: state.deliverables.map((item) => item.id === deliverable.id ? next : item)
    });
  }

  function addComment(deliverableId: string | null, body: string, audience: ProjectCommentAudience, linkedTaskId: string | null) {
    if (!body.trim()) return;
    const now = new Date().toISOString();
    const linkedDeliverable = deliverableId ? deliverables.find((item) => item.id === deliverableId) : null;
    const linkedTask = tasks.find((item) => item.id === linkedTaskId);
    saveWithProjectTimestamp({
      comments: [...state.comments, {
        id: createTeamWorksProjectId("team_works_project_comment"),
        projectId: project.id,
        phaseId: linkedDeliverable?.phaseId ?? linkedTask?.phaseId ?? null,
        taskId: linkedDeliverable?.taskId ?? linkedTask?.id ?? null,
        deliverableId,
        authorMemberId: actorMemberId,
        audience,
        body: body.trim(),
        createdAt: now,
        updatedAt: now
      }]
    });
  }

  function addReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    addComment(null, reportBody, reportAudience, reportTaskId || null);
    setReportBody("");
  }

  const projectComments = state.comments.filter((comment) => comment.projectId === project.id && !comment.deliverableId);

  return (
    <div className="space-y-6">
      <MikkeSection title="成果物ワークフロー">
        {deliverables.length > 0 ? (
          <div className="space-y-4">
            {deliverables.map((deliverable) => (
              <DeliverableCard
                key={deliverable.id}
                deliverable={deliverable}
                phaseName={phases.find((phase) => phase.id === deliverable.phaseId)?.name ?? "工程未設定"}
                taskName={tasks.find((task) => task.id === deliverable.taskId)?.title ?? "タスク未設定"}
                comments={state.comments.filter((comment) => comment.deliverableId === deliverable.id)}
                members={members}
                onStatusChange={(nextStatus) => changeStatus(deliverable, nextStatus)}
                onComment={(body, audience) => addComment(deliverable.id, body, audience, deliverable.taskId)}
              />
            ))}
          </div>
        ) : <MikkeEmptyState title="成果物はまだありません" helper="下のフォームから最初の成果物を追加してください。" />}
      </MikkeSection>

      <MikkeSection title="成果物を追加">
        {tasks.length === 0 ? <MikkeEmptyState title="先にタスクを追加してください" /> : (
          <form onSubmit={addDeliverable} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <TeamWorksProjectField label="成果物名" required className="sm:col-span-2">
              <input value={title} onChange={(event) => setTitle(event.target.value)} className={teamWorksProjectInputClass} required />
            </TeamWorksProjectField>
            <TeamWorksProjectField label="対象タスク">
              <select value={taskId} onChange={(event) => setTaskId(event.target.value)} className={teamWorksProjectInputClass}>
                {tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
              </select>
            </TeamWorksProjectField>
            <TeamWorksProjectField label="形式">
              <select value={type} onChange={(event) => setType(event.target.value as ProjectDeliverable["type"])} className={teamWorksProjectInputClass}>
                <option value="url">URL</option><option value="note">メモ</option><option value="file_placeholder">ファイル枠</option>
              </select>
            </TeamWorksProjectField>
            <TeamWorksProjectField label="公開範囲">
              <label className="flex min-h-10 items-center gap-2 rounded-lg border border-[var(--mikke-line)] px-3 text-xs font-bold">
                <input type="checkbox" checked={clientVisible} onChange={(event) => setClientVisible(event.target.checked)} disabled={!project.clientVisible} /> クライアント共有
              </label>
            </TeamWorksProjectField>
            {type === "url" ? <TeamWorksProjectField label="URL" className="sm:col-span-2 lg:col-span-5"><input type="url" value={url} onChange={(event) => setUrl(event.target.value)} className={teamWorksProjectInputClass} placeholder="https://" /></TeamWorksProjectField> : null}
            <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--mikke-accent)] px-3 py-2.5 text-xs font-bold text-white sm:col-span-2 lg:col-span-5"><Plus size={15} /> 成果物を追加</button>
          </form>
        )}
      </MikkeSection>

      <MikkeSection title="作業コメント・報告">
        <form onSubmit={addReport} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TeamWorksProjectField label="対象タスク">
            <select value={reportTaskId} onChange={(event) => setReportTaskId(event.target.value)} className={teamWorksProjectInputClass}><option value="">プロジェクト全体</option>{tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select>
          </TeamWorksProjectField>
          <TeamWorksProjectField label="公開範囲">
            <select value={reportAudience} onChange={(event) => setReportAudience(event.target.value as ProjectCommentAudience)} className={teamWorksProjectInputClass}><option value="internal">内部のみ</option>{project.clientVisible ? <option value="client">クライアント共有</option> : null}</select>
          </TeamWorksProjectField>
          <TeamWorksProjectField label="コメント" required className="sm:col-span-2"><input value={reportBody} onChange={(event) => setReportBody(event.target.value)} className={teamWorksProjectInputClass} required /></TeamWorksProjectField>
          <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--mikke-primary)] px-3 py-2.5 text-xs font-bold text-white sm:col-span-2 lg:col-span-4"><MessageSquareText size={15} /> コメントを追加</button>
        </form>
        <CommentList comments={projectComments} members={members} tasks={tasks} className="mt-5" />
      </MikkeSection>
    </div>
  );
}

function DeliverableCard({ deliverable, phaseName, taskName, comments, members, onStatusChange, onComment }: {
  deliverable: ProjectDeliverable;
  phaseName: string;
  taskName: string;
  comments: TeamWorksProjectStoreState["comments"];
  members: TeamWorksProjectStoreState["projectMembers"];
  onStatusChange: (status: ProjectDeliverableStatus) => void;
  onComment: (body: string, audience: ProjectCommentAudience) => void;
}) {
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<ProjectCommentAudience>("internal");
  const transitions = getProjectDeliverableTransitions(deliverable, "internal");

  function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onComment(body, audience);
    setBody("");
  }

  return (
    <article className="rounded-xl border border-[var(--mikke-line)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <FileCheck2 size={19} className="mt-0.5 shrink-0 text-[var(--mikke-primary)]" />
          <div><h3 className="text-sm font-bold">{deliverable.title}</h3><p className="mt-1 text-xs text-[var(--mikke-muted)]">{phaseName}・{taskName}・Ver.{deliverable.version}</p></div>
        </div>
        <div className="flex items-center gap-2"><span className="text-xs font-bold text-[var(--mikke-muted)]">{deliverable.clientVisible ? "クライアント共有" : "内部のみ"}</span><MikkeStatusBadge tone={statusTone(deliverable.status)} className="px-2 py-1">{projectDeliverableStatusLabels[deliverable.status]}</MikkeStatusBadge></div>
      </div>
      {deliverable.type === "url" && deliverable.url ? <a href={deliverable.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[var(--mikke-primary)]">成果物を開く <ExternalLink size={13} /></a> : null}
      {transitions.length > 0 ? <div className="mt-4 flex flex-wrap gap-2">{transitions.map((transition) => <button key={transition.status} type="button" onClick={() => onStatusChange(transition.status)} className={buttonClass(transition.tone)}>{transition.label}</button>)}</div> : <p className="mt-4 text-xs font-bold text-[var(--mikke-muted)]">{deliverable.status === "client_review" ? "クライアントの確認を待っています。" : "この成果物の操作は完了しています。"}</p>}
      <div className="mt-4 border-t border-[var(--mikke-line)] pt-4">
        <CommentList comments={comments} members={members} />
        <form onSubmit={submitComment} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input value={body} onChange={(event) => setBody(event.target.value)} className={`${teamWorksProjectInputClass} flex-1`} placeholder="成果物へのコメント" required />
          <select value={audience} onChange={(event) => setAudience(event.target.value as ProjectCommentAudience)} className={`${teamWorksProjectInputClass} sm:w-40`}><option value="internal">内部のみ</option>{deliverable.clientVisible ? <option value="client">クライアント共有</option> : null}</select>
          <button type="submit" className="rounded-lg bg-[var(--mikke-primary)] px-4 py-2 text-xs font-bold text-white">追加</button>
        </form>
      </div>
    </article>
  );
}

function CommentList({ comments, members, tasks = [], className = "" }: { comments: TeamWorksProjectStoreState["comments"]; members: TeamWorksProjectStoreState["projectMembers"]; tasks?: TeamWorksProjectStoreState["tasks"]; className?: string }) {
  if (comments.length === 0) return <p className={`text-xs text-[var(--mikke-muted)] ${className}`}>コメントはまだありません。</p>;
  return <div className={`space-y-2 ${className}`}>{comments.map((comment) => <div key={comment.id} className="rounded-lg bg-[var(--mikke-bg)] p-3"><div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-[var(--mikke-muted)]"><span>{members.find((member) => member.id === comment.authorMemberId)?.displayName ?? "クライアント"}</span><span>{comment.audience === "client" ? "クライアント共有" : "内部のみ"}</span>{comment.taskId ? <span>{tasks.find((task) => task.id === comment.taskId)?.title}</span> : null}</div><p className="mt-1 text-sm leading-6">{comment.body}</p></div>)}</div>;
}

function statusTone(status: ProjectDeliverableStatus): "primary" | "muted" | "success" {
  if (["approved", "delivered"].includes(status)) return "success";
  if (status === "draft") return "muted";
  if (status === "revision_requested") return "muted";
  return "primary";
}

function buttonClass(tone: "primary" | "danger" | "success") {
  if (tone === "danger") return "rounded-lg border border-[var(--mikke-danger)] px-3 py-2 text-xs font-bold text-[var(--mikke-danger)]";
  if (tone === "success") return "rounded-lg bg-[var(--mikke-success)] px-3 py-2 text-xs font-bold text-white";
  return "rounded-lg bg-[var(--mikke-primary)] px-3 py-2 text-xs font-bold text-white";
}
