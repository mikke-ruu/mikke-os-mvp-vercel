"use client";

import { AuthGate } from "@/components/AuthGate";
import { TeamWorksOperationsProjectList } from "@/components/team-works/operations/TeamWorksOperationsProjectList";
import { TeamWorksProjectsList } from "@/components/team-works/projects/TeamWorksProjectsList";
import { TeamWorksProjectsShell } from "@/components/team-works/projects/TeamWorksProjectsShell";

function TeamWorksProjectsContent() {
  return (
    <TeamWorksProjectsShell title="プロジェクト" subtitle="案件ごとの工程・タスク・担当・納期を整える">
      <div className="space-y-8">
        <TeamWorksOperationsProjectList />
        <section>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--mikke-primary)]">Delivery</p>
          <h2 className="mt-1 mb-4 text-base font-extrabold">納品型プロジェクト</h2>
          <TeamWorksProjectsList />
        </section>
      </div>
    </TeamWorksProjectsShell>
  );
}

export default function TeamWorksProjectsPage() {
  return <AuthGate><TeamWorksProjectsContent /></AuthGate>;
}
