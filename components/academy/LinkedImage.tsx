export function safeImageLink(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function LinkedImage({ src, caption = "", linkUrl, className }: {
  src: string; caption?: string; linkUrl?: string; className?: string;
}) {
  const href = safeImageLink(linkUrl);
  const picture = <img src={src} alt={caption} className={className} />;
  return href ? <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`${caption || "画像"}のリンクを開く（別タブ）`} className="block rounded-lg focus-visible:outline-2 focus-visible:outline-[var(--mikke-primary)]">{picture}</a> : picture;
}
