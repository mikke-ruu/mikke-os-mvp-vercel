"use client";

import { useParams } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { TeamWorksWorkerProjectDetail } from "@/components/team-works/worker-projects/TeamWorksWorkerProjectDetail";
import { TeamWorksWorkerProjectsShell } from "@/components/team-works/worker-projects/TeamWorksWorkerProjectsShell";
import { TeamWorksDeliveryPortalProjectRoute } from "@/components/team-works/projects/TeamWorksDeliveryPortalProjectRoute";

export default function TeamWorksWorkerProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  return (
    <AuthGate>
      <TeamWorksWorkerProjectsShell title="担当プロジェクト詳細" subtitle="自分に割り当てられた工程とタスクを確認する">
        <TeamWorksDeliveryPortalProjectRoute
          projectId={params.projectId}
          fallback={<TeamWorksWorkerProjectDetail projectId={params.projectId} />}
        />
      </TeamWorksWorkerProjectsShell>
    </AuthGate>
  );
}
