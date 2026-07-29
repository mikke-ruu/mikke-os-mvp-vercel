"use client";

import { AuthGate } from "@/components/AuthGate";
import { TeamWorksProjectGenerator } from "@/components/team-works/projects/TeamWorksProjectGenerator";
import { TeamWorksProjectsShell } from "@/components/team-works/projects/TeamWorksProjectsShell";

function TeamWorksProjectNewContent() {
  return (
    <TeamWorksProjectsShell title="新しいプロジェクト" subtitle="ゴール・メンバー・作業の順番を決めて全体を設計する">
      <TeamWorksProjectGenerator />
    </TeamWorksProjectsShell>
  );
}

export default function TeamWorksProjectNewPage() {
  return <AuthGate><TeamWorksProjectNewContent /></AuthGate>;
}
