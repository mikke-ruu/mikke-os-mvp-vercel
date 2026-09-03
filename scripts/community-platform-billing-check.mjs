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
const creation = load("lib/billing/platform/creation.ts");
const { createCommunityPlatformStatusLoader } = load("lib/community/platform-billing-loader.ts");
const plans = load("lib/community/platform-plans.ts");
const { CommunityPlatformBillingView } = load("components/community/CommunityPlatformBilling.tsx");
const resource = "ad000001-0000-4000-8000-000000000001";
const other = "ad000002-0000-4000-8000-000000000002";
const requestId = "ad000003-0000-4000-8000-000000000003";
const owner = "ad000004-0000-4000-8000-000000000004";
let checks = 0;
function check(name, fn) { fn(); checks++; }
async function checkAsync(name, fn) { await fn(); checks++; }
const dto = (patch = {}) => ({ version: 0, product: "community_platform", resourceId: resource, availability: "ready",
  subscription: { state: "active", planKey: "starter", currentPeriodEndsAt: "2026-10-01T00:00:00.000Z", cancelAtPeriodEnd: false },
  creation: { state: "consumed" }, allowedActions: ["portal"], noticeCode: null, ...patch });
const state = (patch = {}) => ({ kind: "loaded", data: dto(patch) });
const response = (raw, status = 200) => new Response(JSON.stringify(raw), { status, headers: { "Content-Type": "application/json" } });
const transport = (fetcher, token = "fixture-token-not-valid") => ({ getAccessToken: async () => token, fetch: fetcher });
const quoteDto = (patch = {}) => ({
  quoteId: "quote-community-1", revision: 1, purchaseIntent: "explicit_paid_start",
  scope: { ownerUserId: owner, productKey: "community_platform", resourceId: resource, planKey: "starter", requestId },
  currency: "JPY", taxIncluded: true, dueNow: { totalYen: 2980, dueOn: "2026-09-04" }, nextPayment: { totalYen: 2980, dueOn: "2026-10-04" },
  merchant: { merchantId: "ojas", legalName: "株式会社OJAS", address: "東京都 テスト住所", contactUrl: "https://example.com/contact" },
  policies: { approved: true, approvalId: "community-policy", revision: 1,
    terms: { version: "terms-v1", url: "https://example.com/terms" }, privacy: { version: "privacy-v1", url: "https://example.com/privacy" },
    refund: { version: "refund-v1", url: "https://example.com/refund" }, cancellation: { version: "cancel-v1", url: "https://example.com/cancel" },
    proration: { version: "proration-v1", url: "https://example.com/proration" }, renewal: { version: "renewal-v1", url: "https://example.com/renewal" },
    commercialDisclosure: { version: "commerce-v1", url: "https://example.com/commerce" } },
  issuedAt: "2026-09-03T00:00:00.000Z", expiresAt: "2026-09-03T00:15:00.000Z", ...patch
});
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

