"use client";

import { AuthGate } from "@/components/AuthGate";
import { TeamWorksProjectForm } from "@/components/team-works/projects/TeamWorksProjectForm";
import { TeamWorksProjectsShell } from "@/components/team-works/projects/TeamWorksProjectsShell";

function TeamWorksProjectNewContent() {
  return (
    <TeamWorksProjectsShell title="新しいプロジェクト" subtitle="空の状態から案件の基本情報とメンバーを登録する">
      <TeamWorksProjectForm />
    </TeamWorksProjectsShell>
  );
}

export default function TeamWorksProjectNewPage() {
  return <AuthGate><TeamWorksProjectNewContent /></AuthGate>;
}
