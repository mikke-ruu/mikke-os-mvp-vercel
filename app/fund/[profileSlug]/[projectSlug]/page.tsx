"use client";

import { useParams } from "next/navigation";
import { FundProjectPublicView } from "@/components/fund/FundProjectPublicView";
import { FundPublicShell } from "@/components/fund/FundPublicShell";
import { canViewFundProject, useFundProjects } from "@/lib/fund/store";

export default function FundProjectPage() {
  const params = useParams<{ profileSlug: string; projectSlug: string }>();
  const { projects, plans, updates, challengeRecords } = useFundProjects();
  const project = projects.find((item) => item.profileSlug === params.profileSlug && item.slug === params.projectSlug);

  if (!project || !canViewFundProject(project)) {
    return (
      <FundPublicShell backHref={`/fund/${params.profileSlug}`}>
        <p className="text-sm text-[var(--mikke-muted)]">このプロジェクトは現在公開されていません。</p>
      </FundPublicShell>
    );
  }

  return (
    <FundPublicShell backHref={`/fund/${params.profileSlug}`}>
      <FundProjectPublicView
        project={project}
        plans={plans.filter((plan) => plan.projectId === project.id)}
        updates={updates.filter((update) => update.projectId === project.id && update.visibility === "public")}
        challengeRecord={challengeRecords.find((record) => record.projectId === project.id && record.visibility === "public")}
      />
    </FundPublicShell>
  );
}
