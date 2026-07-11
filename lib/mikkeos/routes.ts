import type { AppKey } from "./types";

export const appSlugs: Record<AppKey, string> = {
  market_note: "market-note",
  event: "event",
  order: "order",
  item_studio: "item-studio",
  academy: "academy",
  session: "session",
  community: "community",
  team_works: "team-works",
  fund: "fund"
};

export function getAppPath(appKey: AppKey) {
  return `/apps/${appSlugs[appKey]}`;
}
