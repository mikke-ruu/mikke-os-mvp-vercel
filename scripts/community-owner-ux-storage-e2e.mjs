import assert from "node:assert/strict";

if (process.argv[2] !== "--run-isolated") throw new Error("Explicit --run-isolated is required");
const env = process.env;
const required = {
  origin: env.COMMUNITY_OWNER_UX_STORAGE_URL,
  anonKey: env.COMMUNITY_OWNER_UX_STORAGE_ANON_KEY,
  ownerJwt: env.COMMUNITY_OWNER_UX_STORAGE_OWNER_JWT,
  memberJwt: env.COMMUNITY_OWNER_UX_STORAGE_MEMBER_JWT,
  outsiderJwt: env.COMMUNITY_OWNER_UX_STORAGE_OUTSIDER_JWT,
  suspendedJwt: env.COMMUNITY_OWNER_UX_STORAGE_SUSPENDED_JWT,
  otherOwnerJwt: env.COMMUNITY_OWNER_UX_STORAGE_OTHER_OWNER_JWT,
  communityId: env.COMMUNITY_OWNER_UX_STORAGE_COMMUNITY_ID,
  userId: env.COMMUNITY_OWNER_UX_STORAGE_USER_ID,
  otherCommunityId: env.COMMUNITY_OWNER_UX_STORAGE_OTHER_COMMUNITY_ID,
  otherUserId: env.COMMUNITY_OWNER_UX_STORAGE_OTHER_USER_ID,
  pdfResourceId: env.COMMUNITY_OWNER_UX_STORAGE_PDF_RESOURCE_ID,
  mimeResourceId: env.COMMUNITY_OWNER_UX_STORAGE_MIME_RESOURCE_ID,
  limitResourceId: env.COMMUNITY_OWNER_UX_STORAGE_LIMIT_RESOURCE_ID,
  otherResourceId: env.COMMUNITY_OWNER_UX_STORAGE_OTHER_RESOURCE_ID,
};
if (Object.values(required).some((value) => !value)) throw new Error("All isolated Storage credentials and pre-seeded fixture IDs are required");
const base = new URL(required.origin);
if (!["127.0.0.1", "localhost", "::1"].includes(base.hostname)) throw new Error("Only an isolated local Supabase Storage endpoint is allowed");
if (!/^https?:$/.test(base.protocol)) throw new Error("The isolated Storage endpoint must use HTTP or HTTPS");
for (const value of [required.communityId, required.userId, required.otherCommunityId, required.otherUserId, required.pdfResourceId, required.mimeResourceId, required.limitResourceId, required.otherResourceId]) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new Error("Fixture IDs must be UUIDs");
}

const authHeaders = (jwt) => ({ apikey: required.anonKey, Authorization: `Bearer ${jwt}` });
const pathFor = (communityId, resourceId, userId, fileName) => `${communityId}/${resourceId}/${userId}/${fileName}`;
const objectUrl = (path) => new URL(`/storage/v1/object/community-resources/${path}`, base).toString();
const authenticatedUrl = (path) => new URL(`/storage/v1/object/authenticated/community-resources/${path}`, base).toString();
const signUrl = (path) => new URL(`/storage/v1/object/sign/community-resources/${path}`, base).toString();

async function upload(jwt, path, bytes, contentType) {
  return fetch(objectUrl(path), { method: "POST", headers: { ...authHeaders(jwt), "content-type": contentType, "x-upsert": "false" }, body: bytes, redirect: "error" });
}
async function sign(jwt, path) {
  return fetch(signUrl(path), { method: "POST", headers: { ...authHeaders(jwt), "content-type": "application/json" }, body: JSON.stringify({ expiresIn: 900 }), redirect: "error" });
}
async function remove(jwt, path) {
  return fetch(objectUrl(path), { method: "DELETE", headers: authHeaders(jwt), redirect: "error" });
}
async function expectDenied(response, reason) {
  assert.ok(!response.ok, `${reason} must fail`);
  return (await response.text()).toLowerCase();
}

