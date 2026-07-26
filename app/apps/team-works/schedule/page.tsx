"use client";

import { AuthGate } from "@/components/AuthGate";
import { TeamWorksOperationsShell } from "@/components/team-works/operations/TeamWorksOperationsShell";
import { TeamWorksScheduleList } from "@/components/team-works/operations/TeamWorksScheduleList";

function TeamWorksScheduleContent() {
  return (
    <TeamWorksOperationsShell title="スケジュール管理" subtitle="全プロジェクトの予定を時系列で確認する">
      <TeamWorksScheduleList />
    </TeamWorksOperationsShell>
  );
}

export default function TeamWorksSchedulePage() {
  return (
    <AuthGate>
      <TeamWorksScheduleContent />
    </AuthGate>
  );
}
