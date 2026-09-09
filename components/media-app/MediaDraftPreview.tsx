"use client";

import { MediaLink as Link } from "./MediaNavigation";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { MediaArticleRenderer } from "./MediaArticleRenderer";
import { getMediaArticle } from "@/lib/media-app/store";
import type { MediaArticle } from "@/lib/media-app/types";

export function MediaDraftPreview() {
  const search = useSearchParams(); const id = search.get("article"); const [article, setArticle] = useState<MediaArticle | null>(null);
  useEffect(() => { setArticle(id ? getMediaArticle(id) : null); }, [id]);
  if (!article) return <p className="rounded-2xl border border-dashed border-[var(--mikke-line)] p-8 text-center text-sm">プレビューする記事が見つかりません。</p>;
  const now = new Date().toISOString();
  return <div><Link href={`/apps/media/write?article=${article.id}`} className="inline-flex items-center gap-1 text-sm font-bold text-[var(--mikke-primary)]"><ArrowLeft size={15} />編集へ戻る</Link><section className="mt-5 rounded-3xl border border-[var(--mikke-line)] bg-white px-5 py-9 shadow-sm sm:px-10 sm:py-14"><MediaArticleRenderer preview article={{ title: article.title, slug: article.slug, excerpt: article.excerpt, category: article.category, coverImageUrl: article.coverImageUrl, blocks: article.blocks, publishedAt: article.publishedSnapshot?.publishedAt ?? now, updatedAt: article.updatedAt }} /></section></div>;
}
