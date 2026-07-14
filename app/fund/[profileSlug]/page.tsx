"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { FundPublicShell } from "@/components/fund/FundPublicShell";
import { FundProgressSummary } from "@/components/fund/FundProgressSummary";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import { useFundProjects } from "@/lib/fund/store";
import { fundProjectStatusLabels } from "@/lib/fund/types";

export default function FundProfilePage() {
  const params = useParams<{ profileSlug: string }>();
  const { projects } = useFundProjects();
  const publicProjects = projects
    .filter((project) => project.profileSlug === params.profileSlug && project.visibility === "public" && project.status !== "draft")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <FundPublicShell>
      <p className="text-xs font-bold uppercase text-[var(--mikke-muted)]">{params.profileSlug}</p>
      <h1 className="mt-2 text-3xl font-bold tracking-normal">これから始めたいこと</h1>
      <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--mikke-text-soft)]">新しい挑戦を、最初のお客様や応援してくれる方と一緒に形にしていきます。</p>

      {publicProjects.length > 0 ? (
        <div className="mt-8 space-y-7">
          {publicProjects.map((project) => (
            <article key={project.id} className="border-t border-[var(--mikke-line)] pt-5 first:border-t-0 first:pt-0">
              <MikkeStatusBadge tone={project.status === "completed" || project.status === "goal_reached" ? "success" : "primary"} className="px-2 py-1">
                {fundProjectStatusLabels[project.status]}
              </MikkeStatusBadge>
              <h2 className="mt-3 text-xl font-bold tracking-normal">{project.title}</h2>
              {project.shortDescription ? <p className="mt-2 text-sm leading-6 text-[var(--mikke-text-soft)]">{project.shortDescription}</p> : null}
              <div className="mt-4 max-w-xl"><FundProgressSummary project={project} publicView /></div>
              <Link href={`/fund/${project.profileSlug}/${project.slug}`} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[var(--mikke-accent)]">
                プロジェクトを見る <ArrowRight size={16} />
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-8"><MikkeEmptyState title="公開中のFundはありません" helper="新しい挑戦が公開されると、ここに表示されます。" /></div>
      )}
    </FundPublicShell>
  );
}
