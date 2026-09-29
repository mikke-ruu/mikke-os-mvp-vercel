import { LpContent } from "@/components/mikkeos/page-builder/LpDesign";
import type { LpBlock } from "@/components/mikkeos/page-builder/lp-design";
import { MikkeContentRenderer } from "@/components/mikkeos/content/MikkeContentRenderer";
import type { MikkeContentBlock } from "@/lib/mikkeos/content/types";
import { safeImageLink } from "./LinkedImage";
import { mediaYoutubeId } from "@/lib/media-app/youtube";
function Image({src,alt,className}:{src:string;alt:string;className?:string}) {
  // Use the same Academy-hosted image URLs, not Media storage or document lookup.
  return <img src={src} alt={alt} className={className} loading="lazy"/>;
}
export function AcademyContentLink({block}:{block:MikkeContentBlock}) {
  const href = safeImageLink(block.url);
  const video = href ? mediaYoutubeId(href) : null;
  if (block.type === "video" && href && /\.(mp4|webm|ogg)(?:[?#]|$)/i.test(href)) return <figure className="my-6"><video className="w-full rounded-lg" src={href} controls preload="metadata" aria-label={block.title || "動画"}/>{block.title && <figcaption>{block.title}</figcaption>}</figure>;
  if (video) return <figure className="my-6"><iframe title={block.title || "YouTube動画"} src={`https://www.youtube-nocookie.com/embed/${video}`} className="aspect-video w-full rounded-lg border-0" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /><a href={href!} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs underline">YouTubeで見る ↗</a></figure>;
  // Opt-in lesson settings only. Existing cards keep their current presentation.
  if (href && block.type === "link" && block.lessonLinkDisplay) return <a href={href} target="_blank" rel="noopener noreferrer" className={block.lessonLinkDisplay === "text" ? "my-4 inline-block underline" : "my-4 block rounded-lg border border-[var(--mikke-line)] p-4"}><strong>{block.title || href} ↗</strong>{block.lessonLinkDisplay !== "text" && block.text && <p className="mt-2 text-sm text-[var(--mikke-muted)]">{block.text}</p>}</a>;
  if (href && block.type === "video" && block.lessonVideoPreview) return <a href={href} target="_blank" rel="noopener noreferrer" className="my-6 block overflow-hidden rounded-lg border border-[var(--mikke-line)]"><div className="relative aspect-video bg-slate-100">{block.imageUrl && <img src={block.imageUrl} alt="" className="aspect-video w-full object-contain"/>}<span className="absolute inset-0 grid place-items-center text-4xl" aria-hidden="true">▶</span></div><p className="p-4">{block.title || "動画を見る"} ↗</p></a>;
  return href ? <a href={href} target="_blank" rel="noopener noreferrer" className="my-4 block break-words rounded-lg border border-[var(--mikke-line)] p-4 text-[var(--mikke-primary)]">{block.type === "video" ? "▶ " : ""}{block.title || href} ↗</a> : <p className="text-sm text-[var(--mikke-muted)]">リンク先を設定してください。</p>;
}
export function AcademyContentRenderer({blocks, presentationHandled = false}:{blocks:MikkeContentBlock[]; presentationHandled?: boolean}) {
  // The gallery editor stores its description in alt. Keep explicit captions and
  // show existing descriptions without migrating or rewriting saved content.
  const displayBlocks = blocks.map(block => block.type === "gallery" ? {
    ...block, images: block.images?.map(image => ({ ...image, caption: image.caption ?? image.alt }))
  } : block);
  const render = (items: MikkeContentBlock[]) => <MikkeContentRenderer blocks={items} Image={Image} LinkCard={AcademyContentLink}/>;
  return !presentationHandled ? <LpContent blocks={displayBlocks as LpBlock[]} render={render}/> : render(displayBlocks);
}
