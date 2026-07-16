"use client";

import { useParams } from "next/navigation";
import { AuthGate, useAuth } from "@/components/AuthGate";
import { FundUpdateManager } from "@/components/fund/FundUpdateManager";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import { useOwnerFundContent } from "@/lib/fund/owner";

function FundUpdatesContent() {
  const params = useParams<{ id: string }>();
  const { profile } = useAuth();
  const { projects, updates, loading, error, migrationNotice } = useOwnerFundContent(profile.id, profile.handle);
  const project = projects.find((item) => item.id === params.id);

  return (
    <MikkeAppShell appName="Fund" title="活動報告" subtitle={project?.title} currentApp={{ label: "Fund", href: "/apps/fund" }} footerLabel="Fund by mikke">
      {migrationNotice ? <p className="mb-4 text-xs font-semibold text-[var(--mikke-muted)]">{migrationNotice}</p> : null}
      {loading ? <p className="text-sm text-[var(--mikke-muted)]">Fundを読み込んでいます。</p> : error ? <p className="text-sm font-bold text-[var(--mikke-danger)]">{error}</p> : project ? <FundUpdateManager projectId={project.id} updates={updates} /> : <p className="text-sm text-[var(--mikke-muted)]">このFundは見つかりませんでした。</p>}
    </MikkeAppShell>
  );
}

export default function FundUpdatesPage() {
  return <AuthGate><FundUpdatesContent /></AuthGate>;
}
