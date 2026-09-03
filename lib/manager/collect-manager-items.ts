"use client";

import { useMemo } from "react";
import { useFundProjects } from "@/lib/fund/store";
import { collectFundManagerBridge } from "./adapters/fund";
import { useAcademyManagerBridge } from "./adapters/academy";
import { useMarketNoteManagerBridge } from "./adapters/marketnote";
import { compareManagerDue, compareManagerItems } from "./adapters/utils";
import { useManagerPreferences } from "./store";
import type { ManagerBridge, ManagerItem, ManagerProgress, ManagerSnapshot } from "./types";

export function useManagerSnapshot(ownerProfileId?: string, ownerUserId?: string): ManagerSnapshot {
  const { preferences } = useManagerPreferences();
  const { projects: fundProjects, plans: fundPlans, supports: fundSupports } = useFundProjects(ownerProfileId);
  const marketNoteBridge = useMarketNoteManagerBridge(ownerProfileId);
  const academyBridge = useAcademyManagerBridge(ownerUserId);

  return useMemo(() => {
    const now = new Date();
    const bridges: ManagerBridge[] = [
      marketNoteBridge,
      collectFundManagerBridge(fundProjects, fundPlans, fundSupports, now),
      academyBridge
    ];

    return {
      personalEvents: [],
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
    preferences.showCompleted,
    fundProjects,
    fundPlans,
    fundSupports,
    marketNoteBridge,
    academyBridge
  ]);
}

function isVisibleManagerItem(item: ManagerItem) {
  return item.status !== "completed" && item.status !== "cancelled";
}

function isVisibleManagerProgress(item: ManagerProgress) {
  return item.status !== "completed" && item.status !== "cancelled";
}
