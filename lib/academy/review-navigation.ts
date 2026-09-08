/** Only return to known Academy editing pages. Never redirect to an arbitrary URL. */
export function academyReviewReturn(value?: string | string[]) {
  if (typeof value !== "string" || !value.startsWith("/academy/")) return null;
  try {
    const url = new URL(value, "https://review.invalid");
    if (url.origin !== "https://review.invalid" || !/^\/academy\/(?:h\/[0-9a-f-]{36}\/manage\/)?(?:instructors|settings|courses\/[0-9a-f-]{36})$/i.test(url.pathname)) return null;
    const query = new URLSearchParams();
    for (const key of ["preview", "tab", "filter", "q"]) {
      const item = url.searchParams.get(key);
      if (item) query.set(key, item);
    }
    return url.pathname + (query.size ? `?${query}` : "");
  } catch { return null; }
}
