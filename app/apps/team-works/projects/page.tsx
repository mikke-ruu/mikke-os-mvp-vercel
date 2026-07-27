"use client";

import { AuthGate } from "@/components/AuthGate";
import { TeamWorksOperationsProjectList } from "@/components/team-works/operations/TeamWorksOperationsProjectList";
import { TeamWorksOperationsShell } from "@/components/team-works/operations/TeamWorksOperationsShell";

function TeamWorksProjectsContent() {
  return (
    <TeamWorksOperationsShell title="プロジェクト管理" subtitle="日本語レッスンの新規立ち上げと、運営中プロジェクトの一覧">
      <TeamWorksOperationsProjectList />
    </TeamWorksOperationsShell>
  );
}

export default function TeamWorksProjectsPage() {
  return <AuthGate><TeamWorksProjectsContent /></AuthGate>;
}
