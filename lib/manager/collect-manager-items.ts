"use client";

import { useMemo } from "react";
import { useMikkeEvents } from "@/lib/event/store";
import { useFundProjects } from "@/lib/fund/store";
import { useOrderMenus } from "@/lib/order/store";
import { useSessionMenus } from "@/lib/session/store";
import { useTeamWorksProjectStore } from "@/lib/team-works-projects";
import { collectEventManagerBridge } from "./adapters/event";
import { collectFundManagerBridge } from "./adapters/fund";
import { useAcademyManagerBridge } from "./adapters/academy";
import { useItemStudioManagerBridge } from "./adapters/item-studio";
import { useMarketNoteManagerBridge } from "./adapters/marketnote";
import { collectOrderManagerBridge } from "./adapters/order";
import { collectSessionManagerBridge } from "./adapters/session";
import { collectTeamWorksManagerBridgeForManager } from "./adapters/team-works";
import { compareManagerDue, compareManagerItems } from "./adapters/utils";
import { personalEventsToManagerSchedules, useManagerPersonalEvents, useManagerPreferences } from "./store";
import type { ManagerBridge, ManagerItem, ManagerProgress, ManagerSnapshot } from "./types";

export function useManagerSnapshot(ownerProfileId?: string, ownerUserId?: string): ManagerSnapshot {
  const { personalEvents } = useManagerPersonalEvents();
  const { preferences } = useManagerPreferences();
  const { menus: orderMenus, applications: orderApplications } = useOrderMenus();
  const { menus: sessionMenus, bookings: sessionBookings } = useSessionMenus();
  const { events, applications: eventApplications } = useMikkeEvents();
  const { projects: fundProjects, plans: fundPlans, supports: fundSupports } = useFundProjects(ownerProfileId);
  const { projectState: teamWorksProjectState } = useTeamWorksProjectStore();
  const marketNoteBridge = useMarketNoteManagerBridge(ownerProfileId);
  const academyBridge = useAcademyManagerBridge(ownerUserId);
  const itemStudioBridge = useItemStudioManagerBridge();

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
      marketNoteBridge,
      collectEventManagerBridge(events, eventApplications, now),
      collectFundManagerBridge(fundProjects, fundPlans, fundSupports, now),
      collectTeamWorksManagerBridgeForManager(teamWorksProjectState, now),
      academyBridge,
      itemStudioBridge
    ];

    return {
      personalEvents,
      schedules: bridges
        .flatMap((bridge) => bridge.schedules)
        .filter((item) => preferences.showCompleted || isVisibleManagerItem(item))
        .sort((a, b) => compareManagerItems(a, b, now)),
      tasks: bridges
        .flatMap((bridge) => bridge.tasks)
        .filter((item) => preferences.showCompleted || isVisibleManagerItem(item))
        .sort((a, b) => compareManagerItems(a, b, now)),
      progress: bridges
        .flatMap((bridge) => bridge.progress)
        .filter((item) => preferences.showCompleted || isVisibleManagerProgress(item))
        .sort((a, b) => compareManagerDue(a.dueAt, b.dueAt, now))
    };
  }, [
    personalEvents,
    preferences.showCompleted,
    orderMenus,
    orderApplications,
    sessionMenus,
    sessionBookings,
    events,
    eventApplications,
    fundProjects,
    fundPlans,
    fundSupports,
    teamWorksProjectState,
    marketNoteBridge,
    academyBridge,
    itemStudioBridge
  ]);
}

function isVisibleManagerItem(item: ManagerItem) {
  return item.status !== "completed" && item.status !== "cancelled";
}

function isVisibleManagerProgress(item: ManagerProgress) {
  return item.status !== "completed" && item.status !== "cancelled";
}
