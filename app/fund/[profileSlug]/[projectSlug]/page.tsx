"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { FundProjectPublicView } from "@/components/fund/FundProjectPublicView";
import { FundPublicShell } from "@/components/fund/FundPublicShell";
import { getPublicFundProject } from "@/lib/fund/public";
import { canViewFundProject, useFundProjects } from "@/lib/fund/store";

export default function FundProjectPage() {
  const params = useParams<{ profileSlug: string; projectSlug: string }>();
  const { projects, plans, updates, challengeRecords } = useFundProjects();
  const [remoteContent, setRemoteContent] = useState<Awaited<ReturnType<typeof getPublicFundProject>>>(null);
  const [loading, setLoading] = useState(true);
  const localProject = projects.find((item) => item.profileSlug === params.profileSlug && item.slug === params.projectSlug);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getPublicFundProject(params.profileSlug, params.projectSlug)
      .then((content) => {
        if (active) setRemoteContent(content);
      })
      .catch(() => {
        if (active) setRemoteContent(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [params.profileSlug, params.projectSlug]);

  if (loading) {
    return (
      <FundPublicShell backHref={`/fund/${params.profileSlug}`}>
        <p className="text-sm text-[var(--mikke-muted)]">プロジェクトを読み込んでいます。</p>
      </FundPublicShell>
    );
  }

  const project = remoteContent?.project ?? localProject;

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
        plans={remoteContent?.plans ?? plans.filter((plan) => plan.projectId === project.id)}
        updates={remoteContent?.updates ?? updates.filter((update) => update.projectId === project.id && update.visibility === "public")}
        challengeRecord={remoteContent?.challengeRecord ?? challengeRecords.find((record) => record.projectId === project.id && record.visibility === "public")}
        localOnly={!remoteContent}
      />
    </FundPublicShell>
  );
}
