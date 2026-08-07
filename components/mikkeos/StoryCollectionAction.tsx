"use client";

import { Bookmark, Check, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getStoryCollectionState,
  removeStoryFromCollectionByHandle,
  saveStoryToCollection,
  type StoryCollectionState
} from "@/lib/mikkeos/story-collection-db";
import { getStoryAppPath } from "@/lib/mikkeos/story-profile-store";
import { supabase } from "@/lib/supabase/client";

type ViewState = "loading" | "signed-out" | "ready" | "error";

export function StoryCollectionAction({ handle }: { handle: string }) {
  const router = useRouter();
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [collectionState, setCollectionState] = useState<StoryCollectionState | null>(null);
  const [saving, setSaving] = useState(false);
  const returnPath = `${getStoryAppPath(handle)}?collect=1`;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        setCollectionState(null);
        setViewState("signed-out");
        return;
      }
      try {
        const next = await getStoryCollectionState(supabase, handle);
        if (!cancelled) {
          setCollectionState(next);
          setViewState("ready");
        }
      } catch {
        if (!cancelled) setViewState("error");
      }
    };
    void load();
    const { data: listener } = supabase.auth.onAuthStateChange(() => void load());
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [handle]);

  if (viewState === "loading" || viewState === "error" || collectionState?.isOwnStory) return null;

  if (viewState === "signed-out") {
    return <button type="button" onClick={() => router.push(`/login?next=${encodeURIComponent(returnPath)}`)} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-medium"><Bookmark size={17} />コレクションに保存</button>;
  }

  if (!collectionState?.viewerHasStory) {
    return <div className="rounded-2xl bg-[var(--story-soft)] p-4"><div className="flex items-center gap-2 text-sm font-medium"><Sparkles size={17} />あなたもSTORYをつくりませんか？</div><p className="mt-2 text-xs font-normal leading-5 text-black/55">写真やリンクをまとめた、自分の名刺を無料で作れます。</p><button type="button" onClick={() => router.push(`/story/start?next=${encodeURIComponent(returnPath)}`)} className="mt-3 w-full rounded-xl bg-[var(--story-accent)] px-4 py-3 text-sm font-medium text-white">自分のSTORYを作る</button></div>;
  }

  const toggle = async () => {
    setSaving(true);
    try {
      if (collectionState.isSaved) {
        await removeStoryFromCollectionByHandle(supabase, handle);
        setCollectionState({ ...collectionState, isSaved: false });
      } else {
        await saveStoryToCollection(supabase, handle);
        setCollectionState({ ...collectionState, isSaved: true });
      }
    } finally {
      setSaving(false);
    }
  };

  return <button type="button" disabled={saving} onClick={() => void toggle()} className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium disabled:opacity-60 ${collectionState.isSaved ? "bg-[var(--story-soft)] text-[var(--story-ink)]" : "bg-[var(--story-accent)] text-white"}`}>{collectionState.isSaved ? <Check size={17} /> : <Bookmark size={17} />}{saving ? "処理中…" : collectionState.isSaved ? "コレクションに保存済み" : "コレクションに保存"}</button>;
}
