"use client";

import { useEffect, useMemo, useState } from "react";
import { migrateLegacyFundCompletion } from "./completion-migration";
import { FUND_DATABASE_UPDATED_EVENT, getOwnerFundContent } from "./database";
import { migrateLegacyFundContent } from "./legacy-migration";
import { cacheOwnerFundContent, useFundProjects } from "./store";
import { migrateLegacyFundSupports } from "./support-migration";
import { migrateLegacyFundUpdates } from "./update-migration";
import type { FundAppLink, FundChallengeRecord, FundPlan, FundProject, FundSupport, FundUpdate } from "./types";

type OwnerFundContent = {
  projects: FundProject[];
  plans: FundPlan[];
  supports: FundSupport[];
  updates: FundUpdate[];
  challengeRecords: FundChallengeRecord[];
  appLinks: FundAppLink[];
};

export function useOwnerFundContent(ownerProfileId: string, profileSlug: string) {
  const cache = useFundProjects(ownerProfileId);
  const [content, setContent] = useState<OwnerFundContent>({
    projects: [],
    plans: [],
    supports: [],
    updates: [],
    challengeRecords: [],
    appLinks: []
  });
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
        const supportMigration = await migrateLegacyFundSupports({
          ownerProfileId,
          databaseProjects: databaseContent.projects
        });
        if (supportMigration.migratedCount > 0) {
          databaseContent = await getOwnerFundContent(ownerProfileId, profileSlug);
        }
        const completionMigration = await migrateLegacyFundCompletion({
          ownerProfileId,
          databaseProjects: databaseContent.projects
        });
        if (completionMigration.migratedCount > 0) {
          databaseContent = await getOwnerFundContent(ownerProfileId, profileSlug);
        }
        cacheOwnerFundContent(
          ownerProfileId,
          databaseContent.projects,
          databaseContent.plans,
          databaseContent.supports,
          databaseContent.updates,
          databaseContent.challengeRecords,
          databaseContent.appLinks
        );

        if (!active) return;
        setContent(databaseContent);
        const migratedParts = [
          projectMigration.migratedCount > 0 ? `Fund ${projectMigration.migratedCount}件` : "",
          updateMigration.migratedCount > 0 ? `活動報告 ${updateMigration.migratedCount}件` : "",
          supportMigration.migratedCount > 0 ? `応援記録 ${supportMigration.migratedCount}件` : ""
        ].filter(Boolean);
        if (completionMigration.migratedCount > 0) {
          migratedParts.push(`完成記録 ${completionMigration.migratedCount}件`);
        }
        if (migratedParts.length > 0) {
          setMigrationNotice(`以前の${migratedParts.join("・")}を引き継ぎました。`);
        } else if (
          projectMigration.preservedCount > 0 ||
          updateMigration.preservedCount > 0 ||
          supportMigration.preservedCount > 0 ||
          completionMigration.preservedCount > 0
        ) {
          setMigrationNotice("別のプロフィールに紐づく以前のFundデータは移行せず、そのまま残しています。");
        }
      } catch {
        if (!active) return;
        setContent({ projects: [], plans: [], supports: [], updates: [], challengeRecords: [], appLinks: [] });
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
    supports: content.supports,
    updates: content.updates,
    challengeRecords: content.challengeRecords,
    appLinks: content.appLinks,
    loading,
    error,
    migrationNotice
  };
}
