"use client";

import { saveFundCompletion } from "./database";
import { getLegacyFundCompletionForMigration } from "./store";
import type { FundProject, FundTargetService } from "./types";

const F5_E_MIGRATION_KEY = "mikke.fund.f5e.migration.v1";

function markerKey(ownerProfileId: string) {
  return `${F5_E_MIGRATION_KEY}.${ownerProfileId}`;
}

export async function migrateLegacyFundCompletion(input: {
  ownerProfileId: string;
  databaseProjects: FundProject[];
}) {
  if (typeof window === "undefined" || window.localStorage.getItem(markerKey(input.ownerProfileId))) {
    return { migratedCount: 0, preservedCount: 0 };
  }

  const legacy = getLegacyFundCompletionForMigration();
  if (!legacy) {
    window.localStorage.setItem(markerKey(input.ownerProfileId), new Date().toISOString());
    return { migratedCount: 0, preservedCount: 0 };
  }

  const ownedProjectIds = new Set(input.databaseProjects.map((project) => project.id));
  const eligibleRecords = legacy.challengeRecords.filter((record) => ownedProjectIds.has(record.projectId));
  const preservedCount =
    legacy.challengeRecords.filter((record) => !ownedProjectIds.has(record.projectId)).length +
    legacy.appLinks.filter((link) => !ownedProjectIds.has(link.projectId)).length;

  for (const record of eligibleRecords) {
    const targets = legacy.appLinks
      .filter((link) =>
        link.projectId === record.projectId &&
        (link.linkStatus === "ready" || link.linkStatus === "linked")
      )
      .map((link) => link.targetService) as FundTargetService[];

    await saveFundCompletion({
      ownerProfileId: input.ownerProfileId,
      projectId: record.projectId,
      record,
      targets: [...new Set(targets)]
    });
  }

  window.localStorage.setItem(markerKey(input.ownerProfileId), new Date().toISOString());
  return { migratedCount: eligibleRecords.length, preservedCount };
}