const pdfPath = pathFor(required.communityId, required.pdfResourceId, required.userId, "proof.pdf");
const unpublishedPath = pathFor(required.communityId, required.mimeResourceId, required.userId, "unpublished.pdf");
const limitPath = pathFor(required.communityId, required.limitResourceId, required.userId, "large.pdf");
const otherPath = pathFor(required.otherCommunityId, required.otherResourceId, required.otherUserId, "other.pdf");
const pdfBytes = new TextEncoder().encode("%PDF-1.4\n% isolated owner UX proof\n");
const cleanupTargets = new Map([
  [pdfPath, required.ownerJwt],
  [unpublishedPath, required.ownerJwt],
  [limitPath, required.ownerJwt],
  [otherPath, required.otherOwnerJwt],
]);

try {
  for (const [jwt, path] of [[required.ownerJwt, pdfPath], [required.otherOwnerJwt, otherPath]]) {
    const uploaded = await upload(jwt, path, pdfBytes, "application/pdf");
    assert.ok(uploaded.ok, `fixture upload failed with ${uploaded.status}`);
  }

  const signed = await sign(required.ownerJwt, pdfPath);
  assert.ok(signed.ok, `signed URL creation failed with ${signed.status}`);
  const signedBody = await signed.json();
  assert.equal(typeof signedBody.signedURL, "string");
  const signedTarget = signedBody.signedURL.startsWith("http")
    ? new URL(signedBody.signedURL)
    : new URL(`/storage/v1${signedBody.signedURL.startsWith("/") ? "" : "/"}${signedBody.signedURL}`, base);
  assert.equal(signedTarget.origin, base.origin, "signed URL must remain on the isolated Storage origin");
  const downloaded = await fetch(signedTarget, { redirect: "error" });
  assert.ok(downloaded.ok, `signed download failed with ${downloaded.status}`);
  assert.deepEqual(new Uint8Array(await downloaded.arrayBuffer()), pdfBytes);

  const wrongMimeReason = await expectDenied(await upload(required.ownerJwt, unpublishedPath, pdfBytes, "text/plain"), "disallowed MIME upload");
  assert.match(wrongMimeReason, /mime|content.?type|not allowed|invalid/);
  const unpublishedUpload = await upload(required.ownerJwt, unpublishedPath, pdfBytes, "application/pdf");
  assert.ok(unpublishedUpload.ok, `unpublished fixture upload failed with ${unpublishedUpload.status}`);

  const memberSigned = await sign(required.memberJwt, pdfPath);
  assert.ok(memberSigned.ok, "an active member can sign a published resource");
  await expectDenied(await sign(required.ownerJwt, otherPath), "cross-Community owner access");
  await expectDenied(await sign(required.otherOwnerJwt, pdfPath), "reverse cross-Community owner access");
  await expectDenied(await sign(required.outsiderJwt, pdfPath), "non-member access");
  await expectDenied(await sign(required.suspendedJwt, pdfPath), "suspended member access");
  await expectDenied(await sign(required.memberJwt, unpublishedPath), "member access to an unpublished resource");

  const overLimit = new Uint8Array(52_428_800 + 1);
  const limitReason = await expectDenied(await upload(required.ownerJwt, limitPath, overLimit, "application/pdf"), "upload larger than 50MB");
  assert.match(limitReason, /size|large|limit|maximum|payload/);
} finally {
  for (const [path, jwt] of cleanupTargets) {
    const deleted = await remove(jwt, path);
    assert.ok(deleted.ok || deleted.status === 404, `fixture cleanup failed with ${deleted.status}`);
    const residue = await fetch(authenticatedUrl(path), { headers: authHeaders(jwt), redirect: "error" });
    assert.equal(residue.status, 404, `fixture must not remain readable: ${path}`);
  }
}

console.log(JSON.stringify({ result: "community_owner_ux_storage_e2e_ok", signedSeconds: 900, maxBytes: 52_428_800, fixtureObjectsRemaining: 0, secretsPrinted: false }));
