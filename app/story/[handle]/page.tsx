"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { StoryNameCard } from "@/components/mikkeos/StoryNameCard";
import { getPublishedStoryProfile } from "@/lib/mikkeos/story-profile-db";
import { normalizeStoryHandle, type StoryProfileView } from "@/lib/mikkeos/story-profile-store";
import { supabase } from "@/lib/supabase/client";

export default function PublicStoryPage() {
  const params = useParams<{ handle: string }>();
  const [story, setStory] = useState<StoryProfileView | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const handle = normalizeStoryHandle(params.handle);
    getPublishedStoryProfile(supabase, handle)
      .then((remote) => { if (!cancelled) setStory(remote); })
      .catch(() => { if (!cancelled) setStory(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [params.handle]);

  if (loading) return <main className="min-h-screen bg-white" />;
  if (!story) return <main className="grid min-h-screen place-items-center bg-white px-6 text-center text-[var(--mikke-text)]"><div className="max-w-sm"><p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--mikke-primary)]">STORY</p><h1 className="mt-3 text-xl font-bold">このSTORYはまだ公開されていません</h1><p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">URLが正しい場合も、本人が公開するまでは表示されません。</p></div></main>;
  return <StoryNameCard story={story} />;
}
