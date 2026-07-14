"use client";

import { AuthGate } from "@/components/AuthGate";
import { FundProjectForm } from "@/components/fund/FundProjectForm";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";

export default function FundNewPage() {
  return (
    <AuthGate>
      <MikkeAppShell appName="Fund" title="新しいFund" subtitle="質問に答えながら、挑戦の下書きを作ります" currentApp={{ label: "Fund", href: "/apps/fund" }} footerLabel="Fund by mikke">
        <FundProjectForm />
      </MikkeAppShell>
    </AuthGate>
  );
}
