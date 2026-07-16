"use client";

import { useEffect, useState } from "react";

export type ProjectStatus =
  | "draft"
  | "preparing"
  | "in_progress"
  | "client_review"
  | "internal_review"
  | "on_hold"
  | "delivery_preparation"
  | "completed"
  | "cancelled";

export type ProjectPhaseStatus = "not_started" | "in_progress" | "review_pending" | "revising" | "completed" | "on_hold";

export type ProjectTaskStatus =
  | "not_started"
  | "in_progress"
  | "client_response_pending"
  | "internal_review_pending"
  | "revision_requested"
  | "approved"
  | "completed"
  | "on_hold";

export type ProjectTaskPriority = "low" | "normal" | "high" | "urgent";

export type ProjectDeliverableStatus =
  | "draft"
  | "submitted"
  | "internal_review"
  | "client_review"
  | "revision_requested"
  | "approved"
  | "delivered";

export type ProjectCommentAudience = "internal" | "client";
export type ProjectTemplateStatus = "draft" | "active" | "archived";

export const projectStatusLabels: Record<ProjectStatus, string> = {
  draft: "下書き",
  preparing: "準備中",
  in_progress: "進行中",
  client_review: "クライアント確認待ち",
  internal_review: "制作側確認待ち",
  on_hold: "保留",
  delivery_preparation: "納品準備中",
  completed: "完了",
  cancelled: "キャンセル"
};

export const projectPhaseStatusLabels: Record<ProjectPhaseStatus, string> = {
  not_started: "未着手",
  in_progress: "進行中",
  review_pending: "確認待ち",
  revising: "修正中",
  completed: "完了",
  on_hold: "保留"
};

export const projectTaskStatusLabels: Record<ProjectTaskStatus, string> = {
  not_started: "未着手",
  in_progress: "対応中",
  client_response_pending: "クライアント回答待ち",
  internal_review_pending: "制作側確認待ち",
  revision_requested: "修正依頼",
  approved: "承認済み",
  completed: "完了",
  on_hold: "保留"
};

export const projectTaskPriorityLabels: Record<ProjectTaskPriority, string> = {
  low: "低",
  normal: "通常",
  high: "高",
  urgent: "緊急"
};

export const projectDeliverableStatusLabels: Record<ProjectDeliverableStatus, string> = {
  draft: "下書き",
  submitted: "提出済み",
  internal_review: "制作側確認中",
  client_review: "クライアント確認中",
  revision_requested: "修正依頼",
  approved: "承認済み",
  delivered: "納品済み"
};

