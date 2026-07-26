"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { LoadingScreen } from "@/components/LoadingScreen";
import { TeamWorksOperationsDashboard } from "@/components/team-works/operations/TeamWorksOperationsDashboard";
import { TeamWorksOperationsShell } from "@/components/team-works/operations/TeamWorksOperationsShell";
import { useTeamWorksPortalRoles } from "@/components/team-works/useTeamWorksPortalRoles";
import { supabase } from "@/lib/supabase/client";
import { resolveStaffOrganizationIds } from "@/lib/team-works-operations";

// A worker/client-only account (no staff role anywhere) must never land on
// the HQ dashboard: its empty state is "create your first operations
// project", which would spin up a brand-new organization for someone who
// was only ever meant to see their own portal. Route them there instead.
// A genuinely new user with no roles at all still sees the dashboard, since
// that's the correct entry point for someone about to become an owner.
function TeamWorksHomeContent() {
  const router = useRouter();
  const { hasWorker, hasClient, loading: rolesLoading } = useTeamWorksPortalRoles();
  const [isStaff, setIsStaff] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    resolveStaffOrganizationIds(supabase)
      .then((ids) => {
        if (!cancelled) setIsStaff(ids.length > 0);
      })
      .catch(() => {
        if (!cancelled) setIsStaff(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const checking = isStaff === null || rolesLoading;
  const redirecting = !checking && !isStaff && (hasClient || hasWorker);

  useEffect(() => {
    if (!redirecting) return;
    router.replace(hasClient ? "/apps/team-works/portal/client" : "/apps/team-works/portal/worker");
  }, [redirecting, hasClient, router]);

  if (checking || redirecting) return <LoadingScreen />;

  return (
    <TeamWorksOperationsShell title="本部ダッシュボード" subtitle="カレンダー・本日の予定・対応が必要なことをまとめて確認する">
      <TeamWorksOperationsDashboard />
    </TeamWorksOperationsShell>
  );
}

export default function TeamWorksPage() {
  return (
    <AuthGate>
      <TeamWorksHomeContent />
    </AuthGate>
  );
}