await checkAsync("resource switch aborts and clears; late old response cannot overwrite", async () => {
  const first = deferred(); const shown = []; let firstSignal;
  const loader = createCommunityPlatformStatusLoader(transport(async (url, init) => {
    if (url.includes(resource)) { firstSignal = init.signal; return first.promise; }
    return response(dto({ resourceId: other }));
  }), value => shown.push(value));
  const a = loader.load(resource); await flush();
  const b = loader.load(other);
  assert.equal(firstSignal.aborted, true); assert.equal(shown.at(-1).kind, "loading");
  await b; assert.equal(shown.at(-1).data.resourceId, other);
  first.resolve(response(dto())); await a;
  assert.equal(shown.at(-1).data.resourceId, other); loader.dispose();
});
await checkAsync("auth signout clears loaded contract synchronously and does not fetch", async () => {
  const shown = []; let calls = 0;
  const loader = createCommunityPlatformStatusLoader(transport(async () => { calls++; return response(dto()); }), value => shown.push(value));
  await loader.load(resource); assert.equal(shown.at(-1).kind, "loaded");
  loader.authChanged(resource, false);
  assert.equal(shown.at(-1).kind, "auth_required"); assert.equal(shown.at(-1).data, undefined);
  await flush(); assert.equal(calls, 1); loader.dispose();
});
await checkAsync("auth change aborts old request; deferred reload uses new token; late result ignored", async () => {
  const old = deferred(); const shown = []; const scheduled = []; const tokens = []; let token = "fake-a"; let signal;
  const loader = createCommunityPlatformStatusLoader({ getAccessToken: async () => token, fetch: async (_url, init) => {
    tokens.push(init.headers.Authorization);
    if (tokens.length === 1) { signal = init.signal; return old.promise; }
    return response(dto({ subscription: null, allowedActions: [] }));
  } }, value => shown.push(value), fn => scheduled.push(fn));
  const a = loader.load(resource); await flush(); token = "fake-b";
  loader.authChanged(resource, true);
  assert.equal(signal.aborted, true); assert.equal(shown.at(-1).kind, "loading"); assert.equal(tokens.length, 1);
  scheduled.shift()(); await flush();
  old.resolve(response(dto())); await a; await flush();
  assert.deepEqual(tokens, ["Bearer fake-a", "Bearer fake-b"]);
  assert.equal(shown.at(-1).data.subscription, null); loader.dispose();
});
await checkAsync("signout cancels queued auth reload and late GET", async () => {
  const old = deferred(); const shown = []; const scheduled = []; let calls = 0;
  const loader = createCommunityPlatformStatusLoader(transport(async () => { calls++; return old.promise; }), value => shown.push(value), fn => scheduled.push(fn));
  const a = loader.load(resource); await flush();
  loader.authChanged(resource, true); loader.authChanged(resource, false);
  scheduled.shift()(); old.resolve(response(dto())); await a;
  assert.equal(calls, 1); assert.equal(shown.at(-1).kind, "auth_required"); loader.dispose();
});
await checkAsync("abort while token pending prevents fetch", async () => {
  const token = deferred(); const controller = new AbortController(); let calls = 0;
  const result = model.loadCommunityPlatformStatus(resource, { getAccessToken: () => token.promise, fetch: () => { calls++; assert.fail(); } }, controller.signal);
  controller.abort(); token.resolve("fake-old-token"); await result;
  assert.equal(calls, 0);
});
await checkAsync("already aborted does not even acquire token", async () => {
  const controller = new AbortController(); controller.abort();
  await model.loadCommunityPlatformStatus(resource, { getAccessToken: () => assert.fail(), fetch: () => assert.fail() }, controller.signal);
});
await checkAsync("failed refresh discards old contract and raw error", async () => {
  const shown = []; let calls = 0;
  const loader = createCommunityPlatformStatusLoader(transport(async () => { if (++calls === 1) return response(dto()); throw Error("secret-details"); }), value => shown.push(value));
  await loader.load(resource); const refresh = loader.load(resource);
  assert.equal(shown.at(-1).kind, "loading"); await refresh;
  assert.equal(shown.at(-1).kind, "error"); assert.equal(shown.at(-1).data, undefined);
  assert.ok(!JSON.stringify(shown.at(-1)).includes("secret-details")); loader.dispose();
});
await checkAsync("unmount aborts and suppresses late results and queued auth", async () => {
  const old = deferred(); const shown = []; const scheduled = []; let calls = 0; let signal;
  const loader = createCommunityPlatformStatusLoader(transport(async (_url, init) => { calls++; signal = init.signal; return old.promise; }), value => shown.push(value), fn => scheduled.push(fn));
  const a = loader.load(resource); await flush(); loader.authChanged(resource, true);
  loader.dispose(); const count = shown.length; scheduled.shift()();
  old.resolve(response(dto())); await a; await loader.load(other);
  assert.equal(signal.aborted, true); assert.equal(shown.length, count); assert.equal(calls, 1);
});

