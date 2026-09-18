import { validPublicBlock as validBlock, type MediaPublicBlockDTO } from "./public-blocks";
export type { MediaPublicBlockDTO } from "./public-blocks";

export type MediaPresentation = {
 bannerImageUrl:string;bannerPosition:number;logoImageUrl:string;authorAvatarUrl:string;authorBio:string;storyUrl:string;
 articles:{slug:string;categories:string[];pinned:boolean;publicationOrder:number;displayDate:string}[];
 collections:{id:string;name:string;slugs:string[]}[];
};
export type MediaPublicSiteDTO = {
 presentation?:MediaPresentation;
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
  categories?: string[];
  blocks: MediaPublicBlockDTO[];
};

export interface MediaPublicTransport {
  readSite(mediaSlug: string, locale?: string): Promise<unknown>;
  readArticles(mediaSlug: string, locale?: string): Promise<unknown>;
  readArticle(mediaSlug: string, articleSlug: string, locale?: string): Promise<unknown>;
}

const siteKeys = ["authorName", "categories", "description", "locale", "name", "slug"];
const publicImageUrl=(value:string)=>value===""||(/^\/media\/images\/[a-f0-9]{64}$/.test(value)&&!/[\r\n]/.test(value));
const summaryKeys = ["categoryName", "coverImageUrl", "excerpt", "locale", "publishedAt", "revisionHash", "slug", "title", "updatedAt", "versionNumber"];
const articleKeys = [...summaryKeys, "blocks"].sort();
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

function parseSummary(value: unknown): MediaPublicArticleSummaryDTO | null {
  const item = record(value);
  if (!item || !hasExactKeys(item, summaryKeys)) return null;
  if (!string(item.title, 160) || !validSlug(item.slug) || !string(item.excerpt, 500) || !string(item.categoryName, 60)) return null;
  if (!string(item.coverImageUrl, 2048) || !publicImageUrl(item.coverImageUrl as string) || !string(item.locale, 16)) return null;
  if (!Number.isInteger(item.versionNumber) || (item.versionNumber as number) < 1 || !validRevision(item.revisionHash)) return null;
  if (!validDate(item.publishedAt) || !validDate(item.updatedAt)) return null;
  return item as MediaPublicArticleSummaryDTO;
}

export function parseMediaPublicSite(value: unknown): MediaPublicSiteDTO | null {
  const item = record(value);
  if (!item || !hasExactKeys(item, item.presentation===undefined?siteKeys:[...siteKeys,"presentation"])) return null;
  if(item.presentation!==undefined&&!validPresentation(item.presentation))return null;
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

export function validPresentation(value:unknown):value is MediaPresentation {
 const v=record(value);if(!v||!hasExactKeys(v,["bannerImageUrl","bannerPosition","logoImageUrl","authorAvatarUrl","authorBio","storyUrl","articles","collections"]))return false;
 if(![v.bannerImageUrl,v.logoImageUrl,v.authorAvatarUrl].every(x=>typeof x==="string"&&(x===""||/^\/media\/site-images\/[a-f0-9]{64}$/.test(x))))return false;
 if(!Number.isInteger(v.bannerPosition)||Number(v.bannerPosition)<0||Number(v.bannerPosition)>100||!string(v.authorBio,500)||typeof v.storyUrl!=="string"||(v.storyUrl!==""&&!/^https:\/\/app\.mikke-os\.com\/story\/[a-z0-9_-]+$/.test(v.storyUrl)))return false;
 if(!Array.isArray(v.articles)||!v.articles.every(x=>{const a=record(x);return a&&hasExactKeys(a,["slug","categories","pinned","publicationOrder","displayDate"])&&validSlug(a.slug)&&Array.isArray(a.categories)&&a.categories.length<=100&&a.categories.every(c=>string(c,60))&&typeof a.pinned==="boolean"&&Number.isInteger(a.publicationOrder)&&validDate(a.displayDate);} ))return false;
 return Array.isArray(v.collections)&&v.collections.length<=500&&v.collections.every(x=>{const c=record(x);return c&&hasExactKeys(c,["id","name","slugs"])&&typeof c.id==="string"&&/^[a-f0-9-]{36}$/.test(c.id)&&string(c.name,120)&&Array.isArray(c.slugs)&&c.slugs.every(validSlug);});
}
