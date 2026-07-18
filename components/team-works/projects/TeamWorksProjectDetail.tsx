"use client";

import { FormEvent, useState } from "react";
import { CalendarDays, CircleUserRound, ClipboardCheck, ExternalLink, FileCheck2, ListChecks, Plus, UsersRound } from "lucide-react";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeListRow } from "@/components/mikkeos/MikkeListRow";
import { MikkeSection } from "@/components/mikkeos/MikkeSection";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import {
  calculateProjectProgress,
  createTeamWorksProjectId,
  projectPhaseProgress,
  projectPhaseStatusLabels,
  projectFormFieldTypeLabels,
  projectFormSubmissionStatusLabels,
  projectResourceAudienceLabels,
  projectStatusLabels,
  projectTaskPriorityLabels,
  projectTaskStatusLabels,
  useTeamWorksProjectStore,
  type Project,
  type ProjectForm,
  type ProjectPhase,
  type ProjectPhaseStatus,
  type ProjectStatus,
  type ProjectTask,
  type ProjectTaskPriority,
  type ProjectTaskStatus,
  type TeamWorksProjectStoreState
} from "@/lib/team-works-projects";
import { isProjectFormAttachmentAnswer, transitionProjectFormSubmission } from "@/lib/team-works-project-forms";
import { teamWorksInitialState } from "@/lib/team-works";
import { TeamWorksProjectDeliverables } from "./TeamWorksProjectDeliverables";
import { TeamWorksProjectCompletionReview } from "./TeamWorksProjectCompletionReview";
import { TeamWorksProjectFinance } from "./TeamWorksProjectFinance";
import { TeamWorksProjectField, teamWorksProjectInputClass } from "./TeamWorksProjectsShell";
import { useTeamWorksProjectDatabaseMembers } from "./useTeamWorksProjectDatabaseMembers";
import { reviewTeamWorksPortalFormSubmission, saveTeamWorksTaskAssignment } from "@/lib/team-works-portal-database";

type ProjectTab = "overview" | "phases" | "tasks" | "forms" | "deliverables" | "finance" | "members";

const tabs: { value: ProjectTab; label: string; icon: typeof ListChecks }[] = [
  { value: "overview", label: "概要", icon: ClipboardCheck },
  { value: "phases", label: "工程", icon: ListChecks },
  { value: "tasks", label: "タスク", icon: CalendarDays },
  { value: "forms", label: "フォーム・資料", icon: ClipboardCheck },
  { value: "deliverables", label: "成果物", icon: FileCheck2 },
  { value: "finance", label: "報酬・請求", icon: ClipboardCheck },
  { value: "members", label: "メンバー", icon: UsersRound }
];

const projectStatuses = Object.keys(projectStatusLabels) as ProjectStatus[];
const phaseStatuses = Object.keys(projectPhaseStatusLabels) as ProjectPhaseStatus[];
const taskStatuses = Object.keys(projectTaskStatusLabels) as ProjectTaskStatus[];
const taskPriorities = Object.keys(projectTaskPriorityLabels) as ProjectTaskPriority[];

