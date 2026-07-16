import type {
  ProjectDeliverableStatus,
  ProjectPhaseStatus,
  ProjectStatus,
  ProjectTaskStatus,
  TeamWorksProjectStoreState
} from "./team-works-projects";

export const TEAM_WORKS_CLIENT_PORTAL_DEMO_CLIENT_ID = "client_sakura";

const clientDeliverableStatuses = new Set<ProjectDeliverableStatus>([
  "client_review",
  "revision_requested",
  "approved",
  "delivered"
]);

const completedTaskStatuses = new Set<ProjectTaskStatus>(["approved", "completed"]);

export type ClientProjectAction = {
  id: string;
  kind: "project" | "task" | "deliverable";
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
  actions: ClientProjectAction[];
  reviewDeliverables: ClientProjectDeliverableView[];
  approvedDeliverables: ClientProjectDeliverableView[];
};

export function createTeamWorksClientProjectList(state: TeamWorksProjectStoreState, clientId: string) {
  return state.projects
    .filter((project) => isClientProjectVisible(project, clientId))
    .map((project) => createTeamWorksClientProjectDetail(state, clientId, project.id))
    .filter((detail): detail is ClientProjectDetailView => detail !== null)
    .sort((a, b) => b.project.updatedAt.localeCompare(a.project.updatedAt));
}

export function createTeamWorksClientProjectDetail(
  state: TeamWorksProjectStoreState,
  clientId: string,
  projectId: string
): ClientProjectDetailView | null {
  const sourceProject = state.projects.find((project) => project.id === projectId);
  if (!sourceProject || !isClientProjectVisible(sourceProject, clientId)) return null;

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

  const actions: ClientProjectAction[] = tasks
    .filter((task) => task.requiresClientAction && !completedTaskStatuses.has(task.status))
    .map((task) => ({
      id: task.id,
      kind: "task" as const,
      title: task.title,
      helper: taskActionHelper(task.status),
      dueDate: task.dueDate
    }));

  deliverables
    .filter((deliverable) => ["client_review", "revision_requested"].includes(deliverable.status))
    .forEach((deliverable) => actions.push({
      id: deliverable.id,
      kind: "deliverable",
      title: deliverable.title,
      helper: deliverable.status === "client_review" ? "内容を確認してください" : "修正内容を確認してください",
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
    actions,
    reviewDeliverables,
    approvedDeliverables
  };
}

function isClientProjectVisible(project: TeamWorksProjectStoreState["projects"][number], clientId: string) {
  return project.clientId === clientId && project.clientVisible && project.status !== "draft";
}

function taskActionHelper(status: ProjectTaskStatus) {
  if (status === "client_response_pending") return "回答をお待ちしています";
  if (status === "revision_requested") return "修正内容をご確認ください";
  return "対応内容をご確認ください";
}

function sortDate(value: string) {
  return value || "9999-12-31";
}
