export const FIRST_COMMUNITY_SLUG = "official-academy-community";

export function communityBasePath(slug: string) {
  return `/community/c/${encodeURIComponent(slug)}`;
}
