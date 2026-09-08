/** Non-production integration seam. Supply a server-authorized, fresh read;
 * client selections and localStorage are never authorization evidence. */
export type MediaDestination = { kind: "story" | "page" | "academy"; key: string };
export type MediaCardSelection = {
  destination: MediaDestination;
  mediaSlug: string;
  articleSlug: string;
  locale: string;
  approvedRevision: string;
  // Must change on EVERY publish cycle, even when content is identical.
  approvedPublication: string;
};
export type SelectedMediaCard = {
  title: string;
  excerpt: string;
  canonicalUrl: string;
  publishedAt: string;
};
export type MediaCardProvider = (selection: Readonly<MediaCardSelection>, signal: AbortSignal) => Promise<unknown>;
const slug = (value: unknown): value is string => typeof value === "string" && value.length <= 100 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const nonempty = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 200;
function validSelection(value: MediaCardSelection, destination: MediaDestination) {
  return value && value.destination?.kind === destination.kind && value.destination.key === destination.key
    && slug(value.mediaSlug) && slug(value.articleSlug) && /^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(value.locale)
    && /^[a-f0-9]{64}$/.test(value.approvedRevision) && nonempty(value.approvedPublication);
}
const keys = ["destinationKind", "destinationKey", "mediaSlug", "articleSlug", "locale", "revision", "publication", "active", "sourcePublished", "destinationPublished", "access", "title", "excerpt", "publishedAt"];
function project(value: unknown, selection: MediaCardSelection): SelectedMediaCard | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (Object.keys(row).length !== keys.length || Object.keys(row).some(key => !keys.includes(key))) return null;
  if (row.active !== true || row.sourcePublished !== true || row.destinationPublished !== true || row.access !== "free") return null;
  if (row.destinationKind !== selection.destination.kind || row.destinationKey !== selection.destination.key
    || row.mediaSlug !== selection.mediaSlug || row.articleSlug !== selection.articleSlug || row.locale !== selection.locale
    || row.revision !== selection.approvedRevision || row.publication !== selection.approvedPublication) return null;
  // Current Free canonical route is Japanese only. Locale routing needs its own adapter.
  if (row.locale !== "ja") return null;
  if (typeof row.title !== "string" || !row.title.trim() || row.title.length > 160
    || typeof row.excerpt !== "string" || row.excerpt.length > 500
    || typeof row.publishedAt !== "string" || !Number.isFinite(Date.parse(row.publishedAt))) return null;
  // Text-only first slice: no private Storage path or arbitrary image URL can escape.
  return { title: row.title, excerpt: row.excerpt,
    canonicalUrl: `https://app.mikke-os.com/media/${selection.mediaSlug}/${selection.articleSlug}`, publishedAt: row.publishedAt };
}
export async function resolveSelectedMediaCards(destination: MediaDestination, selections: readonly MediaCardSelection[], provider: MediaCardProvider, options: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<SelectedMediaCard[]> {
  if (options.signal?.aborted || !["story", "page", "academy"].includes(destination.kind) || !nonempty(destination.key)) return [];
  if (!Array.isArray(selections) || selections.length === 0 || selections.length > 12) return [];
  // Freeze the request semantics before awaits; caller/session changes cannot mutate it.
  const requests = selections.filter(item => validSelection(item, destination)).map(item => ({ ...item, destination: { ...item.destination } }));
  const controller = new AbortController();
  const cancel = () => controller.abort();
  options.signal?.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(cancel, Math.min(10000, Math.max(1, options.timeoutMs ?? 3000)));
  try {
    const stopped = new Promise<null>(resolve => controller.signal.addEventListener("abort", () => resolve(null), { once: true }));
    const results = await Promise.all(requests.map(async selection => {
      try {
        const result = await Promise.race([provider(selection, controller.signal), stopped]);
        return controller.signal.aborted ? null : project(result, selection);
      } catch { return null; }
    }));
    if (controller.signal.aborted) return [];
    const seen = new Set<string>();
    return results.filter((card): card is SelectedMediaCard => {
      if (!card || seen.has(card.canonicalUrl)) return false;
      seen.add(card.canonicalUrl); return true;
    });
  } finally { clearTimeout(timeout); options.signal?.removeEventListener("abort", cancel); }
}
