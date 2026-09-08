import type { MediaArticleSnapshot, MediaBlock } from "@/lib/media-app/types";
import { isSafeMediaUrl } from "@/lib/media-app/validation.js";

function Block({ block }: { block: MediaBlock }) {
  if (block.type === "heading") return block.level === 3 ? <h3 className="mt-9 text-xl font-black">{block.text}</h3> : <h2 className="mt-11 text-2xl font-black sm:text-3xl">{block.text}</h2>;
  if (block.type === "image") return block.imageUrl ? <figure className="my-8"><img src={block.imageUrl} alt={block.alt ?? ""} className="max-h-[680px] w-full rounded-2xl object-contain" />{block.caption ? <figcaption className="mt-2 text-center text-xs text-[var(--mikke-muted)]">{block.caption}</figcaption> : null}</figure> : null;
  if (block.type === "quote") return <blockquote className="my-7 border-l-4 border-[var(--mikke-primary)] bg-[var(--mikke-primary-soft)] px-5 py-4 text-base font-semibold leading-8"><p className="whitespace-pre-wrap">{block.text}</p>{block.attribution ? <cite className="mt-2 block text-xs not-italic text-[var(--mikke-muted)]">— {block.attribution}</cite> : null}</blockquote>;
  if (block.type === "list") return <ul className="my-5 list-disc space-y-2 pl-6 leading-8">{(block.items ?? []).filter(Boolean).map((item, index) => <li key={`${block.id}_${index}`}>{item}</li>)}</ul>;
  if (block.type === "divider") return <hr className="my-9 border-0 border-t border-[var(--mikke-line)]" />;
  if (block.type === "link" && block.url && isSafeMediaUrl(block.url)) return <a href={block.url} target={block.url.startsWith("http") ? "_blank" : undefined} rel={block.url.startsWith("http") ? "noreferrer" : undefined} className="my-6 block rounded-2xl border border-[var(--mikke-line)] bg-white p-5 font-bold text-[var(--mikke-primary)] shadow-sm">{block.title || block.url}</a>;
  return <p className="my-4 break-words whitespace-pre-wrap text-base leading-8 [overflow-wrap:anywhere] sm:text-[17px]">{block.text}</p>;
}

export function MediaArticleRenderer({ article, preview = false, compact = false }: { article: MediaArticleSnapshot; preview?: boolean; compact?: boolean }) {
  return <article className="mx-auto w-full max-w-3xl"><header>{preview ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">下書きプレビュー</span> : null}<div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-bold text-[var(--mikke-muted)]">{article.category ? <span className="rounded-full bg-[var(--mikke-primary-soft)] px-3 py-1 text-[var(--mikke-primary)]">{article.category}</span> : null}<time>{new Date(article.updatedAt).toLocaleDateString("ja-JP")}</time></div><h1 className={`mt-5 break-words text-3xl font-black leading-tight [overflow-wrap:anywhere] ${compact ? "" : "sm:text-5xl"}`}>{article.title}</h1>{article.coverImageUrl ? <img src={article.coverImageUrl} alt="" className="mt-8 max-h-[680px] w-full rounded-3xl object-cover" /> : null}</header><div className="mt-9">{article.blocks.map((block) => <Block key={block.id} block={block} />)}</div></article>;
}
