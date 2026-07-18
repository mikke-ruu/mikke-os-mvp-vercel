"use client";

import { useEffect, useState } from "react";
import { APPLICATION_STATUS_LABELS, listApplications } from "@/lib/academy/applications";
import { listCourses } from "@/lib/academy/courses";
import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { getRenewalAlerts, INSTRUCTOR_STATUS_LABELS, listInstructors } from "@/lib/academy/instructors";
import { KIT_STATUS_LABELS, listKitOrders } from "@/lib/academy/kits";
import type { AcademyApplication, AcademyCourse, AcademyInstructor, AcademyKitOrder } from "@/types/database";
import type { ManagerBridge, ManagerProgress, ManagerProgressStatus, ManagerScheduleItem, ManagerTask } from "../types";
import { classifyManagerDueDate, compareManagerDue, compareManagerItems, progressFromStatus } from "./utils";

const emptyBridge: ManagerBridge = { schedules: [], tasks: [], progress: [] };
const closedApplicationStatuses: AcademyApplication["status"][] = ["closed", "cancelled"];
const closedKitStatuses: AcademyKitOrder["status"][] = ["closed", "cancelled"];

export function useAcademyManagerBridge(userId: string | undefined): ManagerBridge {
  const [state, setState] = useState<ManagerBridge>(emptyBridge);

  useEffect(() => {
    if (!userId) {
      setState(emptyBridge);
      return;
    }

    let cancelled = false;
    const activeUserId = userId;

    async function load() {
      try {
        const hq = await getOwnedHeadquarters(activeUserId);
        if (!hq) {
          if (!cancelled) setState(emptyBridge);
          return;
        }
        const [courses, applications, instructors, kitOrders] = await Promise.all([
          listCourses(hq.id),
          listApplications(hq.id),
          listInstructors(hq.id),
          listKitOrders(hq.id)
        ]);
        if (!cancelled) setState(collectAcademyManagerBridge(courses, applications, instructors, kitOrders, new Date()));
      } catch {
        if (!cancelled) setState(emptyBridge);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return state;
}

export function collectAcademyManagerBridge(
  courses: AcademyCourse[],
  applications: AcademyApplication[],
  instructors: AcademyInstructor[],
  kitOrders: AcademyKitOrder[],
  now = new Date()
): ManagerBridge {
  const courseNameById = new Map(courses.map((course) => [course.id, course.name]));
  const renewalAlerts = getRenewalAlerts(instructors);

  const schedules: ManagerScheduleItem[] = [
    ...applications
      .filter((app) => app.event_date && !closedApplicationStatuses.includes(app.status))
      .map((app): ManagerScheduleItem => ({
        id: `academy_application_schedule:${app.id}`,
        kind: "schedule",
        title: `${courseNameById.get(app.course_id) ?? "講座"}の受講日`,
        description: APPLICATION_STATUS_LABELS[app.status],
        dueAt: app.event_date,
        urgency: classifyManagerDueDate(app.event_date, now),
        status: toApplicationManagerStatus(app.status),
        source: createApplicationSource(app.id)
      })),
    ...renewalAlerts.map(({ instructor, daysUntilDue }): ManagerScheduleItem => ({
      id: `academy_instructor_renewal:${instructor.id}`,
      kind: "schedule",
      title: `${instructor.business_name ?? "認定講師"}の更新期限`,
      description: daysUntilDue < 0 ? "更新期限を過ぎています" : "更新期限が近づいています",
      dueAt: instructor.renewal_due,
      urgency: classifyManagerDueDate(instructor.renewal_due, now),
      status: "active",
      source: createInstructorSource(instructor.id)
    }))
  ].sort((a, b) => compareManagerItems(a, b, now));

  const tasks: ManagerTask[] = [
    ...applications
      .filter((app) => ["received", "awaiting_payment", "kit_pending", "kit_preparing", "cert_pending"].includes(app.status))
      .map((app): ManagerTask => ({
        id: `academy_application_task:${app.id}`,
        kind: "task",
        title: `${courseNameById.get(app.course_id) ?? "講座"}の申込対応`,
        description: APPLICATION_STATUS_LABELS[app.status],
        dueAt: app.event_date,
        urgency: classifyManagerDueDate(app.event_date, now),
        status: toApplicationManagerStatus(app.status),
        priority: app.status === "received" || app.status === "cert_pending" ? "high" : "normal",
        ownerLabel: "Academy",
        source: createApplicationSource(app.id)
      })),
    ...kitOrders
      .filter((order) => ["received", "awaiting_payment", "paid", "preparing"].includes(order.status))
      .map((order): ManagerTask => ({
        id: `academy_kit_task:${order.id}`,
        kind: "task",
        title: `${order.title}のキット対応`,
        description: KIT_STATUS_LABELS[order.status],
        dueAt: order.ordered_at,
        urgency: classifyManagerDueDate(order.ordered_at, now),
        status: toKitManagerStatus(order.status),
        priority: order.status === "received" ? "high" : "normal",
        ownerLabel: "Academy",
        source: {
          appKey: "academy",
          sourceType: "kit_order",
          sourceId: order.id,
          href: "/academy/kits"
        }
      }))
  ].sort((a, b) => compareManagerItems(a, b, now));

  const progress: ManagerProgress[] = [
    ...courses
      .filter((course) => !course.is_published)
      .map((course): ManagerProgress => ({
        id: `academy_course_progress:${course.id}`,
        title: course.name,
        description: "講座公開準備中",
        progressPercent: 35,
        status: "not_started",
        statusLabel: "準備中",
        dueAt: null,
        urgency: "unscheduled",
        source: {
          appKey: "academy",
          sourceType: "course",
          sourceId: course.id,
          href: `/academy/courses/${course.id}`
        }
      })),
    ...applications
      .filter((app) => !closedApplicationStatuses.includes(app.status))
      .map((app): ManagerProgress => ({
        id: `academy_application_progress:${app.id}`,
        title: `${courseNameById.get(app.course_id) ?? "講座"}の申込`,
        description: APPLICATION_STATUS_LABELS[app.status],
        progressPercent: progressFromStatus(app.status),
        status: toApplicationManagerStatus(app.status),
        statusLabel: APPLICATION_STATUS_LABELS[app.status],
        dueAt: app.event_date,
        urgency: classifyManagerDueDate(app.event_date, now),
        source: createApplicationSource(app.id)
      }))
  ].sort((a, b) => compareManagerDue(a.dueAt, b.dueAt, now));

  return { schedules, tasks, progress };
}

function toApplicationManagerStatus(status: AcademyApplication["status"]): ManagerProgressStatus {
  if (["closed", "cancelled"].includes(status)) return status === "cancelled" ? "cancelled" : "completed";
  if (["awaiting_payment", "cert_pending", "kit_pending", "kit_preparing"].includes(status)) return "waiting";
  if (["completed", "certified", "instructor_added"].includes(status)) return "completed";
  return "active";
}

function toKitManagerStatus(status: AcademyKitOrder["status"]): ManagerProgressStatus {
  if (closedKitStatuses.includes(status)) return status === "cancelled" ? "cancelled" : "completed";
  if (["awaiting_payment", "paid", "preparing"].includes(status)) return "waiting";
  return "active";
}

function createApplicationSource(applicationId: string) {
  return {
    appKey: "academy" as const,
    sourceType: "application" as const,
    sourceId: applicationId,
    href: `/academy/applications/${applicationId}`
  };
}

function createInstructorSource(instructorId: string) {
  return {
    appKey: "academy" as const,
    sourceType: "instructor" as const,
    sourceId: instructorId,
    href: `/academy/instructors/${instructorId}`
  };
}
