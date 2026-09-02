import "server-only";

import { createMediaPublicReader, mediaCanonicalPath } from "@/lib/media-app/public-contract";
import { fakeMediaPublicTransport } from "@/lib/media-app/fake-public-transport";

const developmentReader = createMediaPublicReader(fakeMediaPublicTransport);

function enabled() {
  return process.env.NODE_ENV === "development";
}

export async function loadPublicMediaSite(mediaSlug: string, locale?: string) {
  if (!enabled() || !mediaCanonicalPath(mediaSlug)) return null;
  return developmentReader.site(mediaSlug, locale);
}

export async function loadPublicMediaArticles(mediaSlug: string, locale?: string) {
  if (!enabled() || !mediaCanonicalPath(mediaSlug)) return null;
  return developmentReader.articles(mediaSlug, locale);
}

export async function loadPublicMediaArticle(mediaSlug: string, articleSlug: string, locale?: string) {
  if (!enabled() || !mediaCanonicalPath(mediaSlug, articleSlug)) return null;
  return developmentReader.article(mediaSlug, articleSlug, locale);
}