export type Project = {
  id: string;
  organizationId: string;
  clientId: string;
  name: string;
  description: string;
  goal: string;
  status: ProjectStatus;
  startDate: string;
  dueDate: string;
  budget: number | null;
  leaderMemberId: string;
  templateId: string | null;
  templateVersionId: string | null;
  progressPercent: number;
  clientVisible: boolean;
  memo: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectRole = {
  id: string;
  projectId: string;
  name: string;
  description: string;
  createdAt: string;
};

export type ProjectMember = {
  id: string;
  projectId: string;
  organizationMemberId: string;
  displayName: string;
  projectRoleId: string;
  joinedAt: string;
};

export type ProjectPhase = {
  id: string;
  projectId: string;
  name: string;
  description: string;
  position: number;
  status: ProjectPhaseStatus;
  weight: number;
  progressPercent: number;
  startDate: string;
  dueDate: string;
  ownerMemberId: string;
  startCondition: string;
  completionCondition: string;
  clientVisible: boolean;
};

export type ProjectTaskCheckItem = {
  id: string;
  taskId: string;
  label: string;
  completed: boolean;
  position: number;
};

export type ProjectTask = {
  id: string;
  projectId: string;
  phaseId: string;
  title: string;
  description: string;
  status: ProjectTaskStatus;
  priority: ProjectTaskPriority;
  assigneeMemberId: string;
  dueDate: string;
  requiresDeliverable: boolean;
  requiresApproval: boolean;
  requiresClientAction: boolean;
  clientVisible: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectForm = {
  id: string;
  projectId: string;
  phaseId: string;
  taskId: string | null;
  name: string;
  inputRoleId: string;
  reviewerRoleId: string;
  required: boolean;
  clientVisible: boolean;
};

export type ProjectDeliverable = {
  id: string;
  projectId: string;
  phaseId: string;
  taskId: string;
  title: string;
  type: "url" | "file_placeholder" | "note";
  url: string;
  version: number;
  status: ProjectDeliverableStatus;
  submittedByMemberId: string;
  reviewedByMemberId: string;
  clientVisible: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProjectComment = {
  id: string;
  projectId: string;
  phaseId: string | null;
  taskId: string | null;
  deliverableId: string | null;
  authorMemberId: string;
  audience: ProjectCommentAudience;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectTemplatePhase = {
  id: string;
  name: string;
  description: string;
  position: number;
  standardDays: number;
  weight: number;
  required: boolean;
  ownerRoleName: string;
  startCondition: string;
  completionCondition: string;
  clientVisible: boolean;
};

export type ProjectTemplateTask = {
  id: string;
  phaseId: string;
  title: string;
  description: string;
  position: number;
  standardOffsetDays: number;
  priority: ProjectTaskPriority;
  required: boolean;
  assigneeRoleName: string;
  checklist: string[];
  requiresDeliverable: boolean;
  requiresApproval: boolean;
  requiresClientAction: boolean;
  clientVisible: boolean;
};

export type ProjectTemplateForm = {
  id: string;
  phaseId: string;
  taskId: string | null;
  name: string;
  inputRoleName: string;
  reviewerRoleName: string;
  required: boolean;
  clientVisible: boolean;
};

export type ProjectTemplate = {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  status: ProjectTemplateStatus;
  standardDurationDays: number;
  roleNames: string[];
  phases: ProjectTemplatePhase[];
  tasks: ProjectTemplateTask[];
  forms: ProjectTemplateForm[];
  featureSettings: {
    clientPortal: boolean;
    deliverables: boolean;
    comments: boolean;
    payouts: boolean;
    invoices: boolean;
  };
  currentVersionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectTemplateVersion = {
  id: string;
  templateId: string;
  version: number;
  snapshot: Omit<ProjectTemplate, "currentVersionId" | "createdAt" | "updatedAt">;
  createdByMemberId: string;
  createdAt: string;
};

export type TeamWorksProjectStoreState = {
  projects: Project[];
  projectRoles: ProjectRole[];
  projectMembers: ProjectMember[];
  phases: ProjectPhase[];
  tasks: ProjectTask[];
  taskCheckItems: ProjectTaskCheckItem[];
  forms: ProjectForm[];
  deliverables: ProjectDeliverable[];
  comments: ProjectComment[];
};

export type TeamWorksProjectTemplateStoreState = {
  templates: ProjectTemplate[];
  versions: ProjectTemplateVersion[];
};

export const TEAM_WORKS_PROJECTS_STORAGE_KEY = "mikke.team-works.projects.v1";
export const TEAM_WORKS_PROJECT_TEMPLATES_STORAGE_KEY = "mikke.team-works.project-templates.v1";
export const TEAM_WORKS_PROJECTS_UPDATED_EVENT = "mikke-team-works-projects:updated";

const demoCreatedAt = "2026-07-16T00:00:00.000Z";
const demoProjectId = "team_works_project_demo_1";

export const teamWorksProjectDemoState: TeamWorksProjectStoreState = {
  projects: [
    {
      id: demoProjectId,
      organizationId: "org_team_works_demo",
      clientId: "client_sakura",
      name: "サンプル制作案件",
      description: "工程・担当・進捗の操作を確認するための、業種に依存しないデモ案件です。",
      goal: "依頼内容を整理し、制作物を確認して納品する",
      status: "in_progress",
      startDate: "2026-07-14",
      dueDate: "2026-08-14",
      budget: null,
      leaderMemberId: "project_member_demo_leader",
      templateId: null,
      templateVersionId: null,
      progressPercent: 50,
      clientVisible: true,
      memo: "実在する案件や個人情報は含みません。",
      createdAt: demoCreatedAt,
      updatedAt: demoCreatedAt
    }
  ],
  projectRoles: [
    {
      id: "project_role_demo_leader",
      projectId: demoProjectId,
      name: "プロジェクトリーダー",
      description: "全体の進行と確認を担当します。",
      createdAt: demoCreatedAt
    },
    {
      id: "project_role_demo_creator",
      projectId: demoProjectId,
      name: "制作担当",
      description: "割り当てられた制作タスクを担当します。",
      createdAt: demoCreatedAt
    }
  ],
  projectMembers: [
    {
      id: "project_member_demo_leader",
      projectId: demoProjectId,
      organizationMemberId: "worker_hanako",
      displayName: "進行担当",
      projectRoleId: "project_role_demo_leader",
      joinedAt: demoCreatedAt
    },
    {
      id: "project_member_demo_creator",
      projectId: demoProjectId,
      organizationMemberId: "worker_ichiro",
      displayName: "制作担当",
      projectRoleId: "project_role_demo_creator",
      joinedAt: demoCreatedAt
    }
  ],
  phases: [
    {
      id: "project_phase_demo_discovery",
      projectId: demoProjectId,
      name: "要件整理",
      description: "目的・範囲・確認方法を整理します。",
      position: 0,
      status: "completed",
      weight: 30,
      progressPercent: 100,
      startDate: "2026-07-14",
      dueDate: "2026-07-20",
      ownerMemberId: "project_member_demo_leader",
      startCondition: "プロジェクトを開始できる状態になったら",
      completionCondition: "目的・範囲・確認方法が合意できたら",
      clientVisible: true
    },
    {
      id: "project_phase_demo_production",
      projectId: demoProjectId,
      name: "制作",
      description: "合意した内容に沿って制作します。",
      position: 1,
      status: "in_progress",
      weight: 40,
      progressPercent: 50,
      startDate: "2026-07-21",
      dueDate: "2026-08-05",
      ownerMemberId: "project_member_demo_creator",
      startCondition: "要件整理が完了したら",
      completionCondition: "確認用の初稿が完成したら",
      clientVisible: true
    },
    {
      id: "project_phase_demo_delivery",
      projectId: demoProjectId,
      name: "確認・納品",
      description: "完成内容を確認し、必要な修正後に納品します。",
      position: 2,
      status: "not_started",
      weight: 30,
      progressPercent: 0,
      startDate: "2026-08-06",
      dueDate: "2026-08-14",
      ownerMemberId: "project_member_demo_leader",
      startCondition: "制作が完了したら",
      completionCondition: "完成内容の確認と納品が終わったら",
      clientVisible: true
    }
  ],
  tasks: [
    {
      id: "project_task_demo_scope",
      projectId: demoProjectId,
      phaseId: "project_phase_demo_discovery",
      title: "依頼内容を整理する",
      description: "目的と完成条件を確認します。",
      status: "completed",
      priority: "normal",
      assigneeMemberId: "project_member_demo_leader",
      dueDate: "2026-07-18",
      requiresDeliverable: false,
      requiresApproval: false,
      requiresClientAction: false,
      clientVisible: true,
      completedAt: "2026-07-18T00:00:00.000Z",
      createdAt: demoCreatedAt,
      updatedAt: "2026-07-18T00:00:00.000Z"
    },
    {
      id: "project_task_demo_draft",
      projectId: demoProjectId,
      phaseId: "project_phase_demo_production",
      title: "初稿を作成する",
      description: "確認用の初稿を作成します。",
      status: "in_progress",
      priority: "high",
      assigneeMemberId: "project_member_demo_creator",
      dueDate: "2026-07-30",
      requiresDeliverable: true,
      requiresApproval: true,
      requiresClientAction: false,
      clientVisible: true,
      completedAt: null,
      createdAt: demoCreatedAt,
      updatedAt: demoCreatedAt
    },
    {
      id: "project_task_demo_review",
      projectId: demoProjectId,
      phaseId: "project_phase_demo_delivery",
      title: "完成内容を確認する",
      description: "制作物を確認し、納品可否を決めます。",
      status: "not_started",
      priority: "normal",
      assigneeMemberId: "project_member_demo_leader",
      dueDate: "2026-08-10",
      requiresDeliverable: false,
      requiresApproval: true,
      requiresClientAction: true,
      clientVisible: true,
      completedAt: null,
      createdAt: demoCreatedAt,
      updatedAt: demoCreatedAt
    }
  ],
  taskCheckItems: [
    {
      id: "project_check_item_demo_1",
      taskId: "project_task_demo_scope",
      label: "目的を確認する",
      completed: true,
      position: 0
    },
    {
      id: "project_check_item_demo_2",
      taskId: "project_task_demo_scope",
      label: "完成条件を確認する",
      completed: true,
      position: 1
    }
  ],
  forms: [],
  deliverables: [],
  comments: []
};

export const emptyTeamWorksProjectTemplateState: TeamWorksProjectTemplateStoreState = {
  templates: [],
  versions: []
};

const phaseProgressByStatus: Record<ProjectPhaseStatus, number> = {
  not_started: 0,
  in_progress: 50,
  review_pending: 80,
  revising: 90,
  completed: 100,
  on_hold: 0
};

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isProjectStoreState(value: unknown): value is TeamWorksProjectStoreState {
  if (!isRecord(value)) return false;
  return ["projects", "projectRoles", "projectMembers", "phases", "tasks", "taskCheckItems", "deliverables", "comments"].every(
    (key) => Array.isArray(value[key])
  );
}

function isTemplateStoreState(value: unknown): value is TeamWorksProjectTemplateStoreState {
  return isRecord(value) && Array.isArray(value.templates) && Array.isArray(value.versions);
}

function readStorage<T>(key: string, fallback: T, validate: (value: unknown) => value is T): T {
  if (typeof window === "undefined") return cloneValue(fallback);
  const raw = window.localStorage.getItem(key);
  if (!raw) return cloneValue(fallback);
  try {
    const parsed: unknown = JSON.parse(raw);
    return validate(parsed) ? parsed : cloneValue(fallback);
  } catch {
    return cloneValue(fallback);
  }
}

function notifyProjectStoreUpdated() {
  window.dispatchEvent(new CustomEvent(TEAM_WORKS_PROJECTS_UPDATED_EVENT));
}

export function readTeamWorksProjectStore() {
  const state = readStorage(TEAM_WORKS_PROJECTS_STORAGE_KEY, teamWorksProjectDemoState, isProjectStoreState);
  return {
    ...state,
    projects: state.projects.map((project) => project.id === demoProjectId && project.clientId === "client_demo"
      ? { ...project, clientId: "client_sakura" }
      : project),
    forms: Array.isArray(state.forms) ? state.forms : []
  };
}

export function readTeamWorksProjectTemplateStore() {
  return readStorage(TEAM_WORKS_PROJECT_TEMPLATES_STORAGE_KEY, emptyTeamWorksProjectTemplateState, isTemplateStoreState);
}

export function writeTeamWorksProjectStore(state: TeamWorksProjectStoreState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TEAM_WORKS_PROJECTS_STORAGE_KEY, JSON.stringify(state));
  notifyProjectStoreUpdated();
}

export function writeTeamWorksProjectTemplateStore(state: TeamWorksProjectTemplateStoreState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TEAM_WORKS_PROJECT_TEMPLATES_STORAGE_KEY, JSON.stringify(state));
  notifyProjectStoreUpdated();
}

export function resetTeamWorksProjectStores() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TEAM_WORKS_PROJECTS_STORAGE_KEY);
  window.localStorage.removeItem(TEAM_WORKS_PROJECT_TEMPLATES_STORAGE_KEY);
  notifyProjectStoreUpdated();
}

export function createTeamWorksProjectId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function projectPhaseProgress(status: ProjectPhaseStatus, savedProgress = 0) {
  if (status === "on_hold") return Math.min(100, Math.max(0, savedProgress));
  return phaseProgressByStatus[status];
}

export function calculateProjectProgress(phases: ProjectPhase[]) {
  if (phases.length === 0) return 0;
  const totalWeight = phases.reduce((sum, phase) => sum + Math.max(0, phase.weight), 0);
  if (totalWeight === 0) {
    return Math.round(
      phases.reduce((sum, phase) => sum + projectPhaseProgress(phase.status, phase.progressPercent), 0) / phases.length
    );
  }
  const weightedProgress = phases.reduce(
    (sum, phase) => sum + projectPhaseProgress(phase.status, phase.progressPercent) * Math.max(0, phase.weight),
    0
  );
  return Math.round(weightedProgress / totalWeight);
}

export function useTeamWorksProjectStore() {
  const [projectState, setProjectState] = useState<TeamWorksProjectStoreState>(() => cloneValue(teamWorksProjectDemoState));
  const [templateState, setTemplateState] = useState<TeamWorksProjectTemplateStoreState>(() => cloneValue(emptyTeamWorksProjectTemplateState));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    function refresh() {
      setProjectState(readTeamWorksProjectStore());
      setTemplateState(readTeamWorksProjectTemplateStore());
      setHydrated(true);
    }

    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener(TEAM_WORKS_PROJECTS_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(TEAM_WORKS_PROJECTS_UPDATED_EVENT, refresh);
    };
  }, []);

  function saveProjectState(next: TeamWorksProjectStoreState) {
    writeTeamWorksProjectStore(next);
    setProjectState(next);
  }

  function saveTemplateState(next: TeamWorksProjectTemplateStoreState) {
    writeTeamWorksProjectTemplateStore(next);
    setTemplateState(next);
  }

  function reset() {
    resetTeamWorksProjectStores();
    setProjectState(cloneValue(teamWorksProjectDemoState));
    setTemplateState(cloneValue(emptyTeamWorksProjectTemplateState));
  }

  return {
    hydrated,
    projectState,
    templateState,
    saveProjectState,
    saveTemplateState,
    reset
  };
}
