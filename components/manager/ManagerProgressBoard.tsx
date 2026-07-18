"use client";

import { useAuth } from "@/components/AuthGate";
import { useManagerSnapshot } from "@/lib/manager/collect-manager-items";
import { ManagerProgressList } from "./ManagerCards";
import { ManagerShell } from "./ManagerShell";

export function ManagerProgressBoard() {
  const { profile } = useAuth();
  const snapshot = useManagerSnapshot(profile.id, profile.user_id);

  return (
    <ManagerShell title="進行" subtitle="イベントやFundなど、動いているものの進み具合を見ます。">
      <section className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4 shadow-sm">
        <ManagerProgressList progress={snapshot.progress} />
      </section>
    </ManagerShell>
  );
}
