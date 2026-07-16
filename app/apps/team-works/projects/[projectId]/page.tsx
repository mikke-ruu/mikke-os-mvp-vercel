"use client";

import { useParams } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { TeamWorksProjectDetail } from "@/components/team-works/projects/TeamWorksProjectDetail";
import { TeamWorksProjectsShell } from "@/components/team-works/projects/TeamWorksProjectsShell";

function TeamWorksProjectDetailContent() {
  const params = useParams<{ projectId: string }>();
  return (
    <TeamWorksProjectsShell title="プロジェクト詳細" subtitle="工程・タスク・成果物・メンバーを確認する">
      <TeamWorksProjectDetail projectId={params.projectId} />
    </TeamWorksProjectsShell>
  );
}

export default function TeamWorksProjectDetailPage() {
  return <AuthGate><TeamWorksProjectDetailContent /></AuthGate>;
}
