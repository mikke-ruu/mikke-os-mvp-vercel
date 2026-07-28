"use client";

import { useParams } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { TeamWorksClientProjectDetail } from "@/components/team-works/client-projects/TeamWorksClientProjectDetail";
import { TeamWorksClientProjectsShell } from "@/components/team-works/client-projects/TeamWorksClientProjectsShell";
import { TeamWorksDeliveryPortalProjectRoute } from "@/components/team-works/projects/TeamWorksDeliveryPortalProjectRoute";

export default function TeamWorksClientProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  return (
    <AuthGate>
      <TeamWorksClientProjectsShell title="プロジェクト詳細" subtitle="共有されている工程・対応事項・成果物を確認する">
        <TeamWorksDeliveryPortalProjectRoute
          projectId={params.projectId}
          fallback={<TeamWorksClientProjectDetail projectId={params.projectId} />}
        />
      </TeamWorksClientProjectsShell>
    </AuthGate>
  );
}
