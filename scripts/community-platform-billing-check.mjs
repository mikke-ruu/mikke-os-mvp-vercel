import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Execute real TypeScript functions in memory; no emitted fixture files, API,
// Supabase project, credentials or database are needed for this test suite.
const require = createRequire(import.meta.url);
const cache = new Map();
function load(relativePath) {
  const file = path.resolve(relativePath);
  if (cache.has(file)) return cache.get(file);
  const module = { exports: {} };
  const source = readFileSync(file, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, fileName: file
  });
  function localRequire(name) {
    if (name === "next/link") return ({ href, children, ...props }) => React.createElement("a", { ...props, href }, children);
    if (name === "@/lib/supabase/client") throw new Error("Real auth is forbidden in fixture tests");
    if (name.startsWith("@/") || name.startsWith(".")) {
      const base = name.startsWith("@/") ? path.resolve(name.slice(2)) : path.resolve(path.dirname(file), name);
      return load(`${base}.ts`);
    }
    return require(name);
  }
  vm.runInNewContext(outputText, { module, exports: module.exports, require: localRequire, URL, URLSearchParams, AbortController, AbortSignal,
    fetch() { throw new Error("Real network is forbidden in fixture tests"); } }, { filename: file });
  cache.set(file, module.exports);
  return module.exports;
}
const model = load("lib/community/platform-billing.ts");
const plans = load("lib/community/platform-plans.ts");
const { CommunityPlatformBillingView } = load("components/community/CommunityPlatformBilling.tsx");
const resource = "ad000001-0000-4000-8000-000000000001";
const other = "ad000002-0000-4000-8000-000000000002";
const requestId = "ad000003-0000-4000-8000-000000000003";
let checks = 0;
function check(name, fn) { fn(); checks++; }
async function checkAsync(name, fn) { await fn(); checks++; }
const dto = (patch = {}) => ({ version: 0, product: "community_platform", resourceId: resource, availability: "ready",
  subscription: { state: "active", planKey: "starter", currentPeriodEndsAt: "2026-10-01T00:00:00Z", cancelAtPeriodEnd: false },
  creation: { state: "consumed" }, allowedActions: ["portal"], noticeCode: null, ...patch });
const state = (patch = {}) => ({ kind: "loaded", data: dto(patch) });
const response = (raw, status = 200) => new Response(JSON.stringify(raw), { status, headers: { "Content-Type": "application/json" } });
const transport = (fetcher, token = "fixture-token-not-valid") => ({ getAccessToken: async () => token, fetch: fetcher });

check("approved pricing unchanged", () => assert.deepEqual(JSON.parse(JSON.stringify(plans.COMMUNITY_PLATFORM_PLANS.map(p => [p.key, p.monthlyAmountYen, p.memberLimit, p.trialDays]))), [
  ["trial", 0, 10, 30], ["starter", 2980, 50, null], ["standard", 4980, 200, null], ["pro", 9800, 1000, null], ["enterprise", null, null, null]
]));
for (const key of [undefined, null, "fake", "__proto__", "academy_platform"]) check("unknown plan never becomes Trial", () => assert.equal(plans.getCommunityPlatformPlan(key), null));
check("catalogue is frozen", () => assert.throws(() => { plans.COMMUNITY_PLATFORM_PLANS[1].monthlyAmountYen = 0; }));
check("valid DTO", () => assert.ok(model.decodeCommunityPlatformStatus(dto(), resource)));
for (const patch of [
  { version: 1 }, { product: "academy_platform" }, { resourceId: other }, { resourceId: null },
  { availability: "unknown" }, { allowedActions: ["refund"] }, { allowedActions: ["portal", "portal"] },
  { creation: { state: "fake" } }, { noticeCode: "secret raw db error" }, { ownerUserId: other },
  { subscription: undefined }, { subscription: { ...dto().subscription, planKey: "fake" } },
  { subscription: { ...dto().subscription, state: "refunded" } },
  { subscription: { ...dto().subscription, currentPeriodEndsAt: "yesterday" } },
  { subscription: { ...dto().subscription, cancelAtPeriodEnd: "false" } }
]) check("unknown/mismatched DTO fails closed", () => assert.equal(model.decodeCommunityPlatformStatus(dto(patch), resource), null));
for (const kind of ["unavailable", "policy_pending", "auth_required", "resource_unavailable", "error", "loading"]) {
  for (const action of ["checkout", "portal", "create_resource"]) check("unloaded actions blocked", () => assert.ok(model.communityPlatformActionBlock({ kind }, action)));
}
for (const availability of ["not_configured", "policy_pending"]) {
  check("not ready blocks portal", () => assert.ok(model.communityPlatformActionBlock(state({ availability }), "portal")));
}
check("v0 checkout always blocked even with capability", () => assert.ok(model.communityPlatformActionBlock(state({ allowedActions: ["checkout"] }), "checkout")));
check("portal requires existing target", () => assert.ok(model.communityPlatformActionBlock(state({ resourceId: null }), "portal")));
check("portal requires server capability", () => assert.ok(model.communityPlatformActionBlock(state({ allowedActions: [] }), "portal")));
check("portal available for server-confirmed scope", () => assert.equal(model.communityPlatformActionBlock(state(), "portal"), null));
check("active alone never grants creation", () => assert.ok(model.communityPlatformActionBlock(state({ resourceId: null }), "create_resource")));
check("explicit server creation readiness", () => assert.equal(model.communityPlatformActionBlock(state({ resourceId: null, creation: { state: "available" }, allowedActions: ["create_resource"] }), "create_resource"), null));
for (const subState of ["pending", "past_due", "ended"]) check("non-active cannot create", () => assert.ok(model.communityPlatformActionBlock(state({ resourceId: null, creation: { state: "available" }, allowedActions: ["create_resource"], subscription: { ...dto().subscription, state: subState } }), "create_resource")));

