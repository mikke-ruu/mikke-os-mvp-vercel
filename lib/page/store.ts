import { pageDemoState } from "./demo";
import type { PageDocument, PageSite, PageStoreState } from "./types";

export const PAGE_STORAGE_KEY = "mikke.page.v1";

export type CreatePageSiteInput = {
  ownerProfileId: string;
  name: string;
  description: string;
  slug: string;
};

export type CreatePageDocumentInput = {
  title: string;
  slug: string;
};

function clonePageState(state: PageStoreState): PageStoreState {
  return JSON.parse(JSON.stringify(state)) as PageStoreState;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPageDocument(value: unknown): value is PageDocument {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.siteId === "string" &&
    typeof value.title === "string" &&
    typeof value.slug === "string" &&
    Array.isArray(value.blocks)
  );
}

function isPageSite(value: unknown): value is PageSite {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.ownerProfileId === "string" &&
    typeof value.name === "string" &&
    typeof value.description === "string" &&
    Array.isArray(value.documents) &&
    value.documents.every(isPageDocument)
  );
}

function isPageStoreState(value: unknown): value is PageStoreState {
  if (!isRecord(value)) return false;
  return value.version === 1 && Array.isArray(value.sites) && value.sites.every(isPageSite);
}

export function loadPageStore(): PageStoreState {
  if (typeof window === "undefined") return clonePageState(pageDemoState);

  const raw = window.localStorage.getItem(PAGE_STORAGE_KEY);
  if (!raw) return clonePageState(pageDemoState);

  try {
    const parsed = JSON.parse(raw) as unknown;
    return isPageStoreState(parsed) ? parsed : clonePageState(pageDemoState);
  } catch {
    return clonePageState(pageDemoState);
  }
}

export function savePageStore(state: PageStoreState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PAGE_STORAGE_KEY, JSON.stringify(state));
}

export function listPageSites() {
  return loadPageStore().sites;
}

export function getPageSite(siteId: string) {
  return listPageSites().find((site) => site.id === siteId) ?? null;
}

export function getPageDocument(siteId: string, pageId: string) {
  return getPageSite(siteId)?.documents.find((page) => page.id === pageId) ?? null;
}

function createPageId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizePageSiteSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

export function createPageSite(input: CreatePageSiteInput) {
  const name = input.name.trim();
  const description = input.description.trim();
  const slug = normalizePageSiteSlug(input.slug);
  if (!name) throw new Error("サイト名を入力してください。");
  if (!input.ownerProfileId) throw new Error("所有者を確認できませんでした。");
  if (!slug) throw new Error("下書きslugを半角英数字で入力してください。");

  const state = loadPageStore();
  if (state.sites.some((site) => site.publication.slug === slug)) {
    throw new Error("この下書きslugはすでに使われています。");
  }

  const now = new Date().toISOString();
  const siteId = createPageId("page_site");
  const site: PageSite = {
    id: siteId,
    ownerProfileId: input.ownerProfileId,
    name,
    description,
    status: "draft",
    publication: {
      slug,
      isPublic: false,
      searchIndexEnabled: false
    },
    documents: [
      {
        id: createPageId("page_doc"),
        siteId,
        title: "ホーム",
        slug: "home",
        status: "draft",
        blocks: [],
        createdAt: now,
        updatedAt: now
      }
    ],
    createdAt: now,
    updatedAt: now
  };

  savePageStore({ ...state, sites: [site, ...state.sites] });
  return site;
}

function updatePageSite(siteId: string, update: (site: PageSite) => PageSite) {
  const state = loadPageStore();
  const site = state.sites.find((item) => item.id === siteId);
  if (!site) throw new Error("このPageは見つかりませんでした。");
  const updatedSite = update(site);
  savePageStore({
    ...state,
    sites: state.sites.map((item) => (item.id === siteId ? updatedSite : item))
  });
  return updatedSite;
}

export function createPageDocument(siteId: string, input: CreatePageDocumentInput) {
  const title = input.title.trim();
  const slug = normalizePageSiteSlug(input.slug);
  if (!title) throw new Error("ページ名を入力してください。");
  if (!slug) throw new Error("ページslugを半角英数字で入力してください。");

  let createdDocument: PageDocument | null = null;
  updatePageSite(siteId, (site) => {
    if (site.documents.some((document) => document.slug === slug)) {
      throw new Error("このページslugはすでに使われています。");
    }
    const now = new Date().toISOString();
    createdDocument = {
      id: createPageId("page_doc"),
      siteId,
      title,
      slug,
      status: "draft",
      blocks: [],
      createdAt: now,
      updatedAt: now
    };
    return {
      ...site,
      documents: [...site.documents, createdDocument],
      updatedAt: now
    };
  });
  return createdDocument as PageDocument | null;
}

export function deletePageDocument(siteId: string, pageId: string) {
  return updatePageSite(siteId, (site) => {
    if (site.documents.length <= 1) {
      throw new Error("Pageには最低1ページ必要です。");
    }
    if (!site.documents.some((document) => document.id === pageId)) {
      throw new Error("削除するページが見つかりませんでした。");
    }
    return {
      ...site,
      documents: site.documents.filter((document) => document.id !== pageId),
      updatedAt: new Date().toISOString()
    };
  });
}

export function movePageDocument(siteId: string, pageId: string, direction: -1 | 1) {
  return updatePageSite(siteId, (site) => {
    const currentIndex = site.documents.findIndex((document) => document.id === pageId);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= site.documents.length) return site;
    const documents = [...site.documents];
    [documents[currentIndex], documents[nextIndex]] = [documents[nextIndex], documents[currentIndex]];
    return { ...site, documents, updatedAt: new Date().toISOString() };
  });
}
