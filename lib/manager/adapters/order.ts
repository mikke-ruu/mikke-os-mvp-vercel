import { orderApplicationStatusLabels, type OrderApplication, type OrderMenu } from "@/lib/order/types";
import type { ManagerBridge, ManagerProgressStatus, ManagerScheduleItem, ManagerTask } from "../types";
import { classifyManagerDueDate, compareManagerItems, progressFromStatus } from "./utils";

const completedStatuses = ["delivered", "declined"];

export function collectOrderManagerBridge(menus: OrderMenu[], applications: OrderApplication[], now = new Date()): ManagerBridge {
  const menuById = new Map(menus.map((menu) => [menu.id, menu]));

  const tasks: ManagerTask[] = applications
    .filter((application) => !completedStatuses.includes(application.status))
    .map((application) => {
      const menu = menuById.get(application.menuId);
      return {
        id: `order_application_task:${application.id}`,
        kind: "task" as const,
        title: `${application.applicantName || "申込者"}さんの依頼対応`,
        description: menu ? `${menu.title} / ${orderApplicationStatusLabels[application.status]}` : orderApplicationStatusLabels[application.status],
        dueAt: application.desiredDueDate || null,
        urgency: classifyManagerDueDate(application.desiredDueDate, now),
        status: toManagerStatus(application.status),
        priority: application.status === "new" ? "high" as const : "normal" as const,
        ownerLabel: "Order",
        source: {
          appKey: "order" as const,
          sourceType: "application" as const,
          sourceId: application.id,
          sourceGroupId: application.menuId,
          href: "/order/admin/applications"
        }
      };
    })
    .sort((a, b) => compareManagerItems(a, b, now));

  const schedules: ManagerScheduleItem[] = tasks
    .filter((task) => task.dueAt)
    .map((task) => ({
      ...task,
      id: `order_application_due:${task.source.sourceId}`,
      kind: "schedule" as const,
      title: `${task.title}の希望納期`
    }))
    .sort((a, b) => compareManagerItems(a, b, now));

  return { schedules, tasks, progress: [] };
}

function toManagerStatus(status: OrderApplication["status"]): ManagerProgressStatus {
  if (status === "delivered") return "completed";
  if (status === "declined") return "cancelled";
  if (status === "in_progress") return "active";
  return "waiting";
}

export function orderProgressPercent(status: OrderApplication["status"]) {
  return progressFromStatus(status);
}
