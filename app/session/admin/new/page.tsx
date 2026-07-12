"use client";

import { AuthGate } from "@/components/AuthGate";
import { SessionMenuForm } from "@/components/session/SessionMenuForm";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";

export default function SessionAdminNewPage() {
  return (
    <AuthGate>
      <MikkeAppShell appName="Session" title="メニューを作成" currentApp={{ label: "Session", href: "/apps/session" }} footerLabel="Session by mikke">
        <SessionMenuForm />
      </MikkeAppShell>
    </AuthGate>
  );
}
