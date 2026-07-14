"use client";

import { useParams } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { FundCompleteManager } from "@/components/fund/FundCompleteManager";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import { useFundProjects } from "@/lib/fund/store";

function FundCompleteContent() {
  const params = useParams<{ id: string }>();
  const { projects } = useFundProjects();
  const project = projects.find((item) => item.id === params.id);

  return (
    <MikkeAppShell appName="Fund" title="完成記録" subtitle={project?.title} currentApp={{ label: "Fund", href: "/apps/fund" }} footerLabel="Fund by mikke">
      {project ? <FundCompleteManager project={project} /> : <p className="text-sm text-[var(--mikke-muted)]">このFundは見つかりませんでした。</p>}
    </MikkeAppShell>
  );
}

export default function FundCompletePage() {
  return <AuthGate><FundCompleteContent /></AuthGate>;
}
