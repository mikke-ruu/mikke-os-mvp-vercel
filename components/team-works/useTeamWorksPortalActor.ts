"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { readTeamWorksPortalMemberships, type TeamWorksPortalMembership, type TeamWorksPortalRole } from "@/lib/team-works-portal-database";

export function useTeamWorksPortalActor(role: TeamWorksPortalRole) {
  const [memberships, setMemberships] = useState<TeamWorksPortalMembership[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const refresh = useCallback(async () => {
    setStatus("loading");
    setErrorMessage("");
    try {
      setMemberships(await readTeamWorksPortalMemberships(role));
      setStatus("ready");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "案件所属を確認できませんでした。");
      setStatus("error");
    }
  }, [role]);

  useEffect(() => { void refresh(); }, [refresh]);

  const membershipBySourceProjectId = useMemo(
    () => new Map(memberships.map((membership) => [membership.sourceProjectId, membership])),
    [memberships]
  );

  return { memberships, membershipBySourceProjectId, status, errorMessage, refresh };
}
