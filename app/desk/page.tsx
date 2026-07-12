"use client";

import { DeskSummary } from "@/components/mikkeos/DeskSummary";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import { SupabaseDeskReadTest } from "@/components/mikkeos/SupabaseDeskReadTest";
import { useUnifiedActivityLogs } from "@/lib/mikkeos/activity-client-store";

export default function DeskPage() {
  const { logs } = useUnifiedActivityLogs();

  return (
    <MikkeAppShell
      appName="DESK"
      title="DESK"
      subtitle="Activity Logから、売上・経費・利益を軽く把握する画面です。"
      currentApp={{ label: "DESK", href: "/desk" }}
      footerLabel="DESK by mikke"
    >
      <DeskSummary logs={logs} />
      <SupabaseDeskReadTest />
    </MikkeAppShell>
  );
}
