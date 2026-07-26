"use client";

import { AuthGate } from "@/components/AuthGate";
import { TeamWorksOperationsDashboard } from "@/components/team-works/operations/TeamWorksOperationsDashboard";
import { TeamWorksOperationsShell } from "@/components/team-works/operations/TeamWorksOperationsShell";

function TeamWorksHomeContent() {
  return (
    <TeamWorksOperationsShell title="本部ダッシュボード" subtitle="カレンダー・本日の予定・対応が必要なことをまとめて確認する">
      <TeamWorksOperationsDashboard />
    </TeamWorksOperationsShell>
  );
}

export default function TeamWorksPage() {
  return (
    <AuthGate>
      <TeamWorksHomeContent />
    </AuthGate>
  );
}
