import type {
  ProjectDeliverableStatus,
  ProjectPhaseStatus,
  ProjectStatus,
  ProjectTaskPriority,
  ProjectTaskStatus,
  TeamWorksProjectStoreState
} from "./team-works-projects";

export const TEAM_WORKS_WORKER_PORTAL_DEMO_WORKER_ID = "worker_hanako";

const completedTaskStatuses = new Set<ProjectTaskStatus>(["approved", "completed"]);

export type WorkerProjectSummary = {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  startDate: string;
  dueDate: string;
  progressPercent: number;
  currentPhaseName: string;
  assignedTaskCount: number;
  actionCount: number;
  delayedTaskCount: number;
  updatedAt: string;
};

export type WorkerProjectPhaseView = {
  id: string;
  name: string;
  description: string;
  position: number;
  status: ProjectPhaseStatus;
  progressPercent: number;
  dueDate: string;
  ownedByWorker: boolean;
};

export type WorkerProjectTaskView = {
  id: string;
  phaseId: string;
  title: string;
  description: string;
  status: ProjectTaskStatus;
  priority: ProjectTaskPriority;
  dueDate: string;
  requiresDeliverable: boolean;
  requiresApproval: boolean;
  completedAt: string | null;
};

export type WorkerProjectDeliverableView = {
  id: string;
  taskId: string;
  title: string;
  type: "url" | "file_placeholder" | "note";
  url: string;
  version: number;
  status: ProjectDeliverableStatus;
  clientVisible: boolean;
  updatedAt: string;
};

export type WorkerProjectCommentView = {
  id: string;
  taskId: string | null;
  deliverableId: string | null;
  authorLabel: string;
  audience: "internal" | "client";
  body: string;
  createdAt: string;
};

export type WorkerProjectResourceView = {
  id: string;
  phaseId: string;
  taskId: string | null;
  title: string;
  type: "url" | "note";
  url: string;
  memo: string;
};

export type WorkerProjectDetailView = {
  project: WorkerProjectSummary;
  memberId: string;
  memberName: string;
  phases: WorkerProjectPhaseView[];
  tasks: WorkerProjectTaskView[];
  deliverables: WorkerProjectDeliverableView[];
  resources: WorkerProjectResourceView[];
  comments: WorkerProjectCommentView[];
};

export function createTeamWorksWorkerProjectList(state: TeamWorksProjectStoreState, workerId: string) {
  return state.projects
    .map((project) => createTeamWorksWorkerProjectDetail(state, workerId, project.id))
    .filter((detail): detail is WorkerProjectDetailView => detail !== null)
    .sort((a, b) => b.project.updatedAt.localeCompare(a.project.updatedAt));
}

export function createTeamWorksWorkerProjectDetail(
  state: TeamWorksProjectStoreState,
  workerId: string,
  projectId: string
): WorkerProjectDetailView | null {
  const sourceProject = state.projects.find((project) => project.id === projectId);
  if (!sourceProject || ["draft", "cancelled"].includes(sourceProject.status)) return null;

  const member = state.projectMembers.find((item) => item.projectId === projectId && item.organizationMemberId === workerId);
  if (!member) return null;

  const tasks = state.tasks
    .filter((task) => task.projectId === projectId && task.assigneeMemberId === member.id)
    .map<WorkerProjectTaskView>((task) => ({
      id: task.id,
      phaseId: task.phaseId,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      requiresDeliverable: task.requiresDeliverable,
      requiresApproval: task.requiresApproval,
      completedAt: task.completedAt
    }));
  const taskIds = new Set(tasks.map((task) => task.id));
  const assignedPhaseIds = new Set(tasks.map((task) => task.phaseId));

  const phases = state.phases
    .filter((phase) => phase.projectId === projectId && (phase.ownerMemberId === member.id || assignedPhaseIds.has(phase.id)))
    .sort((a, b) => a.position - b.position)
    .map<WorkerProjectPhaseView>((phase) => ({
      id: phase.id,
      name: phase.name,
      description: phase.description,
      position: phase.position,
      status: phase.status,
      progressPercent: phase.progressPercent,
      dueDate: phase.dueDate,
      ownedByWorker: phase.ownerMemberId === member.id
    }));

  const deliverables = state.deliverables
    .filter((deliverable) => deliverable.projectId === projectId && taskIds.has(deliverable.taskId))
    .map<WorkerProjectDeliverableView>((deliverable) => ({
      id: deliverable.id,
      taskId: deliverable.taskId,
      title: deliverable.title,
      type: deliverable.type,
      url: deliverable.url,
      version: deliverable.version,
      status: deliverable.status,
      clientVisible: deliverable.clientVisible,
      updatedAt: deliverable.updatedAt
    }));
  const deliverableIds = new Set(deliverables.map((deliverable) => deliverable.id));
  const resources = state.resources
    .filter((resource) => resource.projectId === projectId
      && ["members", "all"].includes(resource.audience))
    .map<WorkerProjectResourceView>((resource) => ({
      id: resource.id,
      phaseId: resource.phaseId,
      taskId: resource.taskId,
      title: resource.title,
      type: resource.type,
      url: resource.url,
      memo: resource.memo
    }));

  const comments = state.comments
    .filter((comment) => comment.projectId === projectId
      && (comment.taskId === null || taskIds.has(comment.taskId))
      && (comment.deliverableId === null || deliverableIds.has(comment.deliverableId)))
    .map<WorkerProjectCommentView>((comment) => ({
      id: comment.id,
      taskId: comment.taskId,
      deliverableId: comment.deliverableId,
      authorLabel: state.projectMembers.find((projectMember) => projectMember.id === comment.authorMemberId)?.displayName
        ?? (comment.authorMemberId.startsWith("client_") ? "クライアント" : "チームメンバー"),
      audience: comment.audience,
      body: comment.body,
      createdAt: comment.createdAt
    }));

  const actionTaskCount = tasks.filter((task) => !completedTaskStatuses.has(task.status)).length;
  const actionDeliverableCount = deliverables.filter((deliverable) => ["draft", "revision_requested"].includes(deliverable.status)).length;
  const delayedTaskCount = tasks.filter((task) => isDelayedTask(task)).length;
  const currentPhase = phases.find((phase) => phase.status !== "completed") ?? phases.at(-1);

  return {
    project: {
      id: sourceProject.id,
      name: sourceProject.name,
      description: sourceProject.description,
      status: sourceProject.status,
      startDate: sourceProject.startDate,
      dueDate: sourceProject.dueDate,
      progressPercent: sourceProject.progressPercent,
      currentPhaseName: currentPhase?.name ?? "未設定",
      assignedTaskCount: tasks.length,
      actionCount: actionTaskCount + actionDeliverableCount,
      delayedTaskCount,
      updatedAt: sourceProject.updatedAt
    },
    memberId: member.id,
    memberName: member.displayName,
    phases,
    tasks,
    deliverables,
    resources,
    comments
  };
}

function isDelayedTask(task: WorkerProjectTaskView) {
  if (!task.dueDate || completedTaskStatuses.has(task.status)) return false;
  return new Date(`${task.dueDate}T23:59:59`).getTime() < Date.now();
}
