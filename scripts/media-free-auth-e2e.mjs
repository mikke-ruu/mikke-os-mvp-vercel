// Explicitly invoked disposable-branch test. Never reads an env file.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const ref = "ydwvaljzorgwmqihvocf";
const deadline = Date.parse("2026-09-07T13:59:05Z");
let currentCase = "GATE";
let cleanup = false;
let admin;
const clients = [];
const users = [];
const boundaries = [];
function checkDeadline() {
  if (Date.now() >= deadline) throw new Error("MEDIA_TEST_EXPIRED");
}
function pass(name) { console.log(`PASS ${name}`); }
async function runCase(name, operation) {
  currentCase = name;
  checkDeadline();
  await operation();
  pass(name);
}
async function safeFetch(input, init) {
  if (!cleanup) checkDeadline();
  const url = new URL(typeof input === "string" ? input : input.url ?? String(input));
  assert.equal(url.origin, `https://${ref}.supabase.co`);
  const authAllowed = /^\/auth\/v1\/(?:admin\/users(?:\/[a-f0-9-]+)?|token|logout|user)$/.test(url.pathname);
  assert.ok(authAllowed || url.pathname.startsWith('/rest/v1/'));
  if (url.pathname === '/auth/v1/token') assert.equal(url.searchParams.get('grant_type'), 'password');
  return fetch(input, { ...init, redirect: "error", signal: AbortSignal.timeout(30000) });
}

