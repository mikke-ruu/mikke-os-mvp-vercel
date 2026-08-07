"use client";

import { Bookmark, ExternalLink, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { listMyStoryCollection, removeStoryFromCollection, type StoryCollectionItem } from "@/lib/mikkeos/story-collection-db";
import { getStoryAppPath, storyThemes } from "@/lib/mikkeos/story-profile-store";
import { supabase } from "@/lib/supabase/client";

export function StoryCollectionPage() {
  const [items, setItems] = useState<StoryCollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    listMyStoryCollection(supabase)
      .then((next) => { if (!cancelled) setItems(next); })
      .catch(() => { if (!cancelled) setMessage("コレクションを読み込めませんでした。"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const remove = async (collectionId: string) => {
    try {
      await removeStoryFromCollection(supabase, collectionId);
      setItems((current) => current.filter((item) => item.collectionId !== collectionId));
      setMessage("コレクションから外しました。");
    } catch {
      setMessage("コレクションから外せませんでした。");
    }
  };

  if (loading) return <div className="mx-auto max-w-3xl py-16 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</div>;

  return (
    <section className="mx-auto w-full max-w-3xl">
      <div className="mb-5 rounded-xl border border-[var(--mikke-line)] bg-white p-4">
        <p className="text-sm font-medium">受け取ったSTORY</p>
        <p className="mt-1 text-xs font-normal leading-5 text-[var(--mikke-muted)]">保存したことは相手に通知されません。ここはあなたにだけ表示されます。</p>
      </div>
      {message ? <p className="mb-4 rounded-xl bg-[var(--mikke-primary-soft)] px-4 py-3 text-xs text-[var(--mikke-primary)]">{message}</p> : null}
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--mikke-line)] bg-white px-6 py-14 text-center">
          <Bookmark className="mx-auto text-[var(--mikke-blue)]" size={28} />
          <p className="mt-4 text-base font-medium">まだ保存したSTORYはありません</p>
          <p className="mt-2 text-sm font-normal leading-6 text-[var(--mikke-muted)]">名刺のQRを読み、公開STORYの「コレクションに保存」を押すとここに並びます。</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => {
            const theme = storyThemes[item.themeKey] ?? storyThemes.blue;
            return <article key={item.collectionId} className="flex min-w-0 items-center gap-3 rounded-xl border border-[var(--mikke-line)] bg-white p-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full text-sm font-medium" style={{ background: theme.accent }}>
                {item.available && item.avatarUrl ? <img src={item.avatarUrl} alt="" className="h-full w-full object-cover" /> : item.available ? item.displayName.slice(0, 2) : "—"}
              </div>
              <div className="min-w-0 flex-1">
                {item.available ? <><p className="truncate text-sm font-medium">{item.displayName}</p>{item.role ? <p className="mt-1 truncate text-xs font-normal text-[var(--mikke-muted)]">{item.role}</p> : null}<p className="mt-1 truncate text-[11px] text-[var(--mikke-muted-light)]">@{item.handle}</p></> : <><p className="text-sm font-medium">現在は公開されていません</p><p className="mt-1 text-xs font-normal text-[var(--mikke-muted)]">古いプロフィール情報は表示しません。</p></>}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {item.available ? <Link href={getStoryAppPath(item.handle)} aria-label={`${item.displayName}のSTORYを見る`} className="grid h-9 w-9 place-items-center rounded-full border border-[var(--mikke-line)]"><ExternalLink size={15} /></Link> : null}
                <button type="button" aria-label="コレクションから外す" onClick={() => void remove(item.collectionId)} className="grid h-9 w-9 place-items-center rounded-full text-[var(--mikke-muted)]"><Trash2 size={15} /></button>
              </div>
            </article>;
          })}
        </div>
      )}
    </section>
  );
}
