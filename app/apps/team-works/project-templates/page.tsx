"use client";

import { AuthGate } from "@/components/AuthGate";
import { TeamWorksStepTemplateManager } from "@/components/team-works/projects/TeamWorksStepTemplateManager";
import { TeamWorksProjectsShell } from "@/components/team-works/projects/TeamWorksProjectsShell";

function TeamWorksTemplateListContent() {
  return (
    <TeamWorksProjectsShell title="自社テンプレート" subtitle="自社の仕事の流れを、繰り返し使える型にする">
      <TeamWorksStepTemplateManager />
    </TeamWorksProjectsShell>
  );
}

export default function TeamWorksTemplateListPage() {
  return <AuthGate><TeamWorksTemplateListContent /></AuthGate>;
}
