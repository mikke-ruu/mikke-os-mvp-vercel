"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthGate";
import { getMediaArticle, getOwnedMedia, listMediaArticles } from "@/lib/media-app/store";
import type { MediaArticle, MediaSite } from "@/lib/media-app/types";
import { MediaArticleRenderer } from "./MediaArticleRenderer";
import { MediaLink } from "./MediaNavigation";

export function MediaReaderPreview() {
  const { profile } = useAuth();
  const id = useSearchParams().get("article");
  const [data, setData] = useState<{ site: MediaSite; article: MediaArticle; related: MediaArticle[] } | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const site = getOwnedMedia(profile.id);
    const article = id ? getMediaArticle(id) : null;
    // Local preview never promotes a draft into public data or ownership.
    if (site && article?.mediaId === site.id) {
      const related = listMediaArticles(site.id).filter((item) => item.id !== article.id && item.publishedSnapshot && item.category === article.category).slice(0, 3);
      setData({ site, article, related });
    } else setData(null);
    setLoaded(true);
  }, [profile.id, id]);
  if (!loaded || (data && (data.site.ownerProfileId !== profile.id || data.article.id !== id))) return <p className="p-10">記事を開いています…</p>;
  if (!data) return <main className="mx-auto max-w-3xl p-10"><p>表示できる記事がありません。</p><MediaLink href="/apps/media/articles">記事一覧へ戻る</MediaLink></main>;
  const { site, article, related } = data;
  return <main className="min-h-screen bg-white text-[var(--mikke-text)]">
    <header className="border-b border-[var(--mikke-line)] px-5 py-7"><div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4"><a href="#media-about" className="text-xl font-bold tracking-wide">{site.name}</a><a href="#media-about" className="text-sm text-[var(--mikke-muted)]">このメディアについて</a></div></header>
    <div className="mx-auto max-w-3xl px-5 py-10 sm:py-16">
      <MediaArticleRenderer article={{ ...article, publishedAt: article.publishedSnapshot?.publishedAt ?? article.createdAt }} />
      <div className="mt-9 flex items-center gap-3 border-b border-[var(--mikke-line)] pb-8"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--mikke-primary-soft)] font-bold text-[var(--mikke-primary)]" aria-hidden>{site.authorName.slice(0,1)}</span><div><p className="text-xs text-[var(--mikke-muted)]">この記事を書いた人</p><a href="#media-about" className="mt-1 block font-semibold">{site.authorName}</a></div></div>
      <section id="media-about" className="scroll-mt-6 py-9"><h2 className="text-lg font-bold">{site.name}について</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-8 text-[var(--mikke-muted)]">{site.description}</p><p className="mt-4 text-sm">書き手：{site.authorName}</p></section>
      {related.length ? <section className="border-t border-[var(--mikke-line)] py-8"><h2 className="text-lg font-bold">あわせて読みたい</h2>{related.map((item) => <MediaLink key={item.id} href={`/apps/media/reader?article=${item.id}`} className="mt-4 block border-b border-[var(--mikke-line)] pb-4 text-[var(--mikke-primary)]">{item.publishedSnapshot!.title}</MediaLink>)}</section> : null}
    </div>
    <footer className="border-t border-[var(--mikke-line)] px-5 py-8 text-center text-xs leading-7 text-[var(--mikke-muted)]"><p>{site.name} · Media by mikke</p><p>読者向けデザインの確認用です。このページは外部公開されていません。</p><MediaLink href={`/apps/media/write?article=${article.id}`} className="underline">執筆画面に戻る</MediaLink></footer>
  </main>;
}
