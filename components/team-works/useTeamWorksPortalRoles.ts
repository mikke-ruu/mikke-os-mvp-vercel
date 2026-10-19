"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export type TeamWorksPortalRoles = {
  hasStaff: boolean;
  hasWorker: boolean;
  hasClient: boolean;
  loading: boolean;
};

export function useTeamWorksPortalRoles(): TeamWorksPortalRoles {
  const [hasStaff, setHasStaff] = useState(false);
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
        const [members, owned] = await Promise.all([supabase
          .from("team_works_organization_members")
          .select("role")
          .eq("user_id", userData.user.id)
          .eq("status", "active"),
          supabase.from("team_works_organizations").select("id").eq("owner_user_id", userData.user.id).limit(1)
        ]);
        if (members.error) throw members.error;
        if (owned.error) throw owned.error;
        if (cancelled) return;
        const rows = (members.data ?? []) as { role: string }[];
        setHasStaff(Boolean(owned.data?.length) || rows.some((row) => row.role === "owner" || row.role === "manager"));
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

  return { hasStaff, hasWorker, hasClient, loading };
}
