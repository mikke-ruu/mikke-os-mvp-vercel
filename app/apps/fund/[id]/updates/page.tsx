"use client";

import { useParams } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { FundUpdateManager } from "@/components/fund/FundUpdateManager";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import { useFundProjects } from "@/lib/fund/store";

function FundUpdatesContent() {
  const params = useParams<{ id: string }>();
  const { projects } = useFundProjects();
  const project = projects.find((item) => item.id === params.id);

  return (
    <MikkeAppShell appName="Fund" title="活動報告" subtitle={project?.title} currentApp={{ label: "Fund", href: "/apps/fund" }} footerLabel="Fund by mikke">
      {project ? <FundUpdateManager projectId={project.id} /> : <p className="text-sm text-[var(--mikke-muted)]">このFundは見つかりませんでした。</p>}
    </MikkeAppShell>
  );
}

export default function FundUpdatesPage() {
  return <AuthGate><FundUpdatesContent /></AuthGate>;
}
