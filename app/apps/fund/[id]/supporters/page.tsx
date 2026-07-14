"use client";

import { useParams } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { FundSupportManager } from "@/components/fund/FundSupportManager";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import { useFundProjects } from "@/lib/fund/store";

function FundSupportersContent() {
  const params = useParams<{ id: string }>();
  const { projects } = useFundProjects();
  const project = projects.find((item) => item.id === params.id);

  return (
    <MikkeAppShell appName="Fund" title="応援者" subtitle={project?.title} currentApp={{ label: "Fund", href: "/apps/fund" }} footerLabel="Fund by mikke">
      {project ? <FundSupportManager projectId={project.id} /> : <p className="text-sm text-[var(--mikke-muted)]">このFundは見つかりませんでした。</p>}
    </MikkeAppShell>
  );
}

export default function FundSupportersPage() {
  return <AuthGate><FundSupportersContent /></AuthGate>;
}
