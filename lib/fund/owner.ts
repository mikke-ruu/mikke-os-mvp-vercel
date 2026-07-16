"use client";

import { useEffect, useMemo, useState } from "react";
import { FUND_DATABASE_UPDATED_EVENT, getOwnerFundContent } from "./database";
import { migrateLegacyFundContent } from "./legacy-migration";
import { cacheOwnerFundContent, useFundProjects } from "./store";
import { migrateLegacyFundUpdates } from "./update-migration";
import type { FundPlan, FundProject, FundUpdate } from "./types";

type OwnerFundContent = {
  projects: FundProject[];
  plans: FundPlan[];
  updates: FundUpdate[];
};

export function useOwnerFundContent(ownerProfileId: string, profileSlug: string) {
  const cache = useFundProjects(ownerProfileId);
  const [content, setContent] = useState<OwnerFundContent>({ projects: [], plans: [], updates: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [migrationNotice, setMigrationNotice] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");
      setMigrationNotice("");

      try {
        let databaseContent = await getOwnerFundContent(ownerProfileId, profileSlug);
        const projectMigration = await migrateLegacyFundContent({
          ownerProfileId,
          profileSlug,
          databaseProjects: databaseContent.projects
        });

        if (projectMigration.migratedCount > 0) {
          databaseContent = await getOwnerFundContent(ownerProfileId, profileSlug);
        }
        const updateMigration = await migrateLegacyFundUpdates({
          ownerProfileId,
          databaseProjects: databaseContent.projects,
          databaseUpdates: databaseContent.updates
        });
        if (updateMigration.migratedCount > 0) {
          databaseContent = await getOwnerFundContent(ownerProfileId, profileSlug);
        }
        cacheOwnerFundContent(ownerProfileId, databaseContent.projects, databaseContent.plans, databaseContent.updates);

        if (!active) return;
        setContent(databaseContent);
        const migratedParts = [
          projectMigration.migratedCount > 0 ? `Fund ${projectMigration.migratedCount}件` : "",
          updateMigration.migratedCount > 0 ? `活動報告 ${updateMigration.migratedCount}件` : ""
        ].filter(Boolean);
        if (migratedParts.length > 0) {
          setMigrationNotice(`以前の${migratedParts.join("・")}を引き継ぎました。`);
        } else if (projectMigration.preservedCount > 0 || updateMigration.preservedCount > 0) {
          setMigrationNotice("別のプロフィールに紐づく以前のFundデータは移行せず、そのまま残しています。");
        }
      } catch {
        if (!active) return;
        setContent({ projects: [], plans: [], updates: [] });
        setError("Fundを読み込めませんでした。時間をおいて、もう一度お試しください。");
      } finally {
        if (active) setLoading(false);
      }
    }

    function handleDatabaseUpdate(event: Event) {
      const detail = (event as CustomEvent<{ ownerProfileId?: string }>).detail;
      if (!detail?.ownerProfileId || detail.ownerProfileId === ownerProfileId) void load();
    }

    void load();
    window.addEventListener(FUND_DATABASE_UPDATED_EVENT, handleDatabaseUpdate);
    return () => {
      active = false;
      window.removeEventListener(FUND_DATABASE_UPDATED_EVENT, handleDatabaseUpdate);
    };
  }, [ownerProfileId, profileSlug]);

  const projects = useMemo(() => {
    const currentValueById = new Map(cache.projects.map((project) => [project.id, project.currentValue]));
    return content.projects.map((project) => ({
      ...project,
      currentValue: currentValueById.get(project.id) ?? project.currentValue
    }));
  }, [cache.projects, content.projects]);

  return {
    projects,
    plans: content.plans,
    updates: content.updates,
    challengeRecords: cache.challengeRecords,
    loading,
    error,
    migrationNotice
  };
}