check("approved pricing unchanged", () => assert.deepEqual(JSON.parse(JSON.stringify(plans.COMMUNITY_PLATFORM_PLANS.map(p => [p.key, p.monthlyAmountYen, p.memberLimit, p.trialDays]))), [
  ["trial", 0, 10, 30], ["starter", 2980, 50, null], ["standard", 4980, 200, null], ["pro", 9800, 1000, null], ["enterprise", null, null, null]
]));
for (const key of [undefined, null, "fake", "__proto__", "academy_platform"]) check("unknown plan never becomes Trial", () => assert.equal(plans.getCommunityPlatformPlan(key), null));
check("catalogue is frozen", () => assert.throws(() => { plans.COMMUNITY_PLATFORM_PLANS[1].monthlyAmountYen = 0; }));
check("approved trial policy is narrow and immutable", () => {
  const policy = model.COMMUNITY_PLATFORM_TRIAL_POLICY;
  assert.equal(policy.automaticBillingAtTrialEnd, false);
  assert.equal(policy.automaticPaidTransitionAtTrialEnd, false);
  assert.equal(policy.explicitPaidApplicationRequired, true);
  assert.equal(policy.postTrialCapabilities, "policy_pending");
  assert.throws(() => { policy.automaticBillingAtTrialEnd = true; });
});
const trialBoundary = Date.parse("2026-09-01T00:00:00.000Z");
for (const offset of [-1, 0, 1]) check("deadline never synthesizes active or rights", () => {
  const raw = dto({ subscription: { state: "trialing", planKey: "trial", currentPeriodEndsAt: new Date(trialBoundary + offset).toISOString(), cancelAtPeriodEnd: false }, allowedActions: [], creation: { state: "none" } });
  const before = JSON.stringify(raw);
  const decoded = model.decodeCommunityPlatformStatus(raw, resource);
  assert.equal(decoded.subscription.state, "trialing");
  const notice = model.communityPlatformTrialPeriodNotice(decoded.subscription, trialBoundary);
  assert.equal(notice !== null, offset <= 0);
  assert.equal(decoded.subscription.state, "trialing");
  assert.equal(decoded.creation.state, "none");
  assert.ok(model.communityPlatformActionBlock({ kind: "loaded", data: decoded }, "checkout"));
  assert.ok(model.communityPlatformActionBlock({ kind: "loaded", data: decoded }, "create_resource"));
  assert.equal(JSON.stringify(raw), before);
});
for (const ends of [null, "invalid"]) check("unknown trial end is not paid or unlimited", () => {
  assert.equal(model.communityPlatformTrialPeriodNotice({ ...dto().subscription, planKey: "trial", state: "trialing", currentPeriodEndsAt: ends }, trialBoundary), null);
});
check("paid subscriptions are not changed by trial expiry notice", () => {
  const sub = Object.freeze({ ...dto().subscription, currentPeriodEndsAt: "2000-01-01T00:00:00.000Z" });
  assert.equal(model.communityPlatformTrialPeriodNotice(sub, trialBoundary), null);
  assert.equal(sub.state, "active");
});
await checkAsync("expired trial status refresh only reads; no checkout or transition", async () => {
  const raw = dto({ subscription: { ...dto().subscription, planKey: "trial", state: "trialing", currentPeriodEndsAt: "2000-01-01T00:00:00.000Z" }, allowedActions: [], creation: { state: "none" } });
  let calls = 0;
  const result = await model.loadCommunityPlatformStatus(resource, transport(async (url, init) => {
    calls++;
    assert.ok(url.startsWith("/api/billing/platform/status?"));
    assert.equal(init.method, "GET");
    return response(raw);
  }));
  assert.equal(calls, 1);
  assert.equal(result.kind, "loaded");
  assert.equal(result.data.subscription.state, "trialing");
  assert.equal(result.data.subscription.planKey, "trial");
  assert.equal(result.data.creation.state, "none");
});
check("expired trial renders explicit consent policy, not paid success or restrictions", () => {
  const html = renderToStaticMarkup(React.createElement(CommunityPlatformBillingView, { state: state({ subscription: { ...dto().subscription, planKey: "trial", state: "trialing", currentPeriodEndsAt: "2000-01-01T00:00:00.000Z" } }) }));
  assert.ok(html.includes(model.COMMUNITY_PLATFORM_TRIAL_POLICY.notice));
  assert.ok(html.includes("最新の契約状態を再確認"));
  assert.ok(html.includes("お試しの契約状態を再確認してください"));
  assert.ok(!html.includes("30日間お試し · お試し期間中"));
  assert.doesNotMatch(html, /自動課金を開始|有料契約が成立|閲覧のみになりました|データを削除しました/);
});
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
check("server capability enables quote checkout flow", () => assert.equal(model.communityPlatformActionBlock(state({ allowedActions: ["checkout"] }), "checkout"), null));
check("portal requires existing target", () => assert.ok(model.communityPlatformActionBlock(state({ resourceId: null }), "portal")));
check("portal requires server capability", () => assert.ok(model.communityPlatformActionBlock(state({ allowedActions: [] }), "portal")));
check("portal available for server-confirmed scope", () => assert.equal(model.communityPlatformActionBlock(state(), "portal"), null));
check("subscription display state alone never grants creation", () => {
  for (const subState of ["pending", "trialing", "active", "past_due", "ended"]) {
    assert.ok(model.communityPlatformActionBlock(state({ resourceId: null, subscription: { ...dto().subscription, state: subState } }), "create_resource"));
  }
});
check("canonical creation projection enables guarded create without synthesizing subscription", () => {
  const projected = creation.projectCreationEntitlementStatus(
    { product: "community_platform", resourceId: null },
    { state: "available", planKey: "starter", resourceId: null, expiresAt: "2026-10-01T00:00:00.000Z" }
  );
  assert.equal(projected.subscription, null);
  const decoded = model.decodeCommunityPlatformStatus(projected, null);
  assert.ok(decoded);
  assert.equal(model.communityPlatformActionBlock({ kind: "loaded", data: decoded }, "create_resource"), null);
});
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

