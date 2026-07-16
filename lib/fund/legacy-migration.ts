"use client";

import { saveFundProjectContent } from "./database";
import { getLegacyFundContentForMigration } from "./store";
import type { FundProject } from "./types";

const F5_B_MIGRATION_KEY = "mikke.fund.f5b.migration.v1";

function markerKey(ownerProfileId: string) {
  return `${F5_B_MIGRATION_KEY}.${ownerProfileId}`;
}

function sameHandle(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export async function migrateLegacyFundContent(input: {
  ownerProfileId: string;
  profileSlug: string;
  databaseProjects: FundProject[];
}) {
  if (typeof window === "undefined" || window.localStorage.getItem(markerKey(input.ownerProfileId))) {
    return { migratedCount: 0, preservedCount: 0 };
  }

  const legacy = getLegacyFundContentForMigration();
  if (!legacy) {
    window.localStorage.setItem(markerKey(input.ownerProfileId), new Date().toISOString());
    return { migratedCount: 0, preservedCount: 0 };
  }

  const databaseSourceIds = new Set(input.databaseProjects.map((project) => project.id));
  const pendingProjects = legacy.projects.filter((project) => !databaseSourceIds.has(project.id));
  const eligibleProjects = pendingProjects.filter((project) => sameHandle(project.profileSlug, input.profileSlug));
  const preservedCount = pendingProjects.length - eligibleProjects.length;

  for (const project of eligibleProjects) {
    await saveFundProjectContent({
      ownerProfileId: input.ownerProfileId,
      project: { ...project, ownerProfileId: input.ownerProfileId, profileSlug: input.profileSlug },
      plans: legacy.plans.filter((plan) => plan.projectId === project.id)
    });
  }

  window.localStorage.setItem(markerKey(input.ownerProfileId), new Date().toISOString());
  return { migratedCount: eligibleProjects.length, preservedCount };
}
