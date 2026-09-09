export function normalizeMediaSlug(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-{2,}/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

export function isSafeMediaUrl(value) {
  if (!value) return true;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
