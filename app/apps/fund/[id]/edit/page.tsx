"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { AuthGate, useAuth } from "@/components/AuthGate";
import { FundProjectForm } from "@/components/fund/FundProjectForm";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import { useOwnerFundContent } from "@/lib/fund/owner";

function FundEditContent() {
  const params = useParams<{ id: string }>();
  const { profile } = useAuth();
  const { projects, plans, loading, error } = useOwnerFundContent(profile.id, profile.handle);
  const project = projects.find((item) => item.id === params.id);

  return (
    <MikkeAppShell appName="Fund" title={project?.title ?? "Fundを編集"} currentApp={{ label: "Fund", href: "/apps/fund" }} footerLabel="Fund by mikke">
      {loading ? (
        <p className="text-sm text-[var(--mikke-muted)]">Fundを読み込んでいます。</p>
      ) : error ? (
        <p className="text-sm font-bold text-[var(--mikke-danger)]">{error}</p>
      ) : !project ? (
        <p className="text-sm text-[var(--mikke-muted)]">このFundは見つかりませんでした。</p>
      ) : (
        <>
          <div className="mb-4 flex justify-end">
            <Link href={`/apps/fund/${project.id}/preview`} className="inline-flex items-center gap-2 rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold text-[var(--mikke-primary)]">
              <ExternalLink size={15} /> プレビュー
            </Link>
          </div>
          <FundProjectForm project={project} projectPlans={plans.filter((plan) => plan.projectId === project.id)} />
        </>
      )}
    </MikkeAppShell>
  );
}

export default function FundEditPage() {
  return <AuthGate><FundEditContent /></AuthGate>;
}
