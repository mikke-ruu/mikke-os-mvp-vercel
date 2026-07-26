"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function TeamWorksWorkerModeNav() {
  const pathname = usePathname();
  const projectsActive = pathname.startsWith("/apps/team-works/portal/worker/projects");

  return (
    <nav aria-label="担当メンバーポータル" className="flex flex-wrap gap-2">
      <Link href="/apps/team-works/portal/worker" className={`rounded-lg px-3 py-2 text-xs font-bold ${projectsActive ? "text-[var(--mikke-muted)]" : "bg-[var(--mikke-primary)] text-white"}`}>
        運営業務
      </Link>
      <Link href="/apps/team-works/portal/worker/projects" className={`rounded-lg px-3 py-2 text-xs font-bold ${projectsActive ? "bg-[var(--mikke-primary)] text-white" : "text-[var(--mikke-muted)]"}`}>
        プロジェクト
      </Link>
    </nav>
  );
}
