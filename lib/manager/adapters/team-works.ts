import { collectTeamWorksManagerBridge } from "@/lib/team-works-manager-adapter";
import type { TeamWorksProjectStoreState } from "@/lib/team-works-projects";
import type { ManagerBridge, ManagerProgress, ManagerScheduleItem, ManagerTask } from "../types";

export function collectTeamWorksManagerBridgeForManager(state: TeamWorksProjectStoreState, now = new Date()): ManagerBridge {
  const bridge = collectTeamWorksManagerBridge(state, { now });
  return {
    schedules: bridge.items.filter((item) => item.kind === "schedule").map((item) => item as ManagerScheduleItem),
    tasks: bridge.tasks.map((task): ManagerTask => ({
      ...task,
      priority: task.priority === "urgent" ? "high" : task.priority,
      ownerLabel: task.assigneeName
    })),
    progress: bridge.progress.map((item): ManagerProgress => ({
      id: item.id,
      title: item.title,
      description: item.description,
      progressPercent: item.progressPercent,
      status: item.status,
      statusLabel: item.statusLabel,
      dueAt: item.dueAt,
      urgency: item.urgency,
      source: item.source
    }))
  };
}
