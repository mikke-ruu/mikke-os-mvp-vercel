import { pageDemoState } from "./demo";
import type { PageDocument, PageSite, PageStoreState } from "./types";

export const PAGE_STORAGE_KEY = "mikke.page.v1";

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
