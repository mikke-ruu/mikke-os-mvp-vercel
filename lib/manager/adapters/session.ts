import { sessionBookingStatusLabels, type SessionBooking, type SessionMenu } from "@/lib/session/types";
import type { ManagerBridge, ManagerProgressStatus, ManagerScheduleItem, ManagerTask } from "../types";
import { classifyManagerDueDate, compareManagerItems } from "./utils";

const completedStatuses = ["completed", "cancelled"];

export function collectSessionManagerBridge(menus: SessionMenu[], bookings: SessionBooking[], now = new Date()): ManagerBridge {
  const menuById = new Map(menus.map((menu) => [menu.id, menu]));

  const schedules: ManagerScheduleItem[] = bookings
    .filter((booking) => booking.status !== "cancelled")
    .map((booking) => {
      const menu = menuById.get(booking.menuId);
      return {
        id: `session_booking_schedule:${booking.id}`,
        kind: "schedule" as const,
        title: `${booking.applicantName || "予約者"}さんのセッション`,
        description: menu ? `${menu.title} / ${sessionBookingStatusLabels[booking.status]}` : sessionBookingStatusLabels[booking.status],
        dueAt: booking.bookingDate || null,
        urgency: classifyManagerDueDate(booking.bookingDate, now),
        status: toManagerStatus(booking.status),
        startTime: booking.bookingTime,
        source: {
          appKey: "session" as const,
          sourceType: "booking" as const,
          sourceId: booking.id,
          sourceGroupId: booking.menuId,
          href: "/session/admin/bookings"
        }
      };
    })
    .sort((a, b) => compareManagerItems(a, b, now));

  const tasks: ManagerTask[] = bookings
    .filter((booking) => !completedStatuses.includes(booking.status))
    .map((booking) => ({
      id: `session_booking_task:${booking.id}`,
      kind: "task" as const,
      title: `${booking.applicantName || "予約者"}さんの予約確認`,
      description: sessionBookingStatusLabels[booking.status],
      dueAt: booking.bookingDate || null,
      urgency: classifyManagerDueDate(booking.bookingDate, now),
      status: toManagerStatus(booking.status),
      priority: booking.status === "requested" ? "high" as const : "normal" as const,
      ownerLabel: "Session",
      source: {
        appKey: "session" as const,
        sourceType: "booking" as const,
        sourceId: booking.id,
        sourceGroupId: booking.menuId,
        href: "/session/admin/bookings"
      }
    }))
    .sort((a, b) => compareManagerItems(a, b, now));

  return { schedules, tasks, progress: [] };
}

function toManagerStatus(status: SessionBooking["status"]): ManagerProgressStatus {
  if (status === "completed") return "completed";
  if (status === "cancelled") return "cancelled";
  if (status === "confirmed") return "active";
  return "waiting";
}
