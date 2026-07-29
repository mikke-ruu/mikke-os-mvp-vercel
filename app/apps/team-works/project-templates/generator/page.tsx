"use client";

import { AuthGate } from "@/components/AuthGate";
import { TeamWorksTemplateGenerator } from "@/components/team-works/project-templates/TeamWorksTemplateGenerator";
import { TeamWorksOperationsShell } from "@/components/team-works/operations/TeamWorksOperationsShell";

function TeamWorksTemplateGeneratorContent() {
  return (
    <TeamWorksOperationsShell title="テンプレートジェネレーター" subtitle="8つの質問から、自社用の仕事の流れを下書きする">
      <TeamWorksTemplateGenerator />
    </TeamWorksOperationsShell>
  );
}

export default function TeamWorksTemplateGeneratorPage() {
  return <AuthGate><TeamWorksTemplateGeneratorContent /></AuthGate>;
}
