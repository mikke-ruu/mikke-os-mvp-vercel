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
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-[var(--mikke-line)] border-t-[3px] border-t-[var(--mikke-orange)] bg-[var(--mikke-surface)] p-3 shadow-sm sm:rounded-2xl sm:p-4">
          <h2 className="text-base font-bold tracking-normal sm:text-lg">対応すること</h2>
          <p className="mt-0.5 text-xs text-[var(--mikke-muted)] sm:mt-1 sm:text-sm">申込み、予約、提供など、対応が必要なものです。</p>
          <div className="mt-3">
            <ManagerTaskListRows tasks={snapshot.tasks} initialLimit={5} emptyTitle="対応が必要なものはありません" />
          </div>
        </section>

        <section className="rounded-xl border border-[var(--mikke-line)] border-t-[3px] border-t-[var(--mikke-green)] bg-[var(--mikke-surface)] p-3 shadow-sm sm:rounded-2xl sm:p-4">
          <h2 className="text-base font-bold tracking-normal sm:text-lg">進行中</h2>
          <p className="mt-0.5 text-xs text-[var(--mikke-muted)] sm:mt-1 sm:text-sm">各アプリで進んでいる活動の現在地です。</p>
          <div className="mt-3">
            <ManagerProgressList progress={snapshot.progress} initialLimit={5} />
          </div>
        </section>
      </div>
    </ManagerShell>
  );
}
