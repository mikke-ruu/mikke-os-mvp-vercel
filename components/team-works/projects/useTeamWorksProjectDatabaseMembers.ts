"use client";

import { useCallback, useEffect, useState } from "react";
import { readTeamWorksProjectDatabaseMembers, type TeamWorksDatabaseProjectMember } from "@/lib/team-works-portal-database";

export function useTeamWorksProjectDatabaseMembers(projectSourceId: string) {
  const [members, setMembers] = useState<TeamWorksDatabaseProjectMember[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const refresh = useCallback(async () => {
    setStatus("loading");
    setErrorMessage("");
    try {
      setMembers(await readTeamWorksProjectDatabaseMembers(projectSourceId));
      setStatus("ready");
    } catch (error) {
      setMembers([]);
      setErrorMessage(error instanceof Error ? error.message : "DBメンバーを読み込めませんでした。");
      setStatus("error");
    }
  }, [projectSourceId]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { members, status, errorMessage, refresh };
}
