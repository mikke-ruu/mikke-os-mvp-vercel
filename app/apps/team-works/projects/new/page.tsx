"use client";

import { AuthGate } from "@/components/AuthGate";
import { TeamWorksOperationsShell } from "@/components/team-works/operations/TeamWorksOperationsShell";
import { TeamWorksProjectGenerator } from "@/components/team-works/projects/TeamWorksProjectGenerator";

function TeamWorksProjectNewContent() {
  return (
    <TeamWorksOperationsShell title="新しいプロジェクト" subtitle="ゴール・メンバー・作業の順番を決めて全体を設計する">
      <TeamWorksProjectGenerator />
    </TeamWorksOperationsShell>
  );
}

export default function TeamWorksProjectNewPage() {
  return <AuthGate><TeamWorksProjectNewContent /></AuthGate>;
}
