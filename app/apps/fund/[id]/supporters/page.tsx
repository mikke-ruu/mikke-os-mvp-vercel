"use client";

import { useParams } from "next/navigation";
import { AuthGate, useAuth } from "@/components/AuthGate";
import { FundSupportManager } from "@/components/fund/FundSupportManager";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import { useOwnerFundContent } from "@/lib/fund/owner";

function FundSupportersContent() {
  const params = useParams<{ id: string }>();
  const { profile } = useAuth();
  const { projects, plans, supports, loading, error } = useOwnerFundContent(profile.id, profile.handle);
  const project = projects.find((item) => item.id === params.id);

  return (
    <MikkeAppShell appName="Fund" title="応援者" subtitle={project?.title} currentApp={{ label: "Fund", href: "/apps/fund" }} footerLabel="Fund by mikke">
      {loading ? <p className="text-sm text-[var(--mikke-muted)]">Fundを読み込んでいます。</p> : error ? <p className="text-sm font-bold text-[var(--mikke-danger)]">{error}</p> : project ? <FundSupportManager project={project} plans={plans} supports={supports} /> : <p className="text-sm text-[var(--mikke-muted)]">このFundは見つかりませんでした。</p>}
    </MikkeAppShell>
  );
}

export default function FundSupportersPage() {
  return <AuthGate><FundSupportersContent /></AuthGate>;
}
