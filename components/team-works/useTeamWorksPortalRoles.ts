"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export type TeamWorksPortalRoles = {
  hasWorker: boolean;
  hasClient: boolean;
  loading: boolean;
};

export function useTeamWorksPortalRoles(): TeamWorksPortalRoles {
  const [hasWorker, setHasWorker] = useState(false);
  const [hasClient, setHasClient] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!userData.user) return;
        const { data, error } = await supabase
          .from("team_works_organization_members")
          .select("role")
          .eq("user_id", userData.user.id)
          .eq("status", "active");
        if (error) throw error;
        if (cancelled) return;
        const rows = (data ?? []) as { role: string }[];
        setHasWorker(rows.some((row) => row.role === "worker"));
        setHasClient(rows.some((row) => row.role === "client_user"));
      } catch (loadError) {
        console.error("useTeamWorksPortalRoles failed", loadError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { hasWorker, hasClient, loading };
}
