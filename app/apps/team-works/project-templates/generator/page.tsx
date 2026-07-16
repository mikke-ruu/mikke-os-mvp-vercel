"use client";

import { AuthGate } from "@/components/AuthGate";
import { TeamWorksTemplateGenerator } from "@/components/team-works/project-templates/TeamWorksTemplateGenerator";
import { TeamWorksProjectsShell } from "@/components/team-works/projects/TeamWorksProjectsShell";

function TeamWorksTemplateGeneratorContent() {
  return (
    <TeamWorksProjectsShell title="テンプレートジェネレーター" subtitle="8つの質問から、自社用の仕事の流れを下書きする">
      <TeamWorksTemplateGenerator />
    </TeamWorksProjectsShell>
  );
}

export default function TeamWorksTemplateGeneratorPage() {
  return <AuthGate><TeamWorksTemplateGeneratorContent /></AuthGate>;
}
