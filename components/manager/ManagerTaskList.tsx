"use client";

import { useAuth } from "@/components/AuthGate";
import { useManagerSnapshot } from "@/lib/manager/collect-manager-items";
import { ManagerTaskListRows } from "./ManagerCards";
import { ManagerShell } from "./ManagerShell";

export function ManagerTaskList() {
  const { profile } = useAuth();
  const snapshot = useManagerSnapshot(profile.id);

  return (
    <ManagerShell title="タスク" subtitle="申込対応・予約確認・提供対応など、未完了の作業をまとめます。">
      <section className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4 shadow-sm">
        <ManagerTaskListRows tasks={snapshot.tasks} />
      </section>
    </ManagerShell>
  );
}

