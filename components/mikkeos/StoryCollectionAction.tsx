"use client";

import { Bookmark, Check } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getStoryCollectionState,
  removeStoryFromCollectionByHandle,
  saveStoryToCollection,
  type StoryCollectionState
} from "@/lib/mikkeos/story-collection-db";
import { getStoryAppPath } from "@/lib/mikkeos/story-profile-store";
import { ensureProfile } from "@/lib/profile";
import { supabase } from "@/lib/supabase/client";

type ViewState = "loading" | "signed-out" | "ready" | "error";

export function StoryCollectionAction({ handle }: { handle: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [collectionState, setCollectionState] = useState<StoryCollectionState | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const returnPath = `${getStoryAppPath(handle)}?collect=1`;
  const shouldCollectAfterLogin = searchParams.get("collect") === "1";

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
        await ensureProfile(data.session.user);
        let next = await getStoryCollectionState(supabase, handle);
        if (shouldCollectAfterLogin && !next.isOwnStory && !next.isSaved) {
          await saveStoryToCollection(supabase, handle);
          next = { ...next, isSaved: true };
          setMessage("このSTORYをコレクションに保存しました。");
        }
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
  }, [handle, shouldCollectAfterLogin]);

  if (viewState === "loading" || viewState === "error" || collectionState?.isOwnStory) return null;

  if (viewState === "signed-out") {
    return <button type="button" onClick={() => router.push(`/login?next=${encodeURIComponent(returnPath)}`)} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-medium"><Bookmark size={17} />コレクションに保存</button>;
  }

  if (!collectionState) return null;

  const toggle = async () => {
    setSaving(true);
    setMessage("");
    try {
      if (collectionState.isSaved) {
        await removeStoryFromCollectionByHandle(supabase, handle);
        setCollectionState({ ...collectionState, isSaved: false });
      } else {
        await saveStoryToCollection(supabase, handle);
        setCollectionState({ ...collectionState, isSaved: true });
      }
    } catch {
      setMessage("コレクションを変更できませんでした。もう一度お試しください。");
    } finally {
      setSaving(false);
    }
  };

  return <div><button type="button" disabled={saving} onClick={() => void toggle()} className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium disabled:opacity-60 ${collectionState.isSaved ? "bg-[var(--story-soft)] text-[var(--story-ink)]" : "bg-[var(--story-accent)] text-white"}`}>{collectionState.isSaved ? <Check size={17} /> : <Bookmark size={17} />}{saving ? "処理中…" : collectionState.isSaved ? "コレクションに保存済み" : "コレクションに保存"}</button>{message ? <p className="mt-2 text-center text-xs leading-5 text-[var(--story-ink)]" aria-live="polite">{message}</p> : null}</div>;
}
