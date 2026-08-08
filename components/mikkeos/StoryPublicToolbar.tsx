"use client";

import { ArrowLeft, Bookmark, Pencil, QrCode, Sparkles } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getStoryCollectionState, type StoryCollectionState } from "@/lib/mikkeos/story-collection-db";
import { supabase } from "@/lib/supabase/client";

type ToolbarState = "loading" | "signed-out" | "ready";

export function StoryPublicToolbar({ handle }: { handle: string }) {
  const searchParams = useSearchParams();
  const fromCollection = searchParams.get("from") === "collection";
  const [viewState, setViewState] = useState<ToolbarState>("loading");
  const [collectionState, setCollectionState] = useState<StoryCollectionState | null>(null);

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
        if (!cancelled) setViewState("ready");
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [handle]);

  const ownStory = collectionState?.isOwnStory === true;
  const leftHref = fromCollection ? "/story/collection" : ownStory ? "/story" : viewState === "signed-out" ? "/" : "/story";
  const leftLabel = fromCollection ? "コレクション" : ownStory ? "マイSTORY" : viewState === "signed-out" ? "mikke" : "マイSTORY";

  return <nav aria-label="STORYナビゲーション" className="mx-auto mb-3 flex w-full max-w-[430px] items-center justify-between gap-2 px-2 sm:px-0"><Link href={leftHref} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-black/10 bg-white px-4 text-xs font-medium shadow-sm"><ArrowLeft size={16} />{leftLabel}</Link><div className="flex items-center gap-2">{ownStory ? <><Link href="/story/edit" aria-label="STORYを編集" className="grid h-11 w-11 place-items-center rounded-full border border-black/10 bg-white shadow-sm"><Pencil size={16} /></Link><Link href="/story/share" aria-label="QR・共有" className="grid h-11 w-11 place-items-center rounded-full border border-black/10 bg-white shadow-sm"><QrCode size={16} /></Link></> : viewState === "ready" ? <Link href="/story/collection" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-black/10 bg-white px-4 text-xs font-medium shadow-sm"><Bookmark size={15} />コレクション</Link> : viewState === "signed-out" ? <Link href="/story/start" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#f75a3b] px-4 text-xs font-medium text-white shadow-sm"><Sparkles size={15} />STORYを作る</Link> : null}</div></nav>;
}
