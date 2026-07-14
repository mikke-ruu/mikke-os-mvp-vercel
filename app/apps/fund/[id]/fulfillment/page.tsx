"use client";

import { useParams } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { FundFulfillmentManager } from "@/components/fund/FundFulfillmentManager";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import { useFundProjects } from "@/lib/fund/store";

function FundFulfillmentContent() {
  const params = useParams<{ id: string }>();
  const { projects } = useFundProjects();
  const project = projects.find((item) => item.id === params.id);

  return (
    <MikkeAppShell appName="Fund" title="提供状況" subtitle={project?.title} currentApp={{ label: "Fund", href: "/apps/fund" }} footerLabel="Fund by mikke">
      {project ? <FundFulfillmentManager projectId={project.id} /> : <p className="text-sm text-[var(--mikke-muted)]">このFundは見つかりませんでした。</p>}
    </MikkeAppShell>
  );
}

export default function FundFulfillmentPage() {
  return <AuthGate><FundFulfillmentContent /></AuthGate>;
}
