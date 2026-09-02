import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const root = fileURLToPath(new URL("../", import.meta.url));
const nativeRequire = createRequire(import.meta.url);
const cache = new Map();
function load(path) {
  const absolute = resolve(root, path);
  if (cache.has(absolute)) return cache.get(absolute);
  const source = readFileSync(absolute, "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} };
  const localRequire = (id) => id.startsWith("@/") ? load(`${id.slice(2)}.ts`) : nativeRequire(id);
  new Function("require", "module", "exports", compiled)(localRequire, module, module.exports);
  cache.set(absolute, module.exports);
  return module.exports;
}

const model = load("lib/academy/platform-billing-view.ts");
const {
  projectAcademyPlatformBillingStatus: project,
  readAcademyPlatformBillingStatus: readStatus,
  beginAcademyPlatformCheckout: beginCheckout,
  openAcademyPlatformBillingPortal: openPortal,
} = load("lib/academy/platform-billing-adapter.ts");
const { AcademyPlatformBillingPanel: Panel } = load("app/academy/billing/AcademyPlatformBillingPanel.tsx");
const render = (state) => renderToStaticMarkup(React.createElement(Panel, { state }));
const hq = "10000000-0000-4000-8000-000000000001";
const dto = {
  version: 0, product: "academy_platform", resourceId: hq, availability: "ready",
  subscription: { state: "active", planKey: "academy", currentPeriodEndsAt: "2026-10-01T00:00:00.000Z", cancelAtPeriodEnd: false },
  creation: { state: "consumed" }, allowedActions: ["portal"], noticeCode: null,
};
const active = project(dto, hq);
assert.equal(project({ ...dto, availability: ["ready"] }, hq).kind, "unavailable");
assert.equal(project({ ...dto, creation: { state: ["consumed"] } }, hq).kind, "unavailable");
assert.equal(active.kind, "owner");
assert.equal(active.subscriptionStatus, "active");
assert.equal(active.headquartersState, "unverified");
assert.equal(active.nextInvoice, null);
assert.equal(active.snapshot, null);
assert.equal(active.constructionPurchase, "unverified");
assert.equal(active.accessEndsAt, null, "renewal date is not an end date");
assert.deepEqual(active.allowedActions, ["portal"]);
assert.equal(active.planKey, "academy");

for (const value of [null, undefined, -1, NaN, Infinity, 1.5]) assert.equal(model.formatAcademyBillingYen(value), "未確定");
assert.equal(model.formatAcademyBillingYen(0), "0円");
assert.equal(model.formatAcademyBillingYen(5000), "5,000円");
assert.equal(model.formatAcademyBillingDate("not a date"), "未確定");
assert.match(model.formatAcademyBillingDate("2026-08-31T15:00:00Z"), /2026年9月1日/);

for (const bad of [null, [], {}, { ...dto, version: 1 }, { ...dto, product: "community_platform" }, { ...dto, resourceId: null }, { ...dto, availability: "policy_pending" }, { ...dto, availability: "not_configured" }, { ...dto, noticeCode: "UNKNOWN" }, { ...dto, amount: 0 }, { ...dto, allowedActions: ["create_anything"] }, { ...dto, allowedActions: ["portal", "portal"] }, { ...dto, creation: { state: "unknown" } }, { ...dto, subscription: { ...dto.subscription, state: "unknown" } }, { ...dto, subscription: { ...dto.subscription, currentPeriodEndsAt: "tomorrow" } }, { ...dto, subscription: { ...dto.subscription, cancelAtPeriodEnd: "true" } }]) {
  assert.deepEqual(project(bad, hq), { kind: "unavailable" });
}
assert.equal(project(dto, "different-hq").kind, "unavailable");
assert.equal(project(dto, "10000000-0000-4000-8000-000000000002").kind, "unavailable");
const fresh = project({ ...dto, resourceId: null, subscription: null, creation: { state: "available" }, allowedActions: ["create_resource"] }, null);
assert.equal(fresh.subscriptionStatus, "none", "creation eligibility never means paid");
assert.equal(fresh.headquartersState, "unverified");
for (const [input, output] of [["pending", "processing"], ["trialing", "trialing"], ["past_due", "past_due"], ["ended", "ended"]]) {
  assert.equal(project({ ...dto, subscription: { ...dto.subscription, state: input } }, hq).subscriptionStatus, output);
}
assert.equal(project({ ...dto, subscription: { ...dto.subscription, cancelAtPeriodEnd: true } }, hq).subscriptionStatus, "cancel_scheduled");
assert.equal(project({ ...dto, subscription: { ...dto.subscription, state: "past_due", cancelAtPeriodEnd: true } }, hq).subscriptionStatus, "past_due");
assert.equal(project({ ...dto, subscription: { ...dto.subscription, currentPeriodEndsAt: null, cancelAtPeriodEnd: true } }, hq).kind, "unavailable");

for (const kind of ["loading", "forbidden", "unavailable", "sign_in_required", "not_configured", "policy_pending", "state_conflict", "invalid_request"]) {
  const html = render({ kind });
  assert.doesNotMatch(html, /<button|5,000|請求予定額/);
}
for (const subscriptionStatus of ["none", "trialing", "processing", "active", "past_due", "cancel_scheduled", "ended"]) {
  const html = render({ ...active, subscriptionStatus });
  assert.equal((html.match(/<button /g) ?? []).length, 2);
  assert.equal((html.match(/disabled=""/g) ?? []).length, 2);
  assert.doesNotMatch(html, /<form|https:\/\/.*stripe|cus_|sub_/);
  assert.match(html, /未確定/);
}
const snapshotHtml = render({ ...active, snapshot: { cutoffAt: "2026-08-31T14:59:00Z", registeredCount: 21, catalogPriceYen: 10000, scheduledPriceYen: 5000, chargeMonth: "2026-09-01", reconciliation: "mismatch" } });
assert.match(snapshotHtml, /請求内容と料金記録が一致していません/);
assert.match(snapshotHtml, /請求予定額（税込）<\/dt><dd[^>]*>未確定/);
assert.match(snapshotHtml, /21名/);
const purchaseHtml = render({ ...fresh, constructionPurchase: "confirmed_awaiting_monthly_contract" });
assert.match(purchaseHtml, /購入確認済み/);
assert.match(purchaseHtml, /利用開始前/);
assert.doesNotMatch(purchaseHtml, />契約中</);
assert.match(render({ ...active, subscriptionStatus: "trialing" }), /自動課金はありません/);
const actionable = renderToStaticMarkup(React.createElement(Panel, { state: active, compact: true, onOpenPortal() {} }));
assert.equal((actionable.match(/<button /g) ?? []).length, 2);
assert.equal((actionable.match(/disabled=""/g) ?? []).length, 1, "only server-authorized portal becomes actionable");
assert.doesNotMatch(actionable, /構築コースを購入された方へ|Academyの月額料金（税込）/);

const page = readFileSync(resolve(root, "app/academy/billing/page.tsx"), "utf8");
assert.equal(ts.createSourceFile("page.tsx", page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX).parseDiagnostics.length, 0);
assert.match(page, /process.env.NODE_ENV !== "development"\) notFound\(\)/);
assert.ok(page.indexOf('notFound();') < page.indexOf('(await searchParams)'));
assert.match(page, /force-dynamic/);
for (const path of ["app/academy/billing/page.tsx", "app/academy/billing/AcademyPlatformBillingPanel.tsx", "lib/academy/platform-billing-view.ts"]) {
  assert.doesNotMatch(readFileSync(resolve(root, path), "utf8"), /fetch\(|supabase\.|localStorage|sessionStorage|SERVICE_ROLE|SECRET_KEY/);
}
let fetchCalls = 0;
let tokenCalls = 0;
const fakeTransport = {
  getAccessToken: async () => { tokenCalls++; return "fake-test-token"; },
  fetch: async (url, options) => {
    fetchCalls++;
    assert.equal(url, `/api/billing/platform/status?product=academy_platform&resourceId=${hq}`);
    assert.equal(options.headers.Authorization, "Bearer fake-test-token");
    assert.equal(options.method, "GET");
    assert.equal(options.cache, "no-store");
    assert.equal(options.credentials, "omit");
    assert.equal(options.redirect, "error");
    return new Response(JSON.stringify(dto), { status: 200 });
  },
};
assert.equal((await readStatus(hq, fakeTransport)).subscriptionStatus, "active");
assert.equal((await readStatus(hq, fakeTransport)).subscriptionStatus, "active");
assert.equal(tokenCalls, 2, "fresh token on each read");
assert.equal((await readStatus(hq, { ...fakeTransport, getAccessToken: async () => null })).kind, "sign_in_required");
assert.equal(fetchCalls, 2, "no token means no fetch");
assert.equal((await readStatus("bad-resource", fakeTransport)).kind, "unavailable");
assert.equal(fetchCalls, 2);
for (const status of [401, 404, 409, 422, 503]) {
  assert.equal((await readStatus(hq, { ...fakeTransport, fetch: async () => new Response("private raw error", { status }) })).kind, status === 401 ? "sign_in_required" : "unavailable");
}
assert.equal((await readStatus(hq, { ...fakeTransport, fetch: async () => { throw new Error("network-private-data"); } })).kind, "unavailable");
assert.equal((await readStatus(hq, { ...fakeTransport, fetch: async () => new Response("invalid json") })).kind, "unavailable");
const aborted = new AbortController();
aborted.abort();
assert.equal((await readStatus(hq, fakeTransport, aborted.signal)).kind, "unavailable");
assert.equal(fetchCalls, 2);
const adapterSource = readFileSync(resolve(root, "lib/academy/platform-billing-adapter.ts"), "utf8");
assert.doesNotMatch(adapterSource, /console\.|localStorage|sessionStorage|SERVICE_ROLE|SECRET_KEY|NEXT_PUBLIC/);
const requestId = "10000000-0000-4000-8000-000000000099";
let mutationCalls = 0;
const mutationTransport = {
  getAccessToken: async () => "fresh-mutation-token",
  fetch: async (url, options) => {
    mutationCalls++;
    assert.equal(options.method, "POST");
    assert.equal(options.headers.Authorization, "Bearer fresh-mutation-token");
    assert.equal(options.cache, "no-store");
    assert.equal(options.credentials, "omit");
    assert.equal(options.redirect, "error");
    if (url.endsWith("/portal")) {
      assert.deepEqual(JSON.parse(options.body), { product: "academy_platform", resourceId: hq, requestId });
      return Response.json({ version: 0, redirectUrl: "https://billing.stripe.com/p/session_fixture" });
    }
    assert.deepEqual(JSON.parse(options.body), { product: "academy_platform", resourceId: hq, planKey: "small", requestId });
    return Response.json({ version: 0, redirectUrl: "https://checkout.stripe.com/c/pay/session_fixture" });
  },
};
assert.deepEqual(await openPortal(hq, requestId, mutationTransport), { kind: "redirect", url: "https://billing.stripe.com/p/session_fixture" });
assert.deepEqual(await beginCheckout(hq, "small", requestId, mutationTransport), { kind: "redirect", url: "https://checkout.stripe.com/c/pay/session_fixture" });
assert.equal(mutationCalls, 2);
const newHqCheckout = await beginCheckout(null, "small", requestId, {
  ...mutationTransport,
  fetch: async (url, options) => {
    assert.equal(url, "/api/billing/platform/checkout");
    assert.deepEqual(JSON.parse(options.body), { product: "academy_platform", resourceId: null, planKey: "small", requestId });
    return Response.json({ version: 0, redirectUrl: "https://checkout.stripe.com/c/pay/new_hq_fixture" });
  },
});
assert.deepEqual(newHqCheckout, { kind: "redirect", url: "https://checkout.stripe.com/c/pay/new_hq_fixture" });
for (const unsafe of ["http://billing.stripe.com/p/x", "https://evil.example/x", "https://user@billing.stripe.com/x", "https://billing.stripe.com:444/x"]) {
  assert.equal((await openPortal(hq, requestId, { ...mutationTransport, fetch: async () => Response.json({ version: 0, redirectUrl: unsafe }) })).kind, "unavailable");
}
assert.equal((await beginCheckout(hq, "Bad Plan", requestId, mutationTransport)).kind, "invalid_request");
assert.equal(mutationCalls, 2, "invalid checkout never reads auth or calls fetch");
assert.equal((await openPortal(hq, requestId, { ...mutationTransport, getAccessToken: async () => null })).kind, "sign_in_required");
assert.equal(mutationCalls, 2, "missing token never calls mutation API");
for (const [code, status, kind] of [["AUTH_REQUIRED", 401, "sign_in_required"], ["RESOURCE_UNAVAILABLE", 404, "unavailable"], ["STATE_CONFLICT", 409, "state_conflict"], ["INVALID_REQUEST", 422, "invalid_request"], ["BILLING_NOT_CONFIGURED", 503, "not_configured"], ["POLICY_PENDING", 503, "policy_pending"]]) {
  const result = await openPortal(hq, requestId, { ...mutationTransport, fetch: async () => Response.json({ error: { code } }, { status }) });
  assert.equal(result.kind, kind);
}
const settingsSource = readFileSync(resolve(root, "app/academy/settings/page.tsx"), "utf8");
assert.match(settingsSource, /<AcademyPlatformBillingLoader/);
assert.match(settingsSource, /userId=\{user\.id\}/);
assert.match(settingsSource, /resourceId=\{headquarters\.id\}/);
assert.doesNotMatch(settingsSource, /planKey=|構築コース.*契約中/);
console.log("Academy platform billing UI: model + v0 rejection + rendered states + boundary checks OK");

for (const [code, kind, status] of [
  ["AUTH_REQUIRED", "sign_in_required", 401], ["RESOURCE_UNAVAILABLE", "unavailable", 404],
  ["STATE_CONFLICT", "state_conflict", 409], ["INVALID_REQUEST", "invalid_request", 422],
  ["BILLING_NOT_CONFIGURED", "not_configured", 503], ["POLICY_PENDING", "policy_pending", 503],
]) {
  assert.equal(project({ ...dto, allowedActions: [], noticeCode: code }, hq).kind, kind);
  assert.equal(project({ ...dto, noticeCode: code }, hq).kind, "unavailable", "blocking notices cannot allow actions");
  assert.equal((await readStatus(hq, { ...fakeTransport, fetch: async () => new Response(JSON.stringify({ error: { code } }), { status }) })).kind, kind);
}
for (const value of ["2026-02-30T00:00:00.000Z", "2026-10-01T00:00:00Z", "2026-10-01T00:00:00+09:00"]) {
  assert.equal(project({ ...dto, subscription: { ...dto.subscription, currentPeriodEndsAt: value } }, hq).kind, "unavailable");
}
const { createAcademyBillingLoader } = load("lib/academy/platform-billing-loader.ts");
const userA = "10000000-0000-4000-8000-000000000010";
const userB = "10000000-0000-4000-8000-000000000020";
let session = { access_token: "fake-only", user: { id: userA, is_anonymous: false } };
let authListener;
let reads = 0;
const auth = {
  getSession: async () => { reads++; return { data: { session }, error: null }; },
  onAuthStateChange: (callback) => { authListener = callback; return { data: { subscription: { unsubscribe() { authListener = undefined; } } } }; },
};
const pending = [];
const delayedFetch = async (_url, options) => new Promise(resolve => pending.push({ resolve, signal: options.signal }));
const scope = { userId: userA, resourceId: hq, isGuest: false, auth, fetch: delayedFetch };
const loader = createAcademyBillingLoader(scope);
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const complete = (entry, payload = dto) => entry.resolve(new Response(JSON.stringify(payload)));
loader.start();
await tick();
complete(pending[0]); await tick();
assert.equal(loader.getSnapshot().kind, "owner");
session = { ...session, user: { id: userB, is_anonymous: false } };
authListener();
assert.equal(loader.getSnapshot().kind, "loading", "auth event erases old billing synchronously");
await tick(); await tick();
assert.equal(loader.getSnapshot().kind, "sign_in_required");
assert.equal(pending.length, 1, "new account token must never be sent under old account scope");
session = { ...session, user: { id: userA, is_anonymous: false } };
const oldReload = loader.reload(); await tick();
const newReload = loader.reload(); await tick();
assert.equal(pending[1].signal.aborted, true);
complete(pending[2], { ...dto, subscription: { ...dto.subscription, state: "past_due" } });
await newReload;
complete(pending[1]); await oldReload;
assert.equal(loader.getSnapshot().subscriptionStatus, "past_due", "late response cannot replace newer result");
const nextHq = createAcademyBillingLoader({ ...scope, resourceId: "10000000-0000-4000-8000-000000000002" });
assert.equal(nextHq.getSnapshot().kind, "loading", "new HQ starts with no invoice before effects");
nextHq.dispose();
loader.dispose();
assert.equal(loader.getSnapshot().kind, "loading");
assert.equal(authListener, undefined);

for (const absent of [null, { ...session, user: { id: userA, is_anonymous: true } }]) {
  session = absent;
  const isolated = createAcademyBillingLoader(scope);
  await isolated.reload();
  assert.equal(isolated.getSnapshot().kind, "sign_in_required");
  isolated.dispose();
}
assert.equal(pending.length, 3);
const never = new Promise(() => {});
const stuck = createAcademyBillingLoader({ ...scope, timeoutMs: 5, auth: { ...auth, getSession: () => never } });
void stuck.reload();
await new Promise(resolve => setTimeout(resolve, 15));
assert.equal(stuck.getSnapshot().kind, "unavailable", "session stalls must fail closed");
stuck.dispose();
assert.ok(reads >= 6, "fresh session per request");
console.log("Academy billing loader: safe notices, auth changes, HQ reset, abort, stale response and timeout OK (fake transport only)");
