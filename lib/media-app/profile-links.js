// Public STORY links only. This does not establish account ownership or import data.
export function normalizeMediaStoryUrl(value) {
  if (!value.trim()) return "";
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || !["mikke-os.com", "app.mikke-os.com"].includes(url.hostname)
      || url.username || url.password || url.port || url.search || url.hash
      || !/^\/story\/[a-z0-9][a-z0-9_-]*\/?$/.test(url.pathname)) return "";
    return `https://mikke-os.com${url.pathname.replace(/\/$/, "")}`;
  } catch { return ""; }
}
