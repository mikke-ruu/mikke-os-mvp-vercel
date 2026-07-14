"use client";

import Link from "next/link";
import { ExternalLink, Newspaper, PackageCheck, Plus, Users } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { FundProgressSummary } from "@/components/fund/FundProgressSummary";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import { useFundProjects } from "@/lib/fund/store";
import { fundProjectStatusLabels, fundVisibilityLabels } from "@/lib/fund/types";

function FundDashboardContent() {
  const { projects } = useFundProjects();
  const sorted = [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <MikkeAppShell appName="Fund" title="Fund" subtitle="これから実現したい挑戦を整える" currentApp={{ label: "Fund", href: "/apps/fund" }} footerLabel="Fund by mikke">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-xl text-sm leading-6 text-[var(--mikke-muted)]">応援してくれる人と、最初のお客様を集めてから始めるためのプロジェクトページです。</p>
        <Link href="/apps/fund/new" className="inline-flex items-center gap-2 rounded-lg bg-[var(--mikke-accent)] px-3 py-2.5 text-xs font-bold text-white">
          <Plus size={16} /> 新しいFund
        </Link>
      </div>

      {sorted.length > 0 ? (
        <div className="space-y-3">
          {sorted.map((project) => (
            <section key={project.id} className="border-t border-[var(--mikke-line)] py-5 first:border-t-0 first:pt-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <MikkeStatusBadge tone={project.status === "goal_reached" || project.status === "completed" ? "success" : project.status === "draft" ? "muted" : "primary"} className="px-2 py-1">
                      {fundProjectStatusLabels[project.status]}
                    </MikkeStatusBadge>
                    <span className="text-xs font-bold text-[var(--mikke-muted)]">{fundVisibilityLabels[project.visibility]}</span>
                  </div>
                  <h2 className="mt-2 text-lg font-bold tracking-normal">{project.title}</h2>
                  {project.shortDescription ? <p className="mt-1 text-sm leading-6 text-[var(--mikke-text-soft)]">{project.shortDescription}</p> : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Link href={`/apps/fund/${project.id}/preview`} className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--mikke-line)] text-[var(--mikke-primary)]" aria-label="プレビュー">
                    <ExternalLink size={17} />
                  </Link>
                  <Link href={`/apps/fund/${project.id}/edit`} className="inline-flex items-center rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold text-[var(--mikke-primary)]">編集</Link>
                </div>
              </div>
              <div className="mt-4 max-w-xl"><FundProgressSummary project={project} /></div>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-[var(--mikke-line)] pt-3">
                <ProjectLink href={`/apps/fund/${project.id}/supporters`} icon={<Users size={15} />} label="応援者" />
                <ProjectLink href={`/apps/fund/${project.id}/updates`} icon={<Newspaper size={15} />} label="活動報告" />
                <ProjectLink href={`/apps/fund/${project.id}/fulfillment`} icon={<PackageCheck size={15} />} label="提供状況" />
              </div>
            </section>
          ))}
        </div>
      ) : (
        <MikkeEmptyState title="Fundはまだありません" helper="新しいFundから、最初の挑戦を下書きできます。" />
      )}
    </MikkeAppShell>
  );
}

function ProjectLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return <Link href={href} className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--mikke-primary)]">{icon}{label}</Link>;
}

export default function FundAppPage() {
  return <AuthGate><FundDashboardContent /></AuthGate>;
}
