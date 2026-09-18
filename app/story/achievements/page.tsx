"use client";

import { AuthGate } from "@/components/AuthGate";
import { StoryAchievementManager } from "@/components/story/StoryAchievementManager";
import { StoryAppShell } from "@/components/mikkeos/StoryAppShell";

export default function StoryAchievementsPage() {
  return (
    <AuthGate>
      <StoryAppShell title="活動実績" subtitle="STORYに連携した実績を自分だけで確認できます">
        <StoryAchievementManager />
      </StoryAppShell>
    </AuthGate>
  );
}
