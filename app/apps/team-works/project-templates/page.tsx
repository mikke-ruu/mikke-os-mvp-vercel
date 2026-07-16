"use client";

import { AuthGate } from "@/components/AuthGate";
import { TeamWorksTemplateList } from "@/components/team-works/project-templates/TeamWorksTemplateList";
import { TeamWorksProjectsShell } from "@/components/team-works/projects/TeamWorksProjectsShell";

function TeamWorksTemplateListContent() {
  return (
    <TeamWorksProjectsShell title="自社テンプレート" subtitle="自社の仕事の流れを、繰り返し使える型にする">
      <TeamWorksTemplateList />
    </TeamWorksProjectsShell>
  );
}

export default function TeamWorksTemplateListPage() {
  return <AuthGate><TeamWorksTemplateListContent /></AuthGate>;
}
