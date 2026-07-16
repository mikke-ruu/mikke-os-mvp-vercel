"use client";

import { CircleUserRound, FolderKanban } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import { TEAM_WORKS_CLIENT_PORTAL_DEMO_CLIENT_ID } from "@/lib/team-works-client-projects";
import { teamWorksInitialState } from "@/lib/team-works";

export function TeamWorksClientProjectsShell({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const projectsActive = pathname.startsWith("/apps/team-works/portal/client/projects");
  const clientName = teamWorksInitialState.clients.find((client) => client.id === TEAM_WORKS_CLIENT_PORTAL_DEMO_CLIENT_ID)?.name ?? "クライアント";

  return (
    <MikkeAppShell
      appName="Team Works"
      title={title}
      subtitle={subtitle}
      currentApp={{ label: "Team", href: "/apps/team-works/portal/client/projects", icon: FolderKanban }}
      footerLabel="Team Works by mikke"
    >
      <div className="mb-6 flex flex-col gap-3 border-b border-[var(--mikke-line)] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="クライアントポータル" className="flex flex-wrap gap-2">
          <Link href="/apps/team-works/portal/client" className={`rounded-lg px-3 py-2 text-xs font-bold ${projectsActive ? "text-[var(--mikke-muted)]" : "bg-[var(--mikke-primary)] text-white"}`}>
            継続業務
          </Link>
          <Link href="/apps/team-works/portal/client/projects" className={`rounded-lg px-3 py-2 text-xs font-bold ${projectsActive ? "bg-[var(--mikke-primary)] text-white" : "text-[var(--mikke-muted)]"}`}>
            プロジェクト
          </Link>
        </nav>
        <p className="inline-flex items-center gap-2 text-xs font-bold text-[var(--mikke-muted)]">
          <CircleUserRound size={16} /> {clientName}として表示
        </p>
      </div>
      {children}
    </MikkeAppShell>
  );
}
