"use client";

import { useParams } from "next/navigation";
import { AuthGate, useAuth } from "@/components/AuthGate";
import { FundProjectPublicView } from "@/components/fund/FundProjectPublicView";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import { useOwnerFundContent } from "@/lib/fund/owner";

function FundPreviewContent() {
  const params = useParams<{ id: string }>();
  const { profile } = useAuth();
  const { projects, plans, updates, challengeRecords, loading, error } = useOwnerFundContent(profile.id, profile.handle);
  const project = projects.find((item) => item.id === params.id);

  return (
    <MikkeAppShell appName="Fund" title="公開プレビュー" currentApp={{ label: "Fund", href: "/apps/fund" }} footerLabel="Fund by mikke">
      {loading ? (
        <p className="text-sm text-[var(--mikke-muted)]">Fundを読み込んでいます。</p>
      ) : error ? (
        <p className="text-sm font-bold text-[var(--mikke-danger)]">{error}</p>
      ) : !project ? (
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
