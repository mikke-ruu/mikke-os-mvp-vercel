import assert from "node:assert/strict";

if (process.argv[2] !== "--run-isolated") throw new Error("Explicit --run-isolated is required");
const origin = process.env.COMMUNITY_OWNER_UX_STORAGE_URL;
const anonKey = process.env.COMMUNITY_OWNER_UX_STORAGE_ANON_KEY;
const jwt = process.env.COMMUNITY_OWNER_UX_STORAGE_OWNER_JWT;
const communityId = process.env.COMMUNITY_OWNER_UX_STORAGE_COMMUNITY_ID;
const userId = process.env.COMMUNITY_OWNER_UX_STORAGE_USER_ID;
const resourceIds = [
  process.env.COMMUNITY_OWNER_UX_STORAGE_PDF_RESOURCE_ID,
  process.env.COMMUNITY_OWNER_UX_STORAGE_MIME_RESOURCE_ID,
  process.env.COMMUNITY_OWNER_UX_STORAGE_LIMIT_RESOURCE_ID,
];
if (!origin || !anonKey || !jwt || !communityId || !userId || resourceIds.some((value) => !value)) {
  throw new Error("The isolated Storage URL, credentials and three pre-seeded resource IDs are required");
}
const base = new URL(origin);
if (!["127.0.0.1", "localhost", "::1"].includes(base.hostname)) throw new Error("Only an isolated local Supabase Storage endpoint is allowed");
if (!/^https?:$/.test(base.protocol)) throw new Error("The isolated Storage endpoint must use HTTP or HTTPS");
for (const value of [communityId, userId, ...resourceIds]) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new Error("Fixture IDs must be UUIDs");
}

const headers = { apikey: anonKey, Authorization: `Bearer ${jwt}` };
const pathFor = (resourceId, fileName) => `${communityId}/${resourceId}/${userId}/${fileName}`;
const objectUrl = (path) => new URL(`/storage/v1/object/community-resources/${path}`, base).toString();

async function upload(path, bytes, contentType) {
  return fetch(objectUrl(path), { method: "POST", headers: { ...headers, "content-type": contentType, "x-upsert": "false" }, body: bytes, redirect: "error" });
}
async function remove(path) {
  return fetch(objectUrl(path), { method: "DELETE", headers, redirect: "error" });
}

const pdfPath = pathFor(resourceIds[0], "proof.pdf");
const mimePath = pathFor(resourceIds[1], "wrong.pdf");
const limitPath = pathFor(resourceIds[2], "large.pdf");
const pdfBytes = new TextEncoder().encode("%PDF-1.4\n% isolated owner UX proof\n");

try {
  const uploaded = await upload(pdfPath, pdfBytes, "application/pdf");
  assert.ok(uploaded.ok, `small PDF upload failed with ${uploaded.status}`);

  const signed = await fetch(new URL(`/storage/v1/object/sign/community-resources/${pdfPath}`, base), {
    method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ expiresIn: 900 }), redirect: "error"
  });
  assert.ok(signed.ok, `signed URL creation failed with ${signed.status}`);
  const signedBody = await signed.json();
  assert.equal(typeof signedBody.signedURL, "string");
  const signedUrl = signedBody.signedURL.startsWith("http")
    ? signedBody.signedURL
    : new URL(`/storage/v1${signedBody.signedURL.startsWith("/") ? "" : "/"}${signedBody.signedURL}`, base).toString();
  const downloaded = await fetch(signedUrl, { redirect: "error" });
  assert.ok(downloaded.ok, `signed download failed with ${downloaded.status}`);
  assert.deepEqual(new Uint8Array(await downloaded.arrayBuffer()), pdfBytes);

  const wrongMime = await upload(mimePath, pdfBytes, "text/plain");
  assert.ok(!wrongMime.ok, "disallowed MIME upload must fail");

  const overLimit = new Uint8Array(52_428_800 + 1);
  const oversized = await upload(limitPath, overLimit, "application/pdf");
  assert.ok(!oversized.ok, "an upload larger than 50MB must fail");
} finally {
  await Promise.all([remove(pdfPath), remove(mimePath), remove(limitPath)]);
}

console.log(JSON.stringify({ result: "community_owner_ux_storage_e2e_ok", signedSeconds: 900, maxBytes: 52_428_800, secretsPrinted: false }));