await checkAsync("no token means no fetch", async () => {
  const result = await model.loadCommunityPlatformStatus(null, transport(() => { assert.fail("must not fetch"); }, null));
  assert.equal(result.kind, "auth_required");
});
await checkAsync("invalid scope blocked before token and fetch", async () => {
  assert.equal((await model.loadCommunityPlatformStatus("invalid", { getAccessToken() { assert.fail(); }, fetch() { assert.fail(); } })).kind, "resource_unavailable");
});
await checkAsync("Bearer reacquired each call, private transport", async () => {
  let tokens = 0;
  const port = { getAccessToken: async () => `fixture-${++tokens}`, fetch: async (url, init) => {
    assert.equal(url, `/api/billing/platform/status?product=community_platform&resourceId=${resource}`);
    assert.equal(init.headers.Authorization, `Bearer fixture-${tokens}`);
    assert.equal(init.credentials, "omit"); assert.equal(init.redirect, "error"); assert.equal(init.cache, "no-store");
    assert.ok(init.signal instanceof AbortSignal);
    assert.ok(!url.includes("fixture")); return response(dto());
  } };
  assert.equal((await model.loadCommunityPlatformStatus(resource, port)).kind, "loaded");
  assert.equal((await model.loadCommunityPlatformStatus(resource, port)).kind, "loaded");
  assert.equal(tokens, 2);
});
for (const [statusCode, code, expected] of [[401, "AUTH_REQUIRED", "auth_required"], [404, "RESOURCE_UNAVAILABLE", "resource_unavailable"], [503, "POLICY_PENDING", "policy_pending"], [503, "BILLING_NOT_CONFIGURED", "unavailable"], [500, "SECRET_STACK", "error"]]) {
  await checkAsync("safe error mapping", async () => assert.equal((await model.loadCommunityPlatformStatus(resource, transport(async () => response({ error: { code } }, statusCode)))).kind, expected));
}
await checkAsync("API absent HTML404", async () => assert.equal((await model.loadCommunityPlatformStatus(null, transport(async () => new Response("<html>Not found</html>", { status: 404 })))).kind, "unavailable"));
await checkAsync("wrong product from server", async () => assert.equal((await model.loadCommunityPlatformStatus(resource, transport(async () => response(dto({ product: "academy_platform" }))))).kind, "unavailable"));
await checkAsync("network fails without raw message", async () => assert.equal((await model.loadCommunityPlatformStatus(resource, transport(async () => { throw Error("private customer email"); }))).kind, "error"));
for (const url of ["javascript:alert(1)", "https://billing.stripe.com.evil.test/x", "https://user@billing.stripe.com/x", "http://billing.stripe.com/x", "//billing.stripe.com/x", "https://billing.stripe.com:8080/x", "/community/create"]) check("unapproved redirect blocked", () => assert.equal(model.isCommunityPlatformProviderUrl(url), false));
check("approved provider redirect", () => assert.equal(model.isCommunityPlatformProviderUrl("https://billing.stripe.com/p/session/test"), true));
await checkAsync("portal body narrow, manual retry request stable", async () => {
  const bodies = [];
  const port = transport(async (url, init) => {
    assert.equal(url, "/api/billing/platform/portal"); assert.equal(init.credentials, "omit"); assert.equal(init.redirect, "error");
    bodies.push(JSON.parse(init.body));
    return response({ version: 0, redirectUrl: "https://billing.stripe.com/p/session/test" });
  });
  const before = JSON.stringify(state());
  assert.equal((await model.openCommunityPlatformPortal(state(), requestId, port)).ok, true);
  assert.equal((await model.openCommunityPlatformPortal(state(), requestId, port)).ok, true);
  assert.deepEqual(bodies, [0, 1].map(() => ({ product: "community_platform", resourceId: resource, requestId })));
  assert.equal(JSON.stringify(state()), before);
});
await checkAsync("portal missing token rejects before network", async () => assert.equal((await model.openCommunityPlatformPortal(state(), requestId, transport(() => { assert.fail(); }, null))).authRequired, true));
await checkAsync("portal401 prompts login", async () => assert.equal((await model.openCommunityPlatformPortal(state(), requestId, transport(async () => response({ error: { code: "AUTH_REQUIRED" } }, 401)))).authRequired, true));
await checkAsync("blocked portal never posts", async () => assert.equal((await model.openCommunityPlatformPortal({ kind: "unavailable" }, requestId, transport(() => { assert.fail(); }))).ok, false));
await checkAsync("portal does not retry automatically", async () => {
  let calls = 0;
  const result = await model.openCommunityPlatformPortal(state(), requestId, transport(async () => { calls++; throw Error("private"); }));
  assert.equal(calls, 1); assert.equal(result.ok, false); assert.ok(!result.message.includes("private"));
});
await checkAsync("portal rejects unsafe redirect", async () => assert.equal((await model.openCommunityPlatformPortal(state(), requestId, transport(async () => response({ version: 0, redirectUrl: "https://evil.test" })))).ok, false));

