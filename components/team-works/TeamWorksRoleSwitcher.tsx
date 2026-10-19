"use client";

import Link from "next/link";
import { useTeamWorksPortalRoles } from "./useTeamWorksPortalRoles";
import { useTeamWorksLabels } from "./useTeamWorksLabels";
import { useIsViewAs } from "./TeamWorksViewAsContext";

export function TeamWorksRoleSwitcher({ current }: { current: "staff" | "client" | "worker" }) {
  const { hasStaff, hasClient, hasWorker, loading } = useTeamWorksPortalRoles();
  const labels = useTeamWorksLabels();
  const isViewAs = useIsViewAs();
  const destinations = [
    { role: "staff", label: "本部", href: "/apps/team-works", available: hasStaff },
    { role: "client", label: "クライアント", href: "/apps/team-works/portal/client", available: hasClient },
    { role: "worker", label: labels.workers, href: "/apps/team-works/portal/worker", available: hasWorker }
  ].filter((item) => item.available);

  if (loading || (!isViewAs && destinations.length < 2) || !destinations.length) return null;
  return (
    <nav aria-label="自分の画面を切り替え" className="mb-3 rounded-xl border border-[var(--mikke-line)] bg-white">
      <details>
        <summary className="cursor-pointer px-3 py-2.5 text-sm font-bold text-[var(--mikke-text)] focus-visible:outline-2 focus-visible:outline-[var(--mikke-primary)]">{isViewAs ? "自分の画面へ" : "画面を切り替え"}</summary>
        <div className="px-3 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            {destinations.map((item) => <Link key={item.role} href={item.href}
              aria-current={!isViewAs && item.role === current ? "page" : undefined}
              className={`rounded-xl px-4 py-2.5 text-sm font-bold ${!isViewAs && item.role === current ? "bg-[var(--mikke-primary)] text-white" : "border border-[var(--mikke-line)] text-[var(--mikke-text)] hover:bg-[var(--mikke-surface)]"}`}>{item.label}</Link>)}
          </div>
          <p className="mt-2 text-xs leading-5 text-[var(--mikke-muted)]">自分が参加しているプロジェクトが表示されます。招待を承認する場合は、招待された役割の画面を開いてください。</p>
        </div>
      </details>
    </nav>
  );
}
