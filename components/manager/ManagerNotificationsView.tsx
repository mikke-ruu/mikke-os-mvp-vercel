"use client";

import { useAuth } from "@/components/AuthGate";
import { useManagerSnapshot } from "@/lib/manager/collect-manager-items";
import { ManagerProgressList, ManagerTaskListRows } from "./ManagerCards";
import { ManagerShell } from "./ManagerShell";

export function ManagerNotificationsView() {
  const { profile } = useAuth();
  const snapshot = useManagerSnapshot(profile.id, profile.user_id);

  return (
    <ManagerShell title="お知らせ" subtitle="各アプリで、確認や対応が必要なものをまとめて見ます。">
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4 shadow-sm">
          <h2 className="text-lg font-bold tracking-normal">対応すること</h2>
          <p className="mt-1 text-sm text-[var(--mikke-muted)]">申込み、予約、提供など、対応が必要なものです。</p>
          <div className="mt-4">
            <ManagerTaskListRows tasks={snapshot.tasks} emptyTitle="対応が必要なものはありません" />
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4 shadow-sm">
          <h2 className="text-lg font-bold tracking-normal">進行中</h2>
          <p className="mt-1 text-sm text-[var(--mikke-muted)]">各アプリで進んでいる活動の現在地です。</p>
          <div className="mt-4">
            <ManagerProgressList progress={snapshot.progress} />
          </div>
        </section>
      </div>
    </ManagerShell>
  );
}