async function main() {
  if (!process.argv.includes("--run")) {
    console.log("NOT_RUN EXPLICIT_RUN_REQUIRED");
    return;
  }
  checkDeadline();
  assert.equal(process.env.MEDIA_TEST_DB_READY, ref);
  assert.equal(process.env.MEDIA_TEST_AUTH_PREFLIGHT, ref);
  assert.equal(process.env.MEDIA_TEST_URL, `https://${ref}.supabase.co`);
  assert.ok(process.env.MEDIA_TEST_PUBLIC_KEY);
  assert.ok(process.env.MEDIA_TEST_ADMIN_KEY);
  assert.notEqual(process.env.MEDIA_TEST_PUBLIC_KEY, process.env.MEDIA_TEST_ADMIN_KEY);
  function checkLegacyKey(key, role) {
    assert.equal(key.split(".").length, 3);
    const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8"));
    assert.equal(payload.ref, ref);
    assert.equal(payload.role, role);
    assert.ok(Number.isFinite(payload.exp) && payload.exp * 1000 > Date.now());
  }
  checkLegacyKey(process.env.MEDIA_TEST_PUBLIC_KEY, "anon");
  checkLegacyKey(process.env.MEDIA_TEST_ADMIN_KEY, "service_role");
  const { createClient } = await import("@supabase/supabase-js");
  const { runMediaBrowserAuthChecks } = await import("./media-free-browser-auth-check.mjs");
  const { createMediaDatabaseOperations } = await import("../lib/media-app/database-operations.ts");
  const { MediaSessionBoundary } = await import("../lib/media-app/integration.ts");
  const { createMediaPublicRpcTransport } = await import("../lib/media-app/public-rpc.ts");
  const { createMediaPublicReader } = await import("../lib/media-app/public-contract.ts");
  function client(key) {
    const value = createClient(process.env.MEDIA_TEST_URL, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: safeFetch }
    });
    clients.push(value);
    return value;
  }
  admin = client(process.env.MEDIA_TEST_ADMIN_KEY);
  const a = client(process.env.MEDIA_TEST_PUBLIC_KEY);
  const b = client(process.env.MEDIA_TEST_PUBLIC_KEY);
  const anon = client(process.env.MEDIA_TEST_PUBLIC_KEY);
  const independentA = client(process.env.MEDIA_TEST_PUBLIC_KEY);
  const suffix = randomBytes(10).toString("hex");
  const credentials = ["a", "b"].map((label) => ({
    email: `media-e2e-${label}-${suffix}@example.invalid`,
    password: randomBytes(32).toString("base64url")
  }));
  await runCase("SYNTHETIC_USERS", async () => {
    for (const credential of credentials) {
      const { data, error } = await admin.auth.admin.createUser({ ...credential, email_confirm: true });
      if (error) throw error;
      assert.ok(data.user?.id);
      users.push(data.user.id);
      assert.equal(Boolean(data.user.is_anonymous), false);
    }
  });
  async function login(target, credential) {
    const { data, error } = await target.auth.signInWithPassword(credential);
    if (error) throw error;
    assert.ok(data.session);
    assert.equal(Boolean(data.user?.is_anonymous), false);
  }
  async function logout(target) {
    const { error } = await target.auth.signOut({ scope: "local" });
    if (error) throw error;
  }
  await runCase("A_B_LOGIN", async () => {
    await login(a, credentials[0]);
    await login(b, credentials[1]);
  });
  const opsA = createMediaDatabaseOperations(a);
  const opsB = createMediaDatabaseOperations(b);
  const boundaryA = new MediaSessionBoundary(opsA.mediaDatabaseTransport);
  const boundaryB = new MediaSessionBoundary(opsB.mediaDatabaseTransport);
  boundaries.push(boundaryA, boundaryB);
  // INITIAL_SESSION is an asynchronous initialization notification, not a
  // settled test precondition. Wait explicitly; never retry a mutation.
  async function settleInitialNotification(target) {
    let subscription;
    let timer;
    try {
      await new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error('AUTH_INITIAL_TIMEOUT')), 10000);
        subscription = target.auth.onAuthStateChange((event) => {
          if (event === 'INITIAL_SESSION') resolve();
        }).data.subscription;
      });
    } finally { clearTimeout(timer); subscription?.unsubscribe(); }
  }
  await settleInitialNotification(a);
  await settleInitialNotification(b);
  const reader = createMediaPublicReader(createMediaPublicRpcTransport((name, args) => anon.rpc(name, args)));
  await runCase("INITIAL_OWNED_ZERO", async () => {
    for (const boundary of [boundaryA, boundaryB]) {
      const initial = await boundary.listMyFreeMedia();
      console.log(`OBSERVE INITIAL_STATUS_${initial.status}_ROWS_${initial.status === 'ok' ? initial.value.length : 'NONE'}`);
      assert.deepEqual(initial, { status: "ok", value: [] });
    }
  });
  const slug = `media-e2e-${suffix}`;
  let siteId;
  await runCase("CREATE_COMMIT_OWNED_ONE", async () => {
    const created = await boundaryA.createMyFreeMedia({
      name: "Synthetic Media", slug, description: "Disposable test only", authorName: "Synthetic author"
    });
    assert.equal(created.status, "ok");
    siteId = created.value;
    const owned = await boundaryA.listMyFreeMedia();
    assert.equal(owned.status, "ok");
    assert.equal(owned.value.length, 1);
    assert.equal(owned.value[0].id, siteId);
    assert.deepEqual(await boundaryB.listMyFreeMedia(), { status: "ok", value: [] });
  });
  const draft = {
    title: "Synthetic first revision", slug: "synthetic-article", excerpt: "Text only",
    locale: "ja-JP", blocks: [{ id: "paragraph-1", type: "paragraph", text: "Synthetic first body" }]
  };
  let articleId;
  await runCase("DRAFT_SAVE_READ", async () => {
    const saved = await opsA.createMediaArticleDraftInDatabase(siteId, draft);
    articleId = saved.id;
    const loaded = await opsA.readMediaArticleDraftFromDatabase(articleId);
    assert.equal(loaded?.title, draft.title);
    assert.deepEqual(loaded?.draft_blocks, draft.blocks);
  });
  await runCase("RELOGIN_INDEPENDENT_CLIENT", async () => {
    await logout(a);
    assert.deepEqual(await boundaryA.listMyFreeMedia(), { status: "unauthenticated" });
    await login(a, credentials[0]);
    await login(independentA, credentials[0]);
    const restored = await createMediaDatabaseOperations(independentA).readMediaArticleDraftFromDatabase(articleId);
    assert.equal(restored?.title, draft.title);
    assert.deepEqual(restored?.draft_blocks, draft.blocks);
  });
  const attestation = {
    termsVersion: "synthetic-test-only-20260907", rightsConfirmed: true,
    privacyConfirmed: true, affiliateFreeConfirmed: true
  };
  await runCase("OTHER_USER_DIRECT_ID_DENIED", async () => {
    assert.equal(await opsB.readMediaArticleDraftFromDatabase(articleId), null);
    await assert.rejects(() => opsB.updateMediaArticleDraftInDatabase(articleId, draft));
    await assert.rejects(() => opsB.createMediaArticleDraftInDatabase(siteId, draft));
    await assert.rejects(() => opsB.publishMediaArticleInDatabase(articleId, attestation));
    await assert.rejects(() => opsB.unpublishMediaArticleInDatabase(articleId));
  });
  await runCase("DIRECT_PUBLICATION_COLUMNS_DENIED", async () => {
    for (const values of [{ status: "published" }, { current_published_version_id: null }]) {
      const result = await a.from("media_articles").update(values).eq("id", articleId).select("id");
      assert.ok(result.error, "Direct article publication column update must fail");
    }
    const result = await a.from("media_sites").update({ is_published: true }).eq("id", siteId).select("id");
    assert.ok(result.error, "Direct site publication column update must fail");
  });
  await runCase("ANON_DRAFT_LEAK_ZERO", async () => {
    const table = await anon.from("media_articles").select("id,title,draft_blocks").eq("id", articleId);
    assert.ok(table.error || (Array.isArray(table.data) && table.data.length === 0));
    assert.equal(await reader.site(slug), null);
    assert.equal(await reader.article(slug, draft.slug), null);
    assert.deepEqual(await reader.articles(slug), []);
    const anonymousBoundary = new MediaSessionBoundary(createMediaDatabaseOperations(anon).mediaDatabaseTransport);
    boundaries.push(anonymousBoundary);
    await settleInitialNotification(anon);
    assert.deepEqual(await anonymousBoundary.listMyFreeMedia(), { status: "unauthenticated" });
  });
  let first;
  await runCase("EXPLICIT_PUBLISH_PUBLIC_DTO", async () => {
    await opsA.publishMediaArticleInDatabase(articleId, attestation);
    first = await reader.article(slug, draft.slug);
    assert.ok(first);
    assert.equal(first.title, draft.title);
    assert.deepEqual(first.blocks, draft.blocks);
    assert.equal((await reader.site(slug))?.slug, slug);
    assert.equal((await reader.articles(slug))?.length, 1);
    assert.equal(/owner_id|site_id|article_id|draft_blocks|imageAssetId/.test(JSON.stringify(first)), false);
  });
  const changed = { ...draft, title: "Synthetic second revision", blocks: [{
    id: "paragraph-1", type: "paragraph", text: "Synthetic second body"
  }] };
  await runCase("DRAFT_CHANGE_SNAPSHOT_UNCHANGED", async () => {
    await opsA.updateMediaArticleDraftInDatabase(articleId, changed);
    assert.deepEqual(await reader.article(slug, draft.slug), first);
  });
  await runCase("REPUBLISH_NEW_SNAPSHOT", async () => {
    await opsA.publishMediaArticleInDatabase(articleId, attestation);
    const second = await reader.article(slug, draft.slug);
    assert.equal(second?.title, changed.title);
    assert.deepEqual(second?.blocks, changed.blocks);
    assert.ok(second.versionNumber > first.versionNumber);
    assert.notEqual(second.revisionHash, first.revisionHash);
  });
  await runCase("UNPUBLISH_PRESERVES_DRAFT", async () => {
    await opsA.unpublishMediaArticleInDatabase(articleId);
    assert.equal(await reader.article(slug, draft.slug), null);
    assert.deepEqual(await reader.articles(slug), []);
    assert.equal((await opsA.readMediaArticleDraftFromDatabase(articleId))?.title, changed.title);
  });
  await runCase("INDEPENDENT_BROWSER_AUTH", async () => {
    await runMediaBrowserAuthChecks({
      url: process.env.MEDIA_TEST_URL,
      publicKey: process.env.MEDIA_TEST_PUBLIC_KEY,
      credentialsA: credentials[0], credentialsB: credentials[1],
      siteId, articleId, expectedTitle: changed.title, pass
    });
  });
  await runCase("REAL_SESSION_CHANGED_RESPONSE_STALE", async () => {
    let release;
    let started;
    const held = new Promise((resolve) => { release = resolve; });
    const entered = new Promise((resolve) => { started = resolve; });
    const delayed = new MediaSessionBoundary({
      ...opsA.mediaDatabaseTransport,
      async listDirectOwnerSites() {
        const rows = await opsA.listMyMediaSitesFromDatabase();
        started();
        await held;
        return rows;
      }
    });
    boundaries.push(delayed);
    await settleInitialNotification(a);
    const pending = delayed.listMyFreeMedia();
    void pending.catch(() => {});
    let timeout;
    try {
      await Promise.race([entered, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error("TIMEOUT")), 30000); })]);
      await logout(a);
      await login(a, credentials[1]);
    } finally {
      clearTimeout(timeout);
      release();
    }
    assert.deepEqual(await pending, { status: "stale" });
    assert.deepEqual(await delayed.listMyFreeMedia(), { status: "ok", value: [] });
  });
}

try {
  await main();
} catch (error) {
  const code = typeof error?.code === "string" && /^[A-Z0-9_]{1,64}$/i.test(error.code)
    ? error.code : "UNCLASSIFIED";
  console.error(`FAIL ${currentCase} ${code}`);
  process.exitCode = 1;
} finally {
  cleanup = true;
  for (const boundary of boundaries) boundary.dispose();
  let cleanupFailed = false;
  for (const target of clients) {
    try {
      const { error } = await target.auth.signOut({ scope: "local" });
      if (error) cleanupFailed = true;
    } catch { cleanupFailed = true; }
  }
  for (const userId of users) {
    try {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) cleanupFailed = true;
    } catch { cleanupFailed = true; }
  }
  if (clients.length) {
    if (cleanupFailed) process.exitCode = 1;
    console.log(cleanupFailed ? "CLEANUP BRANCH_DELETE_REQUIRED" : "CLEANUP CLIENTS_SIGNED_OUT_USERS_REMOVED");
    console.log("CLEANUP FINAL_BRANCH_DELETE_CONTROL_ROOM");
  }
}
