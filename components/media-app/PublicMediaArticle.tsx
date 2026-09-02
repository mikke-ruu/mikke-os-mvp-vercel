"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { MediaArticleRenderer } from "./MediaArticleRenderer";
import { PublicFrame } from "./PublicMediaHome";
import { getMediaSiteBySlug, getPublishedMediaArticle } from "@/lib/media-app/store";
import type { MediaArticle, MediaSite } from "@/lib/media-app/types";

export function PublicMediaArticle({ mediaSlug, articleSlug }: { mediaSlug: string; articleSlug: string }) {
  const [site, setSite] = useState<MediaSite | null>(null); const [article, setArticle] = useState<MediaArticle | null>(null);
  useEffect(() => { const nextSite = getMediaSiteBySlug(mediaSlug); setSite(nextSite); setArticle(nextSite ? getPublishedMediaArticle(nextSite.id, articleSlug) : null); }, [articleSlug, mediaSlug]);
  if (!site || !article?.publishedSnapshot) return <PublicFrame title={site?.name ?? "Media"}><div className="grid min-h-[65vh] place-items-center text-center"><div><h1 className="text-2xl font-black">記事が見つかりません</h1><p className="mt-2 text-sm text-[var(--mikke-muted)]">非公開になったか、URLが変更されています。</p>{site ? <Link href={`/media/${site.slug}`} className="mt-5 inline-flex rounded-xl bg-[var(--mikke-primary)] px-4 py-3 text-sm font-bold text-white">記事一覧へ</Link> : null}</div></div></PublicFrame>;
  return <PublicFrame title={site.name}><div className="py-8 sm:py-14"><Link href={`/media/${site.slug}`} className="inline-flex items-center gap-1 text-xs font-bold text-[var(--mikke-primary)]"><ArrowLeft size={14} />{site.name}</Link><section className="mt-6 rounded-3xl border border-[var(--mikke-line)] bg-white px-5 py-9 shadow-sm sm:px-10 sm:py-14"><MediaArticleRenderer article={article.publishedSnapshot} /><footer className="mx-auto mt-12 max-w-3xl border-t border-[var(--mikke-line)] pt-6 text-sm text-[var(--mikke-muted)]">編集：{site.authorName}</footer></section><p className="mt-6 text-center text-[11px] text-[var(--mikke-muted)]">Media Free ローカルpilot表示</p></div></PublicFrame>;
}
