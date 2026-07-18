import { applicationStatusLabels, eventStatusLabels, type EventApplication, type MikkeEvent } from "@/lib/event/types";
import type { ManagerBridge, ManagerProgress, ManagerProgressStatus, ManagerScheduleItem, ManagerTask } from "../types";
import { classifyManagerDueDate, compareManagerDue, compareManagerItems, progressFromStatus } from "./utils";

const completedApplicationStatuses = ["confirmed", "declined", "cancelled"];

export function collectEventManagerBridge(events: MikkeEvent[], applications: EventApplication[], now = new Date()): ManagerBridge {
  const eventById = new Map(events.map((event) => [event.id, event]));

  const schedules: ManagerScheduleItem[] = events
    .filter((event) => event.status !== "cancelled")
    .map((event) => ({
      id: `event_schedule:${event.id}`,
      kind: "schedule" as const,
      title: event.title,
      description: eventStatusLabels[event.status],
      dueAt: event.eventDate || null,
      urgency: classifyManagerDueDate(event.eventDate, now),
      status: toEventManagerStatus(event.status),
      startTime: event.startTime,
      endTime: event.endTime,
      source: {
        appKey: "event" as const,
        sourceType: "event" as const,
        sourceId: event.id,
        href: `/event/admin/${event.id}`
      }
    }))
    .sort((a, b) => compareManagerItems(a, b, now));

  const tasks: ManagerTask[] = applications
    .filter((application) => !completedApplicationStatuses.includes(application.status))
    .map((application) => {
      const event = eventById.get(application.eventId);
      return {
        id: `event_application_task:${application.id}`,
        kind: "task" as const,
        title: `${application.applicantName || "申込者"}さんの出店申込確認`,
        description: event ? `${event.title} / ${applicationStatusLabels[application.status]}` : applicationStatusLabels[application.status],
        dueAt: event?.eventDate ?? null,
        urgency: classifyManagerDueDate(event?.eventDate, now),
        status: toApplicationManagerStatus(application.status),
        priority: application.status === "submitted" ? "high" as const : "normal" as const,
        ownerLabel: "Event",
        source: {
          appKey: "event" as const,
          sourceType: "application" as const,
          sourceId: application.id,
          sourceGroupId: application.eventId,
          href: `/event/admin/${application.eventId}/applications`
        }
      };
    })
    .sort((a, b) => compareManagerItems(a, b, now));

  const progress: ManagerProgress[] = events
    .filter((event) => event.status !== "cancelled")
    .map((event) => ({
      id: `event_progress:${event.id}`,
      title: event.title,
      description: eventStatusLabels[event.status],
      progressPercent: progressFromStatus(event.status),
      status: toEventManagerStatus(event.status),
      statusLabel: eventStatusLabels[event.status],
      dueAt: event.eventDate || null,
      urgency: classifyManagerDueDate(event.eventDate, now),
      source: {
        appKey: "event" as const,
        sourceType: "event" as const,
        sourceId: event.id,
        href: `/event/admin/${event.id}`
      }
    }))
    .sort((a, b) => compareManagerDue(a.dueAt, b.dueAt, now));

  return { schedules, tasks, progress };
}

function toEventManagerStatus(status: MikkeEvent["status"]): ManagerProgressStatus {
  if (status === "finished") return "completed";
  if (status === "cancelled") return "cancelled";
  if (status === "draft") return "not_started";
  return "active";
}

function toApplicationManagerStatus(status: EventApplication["status"]): ManagerProgressStatus {
  if (status === "confirmed") return "completed";
  if (status === "declined" || status === "cancelled") return "cancelled";
  if (status === "reviewing") return "active";
  return "waiting";
}
