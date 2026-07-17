import type {
  ProjectDeliverableStatus,
  ProjectFormField,
  ProjectFormSubmission,
  ProjectPhaseStatus,
  ProjectStatus,
  ProjectTaskStatus,
  TeamWorksProjectStoreState
} from "./team-works-projects";

export const TEAM_WORKS_CLIENT_PORTAL_DEMO_CLIENT_ID = "client_sakura";
export const TEAM_WORKS_CLIENT_PORTAL_DEMO_MEMBER_ID = "client_portal_demo_member";

const clientDeliverableStatuses = new Set<ProjectDeliverableStatus>([
  "client_review",
  "revision_requested",
  "approved",
  "delivered"
]);

const completedTaskStatuses = new Set<ProjectTaskStatus>(["approved", "completed"]);

export type ClientProjectAction = {
  id: string;
  kind: "project" | "task" | "deliverable" | "form";
  title: string;
  helper: string;
  dueDate: string;
};

export type ClientProjectPhaseView = {
  id: string;
  name: string;
  description: string;
  position: number;
  status: ProjectPhaseStatus;
  progressPercent: number;
  startDate: string;
  dueDate: string;
  completionCondition: string;
};

export type ClientProjectTaskView = {
  id: string;
  phaseId: string;
  title: string;
  description: string;
  status: ProjectTaskStatus;
  dueDate: string;
  requiresClientAction: boolean;
};

export type ClientProjectDeliverableView = {
  id: string;
  phaseId: string;
  taskId: string;
  title: string;
  type: "url" | "file_placeholder" | "note";
  url: string;
  version: number;
  status: ProjectDeliverableStatus;
  updatedAt: string;
};

export type ClientProjectCommentView = {
  id: string;
  phaseId: string | null;
  taskId: string | null;
  deliverableId: string | null;
  authorLabel: "あなた" | "制作チーム";
  body: string;
  createdAt: string;
};

export type ClientProjectResourceView = {
  id: string;
  phaseId: string;
  taskId: string | null;
  title: string;
  type: "url" | "note";
  url: string;
  memo: string;
};

export type ClientProjectFormView = {
  id: string;
  name: string;
  required: boolean;
  dueOffsetDays: number | null;
  editableAfterSubmit: boolean;
  fields: ProjectFormField[];
  submission: ProjectFormSubmission | null;
};

export type ClientProjectSummary = {
  id: string;
  name: string;
  description: string;
  goal: string;
  status: ProjectStatus;
  startDate: string;
  dueDate: string;
  progressPercent: number;
  currentPhaseName: string;
  actionCount: number;
  reviewDeliverableCount: number;
  approvedDeliverableCount: number;
  updatedAt: string;
};

export type ClientProjectDetailView = {
  project: ClientProjectSummary;
  phases: ClientProjectPhaseView[];
  tasks: ClientProjectTaskView[];
  deliverables: ClientProjectDeliverableView[];
  resources: ClientProjectResourceView[];
  forms: ClientProjectFormView[];
  comments: ClientProjectCommentView[];
  actions: ClientProjectAction[];
  reviewDeliverables: ClientProjectDeliverableView[];
  approvedDeliverables: ClientProjectDeliverableView[];
};

export type ClientPortalActor = {
  memberships: ReadonlyMap<string, { memberId: string }>;
};

export function createTeamWorksClientProjectList(state: TeamWorksProjectStoreState, clientId: string, actor?: ClientPortalActor) {
  return state.projects
    .filter((project) => isClientProjectVisible(project, clientId, actor))
    .map((project) => createTeamWorksClientProjectDetail(state, clientId, project.id, actor))
    .filter((detail): detail is ClientProjectDetailView => detail !== null)
    .sort((a, b) => b.project.updatedAt.localeCompare(a.project.updatedAt));
}

