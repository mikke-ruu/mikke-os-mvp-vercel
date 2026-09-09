import { createHash } from "node:crypto";

export type PublicImageLocator = {
  bucket: string; storagePath: string; mimeType: string;
  byteSize: number; contentSha256: string;
};
const maximumBytes = 15 * 1024 * 1024;
const mimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
const headers = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin" };
export function imageNotFound() { return new Response(null, { status: 404, headers }); }

/** No locators, redirects, storage errors or owner identifiers cross this boundary. */
export async function publicImageResponse(token: string, expectedBucket: string, resolve: (token: string) => Promise<PublicImageLocator | null>, download: (locator: PublicImageLocator) => Promise<Response>) {
  if ((token.length < 32 || token.length > 128 || /[^a-zA-Z0-9_-]/.test(token)) || !expectedBucket) return imageNotFound();
  try {
    const locator = await resolve(token);
    if (!locator || locator.bucket !== expectedBucket || !mimeTypes.has(locator.mimeType)
      || !Number.isSafeInteger(locator.byteSize) || locator.byteSize < 1 || locator.byteSize > maximumBytes
      || (locator.contentSha256.length !== 64 || /[^a-f0-9]/i.test(locator.contentSha256))
      || !locator.storagePath || locator.storagePath.split("/").some(part => !part || part === "." || part === "..")
      || /[\\\u0000-\u001f]/.test(locator.storagePath)) return imageNotFound();
    const response = await download(locator);
    if (!response.ok || response.status !== 200 || !response.body) return imageNotFound();
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = []; let total = 0;
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      total += value.byteLength;
      if (total > locator.byteSize || total > maximumBytes) { await reader.cancel(); return imageNotFound(); }
      chunks.push(value);
    }
    const bytes = Buffer.concat(chunks);
    if (total !== locator.byteSize || createHash("sha256").update(bytes).digest("hex") !== locator.contentSha256.toLowerCase()) return imageNotFound();
    // Recheck after download so cancellation/hold while fetching does not use the old authorization.
    const current = await resolve(token);
    if (!current || JSON.stringify(current) !== JSON.stringify(locator)) return imageNotFound();
    return new Response(bytes, { headers: { ...headers, "Content-Type": locator.mimeType, "Content-Length": String(total), "Content-Disposition": "inline" } });
  } catch { return imageNotFound(); }
}
