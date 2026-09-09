// Disposable local stack only. All generated records require entire-stack teardown.
// Usage: node scripts/media-private-auth-storage-check.mjs <private-local-config.json>
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const termsVersion = "local-media-test-v1";
const termsText = "Media local test terms. Not a legal agreement.";
const termsDigest = createHash("sha256").update(termsText).digest("hex");
const bucket = "mikke-media-private";
const checks = [];
const fixture = { users: [], sites: [], articles: [], assetIds: [], storagePaths: [] };
let phase = "configuration";
let configPath;
let permittedOrigin = "";
async function check(name, fn) { phase = name; await fn(); checks.push({ name, status: "passed" }); }
function success(result) { assert.equal(result.error, null); return result.data; }
function denied(result) { assert.ok(result.error || result.data === null || (Array.isArray(result.data) && result.data.length === 0)); }
async function rpc(client, name, args = {}) { return success(await client.rpc(name, args)); }
const fetchWithTimeout = (input, init = {}) => {
  const target = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  assert.equal(target.origin, permittedOrigin);
  return fetch(input, { ...init, redirect: "error",
    signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) });
};

try {
  assert.ok(process.argv[2]);
  configPath = resolve(process.argv[2]);
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  assert.equal(config.scope, "media-private-local-test");
  assert.equal(config.legalFixtureSeeded, true);
  const url = new URL(config.url);
  assert.equal(url.protocol, "http:");
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(url.hostname));
  assert.ok(url.port && !url.username && !url.password && !url.search && !url.hash);
  permittedOrigin = url.origin;
  assert.ok(typeof config.anonKey === "string" && config.anonKey.length > 20);
  assert.ok(typeof config.serviceRoleKey === "string" && config.serviceRoleKey.length > 20);
  const client = key => createClient(url.origin, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: fetchWithTimeout } });
  const admin = client(config.serviceRoleKey);
  const a = client(config.anonKey), b = client(config.anonKey), anonymous = client(config.anonKey), publicReader = client(config.anonKey);
  const suffix = randomUUID().replaceAll("-", "");
  let ownerA, ownerB, siteA, siteB, articleA, imageA, imageB, activeToken;
  // Valid 1x1 WebP fixture. The app upload route's decoder/reencoder is tested separately.
  const image = Buffer.from("UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA", "base64");
  const imageDigest = createHash("sha256").update(image).digest("hex");

  await check("actual-auth-two-normal-users", async () => {
    for (const [label, target] of [["a", a], ["b", b]]) {
      const email = `media-${label}-${suffix}@example.test`, password = `${randomBytes(24).toString("base64url")}aA1!`;
      const created = success(await admin.auth.admin.createUser({ email, password, email_confirm: true }));
      fixture.users.push(created.user.id);
      success(await target.auth.signInWithPassword({ email, password }));
      const verified = success(await target.auth.getUser()).user;
      assert.equal(verified.id, created.user.id);
      assert.equal(Boolean(verified.is_anonymous), false);
      if (label === "a") ownerA = verified.id; else ownerB = verified.id;
    }
  });
  await check("actual-auth-anonymous-owner-denied", async () => {
    const signed = success(await anonymous.auth.signInAnonymously());
    fixture.users.push(signed.user.id);
    assert.equal(signed.user.is_anonymous, true);
    denied(await anonymous.rpc("media_create_site", { p_name: "Anonymous", p_slug: `anon-${suffix}`, p_description: "", p_author_name: "Anonymous", p_default_locale: "ja-JP" }));
  });
  await check("owner-sites-and-cross-account-rls", async () => {
    for (const [target, label] of [[a, "a"], [b, "b"]]) {
      const id = await rpc(target, "media_create_site", { p_name: `Local ${label}`, p_slug: `local-${label}-${suffix}`, p_description: "Synthetic local Media", p_author_name: "Local test", p_default_locale: "ja-JP" });
      fixture.sites.push(id); if (label === "a") siteA = id; else siteB = id;
    }
    denied(await b.from("media_sites").select("id").eq("id", siteA).maybeSingle());
    denied(await publicReader.from("media_sites").select("id").eq("id", siteA));
    denied(await anonymous.from("media_sites").select("id").eq("id", siteA));
  });
  await check("real-private-storage-upload-registration", async () => {
    for (const [owner, label] of [[ownerA, "a"], [ownerB, "b"]]) {
      const path = `${owner}/media/${randomBytes(32).toString("hex")}.webp`;
      success(await admin.storage.from(bucket).upload(path, image, { contentType: "image/webp", upsert: false }));
      fixture.storagePaths.push(path);
      const args = { p_owner_id: owner, p_storage_path: path, p_byte_size: image.length, p_content_sha256: imageDigest, p_original_name: "local-fixture.webp" };
      const registered = await rpc(admin, "media_register_private_image", args);
      fixture.assetIds.push(registered.assetId);
      assert.equal((await rpc(admin, "media_register_private_image", args)).assetId, registered.assetId);
      if (label === "a") imageA = registered.assetId; else imageB = registered.assetId;
    }
  });
  await check("browser-private-storage-and-locator-denied", async () => {
    for (const target of [a, b, anonymous, publicReader]) {
      denied(await target.storage.from(bucket).download(fixture.storagePaths[0]));
      denied(await target.rpc("media_resolve_owner_image", { p_owner_id: ownerA, p_asset_id: imageA }));
      denied(await target.rpc("media_register_private_image", { p_owner_id: ownerA, p_storage_path: fixture.storagePaths[0], p_byte_size: image.length, p_content_sha256: imageDigest, p_original_name: "forged.webp" }));
    }
    assert.equal(await rpc(admin, "media_resolve_owner_image", { p_owner_id: ownerB, p_asset_id: imageA }), null);
  });
  await check("real-owner-image-hash-and-private-bucket", async () => {
    const locator = await rpc(admin, "media_resolve_owner_image", { p_owner_id: ownerA, p_asset_id: imageA });
    assert.equal(locator.bucket, bucket); assert.equal(locator.contentSha256, imageDigest);
    const downloaded = success(await admin.storage.from(locator.bucket).download(locator.storagePath));
    assert.equal(createHash("sha256").update(Buffer.from(await downloaded.arrayBuffer())).digest("hex"), imageDigest);
  });
  await check("draft-owner-only-and-other-asset-review-denied", async () => {
    const draft = success(await a.from("media_articles").insert({ site_id: siteA, title: "Local draft", slug: "local-article", locale: "ja-JP", excerpt: "Local excerpt",
      cover_image_asset_id: imageB, cover_image_url: `/api/media/assets/${imageB}`,
      draft_blocks: [{ id: "p1", type: "paragraph", text: "Synthetic private draft" }] }).select("id").single());
    articleA = draft.id; fixture.articles.push(articleA);
    denied(await b.from("media_articles").select("id").eq("id", articleA));
    denied(await b.rpc("media_review_article", { p_article_id: articleA }));
    denied(await anonymous.rpc("media_review_article", { p_article_id: articleA }));
    denied(await a.rpc("media_review_article", { p_article_id: articleA }));
    assert.deepEqual(await rpc(publicReader, "media_public_article", { p_site_slug: `local-a-${suffix}`, p_locale: "ja-JP", p_article_slug: "local-article" }), []);
    success(await a.from("media_articles").update({ cover_image_asset_id: imageA, cover_image_url: `/api/media/assets/${imageA}`,
      draft_blocks: [{ id: "image1", type: "image", imageUrl: `/api/media/assets/${imageA}`, imageAssetId: imageA, alt: "Local fixture" }] }).eq("id", articleA));
  });
  const publicationArgs = expectedRevision => ({ p_article_id: articleA, p_expected_revision: expectedRevision, p_terms_version: termsVersion,
    p_rights_confirmed: true, p_privacy_confirmed: true, p_affiliate_free_confirmed: true });
  await check("separate-explicit-local-terms-consent", async () => {
    const current = await rpc(a, "media_current_terms");
    assert.equal(current.termsVersion, termsVersion); assert.equal(current.documentSha256, termsDigest); assert.equal(current.accepted, false);
    const review = await rpc(a, "media_review_article", { p_article_id: articleA });
    denied(await a.rpc("media_publish_article_reviewed", publicationArgs(review.expectedRevision)));
    denied(await a.rpc("media_accept_terms", { p_terms_version: termsVersion, p_document_sha256: termsDigest, p_confirmed: false }));
    await rpc(a, "media_accept_terms", { p_terms_version: termsVersion, p_document_sha256: termsDigest, p_confirmed: true });
    assert.equal((await rpc(a, "media_current_terms")).accepted, true);
    denied(await a.rpc("media_publish_article", { p_article_id: articleA, p_terms_version: termsVersion, p_rights_confirmed: true, p_privacy_confirmed: true, p_affiliate_free_confirmed: true }));
  });
  await check("stale-reviewed-revision-denied", async () => {
    const review = await rpc(a, "media_review_article", { p_article_id: articleA });
    success(await a.from("media_articles").update({ title: "Changed after review" }).eq("id", articleA));
    denied(await a.rpc("media_publish_article_reviewed", publicationArgs(review.expectedRevision)));
  });
  async function publishFresh() {
    const review = await rpc(a, "media_review_article", { p_article_id: articleA });
    assert.match(review.expectedRevision, /^[a-f0-9]{64}$/);
    await rpc(a, "media_publish_article_reviewed", publicationArgs(review.expectedRevision));
    const published = await rpc(publicReader, "media_public_article", { p_site_slug: `local-a-${suffix}`, p_locale: "ja-JP", p_article_slug: "local-article" });
    assert.equal(published.length, 1);
    const match = /^\/media\/images\/([a-f0-9]{64})$/.exec(published[0].cover_image_url);
    assert.ok(match);
    const serialized = JSON.stringify(published);
    for (const internal of [ownerA, imageA, "/api/media/assets/", fixture.storagePaths[0]]) assert.equal(serialized.includes(internal), false);
    return match[1];
  }
  await check("reviewed-publication-safe-image-projection", async () => {
    activeToken = await publishFresh();
    const locator = await rpc(admin, "media_resolve_public_image", { p_token: activeToken });
    assert.equal(locator.contentSha256, imageDigest); assert.equal(locator.bucket, bucket);
    denied(await publicReader.rpc("media_resolve_public_image", { p_token: activeToken }));
  });
  await check("cancel-and-republish-do-not-revive-token", async () => {
    const old = activeToken;
    await rpc(a, "media_unpublish_article", { p_article_id: articleA });
    assert.equal(await rpc(admin, "media_resolve_public_image", { p_token: old }), null);
    activeToken = await publishFresh(); assert.notEqual(activeToken, old);
    assert.equal(await rpc(admin, "media_resolve_public_image", { p_token: old }), null);
  });
  await check("hold-clear-needs-new-publication", async () => {
    success(await admin.from("media_articles").update({ moderation_hold: true }).eq("id", articleA));
    assert.equal(await rpc(admin, "media_resolve_public_image", { p_token: activeToken }), null);
    success(await admin.from("media_articles").update({ moderation_hold: false }).eq("id", articleA));
    assert.deepEqual(await rpc(publicReader, "media_public_article", { p_site_slug: `local-a-${suffix}`, p_locale: "ja-JP", p_article_slug: "local-article" }), []);
    assert.equal(await rpc(admin, "media_resolve_public_image", { p_token: activeToken }), null);
    activeToken = await publishFresh();
  });
  await check("registered-storage-replacement-invalidates-locator", async () => {
    success(await admin.storage.from(bucket).update(fixture.storagePaths[0], image, { contentType: "image/webp", upsert: false }));
    assert.equal(await rpc(admin, "media_resolve_public_image", { p_token: activeToken }), null);
  });
  const report = { status: "passed", localOnly: true, disposalRequired: true, checks, fixture };
  writeFileSync(`${configPath}.result.json`, JSON.stringify(report, null, 2));
  console.log(`Media private Auth/Storage HTTP checks PASS (${checks.length} checks). Disposable stack teardown still required.`);
} catch {
  // Never log Supabase error objects, response bodies, credentials, tokens or passwords.
  if (configPath) writeFileSync(`${configPath}.result.json`, JSON.stringify({ status: "failed", phase, localOnly: true, disposalRequired: true, checks, fixture }, null, 2));
  console.error(`Media private local check failed at: ${phase}. No remote endpoint is permitted.`);
  process.exitCode = 1;
}