for (const kind of ["unavailable", "auth_required", "error", "policy_pending"]) check("UI empty state honest", () => {
  const html = renderToStaticMarkup(React.createElement(CommunityPlatformBillingView, { state: { kind } }));
  assert.ok(html.includes("請求額と請求日は未取得")); assert.ok(html.includes("disabled"));
  assert.ok(!html.includes('href="/community/create"')); assert.ok(!html.includes("決済が完了しました"));
  assert.ok(html.includes("2,980")); assert.ok(html.includes("税込"));
});
check("UI keeps creation disabled despite readiness until backend guard", () => {
  const html = renderToStaticMarkup(React.createElement(CommunityPlatformBillingView, { state: state({ resourceId: null, creation: { state: "available" }, allowedActions: ["create_resource"] }) }));
  assert.ok(html.includes("Community作成への接続は準備中")); assert.ok(!html.includes('href="/community/create"'));
});
check("null period not unlimited or zero", () => {
  const html = renderToStaticMarkup(React.createElement(CommunityPlatformBillingView, { state: state({ subscription: { ...dto().subscription, currentPeriodEndsAt: null } }) }));
  assert.ok(html.includes("未確定")); assert.ok(!html.includes("期限なし"));
});
check("queries cannot mark checkout paid", () => {
  const route = readFileSync("app/community/start/page.tsx", "utf8");
  assert.doesNotMatch(route, /searchParams|session_id|payment_status/);
});
check("source boundaries", () => {
  const adapter = readFileSync("lib/community/platform-billing.ts", "utf8");
  const view = readFileSync("components/community/CommunityPlatformBilling.tsx", "utf8");
  assert.doesNotMatch(adapter + view, /localStorage|service_role|STRIPE_SECRET|\.rpc\(|\.from\(/);
  assert.doesNotMatch(adapter, /\/api\/billing\/platform\/checkout["']/);
  assert.match(view, /pending\.current/); assert.match(view, /request\.current\.id/);
  assert.match(view, /getSession\(\)/); assert.doesNotMatch(view, /console\./);
});
console.log(`community-platform-billing-check: ${checks} checks passed (fixture-only; no auth/DB/provider network)`);
