"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readTeamWorksPortalCollaborationState, readTeamWorksPortalMemberships, type TeamWorksPortalMembership, type TeamWorksPortalRole } from "@/lib/team-works-portal-database";
import type { TeamWorksProjectStoreState } from "@/lib/team-works-projects";

export function useTeamWorksPortalActor(role: TeamWorksPortalRole, stateBridge?: {
  projectState: TeamWorksProjectStoreState;
  saveProjectState: (next: TeamWorksProjectStoreState) => void;
}) {
  const [memberships, setMemberships] = useState<TeamWorksPortalMembership[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const bridgeRef = useRef(stateBridge);
  bridgeRef.current = stateBridge;

  const refresh = useCallback(async () => {
    setStatus("loading");
    setErrorMessage("");
    try {
      const nextMemberships = await readTeamWorksPortalMemberships(role);
      setMemberships(nextMemberships);
      const bridge = bridgeRef.current;
      if (bridge) bridge.saveProjectState(await readTeamWorksPortalCollaborationState(nextMemberships, bridge.projectState));
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
