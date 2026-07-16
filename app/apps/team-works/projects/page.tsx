"use client";

import { AuthGate } from "@/components/AuthGate";
import { TeamWorksProjectsList } from "@/components/team-works/projects/TeamWorksProjectsList";
import { TeamWorksProjectsShell } from "@/components/team-works/projects/TeamWorksProjectsShell";

function TeamWorksProjectsContent() {
  return (
    <TeamWorksProjectsShell title="プロジェクト" subtitle="案件ごとの工程・タスク・担当・納期を整える">
      <TeamWorksProjectsList />
    </TeamWorksProjectsShell>
  );
}

export default function TeamWorksProjectsPage() {
  return <AuthGate><TeamWorksProjectsContent /></AuthGate>;
}
