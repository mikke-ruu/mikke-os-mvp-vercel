"use client";

import { saveFundUpdate } from "./database";
import { getLegacyFundUpdatesForMigration } from "./store";
import type { FundProject, FundUpdate } from "./types";

const F5_C_MIGRATION_KEY = "mikke.fund.f5c.migration.v1";

function markerKey(ownerProfileId: string) {
  return `${F5_C_MIGRATION_KEY}.${ownerProfileId}`;
}

export async function migrateLegacyFundUpdates(input: {
  ownerProfileId: string;
  databaseProjects: FundProject[];
  databaseUpdates: FundUpdate[];
}) {
  if (typeof window === "undefined" || window.localStorage.getItem(markerKey(input.ownerProfileId))) {
    return { migratedCount: 0, preservedCount: 0 };
  }

  const legacyUpdates = getLegacyFundUpdatesForMigration();
  if (!legacyUpdates) {
    window.localStorage.setItem(markerKey(input.ownerProfileId), new Date().toISOString());
    return { migratedCount: 0, preservedCount: 0 };
  }

  const ownedProjectIds = new Set(input.databaseProjects.map((project) => project.id));
  const databaseUpdateIds = new Set(input.databaseUpdates.map((update) => `${update.projectId}\u0000${update.id}`));
  const pendingUpdates = legacyUpdates.filter((update) => !databaseUpdateIds.has(`${update.projectId}\u0000${update.id}`));
  const eligibleUpdates = pendingUpdates.filter((update) => ownedProjectIds.has(update.projectId));
  const preservedCount = pendingUpdates.length - eligibleUpdates.length;

  for (const update of eligibleUpdates) {
    await saveFundUpdate({
      ownerProfileId: input.ownerProfileId,
      projectId: update.projectId,
      update: {
        id: update.id,
        projectId: update.projectId,
        title: update.title,
        body: update.body,
        imageUrl: update.imageUrl,
        visibility: update.visibility
      }
    });
  }

  window.localStorage.setItem(markerKey(input.ownerProfileId), new Date().toISOString());
  return { migratedCount: eligibleUpdates.length, preservedCount };
}
