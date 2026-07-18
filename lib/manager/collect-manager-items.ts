"use client";

import { useMemo } from "react";
import { useMikkeEvents } from "@/lib/event/store";
import { useFundProjects } from "@/lib/fund/store";
import { useOrderMenus } from "@/lib/order/store";
import { useSessionMenus } from "@/lib/session/store";
import { collectEventManagerBridge } from "./adapters/event";
import { collectFundManagerBridge } from "./adapters/fund";
import { collectOrderManagerBridge } from "./adapters/order";
import { collectSessionManagerBridge } from "./adapters/session";
import { compareManagerDue, compareManagerItems } from "./adapters/utils";
import { personalEventsToManagerSchedules, useManagerPersonalEvents } from "./store";
import type { ManagerBridge, ManagerSnapshot } from "./types";

export function useManagerSnapshot(ownerProfileId?: string): ManagerSnapshot {
  const { personalEvents } = useManagerPersonalEvents();
  const { menus: orderMenus, applications: orderApplications } = useOrderMenus();
  const { menus: sessionMenus, bookings: sessionBookings } = useSessionMenus();
  const { events, applications: eventApplications } = useMikkeEvents();
  const { projects: fundProjects, plans: fundPlans, supports: fundSupports } = useFundProjects(ownerProfileId);

  return useMemo(() => {
    const now = new Date();
    const bridges: ManagerBridge[] = [
      {
        schedules: personalEventsToManagerSchedules(personalEvents, now),
        tasks: [],
        progress: []
      },
      collectOrderManagerBridge(orderMenus, orderApplications, now),
      collectSessionManagerBridge(sessionMenus, sessionBookings, now),
      collectEventManagerBridge(events, eventApplications, now),
      collectFundManagerBridge(fundProjects, fundPlans, fundSupports, now)
    ];

    return {
      personalEvents,
      schedules: bridges.flatMap((bridge) => bridge.schedules).sort((a, b) => compareManagerItems(a, b, now)),
      tasks: bridges.flatMap((bridge) => bridge.tasks).sort((a, b) => compareManagerItems(a, b, now)),
      progress: bridges.flatMap((bridge) => bridge.progress).sort((a, b) => compareManagerDue(a.dueAt, b.dueAt, now))
    };
  }, [
    personalEvents,
    orderMenus,
    orderApplications,
    sessionMenus,
    sessionBookings,
    events,
    eventApplications,
    fundProjects,
    fundPlans,
    fundSupports
  ]);
}