export function TeamWorksProjectDetail({ projectId }: { projectId: string }) {
  const { hydrated, projectState, templateState, saveProjectState, saveTemplateState } = useTeamWorksProjectStore();
  const [tab, setTab] = useState<ProjectTab>("overview");
  const [showCompletionReview, setShowCompletionReview] = useState(false);
  const databaseMemberState = useTeamWorksProjectDatabaseMembers(projectId);
  const project = projectState.projects.find((item) => item.id === projectId);

  if (!hydrated) return <p className="text-sm text-[var(--mikke-muted)]">プロジェクトを読み込んでいます。</p>;
  if (!project) return <MikkeEmptyState title="このプロジェクトは見つかりませんでした" helper="一覧に戻り、現在のプロジェクトを確認してください。" />;

  const phases = projectState.phases.filter((phase) => phase.projectId === project.id).sort((a, b) => a.position - b.position);
  const tasks = projectState.tasks.filter((task) => task.projectId === project.id);
  const forms = projectState.forms.filter((form) => form.projectId === project.id);
  const deliverables = projectState.deliverables.filter((item) => item.projectId === project.id);
  const resources = projectState.resources.filter((item) => item.projectId === project.id);
  const roles = projectState.projectRoles.filter((role) => role.projectId === project.id);
  const localMembers = projectState.projectMembers.filter((member) => member.projectId === project.id);
  const databaseMembers = databaseMemberState.members.flatMap((member) => {
    const role = roles.find((item) => member.projectRole === "worker" ? item.name.includes("担当") : member.projectRole === "client" ? item.name.includes("クライアント") : item.name.includes("管理"));
    if (!role) return [];
    return [{ id: member.memberId, projectId: project.id, organizationMemberId: member.memberId, displayName: member.memberName, projectRoleId: role.id, joinedAt: "" }];
  });
  const databaseMemberIds = new Set(databaseMembers.map((member) => member.id));
  const databaseWorkerIds = new Set(databaseMemberState.members.filter((member) => member.projectRole === "worker").map((member) => member.memberId));
  const members = [...localMembers.filter((member) => !databaseMemberIds.has(member.id)), ...databaseMembers];
  const taskMembers = members.filter((member) => !databaseMemberIds.has(member.id) || databaseWorkerIds.has(member.id));
  const currentPhase = phases.find((phase) => phase.status !== "completed") ?? phases.at(-1);
  const waitingTaskCount = tasks.filter((task) => ["client_response_pending", "internal_review_pending", "revision_requested"].includes(task.status)).length;
  const delayedTaskCount = tasks.filter((task) => isDelayedTask(task)).length;
  const leader = members.find((member) => member.id === project.leaderMemberId);
  const sourceVersion = templateState.versions.find((version) => version.id === project.templateVersionId);
  const currentProjectId = project.id;

  function updateProject(patch: Partial<Project>) {
    const now = new Date().toISOString();
    saveProjectState({
      ...projectState,
      projects: projectState.projects.map((item) => item.id === currentProjectId ? { ...item, ...patch, updatedAt: now } : item)
    });
  }

  return (
    <div className="space-y-6">
      <section className="border-b border-[var(--mikke-line)] pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <MikkeStatusBadge tone={project.status === "completed" ? "success" : project.status === "draft" ? "muted" : "primary"} className="px-2 py-1">
                {projectStatusLabels[project.status]}
              </MikkeStatusBadge>
              <span className="text-xs font-bold text-[var(--mikke-muted)]">{clientLabel(project.clientId)}</span>
              {sourceVersion ? (
                <span className="rounded-full bg-[var(--mikke-bg)] px-2 py-1 text-xs font-bold text-[var(--mikke-muted)]">
                  {sourceVersion.snapshot.name} Ver.{sourceVersion.version}から作成
                </span>
              ) : null}
            </div>
            <h2 className="mt-3 text-2xl font-bold tracking-normal">{project.name}</h2>
            {project.description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--mikke-text-soft)]">{project.description}</p> : null}
          </div>
          <label className="w-full max-w-xs text-xs font-bold text-[var(--mikke-text)]">
            プロジェクトの状態
            <select value={project.status} onChange={(event) => {
              const nextStatus = event.target.value as ProjectStatus;
              if (nextStatus === "completed" && project.status !== "completed") setShowCompletionReview(true);
              else updateProject({ status: nextStatus });
            }} className={teamWorksProjectInputClass}>
              {projectStatuses.map((status) => <option key={status} value={status}>{projectStatusLabels[status]}</option>)}
            </select>
          </label>
        </div>

        <div className="mt-5 grid gap-3 text-xs font-semibold text-[var(--mikke-muted)] sm:grid-cols-2 lg:grid-cols-5">
          <SummaryItem label="開始日" value={formatDate(project.startDate)} />
          <SummaryItem label="納期" value={formatDate(project.dueDate)} />
          <SummaryItem label="リーダー" value={leader?.displayName ?? "未設定"} />
          <SummaryItem label="現在の工程" value={currentPhase?.name ?? "未設定"} />
          <SummaryItem label="確認・遅延" value={`${waitingTaskCount}件 / ${delayedTaskCount}件`} />
        </div>

        <div className="mt-5 max-w-3xl">
          <div className="flex items-center justify-between text-xs font-bold"><span>全体進捗</span><span className="text-[var(--mikke-accent)]">{project.progressPercent}%</span></div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[var(--mikke-line-soft)]">
            <div className="h-full rounded-full bg-[var(--mikke-accent)]" style={{ width: `${project.progressPercent}%` }} />
          </div>
        </div>
      </section>

      {showCompletionReview ? <TeamWorksProjectCompletionReview project={project} projectState={projectState} templateState={templateState} saveProjectState={saveProjectState} saveTemplateState={saveTemplateState} onCancel={() => setShowCompletionReview(false)} onCompleted={() => setShowCompletionReview(false)} /> : null}

      <div className="flex gap-2 overflow-x-auto border-b border-[var(--mikke-line)] pb-3" role="tablist" aria-label="プロジェクト詳細">
        {tabs.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={tab === item.value}
              onClick={() => setTab(item.value)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold ${
                tab === item.value ? "bg-[var(--mikke-primary)] text-white" : "text-[var(--mikke-muted)]"
              }`}
            >
              <Icon size={15} /> {item.label}
            </button>
          );
        })}
      </div>

      {tab === "overview" ? <OverviewTab project={project} phases={phases} tasks={tasks} formsCount={forms.length} deliverablesCount={deliverables.length} /> : null}
      {tab === "phases" ? <PhasesTab project={project} phases={phases} members={members} state={projectState} save={saveProjectState} /> : null}
      {tab === "tasks" ? <TasksTab project={project} phases={phases} tasks={tasks} members={taskMembers} databaseMemberIds={databaseWorkerIds} state={projectState} save={saveProjectState} /> : null}
      {tab === "forms" ? <FormsAndResourcesTab projectId={project.id} reviewerId={project.leaderMemberId} forms={forms} resources={resources} roles={roles} state={projectState} save={saveProjectState} /> : null}
      {tab === "deliverables" ? <TeamWorksProjectDeliverables project={project} phases={phases} tasks={tasks} members={members} state={projectState} save={saveProjectState} /> : null}
      {tab === "finance" ? <TeamWorksProjectFinance project={project} localTasks={tasks} /> : null}
      {tab === "members" ? (
        <MikkeSection title="参加メンバー">
          {members.length > 0 ? (
            <div className="space-y-2">
              {members.map((member) => (
                <MikkeListRow
                  key={member.id}
                  title={member.displayName}
                  label={roles.find((role) => role.id === member.projectRoleId)?.name ?? "メンバー"}
                  helper={member.id === project.leaderMemberId ? "プロジェクトリーダー" : undefined}
                  icon={CircleUserRound}
                />
              ))}
            </div>
          ) : <MikkeEmptyState title="参加メンバーはまだいません" />}
        </MikkeSection>
      ) : null}
    </div>
  );
}

function FormsAndResourcesTab({ projectId, reviewerId, forms, resources, roles, state, save }: {
  projectId: string;
  reviewerId: string;
  forms: ProjectForm[];
  resources: TeamWorksProjectStoreState["resources"];
  roles: TeamWorksProjectStoreState["projectRoles"];
  state: TeamWorksProjectStoreState;
  save: (next: TeamWorksProjectStoreState) => void;
}) {
  const [reviewMemos, setReviewMemos] = useState<Record<string, string>>({});
  const [reviewError, setReviewError] = useState("");
  const roleName = (roleId: string) => roles.find((role) => role.id === roleId)?.name ?? "未設定";
  async function review(submissionId: string, nextStatus: "revision_requested" | "approved") {
    const submission = state.formSubmissions.find((item) => item.id === submissionId && item.projectId === projectId);
    if (!submission) return;
    const now = new Date().toISOString();
    let reviewerMemberId = reviewerId;
    let approvedByMemberId = nextStatus === "approved" ? reviewerId : "";
    try {
      setReviewError("");
      const result = await reviewTeamWorksPortalFormSubmission({
        projectSourceId: projectId,
        formSourceId: submission.formId,
        submittedByMemberId: submission.submittedById,
        nextStatus,
        reviewMemo: reviewMemos[submissionId] ?? ""
      });
      reviewerMemberId = result.reviewerMemberId;
      approvedByMemberId = result.approvedByMemberId;
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : "DB review save failed.");
      return;
    }
    const next = {
      ...transitionProjectFormSubmission({ submission, nextStatus, actor: { kind: "admin", id: reviewerMemberId, memberId: reviewerMemberId }, reviewMemo: reviewMemos[submissionId], now }),
      approvedByMemberId
    };
    save({ ...state, projects: state.projects.map((project) => project.id === projectId ? { ...project, updatedAt: now } : project), formSubmissions: state.formSubmissions.map((item) => item.id === submissionId ? next : item) });
  }
  return <div className="grid gap-6 lg:grid-cols-2">
    {reviewError ? <p role="alert" className="rounded-lg border border-[var(--mikke-danger)] bg-red-50 px-3 py-2 text-sm font-bold text-[var(--mikke-danger)] lg:col-span-2">{reviewError}</p> : null}
    <MikkeSection title="フォーム定義・提出確認">{forms.length > 0 ? <div className="space-y-3">{forms.map((form) => { const submissions = state.formSubmissions.filter((item) => item.formId === form.id); return <article key={form.id} className="rounded-lg border border-[var(--mikke-line)] p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-sm font-bold">{form.name}</h3><p className="mt-1 text-xs text-[var(--mikke-muted)]">入力 {roleName(form.inputRoleId)}・確認 {roleName(form.reviewerRoleId)}・承認 {roleName(form.approverRoleId)}</p></div><span className="text-xs font-bold text-[var(--mikke-muted)]">{form.fields.length}項目</span></div><div className="mt-3 flex flex-wrap gap-2">{form.fields.map((field) => <span key={field.id} className="rounded-full bg-[var(--mikke-bg)] px-2.5 py-1 text-xs font-bold">{field.label}・{projectFormFieldTypeLabels[field.type]}{field.required ? "・必須" : ""}</span>)}</div><p className="mt-3 text-xs text-[var(--mikke-muted)]">{form.required ? "フォーム必須" : "任意"}・{form.clientVisible ? "クライアント公開" : "内部のみ"}・{form.editableAfterSubmit ? "提出後修正可" : "提出後修正不可"}{form.dueOffsetDays === null ? "・期限なし" : `・工程開始から${form.dueOffsetDays}日`}</p><div className="mt-4 space-y-2">{submissions.map((submission) => <div key={submission.id} className="rounded-lg bg-[var(--mikke-bg)] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold">{submission.submittedByActor === "client" ? "クライアント" : "担当メンバー"}からの提出</p><span className="text-xs font-bold text-[var(--mikke-muted)]">{projectFormSubmissionStatusLabels[submission.status]}</span></div><dl className="mt-2 space-y-1 text-sm">{form.fields.map((field) => <div key={field.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2"><dt className="font-bold">{field.label}</dt><dd className="break-words text-[var(--mikke-text-soft)]">{formatAnswer(submission.answers[field.id])}</dd></div>)}</dl>{submission.status === "submitted" ? <div className="mt-3 border-t border-[var(--mikke-line)] pt-3"><textarea value={reviewMemos[submission.id] ?? ""} onChange={(event) => setReviewMemos((current) => ({ ...current, [submission.id]: event.target.value }))} rows={2} className={`${teamWorksProjectInputClass} resize-y`} placeholder="修正を依頼する場合は理由を入力" /><div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={() => review(submission.id, "approved")} className="rounded-lg bg-[var(--mikke-success)] px-3 py-2 text-xs font-bold text-white">承認する</button><button type="button" onClick={() => review(submission.id, "revision_requested")} disabled={!reviewMemos[submission.id]?.trim()} className="rounded-lg border border-[var(--mikke-danger)] px-3 py-2 text-xs font-bold text-[var(--mikke-danger)] disabled:opacity-40">修正を依頼</button></div></div> : null}</div>)}{submissions.length === 0 ? <p className="text-xs text-[var(--mikke-muted)]">提出はまだありません。</p> : null}</div></article>; })}</div> : <p className="text-sm text-[var(--mikke-muted)]">フォームはありません。</p>}</MikkeSection>
    <MikkeSection title="資料ブロック（管理者表示）">{resources.length > 0 ? <div className="space-y-3">{resources.map((resource) => <article key={resource.id} className="rounded-lg border border-[var(--mikke-line)] p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold">{resource.title}</h3><p className="mt-1 text-xs text-[var(--mikke-muted)]">{projectResourceAudienceLabels[resource.audience]}</p>{resource.type === "note" ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--mikke-text-soft)]">{resource.memo}</p> : null}</div>{resource.type === "url" && resource.url ? <a href={resource.url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[var(--mikke-primary)]">開く <ExternalLink size={13} /></a> : null}</div></article>)}</div> : <p className="text-sm text-[var(--mikke-muted)]">資料はありません。</p>}</MikkeSection>
  </div>;
}

function formatAnswer(value: TeamWorksProjectStoreState["formSubmissions"][number]["answers"][string] | undefined) {
  if (isProjectFormAttachmentAnswer(value)) return <a href={value.signedUrl ?? value.storagePath} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-[var(--mikke-primary)]">{value.fileName || "添付ファイル"} <ExternalLink size={13} /></a>;
  if (Array.isArray(value)) return value.join("、") || "未回答";
  if (typeof value === "boolean") return value ? "はい" : "いいえ";
  return value === undefined || value === "" ? "未回答" : String(value);
}

function OverviewTab({ project, phases, tasks, formsCount, deliverablesCount }: { project: NonNullable<ReturnType<typeof useTeamWorksProjectStore>["projectState"]["projects"][number]>; phases: ProjectPhase[]; tasks: ProjectTask[]; formsCount: number; deliverablesCount: number }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <MikkeSection title="目的・完成条件">
        <p className="text-sm leading-7 text-[var(--mikke-text-soft)]">{project.goal || "目的はまだ入力されていません。"}</p>
      </MikkeSection>
      <MikkeSection title="進行状況">
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <DescriptionItem label="工程" value={`${phases.length}件`} />
          <DescriptionItem label="タスク" value={`${tasks.length}件`} />
          <DescriptionItem label="フォーム" value={`${formsCount}件`} />
          <DescriptionItem label="成果物枠" value={`${deliverablesCount}件`} />
          <DescriptionItem label="クライアント共有" value={project.clientVisible ? "対象" : "非公開"} />
          <DescriptionItem label="予算" value={project.budget === null ? "未設定" : `${project.budget.toLocaleString("ja-JP")}円`} />
        </dl>
      </MikkeSection>
      <MikkeSection title="内部メモ">
        <p className="text-sm leading-7 text-[var(--mikke-text-soft)]">{project.memo || "内部メモはありません。"}</p>
      </MikkeSection>
    </div>
  );
}

function PhasesTab({
  project,
  phases,
  members,
  state,
  save
}: {
  project: TeamWorksProjectStoreState["projects"][number];
  phases: ProjectPhase[];
  members: TeamWorksProjectStoreState["projectMembers"];
  state: TeamWorksProjectStoreState;
  save: (next: TeamWorksProjectStoreState) => void;
}) {
  const [name, setName] = useState("");
  const [weight, setWeight] = useState("0");
  const [dueDate, setDueDate] = useState("");
  const [ownerMemberId, setOwnerMemberId] = useState(members[0]?.id ?? "");

  function persistPhases(nextAllPhases: ProjectPhase[]) {
    const projectPhases = nextAllPhases.filter((phase) => phase.projectId === project.id);
    const progressPercent = calculateProjectProgress(projectPhases);
    save({
      ...state,
      phases: nextAllPhases,
      projects: state.projects.map((item) => item.id === project.id ? { ...item, progressPercent, updatedAt: new Date().toISOString() } : item)
    });
  }

  function updatePhase(phaseId: string, patch: Partial<ProjectPhase>) {
    const next = state.phases.map((phase) => {
      if (phase.id !== phaseId) return phase;
      const nextStatus = patch.status ?? phase.status;
      return { ...phase, ...patch, progressPercent: projectPhaseProgress(nextStatus, phase.progressPercent) };
    });
    persistPhases(next);
  }

  function addPhase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    const phase: ProjectPhase = {
      id: createTeamWorksProjectId("team_works_project_phase"),
      projectId: project.id,
      name: name.trim(),
      description: "",
      position: phases.length,
      status: "not_started",
      weight: Number(weight) || 0,
      progressPercent: 0,
      startDate: project.startDate,
      dueDate,
      ownerMemberId,
      startCondition: phases.length > 0 ? "前の工程が完了したら" : "プロジェクトを開始できる状態になったら",
      completionCondition: "必要な作業と確認が終わったら",
      clientVisible: project.clientVisible
    };
    persistPhases([...state.phases, phase]);
    setName("");
    setWeight("0");
    setDueDate("");
  }

  return (
    <div className="space-y-6">
      <MikkeSection title="工程一覧">
        {phases.length > 0 ? (
          <div className="space-y-3">
            {phases.map((phase) => (
              <article key={phase.id} className="rounded-lg border border-[var(--mikke-line)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-xs font-bold text-[var(--mikke-muted)]">工程 {phase.position + 1}</p><h3 className="mt-1 text-base font-bold">{phase.name}</h3></div>
                  <MikkeStatusBadge tone={phase.status === "completed" ? "success" : phase.status === "not_started" ? "muted" : "primary"} className="px-2 py-1">
                    {projectPhaseStatusLabels[phase.status]}
                  </MikkeStatusBadge>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <TeamWorksProjectField label="状態">
                    <select value={phase.status} onChange={(event) => updatePhase(phase.id, { status: event.target.value as ProjectPhaseStatus })} className={teamWorksProjectInputClass}>
                      {phaseStatuses.map((status) => <option key={status} value={status}>{projectPhaseStatusLabels[status]}</option>)}
                    </select>
                  </TeamWorksProjectField>
                  <TeamWorksProjectField label="責任者">
                    <select value={phase.ownerMemberId} onChange={(event) => updatePhase(phase.id, { ownerMemberId: event.target.value })} className={teamWorksProjectInputClass}>
                      <option value="">未設定</option>
                      {members.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}
                    </select>
                  </TeamWorksProjectField>
                  <TeamWorksProjectField label="比重">
                    <input value={phase.weight} onChange={(event) => updatePhase(phase.id, { weight: Number(event.target.value.replace(/\D/g, "")) || 0 })} inputMode="numeric" className={teamWorksProjectInputClass} />
                  </TeamWorksProjectField>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs font-bold"><span>工程進捗</span><span>{phase.progressPercent}%</span></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--mikke-line-soft)]"><div className="h-full bg-[var(--mikke-accent)]" style={{ width: `${phase.progressPercent}%` }} /></div>
              </article>
            ))}
          </div>
        ) : <MikkeEmptyState title="工程はまだありません" helper="下のフォームから最初の工程を追加してください。" />}
      </MikkeSection>

      <MikkeSection title="工程を追加">
        <form onSubmit={addPhase} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TeamWorksProjectField label="工程名" required className="sm:col-span-2 lg:col-span-1">
            <input value={name} onChange={(event) => setName(event.target.value)} className={teamWorksProjectInputClass} required />
          </TeamWorksProjectField>
          <TeamWorksProjectField label="比重">
            <input value={weight} onChange={(event) => setWeight(event.target.value.replace(/\D/g, ""))} inputMode="numeric" className={teamWorksProjectInputClass} />
          </TeamWorksProjectField>
          <TeamWorksProjectField label="完了予定日">
            <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className={teamWorksProjectInputClass} />
          </TeamWorksProjectField>
          <TeamWorksProjectField label="責任者">
            <select value={ownerMemberId} onChange={(event) => setOwnerMemberId(event.target.value)} className={teamWorksProjectInputClass}>
              <option value="">未設定</option>
              {members.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}
            </select>
          </TeamWorksProjectField>
          <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--mikke-accent)] px-3 py-2.5 text-xs font-bold text-white sm:col-span-2 lg:col-span-4">
            <Plus size={15} /> 工程を追加
          </button>
        </form>
      </MikkeSection>
    </div>
  );
}

function TasksTab({
  project,
  phases,
  tasks,
  members,
  databaseMemberIds,
  state,
  save
}: {
  project: TeamWorksProjectStoreState["projects"][number];
  phases: ProjectPhase[];
  tasks: ProjectTask[];
  members: TeamWorksProjectStoreState["projectMembers"];
  databaseMemberIds: ReadonlySet<string>;
  state: TeamWorksProjectStoreState;
  save: (next: TeamWorksProjectStoreState) => void;
}) {
  const [title, setTitle] = useState("");
  const [phaseId, setPhaseId] = useState(phases[0]?.id ?? "");
  const [assigneeMemberId, setAssigneeMemberId] = useState(members[0]?.id ?? "");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<ProjectTaskPriority>("normal");
  const [assignmentError, setAssignmentError] = useState("");

  function updateTask(taskId: string, patch: Partial<ProjectTask>) {
    const now = new Date().toISOString();
    save({
      ...state,
      tasks: state.tasks.map((task) => task.id === taskId ? {
        ...task,
        ...patch,
        completedAt: patch.status === "completed" ? now : patch.status ? null : task.completedAt,
        updatedAt: now
      } : task),
      projects: state.projects.map((item) => item.id === project.id ? { ...item, updatedAt: now } : item)
    });
  }

  async function assignTask(taskId: string, memberId: string) {
    if (memberId === "" || databaseMemberIds.has(memberId)) {
      try {
        setAssignmentError("");
        await saveTeamWorksTaskAssignment({ projectSourceId: project.id, taskSourceId: taskId, assigneeMemberId: memberId || null });
      } catch (error) {
        setAssignmentError(error instanceof Error ? error.message : "実メンバーを割り当てられませんでした。");
        return;
      }
    }
    updateTask(taskId, { assigneeMemberId: memberId });
  }

  function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !phaseId) return;
    const now = new Date().toISOString();
    const task: ProjectTask = {
      id: createTeamWorksProjectId("team_works_project_task"),
      projectId: project.id,
      phaseId,
      title: title.trim(),
      description: "",
      status: "not_started",
      priority,
      assigneeMemberId,
      dueDate,
      requiresDeliverable: false,
      requiresApproval: false,
      requiresClientAction: false,
      clientVisible: project.clientVisible,
      completedAt: null,
      createdAt: now,
      updatedAt: now
    };
    save({ ...state, tasks: [...state.tasks, task], projects: state.projects.map((item) => item.id === project.id ? { ...item, updatedAt: now } : item) });
    setTitle("");
    setDueDate("");
  }

  return (
    <div className="space-y-6">
      {assignmentError ? <p role="alert" className="rounded-lg border border-[var(--mikke-danger)] bg-red-50 px-3 py-2 text-sm font-bold text-[var(--mikke-danger)]">{assignmentError}</p> : null}
      <MikkeSection title="タスク一覧">
        {tasks.length > 0 ? (
          <div className="space-y-3">
            {tasks.map((task) => (
              <article key={task.id} className="rounded-lg border border-[var(--mikke-line)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-[var(--mikke-muted)]">{phases.find((phase) => phase.id === task.phaseId)?.name ?? "工程未設定"}</p>
                    <h3 className="mt-1 text-base font-bold">{task.title}</h3>
                  </div>
                  <MikkeStatusBadge tone={task.status === "completed" || task.status === "approved" ? "success" : task.status === "not_started" ? "muted" : "primary"} className="px-2 py-1">
                    {projectTaskStatusLabels[task.status]}
                  </MikkeStatusBadge>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <TeamWorksProjectField label="状態">
                    <select value={task.status} onChange={(event) => updateTask(task.id, { status: event.target.value as ProjectTaskStatus })} className={teamWorksProjectInputClass}>
                      {taskStatuses.map((status) => <option key={status} value={status}>{projectTaskStatusLabels[status]}</option>)}
                    </select>
                  </TeamWorksProjectField>
                  <TeamWorksProjectField label="担当者">
                    <select value={task.assigneeMemberId} onChange={(event) => { void assignTask(task.id, event.target.value); }} className={teamWorksProjectInputClass}>
                      <option value="">未設定</option>
                      {members.map((member) => <option key={member.id} value={member.id}>{member.displayName}{databaseMemberIds.has(member.id) ? "（実ユーザー）" : ""}</option>)}
                    </select>
                  </TeamWorksProjectField>
                  <TeamWorksProjectField label="優先度">
                    <select value={task.priority} onChange={(event) => updateTask(task.id, { priority: event.target.value as ProjectTaskPriority })} className={teamWorksProjectInputClass}>
                      {taskPriorities.map((item) => <option key={item} value={item}>{projectTaskPriorityLabels[item]}</option>)}
                    </select>
                  </TeamWorksProjectField>
                  <TeamWorksProjectField label="期限">
                    <input type="date" value={task.dueDate} onChange={(event) => updateTask(task.id, { dueDate: event.target.value })} className={teamWorksProjectInputClass} />
                  </TeamWorksProjectField>
                </div>
              </article>
            ))}
          </div>
        ) : <MikkeEmptyState title="タスクはまだありません" helper="工程を作成してから、下のフォームでタスクを追加してください。" />}
      </MikkeSection>

      <MikkeSection title="タスクを追加">
        {phases.length === 0 ? (
          <MikkeEmptyState title="先に工程を追加してください" helper="タスクは必ずいずれかの工程に所属します。" />
        ) : (
          <form onSubmit={addTask} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <TeamWorksProjectField label="タスク名" required className="sm:col-span-2 lg:col-span-1">
              <input value={title} onChange={(event) => setTitle(event.target.value)} className={teamWorksProjectInputClass} required />
            </TeamWorksProjectField>
            <TeamWorksProjectField label="工程">
              <select value={phaseId} onChange={(event) => setPhaseId(event.target.value)} className={teamWorksProjectInputClass}>
                {phases.map((phase) => <option key={phase.id} value={phase.id}>{phase.name}</option>)}
              </select>
            </TeamWorksProjectField>
            <TeamWorksProjectField label="担当者">
              <select value={assigneeMemberId} onChange={(event) => setAssigneeMemberId(event.target.value)} className={teamWorksProjectInputClass}>
                <option value="">未設定</option>
                {members.map((member) => <option key={member.id} value={member.id}>{member.displayName}{databaseMemberIds.has(member.id) ? "（実ユーザー）" : ""}</option>)}
              </select>
            </TeamWorksProjectField>
            <TeamWorksProjectField label="優先度">
              <select value={priority} onChange={(event) => setPriority(event.target.value as ProjectTaskPriority)} className={teamWorksProjectInputClass}>
                {taskPriorities.map((item) => <option key={item} value={item}>{projectTaskPriorityLabels[item]}</option>)}
              </select>
            </TeamWorksProjectField>
            <TeamWorksProjectField label="期限">
              <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className={teamWorksProjectInputClass} />
            </TeamWorksProjectField>
            <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--mikke-accent)] px-3 py-2.5 text-xs font-bold text-white sm:col-span-2 lg:col-span-5">
              <Plus size={15} /> タスクを追加
            </button>
          </form>
        )}
      </MikkeSection>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return <div><p>{label}</p><p className="mt-1 text-sm font-bold text-[var(--mikke-text)]">{value}</p></div>;
}

function DescriptionItem({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-bold text-[var(--mikke-muted)]">{label}</dt><dd className="mt-1 font-bold">{value}</dd></div>;
}

function clientLabel(clientId: string) {
  if (clientId === "client_demo") return "サンプル依頼元";
  return teamWorksInitialState.clients.find((client) => client.id === clientId)?.name ?? "クライアント未設定";
}

function formatDate(value: string) {
  if (!value) return "未設定";
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "numeric", day: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function isDelayedTask(task: ProjectTask) {
  if (!task.dueDate || ["completed", "approved"].includes(task.status)) return false;
  return new Date(`${task.dueDate}T23:59:59`).getTime() < Date.now();
}