check("strict quote decoder binds scope plan resource and request", () => assert.ok(model.decodeCommunityPlatformQuote(quoteDto(), resource, "starter", requestId)));
for (const raw of [
  quoteDto({ currency: "USD" }), quoteDto({ amount: 1 }), quoteDto({ scope: { ...quoteDto().scope, resourceId: other } }),
  quoteDto({ scope: { ...quoteDto().scope, planKey: "standard" } }), quoteDto({ dueNow: { totalYen: -1, dueOn: "2026-09-04" } }),
  quoteDto({ merchant: { ...quoteDto().merchant, contactUrl: "javascript:alert(1)" } }),
  quoteDto({ policies: { ...quoteDto().policies, terms: { version: "terms-v1", url: "http://example.com" } } })
]) check("unsafe or mismatched quote fails closed", () => assert.equal(model.decodeCommunityPlatformQuote(raw, resource, "starter", requestId), null));
await checkAsync("quote request uses narrow authenticated scope", async () => {
  let calls = 0;
  const result = await model.requestCommunityPlatformQuote(state({ allowedActions: ["checkout"] }), "starter", requestId, transport(async (url, init) => {
    calls++; assert.equal(url, "/api/billing/platform/quote"); assert.equal(init.method, "POST");
    assert.equal(init.credentials, "omit"); assert.equal(init.redirect, "error"); assert.equal(init.cache, "no-store");
    assert.deepEqual(JSON.parse(init.body), { product: "community_platform", resourceId: resource, planKey: "starter", requestId });
    return response(quoteDto());
  }));
  assert.equal(calls, 1); assert.equal(result.ok, true); assert.equal(result.quote.dueNow.totalYen, 2980);
});
for (const key of ["trial", "enterprise"]) await checkAsync("non-paid catalogue plans never call quote API", async () => {
  const result = await model.requestCommunityPlatformQuote(state({ allowedActions: ["checkout"] }), key, requestId, transport(() => assert.fail()));
  assert.equal(result.ok, false);
});
await checkAsync("no explicit acceptance never calls checkout", async () => {
  const result = await model.startCommunityPlatformCheckout(state({ allowedActions: ["checkout"] }), quoteDto(), false, transport(() => assert.fail()));
  assert.equal(result.ok, false);
});
await checkAsync("accepted checkout sends consent only and allows canonical Stripe", async () => {
  let body;
  const result = await model.startCommunityPlatformCheckout(state({ allowedActions: ["checkout"] }), quoteDto(), true, transport(async (url, init) => {
    assert.equal(url, "/api/billing/platform/checkout"); body = JSON.parse(init.body);
    return response({ state: "redirect", redirectUrl: "https://checkout.stripe.com/c/pay_fixture" });
  }));
  assert.equal(result.ok, true); assert.equal(result.state, "redirect");
  assert.deepEqual(body, { version: 1, product: "community_platform", resourceId: resource, planKey: "starter", requestId,
    consent: { quoteId: "quote-community-1", revision: 1, termsVersion: "terms-v1", accepted: true } });
  assert.ok(!JSON.stringify(body).includes("2980")); assert.ok(!JSON.stringify(body).includes(owner));
});
await checkAsync("checkout rejects unsafe redirect", async () => {
  const result = await model.startCommunityPlatformCheckout(state({ allowedActions: ["checkout"] }), quoteDto(), true,
    transport(async () => response({ state: "redirect", redirectUrl: "https://checkout.stripe.com.evil.test/x" })));
  assert.equal(result.ok, false);
});

