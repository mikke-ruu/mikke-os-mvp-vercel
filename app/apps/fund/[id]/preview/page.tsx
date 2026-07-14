"use client";

import { useParams } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { FundProjectPublicView } from "@/components/fund/FundProjectPublicView";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import { useFundProjects } from "@/lib/fund/store";

function FundPreviewContent() {
  const params = useParams<{ id: string }>();
  const { projects, plans, updates, challengeRecords } = useFundProjects();
  const project = projects.find((item) => item.id === params.id);

  return (
    <MikkeAppShell appName="Fund" title="公開プレビュー" currentApp={{ label: "Fund", href: "/apps/fund" }} footerLabel="Fund by mikke">
      {!project ? (
        <p className="text-sm text-[var(--mikke-muted)]">このFundは見つかりませんでした。</p>
      ) : (
        <FundProjectPublicView
          project={project}
          plans={plans.filter((plan) => plan.projectId === project.id)}
          updates={updates.filter((update) => update.projectId === project.id)}
          challengeRecord={challengeRecords.find((record) => record.projectId === project.id)}
          preview
        />
      )}
    </MikkeAppShell>
  );
}

export default function FundPreviewPage() {
  return <AuthGate><FundPreviewContent /></AuthGate>;
}
