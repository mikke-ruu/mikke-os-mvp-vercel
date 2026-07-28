"use client";

import { CircleUserRound, FolderKanban } from "lucide-react";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import { teamWorksInitialState } from "@/lib/team-works";
import { TEAM_WORKS_WORKER_PORTAL_DEMO_WORKER_ID } from "@/lib/team-works-worker-projects";
import { TeamWorksWorkerModeNav } from "./TeamWorksWorkerModeNav";

export function TeamWorksWorkerProjectsShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const workerName = teamWorksInitialState.workers.find((worker) => worker.id === TEAM_WORKS_WORKER_PORTAL_DEMO_WORKER_ID)?.name ?? "担当メンバー";
  return (
    <MikkeAppShell appName="Team Works" title={title} subtitle={subtitle} currentApp={{ label: "Team", href: "/apps/team-works/portal/worker/projects", icon: FolderKanban }} theme="green" footerLabel="Team Works by mikke" ownedApps={[]} otherApps={[]} suggestedApps={[]}>
      <div className="mb-6 flex flex-col gap-3 border-b border-[var(--mikke-line)] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <TeamWorksWorkerModeNav />
        <p className="inline-flex items-center gap-2 text-xs font-bold text-[var(--mikke-muted)]"><CircleUserRound size={16} /> {workerName}として表示</p>
      </div>
      {children}
    </MikkeAppShell>
  );
}
