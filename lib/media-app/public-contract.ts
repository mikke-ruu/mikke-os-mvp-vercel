import { isSafeMediaUrl } from "./validation.js";

export type MediaPublicBlockDTO =
  | { id: string; type: "paragraph"; text: string }
  | { id: string; type: "heading"; text: string; level: 2 | 3 }
  | { id: string; type: "image"; imageUrl: string; alt: string; caption?: string }
  | { id: string; type: "quote"; text: string; attribution?: string }
  | { id: string; type: "list"; items: string[] }
  | { id: string; type: "divider" }
  | { id: string; type: "link"; url: string; title?: string };

export type MediaPublicSiteDTO = {
  name: string;
  slug: string;
  description: string;
  authorName: string;
  locale: string;
  categories: string[];
};

export type MediaPublicArticleSummaryDTO = {
  title: string;
  slug: string;
  excerpt: string;
  categoryName: string;
  coverImageUrl: string;
  locale: string;
  versionNumber: number;
  revisionHash: string;
  publishedAt: string;
  updatedAt: string;
};

export type MediaPublicArticleDTO = MediaPublicArticleSummaryDTO & {
  blocks: MediaPublicBlockDTO[];
};

export interface MediaPublicTransport {
  readSite(mediaSlug: string, locale?: string): Promise<unknown>;
  readArticles(mediaSlug: string, locale?: string): Promise<unknown>;
  readArticle(mediaSlug: string, articleSlug: string, locale?: string): Promise<unknown>;
}

const siteKeys = ["authorName", "categories", "description", "locale", "name", "slug"];
const summaryKeys = ["categoryName", "coverImageUrl", "excerpt", "locale", "publishedAt", "revisionHash", "slug", "title", "updatedAt", "versionNumber"];
const articleKeys = [...summaryKeys, "blocks"].sort();
const blockKeys = {
  paragraph: ["id", "text", "type"],
  heading: ["id", "level", "text", "type"],
  image: ["alt", "caption", "id", "imageUrl", "type"],
  quote: ["attribution", "id", "text", "type"],
  list: ["id", "items", "type"],
  divider: ["id", "type"],
  link: ["id", "title", "type", "url"]
} as const;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function hasExactKeys(value: Record<string, unknown>, allowed: readonly string[]) {
  const keys = Object.keys(value);
  return keys.length === allowed.length && keys.every((key) => allowed.includes(key));
}

function string(value: unknown, max: number) {
  return typeof value === "string" && value.length <= max;
}

function validSlug(value: unknown) {
  return typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function validRevision(value: unknown) {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function validDate(value: unknown) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function validBlock(value: unknown): value is MediaPublicBlockDTO {
  const item = record(value);
  if (!item || !string(item.id, 80) || typeof item.type !== "string" || !string(item.type, 20) || !(item.type in blockKeys)) return false;
  const type = item.type as keyof typeof blockKeys;

  switch (type) {
    case "paragraph":
      return hasExactKeys(item, blockKeys.paragraph) && string(item.text, 20000);
    case "heading":
      return hasExactKeys(item, blockKeys.heading) && string(item.text, 500) && (item.level === 2 || item.level === 3);
    case "image": {
      const required = item.caption === undefined ? ["alt", "id", "imageUrl", "type"] : blockKeys.image;
      return hasExactKeys(item, required) && string(item.imageUrl, 2048) && isSafeMediaUrl(item.imageUrl as string)
        && string(item.alt, 500) && (item.caption === undefined || string(item.caption, 1000));
    }
    case "quote": {
      const required = item.attribution === undefined ? ["id", "text", "type"] : blockKeys.quote;
      return hasExactKeys(item, required) && string(item.text, 20000)
        && (item.attribution === undefined || string(item.attribution, 500));
    }
    case "list":
      return hasExactKeys(item, blockKeys.list) && Array.isArray(item.items) && item.items.length <= 100
        && item.items.every((entry) => string(entry, 2000));
    case "divider":
      return hasExactKeys(item, blockKeys.divider);
    case "link": {
      const required = item.title === undefined ? ["id", "type", "url"] : blockKeys.link;
      return hasExactKeys(item, required) && string(item.url, 2048) && isSafeMediaUrl(item.url as string)
        && (item.title === undefined || string(item.title, 500));
    }
  }
}

function parseSummary(value: unknown): MediaPublicArticleSummaryDTO | null {
  const item = record(value);
  if (!item || !hasExactKeys(item, summaryKeys)) return null;
  if (!string(item.title, 160) || !validSlug(item.slug) || !string(item.excerpt, 500) || !string(item.categoryName, 60)) return null;
  if (!string(item.coverImageUrl, 2048) || !isSafeMediaUrl(item.coverImageUrl as string) || !string(item.locale, 16)) return null;
  if (!Number.isInteger(item.versionNumber) || (item.versionNumber as number) < 1 || !validRevision(item.revisionHash)) return null;
  if (!validDate(item.publishedAt) || !validDate(item.updatedAt)) return null;
  return item as MediaPublicArticleSummaryDTO;
}

export function parseMediaPublicSite(value: unknown): MediaPublicSiteDTO | null {
  const item = record(value);
  if (!item || !hasExactKeys(item, siteKeys)) return null;
  if (!string(item.name, 120) || !validSlug(item.slug) || !string(item.description, 500) || !string(item.authorName, 120) || !string(item.locale, 16)) return null;
  if (!Array.isArray(item.categories) || item.categories.length > 100 || item.categories.some((entry) => !string(entry, 60))) return null;
  return item as MediaPublicSiteDTO;
}

export function parseMediaPublicArticles(value: unknown): MediaPublicArticleSummaryDTO[] | null {
  if (!Array.isArray(value) || value.length > 50) return null;
  const parsed = value.map(parseSummary);
  return parsed.every(Boolean) ? parsed as MediaPublicArticleSummaryDTO[] : null;
}

export function parseMediaPublicArticle(value: unknown): MediaPublicArticleDTO | null {
  const item = record(value);
  if (!item || !hasExactKeys(item, articleKeys)) return null;
  const summary = parseSummary(Object.fromEntries(summaryKeys.map((key) => [key, item[key]])));
  if (!summary || !Array.isArray(item.blocks) || item.blocks.length > 200 || !item.blocks.every(validBlock)) return null;
  return { ...summary, blocks: item.blocks };
}

export function createMediaPublicReader(transport: MediaPublicTransport) {
  return {
    async site(mediaSlug: string, locale?: string) {
      return parseMediaPublicSite(await transport.readSite(mediaSlug, locale));
    },
    async articles(mediaSlug: string, locale?: string) {
      return parseMediaPublicArticles(await transport.readArticles(mediaSlug, locale));
    },
    async article(mediaSlug: string, articleSlug: string, locale?: string) {
      return parseMediaPublicArticle(await transport.readArticle(mediaSlug, articleSlug, locale));
    }
  };
}

export function mediaCanonicalPath(mediaSlug: string, articleSlug?: string) {
  if (!validSlug(mediaSlug) || (articleSlug !== undefined && !validSlug(articleSlug))) return null;
  return articleSlug ? `/media/${mediaSlug}/${articleSlug}` : `/media/${mediaSlug}`;
}

export function mediaCanonicalUrl(mediaSlug: string, articleSlug?: string) {
  const path = mediaCanonicalPath(mediaSlug, articleSlug);
  return path ? `https://app.mikke-os.com${path}` : null;
}
