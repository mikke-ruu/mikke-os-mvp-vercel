import "server-only";
import { createClient } from "@supabase/supabase-js";
import { imageNotFound, publicImageResponse, type PublicImageLocator } from "@/lib/media-app/public-image-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ publicationImageToken: string }> }) {
  if (process.env.MEDIA_PUBLIC_DATABASE_ENABLED !== "true") return imageNotFound();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.MEDIA_PRIVATE_ASSET_BUCKET;
  if (!url || !key || !bucket) return imageNotFound();
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { publicationImageToken } = await context.params;
  return publicImageResponse(publicationImageToken, bucket, async token => {
    const { data, error } = await client.rpc("media_resolve_public_image", { p_token: token });
    if (error || !data || Array.isArray(data)) return null;
    return data as PublicImageLocator;
  }, locator => fetch(`${url}/storage/v1/object/authenticated/${encodeURIComponent(locator.bucket)}/${locator.storagePath.split("/").map(encodeURIComponent).join("/")}`, {
    headers: { Authorization: `Bearer ${key}`, apikey: key }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000),
  }));
}
