"use client";

import { OsShell } from "@/components/mikkeos/OsShell";
import { StoryProfile } from "@/components/mikkeos/StoryProfile";
import { useUnifiedActivityLogs } from "@/lib/mikkeos/activity-client-store";
import { mockProfile } from "@/lib/mikkeos/mock-data";

export default function StoryPage() {
  const { logs } = useUnifiedActivityLogs();

  return (
    <OsShell title="Story" subtitle="名刺代わりに共有できるプロフィール・実績・作品ポートフォリオ" brandLabel="" showGlobalNav={false}>
      <StoryProfile profile={mockProfile} logs={logs} />
    </OsShell>
  );
}
