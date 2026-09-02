import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MediaArticleRenderer } from "./MediaArticleRenderer";
import { PublicFrame } from "./PublicMediaHome";
import type { MediaPublicArticleDTO, MediaPublicSiteDTO } from "@/lib/media-app/public-contract";

export function PublicMediaArticle({ site, article }: { site: MediaPublicSiteDTO; article: MediaPublicArticleDTO }) {
  const snapshot = { ...article, category: article.categoryName, publishedAt: article.publishedAt };
  return <PublicFrame title={site.name}><div className="py-8 sm:py-14"><Link href={`/media/${site.slug}`} className="inline-flex max-w-full items-center gap-1 break-words text-xs font-bold text-[var(--mikke-primary)]"><ArrowLeft size={14} className="shrink-0" />{site.name}</Link><section className="mt-6 rounded-3xl border border-[var(--mikke-line)] bg-white px-5 py-9 shadow-sm sm:px-10 sm:py-14"><MediaArticleRenderer article={snapshot} /><footer className="mx-auto mt-12 max-w-3xl border-t border-[var(--mikke-line)] pt-6 text-sm text-[var(--mikke-muted)]">編集：{site.authorName}</footer></section><p className="mt-6 text-center text-[11px] text-[var(--mikke-muted)]">Media Free ローカルpilot表示</p></div></PublicFrame>;
}
