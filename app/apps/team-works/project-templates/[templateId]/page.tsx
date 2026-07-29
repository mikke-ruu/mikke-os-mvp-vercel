"use client";

import { useParams } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { TeamWorksTemplateBuilder } from "@/components/team-works/project-templates/TeamWorksTemplateBuilder";
import { TeamWorksOperationsShell } from "@/components/team-works/operations/TeamWorksOperationsShell";

function TeamWorksTemplateBuilderContent() {
  const params = useParams<{ templateId: string }>();
  return (
    <TeamWorksOperationsShell title="テンプレートビルダー" subtitle="工程・役割・タスク・使用機能を自社向けに整える">
      <TeamWorksTemplateBuilder templateId={params.templateId} />
    </TeamWorksOperationsShell>
  );
}

export default function TeamWorksTemplateBuilderPage() {
  return <AuthGate><TeamWorksTemplateBuilderContent /></AuthGate>;
}
