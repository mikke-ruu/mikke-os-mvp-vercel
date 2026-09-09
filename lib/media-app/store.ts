"use client";

import type { MediaArticle, MediaBlock, MediaBlockType, MediaSite, MediaStoreState } from "./types";
export { isSafeMediaUrl, normalizeMediaSlug } from "./validation.js";
import { isSafeMediaUrl, normalizeMediaSlug } from "./validation.js";
import { normalizeMediaStoryUrl } from "./profile-links.js";

export const MEDIA_APP_STORAGE_KEY = "mikke.media.free.v1";

const emptyState: MediaStoreState = { version: 1, sites: [], articles: [] };

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
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

// Local design fixture only; never used as server authorization or imported to DB.
export function updateMediaAuthorProfile(siteId: string, input: { authorBio: string; storyUrl: string; showStory: boolean }) {
  const state = loadMediaStore();
  const site = state.sites.find((item) => item.id === siteId);
  if (!site) throw new Error("Mediaが見つかりませんでした。");
  const authorBio = input.authorBio.trim();
  if (Array.from(authorBio).length > 500) throw new Error("自己紹介は500文字以内で入力してください。");
  const storyUrl = normalizeMediaStoryUrl(input.storyUrl);
  if ((input.storyUrl.trim() || input.showStory) && !storyUrl) throw new Error("公開STORYのURLを入力してください。編集画面のURLは使えません。");
  const updated = { ...site, authorBio, storyUrl, showStory: input.showStory === true, updatedAt: new Date().toISOString() };
  saveMediaStore({ ...state, sites: state.sites.map((item) => item.id === siteId ? updated : item) });
  return updated;
}

export function addMediaCategory(siteId: string, name: string) {
  const state = loadMediaStore();
  const site = state.sites.find((item) => item.id === siteId);
  if (!site) throw new Error("Mediaが見つかりませんでした。");
  const category = name.trim();
  if (!category) throw new Error("カテゴリー名を入力してください。");
  if (Array.from(category).length > 60) throw new Error("カテゴリー名は60文字以内で入力してください。");
  if (site.categories.includes(category)) return site;
  if (site.categories.length >= 100) throw new Error("カテゴリーは100件まで追加できます。");
  const updated = { ...site, categories: [...site.categories, category], updatedAt: new Date().toISOString() };
  saveMediaStore({ ...state, sites: state.sites.map((item) => item.id === siteId ? updated : item) });
  return updated;
}

export function getMediaExcerpt(blocks: MediaBlock[]) {
  const text = blocks.map((block) => {
    if (block.type === "paragraph" || block.type === "heading" || block.type === "quote") return block.text ?? "";
    if (block.type === "list") return (block.items ?? []).join(" ");
    if (block.type === "link") return block.title ?? "";
    return "";
  }).join(" ").replace(/\s+/g, " ").trim();
  return Array.from(text).slice(0, 150).join("");
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
  if (!state.sites.some((site) => site.id === mediaId)) throw new Error("Mediaが見つかりませんでした。");
  const current = articleId ? state.articles.find((article) => article.id === articleId && article.mediaId === mediaId) : null;
  if (articleId && !current) throw new Error("この記事はこのMediaにありません。");
  const title = input.title.trim();
  if (!title) throw new Error("タイトルを入力してください。");
  const requestedSlug = input.slug.trim().toLowerCase();
  if (requestedSlug && (requestedSlug.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(requestedSlug))) {
    throw new Error("記事URL名は80文字以内の半角英数字とハイフンで入力してください。");
  }
  const conflicts = (candidate: string) => state.articles.some((article) => article.mediaId === mediaId
    && article.id !== articleId && (article.slug === candidate || article.publishedSnapshot?.slug === candidate));
  let slug = requestedSlug || current?.slug || "";
  if (!slug) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
      if (!conflicts(candidate)) { slug = candidate; break; }
    }
    if (!slug) throw new Error("記事URLを作成できませんでした。もう一度保存してください。");
  }
  if (conflicts(slug)) throw new Error("このURL名の記事はすでにあります。");
  const draft = {
    title, slug, excerpt: input.excerpt.trim(), category: input.category,
    coverImageUrl: input.coverImageUrl, coverImageAssetId: input.coverImageAssetId,
    blocks: clone(input.blocks)
  };
  const now = new Date().toISOString();
  const article: MediaArticle = current ? { ...current, ...draft, updatedAt: now } : {
    id: createId("media_article"), mediaId, ...draft, status: "draft", publishedSnapshot: null, createdAt: now, updatedAt: now
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
    publishedSnapshot: { title: current.title, slug: current.slug, excerpt: current.excerpt.trim() || getMediaExcerpt(current.blocks), category: current.category, coverImageUrl: current.coverImageUrl, blocks: clone(current.blocks), publishedAt: current.publishedSnapshot?.publishedAt ?? now, updatedAt: now }
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
