"use client";

import { useParams } from "next/navigation";
import { AuthGate, useAuth } from "@/components/AuthGate";
import { FundCompleteManager } from "@/components/fund/FundCompleteManager";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import { useOwnerFundContent } from "@/lib/fund/owner";

function FundCompleteContent() {
  const params = useParams<{ id: string }>();
  const { profile } = useAuth();
  const { projects, plans, loading, error } = useOwnerFundContent(profile.id, profile.handle);
  const project = projects.find((item) => item.id === params.id);

  return (
    <MikkeAppShell appName="Fund" title="完成記録" subtitle={project?.title} currentApp={{ label: "Fund", href: "/apps/fund" }} footerLabel="Fund by mikke">
      {loading ? <p className="text-sm text-[var(--mikke-muted)]">Fundを読み込んでいます。</p> : error ? <p className="text-sm font-bold text-[var(--mikke-danger)]">{error}</p> : project ? <FundCompleteManager project={project} projectPlans={plans.filter((plan) => plan.projectId === project.id)} /> : <p className="text-sm text-[var(--mikke-muted)]">このFundは見つかりませんでした。</p>}
    </MikkeAppShell>
  );
}

export default function FundCompletePage() {
  return <AuthGate><FundCompleteContent /></AuthGate>;
}
