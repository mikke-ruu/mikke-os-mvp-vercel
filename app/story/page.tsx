"use client";

import { useEffect, useState } from "react";
import { AuthGate, useAuth } from "@/components/AuthGate";
import { StoryNameCard } from "@/components/mikkeos/StoryNameCard";
import { StoryAppShell } from "@/components/mikkeos/StoryAppShell";
import { getMyStoryProfile } from "@/lib/mikkeos/story-profile-db";
import { defaultStoryProfile, loadStoryProfileDraft, type StoryProfileView } from "@/lib/mikkeos/story-profile-store";
import { supabase } from "@/lib/supabase/client";

export default function StoryPage() {
  return <AuthGate><StoryAppShell title="マイSTORY" subtitle="あなたの公開名刺"><StoryOwnerPage /></StoryAppShell></AuthGate>;
}

function StoryOwnerPage() {
  const { user } = useAuth();
  const [story, setStory] = useState<StoryProfileView>(defaultStoryProfile);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      setStory(loadStoryProfileDraft(user.id));
      getMyStoryProfile(supabase)
        .then((remote) => { if (!cancelled && remote) setStory(remote); })
        .catch(() => undefined);
    };
    load();
    window.addEventListener("mikkeos-story-profile-updated", load);
    return () => {
      cancelled = true;
      window.removeEventListener("mikkeos-story-profile-updated", load);
    };
  }, [user.id]);

  return <StoryNameCard story={story} isOwner />;
}
