"use client";

import type { MediaArticle, MediaBlock, MediaBlockType, MediaSite, MediaStoreState } from "./types";

export const MEDIA_APP_STORAGE_KEY = "mikke.media.free.v1";

const emptyState: MediaStoreState = { version: 1, sites: [], articles: [] };

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizeMediaSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-{2,}/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

export function isSafeMediaUrl(value: string) {
  if (!value) return true;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function createMediaBlock(type: MediaBlockType): MediaBlock {
  const id = createId("media_block");
  if (type === "heading") return { id, type, level: 2, text: "" };
  if (type === "image") return { id, type, imageUrl: "", alt: "", caption: "" };
  if (type === "quote") return { id, type, text: "", attribution: "" };
  if (type === "list") return { id, type, items: [""] };
  if (type === "divider") return { id, type };
  if (type === "link") return { id, type, title: "", url: "" };
  return { id, type: "paragraph", text: "" };
}

export function loadMediaStore(): MediaStoreState {
  if (typeof window === "undefined") return clone(emptyState);
  const raw = window.localStorage.getItem(MEDIA_APP_STORAGE_KEY);
  if (!raw) return clone(emptyState);
  try {
    const value = JSON.parse(raw) as Partial<MediaStoreState>;
    if (value.version !== 1 || !Array.isArray(value.sites) || !Array.isArray(value.articles)) return clone(emptyState);
    return value as MediaStoreState;
  } catch {
    return clone(emptyState);
  }
}

function saveMediaStore(state: MediaStoreState) {
  window.localStorage.setItem(MEDIA_APP_STORAGE_KEY, JSON.stringify(state));
}

export function getOwnedMedia(ownerProfileId: string) {
  return loadMediaStore().sites.find((site) => site.ownerProfileId === ownerProfileId) ?? null;
}

export function getMediaSite(id: string) {
  return loadMediaStore().sites.find((site) => site.id === id) ?? null;
}

export function getMediaSiteBySlug(slug: string) {
  return loadMediaStore().sites.find((site) => site.slug === normalizeMediaSlug(slug)) ?? null;
}

export function createMediaSite(input: Pick<MediaSite, "ownerProfileId" | "name" | "slug" | "description" | "authorName">) {
  const state = loadMediaStore();
  if (state.sites.some((site) => site.ownerProfileId === input.ownerProfileId)) throw new Error("Media Freeでは1つのMediaを作成できます。");
  const name = input.name.trim();
  const slug = normalizeMediaSlug(input.slug);
  if (!name) throw new Error("Media名を入力してください。");
  if (!slug) throw new Error("公開URL名を半角英数字で入力してください。");
  if (state.sites.some((site) => site.slug === slug)) throw new Error("この公開URL名はすでに使われています。");
  const now = new Date().toISOString();
  const site: MediaSite = {
    id: createId("media_site"), ownerProfileId: input.ownerProfileId, name, slug,
    description: input.description.trim(), authorName: input.authorName.trim() || name,
    categories: ["お知らせ", "使い方", "コラム"], createdAt: now, updatedAt: now
  };
  saveMediaStore({ ...state, sites: [site, ...state.sites] });
  return site;
}

export function updateMediaSite(id: string, input: Pick<MediaSite, "name" | "slug" | "description" | "authorName" | "categories">) {
  const state = loadMediaStore();
  const site = state.sites.find((item) => item.id === id);
  if (!site) throw new Error("Mediaが見つかりませんでした。");
  const slug = normalizeMediaSlug(input.slug);
  if (!input.name.trim() || !slug) throw new Error("Media名と公開URL名を入力してください。");
  if (state.sites.some((item) => item.id !== id && item.slug === slug)) throw new Error("この公開URL名はすでに使われています。");
  const updated = { ...site, ...input, name: input.name.trim(), slug, description: input.description.trim(), authorName: input.authorName.trim() || input.name.trim(), categories: input.categories.map((item) => item.trim()).filter(Boolean), updatedAt: new Date().toISOString() };
  saveMediaStore({ ...state, sites: state.sites.map((item) => item.id === id ? updated : item) });
  return updated;
}

export function listMediaArticles(mediaId: string) {
  return loadMediaStore().articles.filter((article) => article.mediaId === mediaId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getMediaArticle(id: string) {
  return loadMediaStore().articles.find((article) => article.id === id) ?? null;
}

export function getPublishedMediaArticle(mediaId: string, slug: string) {
  return loadMediaStore().articles.find((article) => article.mediaId === mediaId && article.publishedSnapshot?.slug === normalizeMediaSlug(slug)) ?? null;
}

export type SaveMediaArticleInput = Pick<MediaArticle, "title" | "slug" | "excerpt" | "category" | "coverImageUrl" | "coverImageAssetId" | "blocks">;

export function saveMediaArticle(mediaId: string, articleId: string | null, input: SaveMediaArticleInput) {
  const state = loadMediaStore();
  const title = input.title.trim();
  const slug = normalizeMediaSlug(input.slug);
  if (!title) throw new Error("タイトルを入力してください。");
  if (!slug) throw new Error("記事URL名を半角英数字で入力してください。");
  if (state.articles.some((article) => article.mediaId === mediaId && article.id !== articleId && (article.slug === slug || article.publishedSnapshot?.slug === slug))) throw new Error("このURL名の記事はすでにあります。");
  const now = new Date().toISOString();
  const current = articleId ? state.articles.find((article) => article.id === articleId) : null;
  const article: MediaArticle = current ? { ...current, ...input, title, slug, updatedAt: now } : {
    id: createId("media_article"), mediaId, ...input, title, slug, status: "draft", publishedSnapshot: null, createdAt: now, updatedAt: now
  };
  saveMediaStore({ ...state, articles: current ? state.articles.map((item) => item.id === current.id ? article : item) : [article, ...state.articles] });
  return article;
}

export function publishMediaArticle(articleId: string) {
  const state = loadMediaStore();
  const current = state.articles.find((article) => article.id === articleId);
  if (!current) throw new Error("公開する記事が見つかりませんでした。");
  const now = new Date().toISOString();
  const article: MediaArticle = {
    ...current, status: "published", updatedAt: now,
    publishedSnapshot: { title: current.title, slug: current.slug, excerpt: current.excerpt, category: current.category, coverImageUrl: current.coverImageUrl, blocks: clone(current.blocks), publishedAt: current.publishedSnapshot?.publishedAt ?? now, updatedAt: now }
  };
  saveMediaStore({ ...state, articles: state.articles.map((item) => item.id === articleId ? article : item) });
  return article;
}

export function unpublishMediaArticle(articleId: string) {
  const state = loadMediaStore();
  const current = state.articles.find((article) => article.id === articleId);
  if (!current) throw new Error("記事が見つかりませんでした。");
  const article: MediaArticle = { ...current, status: "unpublished", publishedSnapshot: null, updatedAt: new Date().toISOString() };
  saveMediaStore({ ...state, articles: state.articles.map((item) => item.id === articleId ? article : item) });
  return article;
}
