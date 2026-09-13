import { MikkeContentRenderer } from "@/components/mikkeos/content/MikkeContentRenderer";
import type { MikkeContentBlock } from "@/lib/mikkeos/content/types";
import { safeImageLink } from "./LinkedImage";
function Image({src,alt,className}:{src:string;alt:string;className?:string}) {
  // Use the same Academy-hosted image URLs, not Media storage or document lookup.
  return <img src={src} alt={alt} className={className} loading="lazy"/>;
}
function LinkCard({block}:{block:MikkeContentBlock}) {
  const href = safeImageLink(block.url);
  return href ? <a href={href} target="_blank" rel="noopener noreferrer" className="my-4 block break-words rounded-lg border border-[var(--mikke-line)] p-4 text-[var(--mikke-primary)]">{block.type === "video" ? "▶ " : ""}{block.title || href} ↗</a> : <p className="text-sm text-[var(--mikke-muted)]">リンク先を設定してください。</p>;
}
export function AcademyContentRenderer({blocks}:{blocks:MikkeContentBlock[]}) {
  return <MikkeContentRenderer blocks={blocks} Image={Image} LinkCard={LinkCard}/>;
}
