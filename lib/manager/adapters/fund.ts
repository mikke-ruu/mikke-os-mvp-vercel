import {
  fundFulfillmentStatusLabels,
  fundProjectStatusLabels,
  type FundPlan,
  type FundProject,
  type FundSupport
} from "@/lib/fund/types";
import type { ManagerBridge, ManagerProgress, ManagerProgressStatus, ManagerScheduleItem, ManagerTask } from "../types";
import { classifyManagerDueDate, compareManagerDue, compareManagerItems, progressFromStatus } from "./utils";

const hiddenProjectStatuses = ["cancelled", "archived"];
const completedProjectStatuses = ["completed", "cancelled", "archived"];
const completedFulfillmentStatuses = ["completed", "cancelled", "not_required"];

export function collectFundManagerBridge(projects: FundProject[], plans: FundPlan[], supports: FundSupport[], now = new Date()): ManagerBridge {
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const planById = new Map(plans.map((plan) => [plan.id, plan]));

  const schedules: ManagerScheduleItem[] = [
    ...projects
      .filter((project) => project.endAt && !hiddenProjectStatuses.includes(project.status))
      .map((project) => ({
        id: `fund_project_end:${project.id}`,
        kind: "schedule" as const,
        title: `${project.title}の募集終了`,
        description: fundProjectStatusLabels[project.status],
        dueAt: project.endAt || null,
        urgency: classifyManagerDueDate(project.endAt, now),
        status: toProjectManagerStatus(project.status),
        source: {
          appKey: "fund" as const,
          sourceType: "project" as const,
          sourceId: project.id,
          href: `/apps/fund/${project.id}/edit`
        }
      })),
    ...plans
      .filter((plan) => plan.deliveryDate && plan.status !== "hidden")
      .map((plan) => {
        const project = projectById.get(plan.projectId);
        return {
          id: `fund_plan_delivery:${plan.id}`,
          kind: "schedule" as const,
          title: `${plan.title}の提供予定`,
          description: project ? project.title : "Fund",
          dueAt: plan.deliveryDate || null,
          urgency: classifyManagerDueDate(plan.deliveryDate, now),
          status: plan.status === "closed" ? "completed" as const : "active" as const,
          source: {
            appKey: "fund" as const,
            sourceType: "plan" as const,
            sourceId: plan.id,
            sourceGroupId: plan.projectId,
            href: `/apps/fund/${plan.projectId}/edit`
          }
        };
      })
  ].sort((a, b) => compareManagerItems(a, b, now));

  const tasks: ManagerTask[] = supports
    .filter((support) => support.recordStatus === "valid" && !completedFulfillmentStatuses.includes(support.fulfillmentStatus))
    .map((support) => {
      const project = projectById.get(support.projectId);
      const plan = planById.get(support.planId);
      return {
        id: `fund_support_task:${support.id}`,
        kind: "task" as const,
        title: `${support.supporterName || "支援者"}さんへの提供対応`,
        description: `${project?.title ?? "Fund"}${plan ? ` / ${plan.title}` : ""} / ${fundFulfillmentStatusLabels[support.fulfillmentStatus]}`,
        dueAt: plan?.deliveryDate || null,
        urgency: classifyManagerDueDate(plan?.deliveryDate, now),
        status: toFulfillmentManagerStatus(support.fulfillmentStatus),
        priority: support.fulfillmentStatus === "waiting" ? "high" as const : "normal" as const,
        ownerLabel: "Fund",
        source: {
          appKey: "fund" as const,
          sourceType: "support" as const,
          sourceId: support.id,
          sourceGroupId: support.projectId,
          href: `/apps/fund/${support.projectId}/supporters`
        }
      };
    })
    .sort((a, b) => compareManagerItems(a, b, now));

  const progress: ManagerProgress[] = projects
    .filter((project) => !hiddenProjectStatuses.includes(project.status))
    .map((project) => ({
      id: `fund_project_progress:${project.id}`,
      title: project.title,
      description: fundProjectStatusLabels[project.status],
      progressPercent: progressFromStatus(project.status),
      status: toProjectManagerStatus(project.status),
      statusLabel: fundProjectStatusLabels[project.status],
      dueAt: project.endAt || null,
      urgency: classifyManagerDueDate(project.endAt, now),
      source: {
        appKey: "fund" as const,
        sourceType: "project" as const,
        sourceId: project.id,
        href: `/apps/fund/${project.id}/edit`
      }
    }))
    .sort((a, b) => compareManagerDue(a.dueAt, b.dueAt, now));

  return { schedules, tasks, progress };
}

function toProjectManagerStatus(status: FundProject["status"]): ManagerProgressStatus {
  if (completedProjectStatuses.includes(status)) return "completed";
  if (status === "postponed") return "on_hold";
  if (status === "draft" || status === "interest_open" || status === "ready") return "not_started";
  return "active";
}

function toFulfillmentManagerStatus(status: FundSupport["fulfillmentStatus"]): ManagerProgressStatus {
  if (status === "completed" || status === "not_required") return "completed";
  if (status === "cancelled") return "cancelled";
  if (status === "on_hold") return "on_hold";
  if (status === "waiting") return "waiting";
  return "active";
}
