import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createMediaPublicReader, mediaCanonicalPath } from "@/lib/media-app/public-contract";
import { createMediaPublicRpcTransport } from "@/lib/media-app/public-rpc";
import { fakeMediaPublicTransport } from "@/lib/media-app/fake-public-transport";

const developmentReader = createMediaPublicReader(fakeMediaPublicTransport);
function reader(mediaSlug: string) {
  if (process.env.NODE_ENV === "development" && mediaSlug === "mikkeos-media-preview") return developmentReader;
  // Enable only after production SQL/public DTO/legal gates pass. No authenticated
  // cookie or privileged client is ever reused on this anonymous read path.
  if (process.env.MEDIA_PUBLIC_DATABASE_ENABLED !== "true") return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) } });
  return createMediaPublicReader(createMediaPublicRpcTransport(async (name, args) => {
    const {data,error} = await client.rpc(name,args);
    return {data,error};
  }));
}
export async function loadPublicMediaSite(mediaSlug: string, locale?: string) {
  if (!mediaCanonicalPath(mediaSlug)) return null;
  return reader(mediaSlug)?.site(mediaSlug,locale) ?? null;
}
export async function loadPublicMediaArticles(mediaSlug: string, locale?: string) {
  if (!mediaCanonicalPath(mediaSlug)) return [];
  return reader(mediaSlug)?.articles(mediaSlug,locale) ?? [];
}
export async function loadPublicMediaArticle(mediaSlug: string, articleSlug: string, locale?: string) {
  if (!mediaCanonicalPath(mediaSlug,articleSlug)) return null;
  return reader(mediaSlug)?.article(mediaSlug,articleSlug,locale) ?? null;
}