for (const kind of ["unavailable", "auth_required", "error", "policy_pending"]) check("UI empty state honest", () => {
  const html = renderToStaticMarkup(React.createElement(CommunityPlatformBillingView, { state: { kind } }));
  assert.ok(html.includes("請求額と請求日は未取得")); assert.ok(html.includes("disabled"));
  assert.ok(!html.includes('href="/community/create"')); assert.ok(!html.includes("決済が完了しました"));
  assert.ok(html.includes("2,980")); assert.ok(html.includes("税込"));
});
check("UI links to guarded create only after authoritative readiness", () => {
  const html = renderToStaticMarkup(React.createElement(CommunityPlatformBillingView, { state: state({ resourceId: null, subscription: null, creation: { state: "available" }, allowedActions: ["create_resource"] }) }));
  assert.ok(html.includes("1回だけ安全に消費")); assert.ok(html.includes('href="/community/create"'));
  assert.ok(html.includes("利用開始確認が完了"));
});
check("SSR quote is responsive and still requires explicit consent", () => {
  const html = renderToStaticMarkup(React.createElement(CommunityPlatformBillingView, {
    state: state({ allowedActions: ["checkout"] }), selectedKey: "starter", quote: quoteDto()
  }));
  assert.ok(html.includes("今回のお支払い（税込）")); assert.ok(html.includes("2,980円")); assert.ok(html.includes("株式会社OJAS"));
  assert.ok(html.includes("利用規約")); assert.ok(html.includes("terms-v1")); assert.ok(html.includes("sm:grid-cols-2"));
  assert.match(html, /type="checkbox"/); assert.match(html, /disabled=""/);
  assert.ok(!html.includes(owner)); assert.ok(!html.includes("quote-community-1"));
});
check("shared decoder rejects noncanonical dates and unsafe actions", () => {
  assert.equal(model.decodeCommunityPlatformStatus(dto({ subscription: { ...dto().subscription, currentPeriodEndsAt: "2026-10-01T00:00:00Z" } }), resource), null);
  assert.equal(model.decodeCommunityPlatformStatus(dto({ availability: "not_configured", allowedActions: ["create_resource"] }), resource), null);
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
  const browserTransport = readFileSync("lib/community/platform-billing-browser.ts", "utf8");
  assert.doesNotMatch(adapter + view + browserTransport, /localStorage|service_role|STRIPE_SECRET|\.rpc\(|\.from\(/);
  assert.match(adapter, /\/api\/billing\/platform\/quote/);
  assert.match(adapter, /\/api\/billing\/platform\/checkout/);
  assert.match(view, /pending\.current/); assert.match(view, /quoteRequest\.current\.id/);
  assert.match(browserTransport, /getSession\(\)/); assert.doesNotMatch(view + browserTransport, /console\./);
  assert.match(view, /onAuthStateChange/); assert.match(view, /subscription\.unsubscribe\(\)/);
  assert.match(view, /key=\{resourceId \?\? "new"\}/);
  assert.match(view, /identityEpoch\.current !== epoch/);
  assert.match(view, /principal\.current !== nextPrincipal/); assert.match(view, /setQuote\(null\)/);
  const hub = readFileSync("components/community/CommunityHub.tsx", "utf8");
  const client = readFileSync("lib/community/client.ts", "utf8");
  const migration = readFileSync("supabase/migrations/20260901130000_community_guarded_platform_creation.sql", "utf8");
  assert.match(hub, /communityPlatformActionBlock\(platformState, "create_resource"\)/);
  assert.match(client, /rpc\("community_create_with_platform_entitlement"/);
  assert.doesNotMatch(client, /rpc\("community_create"/);
  assert.match(migration, /revoke all on function public\.community_create\(text,text,text,text\)[\s\S]*from authenticated/);
});
console.log(`community-platform-billing-check: ${checks} checks passed (fixture-only; no auth/DB/provider network)`);
