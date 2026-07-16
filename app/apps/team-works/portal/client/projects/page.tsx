"use client";

import { AuthGate } from "@/components/AuthGate";
import { TeamWorksClientProjectList } from "@/components/team-works/client-projects/TeamWorksClientProjectList";
import { TeamWorksClientProjectsShell } from "@/components/team-works/client-projects/TeamWorksClientProjectsShell";

export default function TeamWorksClientProjectsPage() {
  return (
    <AuthGate>
      <TeamWorksClientProjectsShell title="共有プロジェクト" subtitle="進み具合と、あなたの対応事項を確認する">
        <TeamWorksClientProjectList />
      </TeamWorksClientProjectsShell>
    </AuthGate>
  );
}
