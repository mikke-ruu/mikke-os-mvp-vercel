"use client";

import { AuthGate } from "@/components/AuthGate";
import { TeamWorksOperationsShell } from "@/components/team-works/operations/TeamWorksOperationsShell";
import { TeamWorksStepTemplateManager } from "@/components/team-works/projects/TeamWorksStepTemplateManager";

function TeamWorksTemplateListContent() {
  return (
    <TeamWorksOperationsShell title="自社テンプレート" subtitle="自社の仕事の流れを、繰り返し使える型にする">
      <TeamWorksStepTemplateManager />
    </TeamWorksOperationsShell>
  );
}

export default function TeamWorksTemplateListPage() {
  return <AuthGate><TeamWorksTemplateListContent /></AuthGate>;
}
