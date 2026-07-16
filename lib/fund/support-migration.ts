"use client";

import { saveFundSupport } from "./database";
import { getLegacyFundSupportsForMigration } from "./store";
import type { FundProject } from "./types";

const F5_D_MIGRATION_KEY = "mikke.fund.f5d.migration.v1";

function markerKey(ownerProfileId: string) {
  return `${F5_D_MIGRATION_KEY}.${ownerProfileId}`;
}

export async function migrateLegacyFundSupports(input: {
  ownerProfileId: string;
  databaseProjects: FundProject[];
}) {
  if (typeof window === "undefined" || window.localStorage.getItem(markerKey(input.ownerProfileId))) {
    return { migratedCount: 0, preservedCount: 0 };
  }

  const legacySupports = getLegacyFundSupportsForMigration();
  if (!legacySupports) {
    window.localStorage.setItem(markerKey(input.ownerProfileId), new Date().toISOString());
    return { migratedCount: 0, preservedCount: 0 };
  }

  const ownedProjectIds = new Set(input.databaseProjects.map((project) => project.id));
  const eligibleSupports = legacySupports.filter((support) => ownedProjectIds.has(support.projectId));
  const preservedCount = legacySupports.length - eligibleSupports.length;

  for (const support of eligibleSupports) {
    await saveFundSupport({
      ownerProfileId: input.ownerProfileId,
      projectId: support.projectId,
      support
    });
  }

  window.localStorage.setItem(markerKey(input.ownerProfileId), new Date().toISOString());
  return { migratedCount: eligibleSupports.length, preservedCount };
}
