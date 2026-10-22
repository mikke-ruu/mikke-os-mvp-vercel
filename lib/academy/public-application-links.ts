/** IDs are taken only from links already present in the public front document. */
export function existingPublicApplicationIds(document: unknown, currentOrigin?: string): string[] {
  const origins = new Set(['https://app.mikke-os.com']);
  if (currentOrigin) origins.add(currentOrigin);
  const ids = new Set<string>();
  let nodes = 0;
  const visit = (value: unknown, depth: number) => {
    if (++nodes > 2000 || depth > 8 || ids.size >= 12) return;
    if (Array.isArray(value)) { for (const item of value) visit(item, depth + 1); return; }
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      if (['buttonUrl', 'linkUrl', 'url', 'href'].includes(key) && typeof item === 'string') {
        if (item !== item.trim() || /[\s\\\u0000-\u001f\u007f]/u.test(item)) continue;
        try {
          const url = new URL(item, 'https://app.mikke-os.com');
          if (!origins.has(url.origin) || url.username || url.password || url.search) continue;
          const match = url.pathname.match(/^\/academy\/o\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i);
          if (match && (!url.hash || url.hash === '#apply')) ids.add(match[1].toLowerCase());
        } catch { /* A malformed public link is not an application destination. */ }
      } else if (item && typeof item === 'object') visit(item, depth + 1);
    }
  };
  visit(document, 0);
  return [...ids];
}