export function createTeamWorksClientProjectDetail(
  state: TeamWorksProjectStoreState,
  clientId: string,
  projectId: string,
  actor?: ClientPortalActor
): ClientProjectDetailView | null {
  const sourceProject = state.projects.find((project) => project.id === projectId);
  if (!sourceProject || !isClientProjectVisible(sourceProject, clientId, actor)) return null;
  const portalMemberId = actor?.memberships.get(projectId)?.memberId ?? TEAM_WORKS_CLIENT_PORTAL_DEMO_MEMBER_ID;

  const phases = state.phases
    .filter((phase) => phase.projectId === projectId && phase.clientVisible)
    .sort((a, b) => a.position - b.position)
    .map<ClientProjectPhaseView>((phase) => ({
      id: phase.id,
      name: phase.name,
      description: phase.description,
      position: phase.position,
      status: phase.status,
      progressPercent: phase.progressPercent,
      startDate: phase.startDate,
      dueDate: phase.dueDate,
      completionCondition: phase.completionCondition
    }));
  const visiblePhaseIds = new Set(phases.map((phase) => phase.id));

  const tasks = state.tasks
    .filter((task) => task.projectId === projectId && task.clientVisible && visiblePhaseIds.has(task.phaseId))
    .map<ClientProjectTaskView>((task) => ({
      id: task.id,
      phaseId: task.phaseId,
      title: task.title,
      description: task.description,
      status: task.status,
      dueDate: task.dueDate,
      requiresClientAction: task.requiresClientAction
    }));
  const visibleTaskIds = new Set(tasks.map((task) => task.id));

  const deliverables = state.deliverables
    .filter((deliverable) =>
      deliverable.projectId === projectId
      && deliverable.clientVisible
      && clientDeliverableStatuses.has(deliverable.status)
      && visiblePhaseIds.has(deliverable.phaseId)
      && visibleTaskIds.has(deliverable.taskId)
    )
    .map<ClientProjectDeliverableView>((deliverable) => ({
      id: deliverable.id,
      phaseId: deliverable.phaseId,
      taskId: deliverable.taskId,
      title: deliverable.title,
      type: deliverable.type,
      url: deliverable.url,
      version: deliverable.version,
      status: deliverable.status,
      updatedAt: deliverable.updatedAt
    }));
  const visibleDeliverableIds = new Set(deliverables.map((deliverable) => deliverable.id));
  const resources = state.resources
    .filter((resource) => resource.projectId === projectId
      && ["client", "all"].includes(resource.audience))
    .map<ClientProjectResourceView>((resource) => ({
      id: resource.id,
      phaseId: resource.phaseId,
      taskId: resource.taskId,
      title: resource.title,
      type: resource.type,
      url: resource.url,
      memo: resource.memo
    }));
  const forms = state.forms
    .filter((form) => {
      if (form.projectId !== projectId || !form.clientVisible) return false;
      const inputRole = state.projectRoles.find((role) => role.id === form.inputRoleId);
      return Boolean(inputRole?.name.includes("クライアント"));
    })
    .map<ClientProjectFormView>((form) => ({
      id: form.id,
      name: form.name,
      required: form.required,
      dueOffsetDays: form.dueOffsetDays,
      editableAfterSubmit: form.editableAfterSubmit,
      fields: form.fields.map((field) => ({ ...field, options: [...field.options] })),
      submission: state.formSubmissions.find((submission) => submission.formId === form.id
        && submission.submittedByActor === "client"
        && submission.submittedById === portalMemberId) ?? null
    }));

  const comments = state.comments
    .filter((comment) =>
      comment.projectId === projectId
      && comment.audience === "client"
      && (comment.phaseId === null || visiblePhaseIds.has(comment.phaseId))
      && (comment.taskId === null || visibleTaskIds.has(comment.taskId))
      && (comment.deliverableId === null || visibleDeliverableIds.has(comment.deliverableId))
    )
    .map<ClientProjectCommentView>((comment) => ({
      id: comment.id,
      phaseId: comment.phaseId,
      taskId: comment.taskId,
      deliverableId: comment.deliverableId,
      authorLabel: comment.authorMemberId === portalMemberId ? "あなた" : "制作チーム",
      body: comment.body,
      createdAt: comment.createdAt
    }));

  const actions: ClientProjectAction[] = tasks
    .filter((task) => task.requiresClientAction && !completedTaskStatuses.has(task.status))
    .map((task) => ({
      id: task.id,
      kind: "task" as const,
      title: task.title,
      helper: taskActionHelper(task.status),
      dueDate: task.dueDate
    }));

  forms.filter((form) => !form.submission || ["draft", "revision_requested"].includes(form.submission.status)).forEach((form) => actions.push({
    id: form.id,
    kind: "form",
    title: form.name,
    helper: form.submission?.status === "revision_requested" ? "修正内容を確認して再提出してください" : "フォームを入力して提出してください",
    dueDate: ""
  }));

  deliverables
    .filter((deliverable) => deliverable.status === "client_review")
    .forEach((deliverable) => actions.push({
      id: deliverable.id,
      kind: "deliverable",
      title: deliverable.title,
      helper: "内容を確認してください",
      dueDate: ""
    }));

  if (sourceProject.status === "client_review" && actions.length === 0) {
    actions.push({
      id: sourceProject.id,
      kind: "project",
      title: `${sourceProject.name}の内容を確認する`,
      helper: "プロジェクト全体が確認待ちです",
      dueDate: sourceProject.dueDate
    });
  }

  actions.sort((a, b) => sortDate(a.dueDate).localeCompare(sortDate(b.dueDate)));
  const currentPhase = phases.find((phase) => phase.status !== "completed") ?? phases.at(-1);
  const reviewDeliverables = deliverables.filter((deliverable) => ["client_review", "revision_requested"].includes(deliverable.status));
  const approvedDeliverables = deliverables.filter((deliverable) => ["approved", "delivered"].includes(deliverable.status));

  return {
    project: {
      id: sourceProject.id,
      name: sourceProject.name,
      description: sourceProject.description,
      goal: sourceProject.goal,
      status: sourceProject.status,
      startDate: sourceProject.startDate,
      dueDate: sourceProject.dueDate,
      progressPercent: sourceProject.progressPercent,
      currentPhaseName: currentPhase?.name ?? "未設定",
      actionCount: actions.length,
      reviewDeliverableCount: reviewDeliverables.length,
      approvedDeliverableCount: approvedDeliverables.length,
      updatedAt: sourceProject.updatedAt
    },
    phases,
    tasks,
    deliverables,
    resources,
    forms,
    comments,
    actions,
    reviewDeliverables,
    approvedDeliverables
  };
}

function isClientProjectVisible(project: TeamWorksProjectStoreState["projects"][number], clientId: string, actor?: ClientPortalActor) {
  const belongsToClient = actor ? actor.memberships.has(project.id) : project.clientId === clientId;
  return belongsToClient && project.clientVisible && project.status !== "draft";
}

function taskActionHelper(status: ProjectTaskStatus) {
  if (status === "client_response_pending") return "回答をお待ちしています";
  if (status === "revision_requested") return "修正内容をご確認ください";
  return "対応内容をご確認ください";
}

function sortDate(value: string) {
  return value || "9999-12-31";
}
