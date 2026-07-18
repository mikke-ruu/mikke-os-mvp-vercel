import {
  projectStatusLabels,
  projectTaskPriorityLabels,
  projectTaskStatusLabels,
  type ProjectStatus,
  type ProjectTaskPriority,
  type ProjectTaskStatus,
  type TeamWorksProjectStoreState
} from "@/lib/team-works-projects";

export type TeamWorksManagerItemKind = "schedule" | "task" | "progress";
export type TeamWorksManagerUrgency = "overdue" | "today" | "week" | "later" | "unscheduled";
export type TeamWorksManagerProgressStatus = "not_started" | "active" | "waiting" | "completed" | "on_hold";

export type TeamWorksManagerSource = {
  appKey: "team_works";
  sourceType: "project" | "task";
  sourceId: string;
  sourceGroupId: string;
  href: string;
};

export type TeamWorksManagerItem = {
  id: string;
  kind: TeamWorksManagerItemKind;
  title: string;
  description: string;
  dueAt: string | null;
  urgency: TeamWorksManagerUrgency;
  status: TeamWorksManagerProgressStatus;
  source: TeamWorksManagerSource;
};

export type TeamWorksManagerTask = TeamWorksManagerItem & {
  kind: "task";
  priority: ProjectTaskPriority;
  priorityLabel: string;
  assigneeName: string;
};

export type TeamWorksManagerProgress = {
  id: string;
  title: string;
  description: string;
  progressPercent: number;
  status: TeamWorksManagerProgressStatus;
  statusLabel: string;
  dueAt: string | null;
  urgency: TeamWorksManagerUrgency;
  openTaskCount: number;
  waitingTaskCount: number;
  source: TeamWorksManagerSource;
};

export type TeamWorksManagerBridge = {
  items: TeamWorksManagerItem[];
  tasks: TeamWorksManagerTask[];
  progress: TeamWorksManagerProgress[];
};

type CollectTeamWorksManagerBridgeOptions = {
  now?: Date;
};

const hiddenProjectStatuses: ProjectStatus[] = ["cancelled"];
const completedTaskStatuses: ProjectTaskStatus[] = ["completed", "approved"];
const waitingTaskStatuses: ProjectTaskStatus[] = ["client_response_pending", "internal_review_pending", "revision_requested"];

export function collectTeamWorksManagerBridge(
  state: TeamWorksProjectStoreState,
  options: CollectTeamWorksManagerBridgeOptions = {}
): TeamWorksManagerBridge {
  const now = options.now ?? new Date();
  const projects = state.projects.filter((project) => !hiddenProjectStatuses.includes(project.status));
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const memberNameById = new Map(state.projectMembers.map((member) => [member.id, member.displayName]));
  const tasks = state.tasks.filter((task) => projectById.has(task.projectId));

  const taskItems: TeamWorksManagerTask[] = tasks
    .filter((task) => !completedTaskStatuses.includes(task.status))
    .map((task) => {
      const project = projectById.get(task.projectId);
      return {
        id: `team_works_task:${task.id}`,
        kind: "task" as const,
        title: task.title,
        description: project ? `${project.name} / ${projectTaskStatusLabels[task.status]}` : projectTaskStatusLabels[task.status],
        dueAt: task.dueDate || null,
        urgency: classifyDueDate(task.dueDate, now),
        status: toManagerTaskStatus(task.status),
        priority: task.priority,
        priorityLabel: projectTaskPriorityLabels[task.priority],
        assigneeName: memberNameById.get(task.assigneeMemberId) ?? "未設定",
        source: createTaskSource(task.projectId, task.id)
      };
    })
    .sort((a, b) => compareManagerItems(a, b, now));

  const progress = projects
    .filter((project) => project.status !== "completed")
    .map<TeamWorksManagerProgress>((project) => {
      const projectTasks = tasks.filter((task) => task.projectId === project.id);
      return {
        id: `team_works_project:${project.id}`,
        title: project.name,
        description: projectStatusLabels[project.status],
        progressPercent: project.progressPercent,
        status: toManagerProjectStatus(project.status),
        statusLabel: projectStatusLabels[project.status],
        dueAt: project.dueDate || null,
        urgency: classifyDueDate(project.dueDate, now),
        openTaskCount: projectTasks.filter((task) => !completedTaskStatuses.includes(task.status)).length,
        waitingTaskCount: projectTasks.filter((task) => waitingTaskStatuses.includes(task.status)).length,
        source: createProjectSource(project.id)
      };
    })
    .sort((a, b) => compareDue(a.dueAt, b.dueAt, now) || b.progressPercent - a.progressPercent);

  const scheduleItems: TeamWorksManagerItem[] = projects
    .filter((project) => project.dueDate && project.status !== "completed")
    .map((project) => ({
      id: `team_works_project_due:${project.id}`,
      kind: "schedule" as const,
      title: `${project.name}の納期`,
      description: projectStatusLabels[project.status],
      dueAt: project.dueDate,
      urgency: classifyDueDate(project.dueDate, now),
      status: toManagerProjectStatus(project.status),
      source: createProjectSource(project.id)
    }))
    .sort((a, b) => compareManagerItems(a, b, now));

  return {
    items: [...scheduleItems, ...taskItems].sort((a, b) => compareManagerItems(a, b, now)),
    tasks: taskItems,
    progress
  };
}

function createProjectSource(projectId: string): TeamWorksManagerSource {
  return {
    appKey: "team_works",
    sourceType: "project",
    sourceId: projectId,
    sourceGroupId: `team_works_project:${projectId}`,
    href: `/apps/team-works/projects/${projectId}`
  };
}

function createTaskSource(projectId: string, taskId: string): TeamWorksManagerSource {
  return {
    appKey: "team_works",
    sourceType: "task",
    sourceId: taskId,
    sourceGroupId: `team_works_project:${projectId}`,
    href: `/apps/team-works/projects/${projectId}`
  };
}

function toManagerProjectStatus(status: ProjectStatus): TeamWorksManagerProgressStatus {
  if (status === "completed") return "completed";
  if (status === "on_hold") return "on_hold";
  if (status === "draft" || status === "preparing") return "not_started";
  if (status === "client_review" || status === "internal_review") return "waiting";
  return "active";
}

function toManagerTaskStatus(status: ProjectTaskStatus): TeamWorksManagerProgressStatus {
  if (completedTaskStatuses.includes(status)) return "completed";
  if (status === "on_hold") return "on_hold";
  if (status === "not_started") return "not_started";
  if (waitingTaskStatuses.includes(status)) return "waiting";
  return "active";
}

function classifyDueDate(value: string, now: Date): TeamWorksManagerUrgency {
  if (!value) return "unscheduled";
  const due = parseDate(value);
  const today = startOfDay(now);
  const diffDays = Math.floor((due.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "today";
  if (diffDays <= 7) return "week";
  return "later";
}

function compareManagerItems(a: TeamWorksManagerItem, b: TeamWorksManagerItem, now: Date) {
  return compareDue(a.dueAt, b.dueAt, now) || urgencyRank(a.urgency) - urgencyRank(b.urgency) || a.title.localeCompare(b.title, "ja");
}

function compareDue(a: string | null, b: string | null, now: Date) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return parseDate(a).getTime() - parseDate(b).getTime() || urgencyRank(classifyDueDate(a, now)) - urgencyRank(classifyDueDate(b, now));
}

function urgencyRank(urgency: TeamWorksManagerUrgency) {
  if (urgency === "overdue") return 0;
  if (urgency === "today") return 1;
  if (urgency === "week") return 2;
  if (urgency === "later") return 3;
  return 4;
}

function parseDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}
