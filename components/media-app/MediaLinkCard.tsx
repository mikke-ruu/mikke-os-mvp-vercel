import { mediaYoutubeId } from "@/lib/media-app/youtube";
import type { MediaBlock } from "@/lib/media-app/types";
import { isSafeMediaUrl } from "@/lib/media-app/validation.js";
import { MediaImage } from "./MediaImage";
export function MediaLinkCard({ block }: { block: MediaBlock }) {
  if (!block.url || !isSafeMediaUrl(block.url)) return null;
  const video=mediaYoutubeId(block.url);
  if(video) return <figure className="my-6"><iframe title={block.title || "YouTube動画"} src={`https://www.youtube-nocookie.com/embed/${video}`} className="aspect-video min-h-[200px] w-full rounded-lg border-0" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen/><a href={block.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs underline">YouTubeで見る ↗</a></figure>;
  let domain="";try {domain=new URL(block.url).hostname;} catch {}
  return <a href={block.url} target="_blank" rel="noopener noreferrer" className="my-6 flex overflow-hidden rounded-xl border border-[var(--mikke-line)] bg-white text-[var(--mikke-text)]"><div className="min-w-0 flex-1 p-4 sm:p-5"><p className="line-clamp-2 break-words font-bold leading-6">{block.title || domain || block.url}</p>{block.text ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--mikke-muted)]">{block.text}</p> : null}<p className="mt-3 truncate text-xs text-[var(--mikke-muted)]">{domain}</p></div>{block.imageUrl ? <div className="flex w-[38%] shrink-0 items-center border-l border-[var(--mikke-line)]"><MediaImage src={block.imageUrl} alt="" className="max-h-52 w-full object-contain" /></div> : null}</a>;
}
