"use client";

import { AuthGate } from "@/components/AuthGate";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { TeamWorksOperationsShell } from "@/components/team-works/operations/TeamWorksOperationsShell";

function TeamWorksManualsContent() {
  return (
    <TeamWorksOperationsShell title="マニュアル管理" subtitle="共通雛形を各プロジェクトへ複製して育てる">
      <MikkeEmptyState title="マニュアル管理" helper="この画面は準備中です（次のフェーズで実装）。" />
    </TeamWorksOperationsShell>
  );
}

export default function TeamWorksManualsPage() {
  return (
    <AuthGate>
      <TeamWorksManualsContent />
    </AuthGate>
  );
}
