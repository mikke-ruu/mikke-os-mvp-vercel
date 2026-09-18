import { MikkeContentRenderer } from "@/components/mikkeos/content/MikkeContentRenderer";
import { MediaLinkCard } from "./MediaLinkCard";
import { MediaImage } from "./MediaImage";
import type { MediaArticleSnapshot, MediaBlock } from "@/lib/media-app/types";
import { isSafeMediaUrl } from "@/lib/media-app/validation.js";

export function MediaArticleRenderer({ article, preview = false, compact = false }: { article: MediaArticleSnapshot; preview?: boolean; compact?: boolean }) {
  return <article className="mx-auto w-full max-w-3xl"><header>{preview ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">下書きプレビュー</span> : null}<div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-bold text-[var(--mikke-muted)]">{(article.categories?.length?article.categories:[article.category].filter(Boolean)).map(category=><span key={category} className="rounded-full bg-[var(--mikke-primary-soft)] px-3 py-1 text-[var(--mikke-primary)]">{category}</span>)}<time>{new Date(article.updatedAt).toLocaleDateString("ja-JP")}</time></div><h1 className={`mt-4 break-words text-2xl font-bold leading-snug [overflow-wrap:anywhere] ${compact ? "" : "sm:text-4xl"}`}>{article.title}</h1>{article.coverImageUrl ? <MediaImage src={article.coverImageUrl} alt="" className="mt-5 max-h-[680px] w-full rounded-lg object-cover" /> : null}</header><div className="mt-6"><MikkeContentRenderer blocks={article.blocks} Image={MediaImage} LinkCard={MediaLinkCard}/></div></article>;
}
