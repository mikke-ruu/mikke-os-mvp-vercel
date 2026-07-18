export type ManagerAppKey = "manager" | "marketnote" | "order" | "session" | "event" | "fund" | "team_works";
export type ManagerItemKind = "schedule" | "task" | "progress" | "history";
export type ManagerUrgency = "overdue" | "today" | "week" | "later" | "unscheduled";
export type ManagerProgressStatus = "not_started" | "active" | "waiting" | "completed" | "on_hold" | "cancelled";
export type ManagerSourceType = "personal_event" | "event" | "application" | "booking" | "project" | "plan" | "support" | "task" | "log";

export type ManagerSource = {
  appKey: ManagerAppKey;
  sourceType: ManagerSourceType;
  sourceId: string;
  sourceGroupId?: string;
  href: string;
};

export type ManagerItem = {
  id: string;
  kind: ManagerItemKind;
  title: string;
  description: string;
  dueAt: string | null;
  urgency: ManagerUrgency;
  status: ManagerProgressStatus;
  source: ManagerSource;
};

export type ManagerTask = ManagerItem & {
  kind: "task";
  priority: "low" | "normal" | "high";
  ownerLabel: string;
};

export type ManagerScheduleItem = ManagerItem & {
  kind: "schedule";
  startTime?: string;
  endTime?: string;
};

export type ManagerProgress = {
  id: string;
  title: string;
  description: string;
  progressPercent: number;
  status: ManagerProgressStatus;
  statusLabel: string;
  dueAt: string | null;
  urgency: ManagerUrgency;
  source: ManagerSource;
};

export type ManagerPersonalEvent = {
  id: string;
  title: string;
  note: string;
  date: string;
  startTime: string;
  endTime: string;
  createdAt: string;
  updatedAt: string;
};

export type ManagerPreferences = {
  defaultView: "dashboard" | "calendar" | "tasks" | "progress" | "history";
  showCompleted: boolean;
};

export type ManagerBridge = {
  schedules: ManagerScheduleItem[];
  tasks: ManagerTask[];
  progress: ManagerProgress[];
};

export type ManagerSnapshot = ManagerBridge & {
  personalEvents: ManagerPersonalEvent[];
};

export const managerAppLabels: Record<ManagerAppKey, string> = {
  manager: "Manager",
  marketnote: "MarketNote",
  order: "Order",
  session: "Session",
  event: "Event",
  fund: "Fund",
  team_works: "Team Works"
};
