import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context);
  return nextResolve(specifier, context);
} });
const { handlePlatformRequest, PlatformApiError } = await import('../lib/billing/platform/http.ts');
const { unavailableStatus, decodeCommunityTrialStartResult, decodePlatformStatus, parseCheckout, parseCommunityTrialStart, isPlatformRedirect } = await import('../lib/billing/platform/contracts.ts');
const owner = 'a0000000-0000-4000-8000-000000000001';
const resourceId = 'a0000000-0000-4000-8000-000000000002';
const requestId = 'a0000000-0000-4000-8000-000000000003';
const product = 'community_platform';
const origin = 'https://app.mikke-os.com';
let checks = 0;
const equal = (a, b) => { assert.deepEqual(a, b); checks++; };
const scope = { product, resourceId };
function request(action, body, headers = {}, query = `?product=${product}&resourceId=${resourceId}`) {
  return new Request(`${origin}/api/billing/platform/${action}${action === 'status' ? query : ''}`, {
    method: action === 'status' ? 'GET' : 'POST',
    headers: { authorization: 'Bearer test-token', origin, 'content-type': 'application/json', ...headers },
    ...(action === 'status' ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) })
  });
}
function deps(options = {}) {
  const calls = { auth: 0, owns: 0, read: 0, portal: 0, quote: 0, checkout: 0, trial: 0 };
  const dependencies = {
    trustedOrigins: [origin],
    authenticate: async () => { calls.auth++; return { userId: owner, anonymous: false }; },
    ownsResource: async () => { calls.owns++; return true; },
    readStatus: async (_actor, s) => { calls.read++; return unavailableStatus(s); },
    openPortal: async () => { calls.portal++; return 'https://billing.stripe.com/p/session'; },
    issueQuote: async () => { calls.quote++; return { quoteId: 'server-owned' }; },
    startCheckout: async () => { calls.checkout++; return { state: 'pending' }; },
    startCommunityTrial: async () => { calls.trial++; return {
      state: 'trialing', startsAt: '2026-09-04T00:00:00.000Z', endsAt: '2026-10-04T00:00:00.000Z',
      automaticBilling: false, creation: { state: 'available' }
    }; },
    ...options
  };
  return { calls, dependencies };
}
async function checkError(action, req, code, expectedStatus, options = {}) {
  const d = deps(options);
  const response = await handlePlatformRequest(action, req, d.dependencies);
  equal(response.status, expectedStatus);
  equal(await response.json(), { error: { code } });
  assert.match(response.headers.get('cache-control'), /no-store/); checks++;
  return d.calls;
}
const checkout = { ...scope, requestId, planKey: 'starter' };
const confirmation = { version: 1, ...checkout, consent: {
  quoteId: 'server-owned', revision: 1, termsVersion: 'terms-v1', accepted: true
} };
const portal = { ...scope, requestId };
for (const token of ['', 'Basic abc', 'Bearer ', 'Bearer a b', `Bearer ${'x'.repeat(8192)}`]) {
  const calls = await checkError('status', request('status', null, { authorization: token }), 'AUTH_REQUIRED', 401);
  equal(calls.auth, 0);
}
await checkError('status', request('status'), 'AUTH_REQUIRED', 401, { authenticate: async () => null });
await checkError('status', request('status'), 'AUTH_REQUIRED', 401, { authenticate: async () => ({ userId: owner, anonymous: true }) });
await checkError('status', request('status'), 'AUTH_REQUIRED', 401, { authenticate: async () => ({ userId: owner }) });
await checkError('status', request('status'), 'AUTH_REQUIRED', 401, { authenticate: async () => ({ userId: 'not-id', anonymous: false }) });
const forbidden = await checkError('status', request('status'), 'RESOURCE_UNAVAILABLE', 404, { ownsResource: async () => false });
equal(forbidden.read, 0);
for (const query of ['', '?product=bad', '?product=community_platform&owner=stolen', '?product=community_platform&product=academy_platform', '?product=academy_platform&resourceId=', '?product=academy_platform&resourceId=a&resourceId=b']) {
  await checkError('status', request('status', null, {}, query), 'INVALID_REQUEST', 422);
}
for (const badOrigin of ['https://evil.test', 'null', 'https://app.mikke-os.com.evil.test']) {
  const calls = await checkError('portal', request('portal', portal, { origin: badOrigin }), 'INVALID_REQUEST', 422);
  equal(calls.auth, 0);
}
const noOrigin = request('portal', portal); noOrigin.headers.delete('origin');
await checkError('portal', noOrigin, 'INVALID_REQUEST', 422);
await checkError('portal', request('portal', portal, { 'sec-fetch-site': 'cross-site' }), 'INVALID_REQUEST', 422);
for (const malformed of [null, [], '{}', 'broken', ' '.repeat(4097), { ...checkout, amount: 1 }, { ...checkout, userId: owner }, { ...checkout, returnUrl: 'https://evil.test' }, { ...checkout, priceId: 'price_a' }, { ...checkout, requestId: 'bad' }]) {
  await checkError('checkout', request('checkout', malformed), 'INVALID_REQUEST', 422);
}
await checkError('checkout', request('checkout', checkout, { 'content-type': 'text/plain' }), 'INVALID_REQUEST', 422);
await checkError('portal', request('portal', { ...portal, resourceId: null }), 'INVALID_REQUEST', 422);
const controller = new AbortController();
let canceled = false;
const stream = new ReadableStream({ cancel() { canceled = true; } });
const stalled = new Request(`${origin}/api/billing/platform/checkout`, {
  method: 'POST', duplex: 'half', signal: controller.signal, body: stream,
  headers: { authorization: 'Bearer test-token', origin, 'content-type': 'application/json' }
});
const stalledResult = checkError('checkout', stalled, 'INVALID_REQUEST', 422);
setTimeout(() => controller.abort(), 10);
await stalledResult;
equal(canceled, true);
await checkError('checkout', request('checkout', confirmation), 'BILLING_NOT_CONFIGURED', 503);
const ready = { ...unavailableStatus(scope), availability: 'ready', noticeCode: null,
  subscription: { state: 'active', planKey: 'starter', currentPeriodStartsAt: '2026-09-01T00:00:00.000Z', currentPeriodEndsAt: '2026-10-01T00:00:00.000Z', automaticBilling: true, cancelAtPeriodEnd: false }, allowedActions: ['checkout', 'portal'] };
const legacyReady = structuredClone(ready);
delete legacyReady.subscription.currentPeriodStartsAt;
delete legacyReady.subscription.automaticBilling;
equal(decodePlatformStatus(legacyReady, scope), {
  ...ready,
  subscription: { ...ready.subscription, currentPeriodStartsAt: null }
});
const cancelScheduled = structuredClone(ready);
cancelScheduled.subscription.cancelAtPeriodEnd = true;
cancelScheduled.subscription.automaticBilling = false;
equal(decodePlatformStatus(cancelScheduled, scope), cancelScheduled);
const policyPending = { ...unavailableStatus(scope), availability: 'policy_pending', noticeCode: 'POLICY_PENDING' };
const blocked = await checkError('checkout', request('checkout', confirmation), 'POLICY_PENDING', 503, { readStatus: async () => policyPending });
for (const field of ['availability', 'creation', 'subscription']) {
  for (const value of [null, 1, ['ready'], ['none'], ['active']]) {
    const invalid = structuredClone(ready);
    if (field === 'availability') invalid.availability = value;
    else invalid[field].state = value;
    await checkError('status', request('status'), 'BILLING_NOT_CONFIGURED', 503, { readStatus: async () => invalid });
  }
}
equal(blocked.portal, 0); // No v0 accepted quote => no provider call, even if ready/capability true.
const pendingDeps=deps({readStatus:async()=>ready});
const pending=await handlePlatformRequest('checkout',request('checkout',confirmation),pendingDeps.dependencies);
equal(pending.status,200);equal(await pending.json(),{state:'pending'});equal(pendingDeps.calls.checkout,1);
const quoteDeps=deps({readStatus:async()=>ready});
const quoted=await handlePlatformRequest('quote',request('quote',checkout),quoteDeps.dependencies);
equal(quoted.status,200);equal(await quoted.json(),{quoteId:'server-owned'});equal(quoteDeps.calls.quote,1);
const d = deps({ readStatus: async () => ready });
const opened = await handlePlatformRequest('portal', request('portal', portal), d.dependencies);
equal(opened.status, 200); equal(await opened.json(), { version: 0, redirectUrl: 'https://billing.stripe.com/p/session' });
equal(d.calls.portal, 1);
const trialInput = { product: 'community_platform', resourceId: null, requestId };
const trialScope = { product: 'community_platform', resourceId: null };
const trialReady = { ...unavailableStatus(trialScope), availability: 'ready', noticeCode: null, allowedActions: ['checkout', 'start_trial'] };
const trialDeps = deps({ readStatus: async () => trialReady });
const trialResponse = await handlePlatformRequest('trial_start', request('trial/start', trialInput), trialDeps.dependencies);
equal(trialResponse.status, 200);
const trialResult = await trialResponse.json();
equal(decodeCommunityTrialStartResult(trialResult), trialResult);
equal(trialDeps.calls.trial, 1);
for (const malformedTrial of [
  { ...trialInput, product: 'academy_platform' }, { ...trialInput, resourceId },
  { ...trialInput, requestId: 'bad' }, { ...trialInput, actorUserId: owner }, { ...trialInput, days: 30 }
]) await checkError('trial_start', request('trial/start', malformedTrial), 'INVALID_REQUEST', 422);
await checkError('trial_start', request('trial/start', trialInput), 'STATE_CONFLICT', 409, { readStatus: async () => ({ ...trialReady, allowedActions: ['checkout'] }) });
for (const url of ['http://billing.stripe.com/p', 'https://billing.stripe.com.evil.test/p', 'https://u:p@billing.stripe.com/p', 'https://checkout.stripe.com/p']) {
  await checkError('portal', request('portal', portal), 'BILLING_NOT_CONFIGURED', 503,
    { readStatus: async () => ready, openPortal: async () => url });
}
for (const bad of [{ ...ready, ownerUserId: owner }, { ...ready, resourceId: requestId }, { ...ready, product: 'academy_platform' }, { ...ready, version: 1 }, { ...ready, allowedActions: ['portal', 'portal'] }, { ...ready, noticeCode: 'raw secret error' }, { ...ready, availability: 'not_configured' }]) {
  await checkError('status', request('status'), 'BILLING_NOT_CONFIGURED', 503, { readStatus: async () => bad });
}
await checkError('status', request('status'), 'BILLING_NOT_CONFIGURED', 503, { authenticate: async () => { throw new Error('private token or database message'); } });
await checkError('status', request('status'), 'POLICY_PENDING', 503, { readStatus: async () => { throw new PlatformApiError('POLICY_PENDING'); } });
const before = deps();
const absent = await handlePlatformRequest('status', request('status', null, {}, '?product=academy_platform'), before.dependencies);
equal(before.calls.owns, 0); equal((await absent.json()).allowedActions, []);
equal(parseCheckout(checkout), checkout);
equal(parseCheckout({ ...checkout, resourceId: resourceId.toUpperCase(), requestId: requestId.toUpperCase() }), checkout);
equal(parseCommunityTrialStart(trialInput), trialInput);
equal(decodePlatformStatus(unavailableStatus(scope), scope), unavailableStatus(scope));
equal(isPlatformRedirect('https://checkout.stripe.com/c/a', 'checkout'), true);
for (const route of ['status', 'quote', 'checkout', 'portal']) {
  const source = readFileSync(new URL(`../app/api/billing/platform/${route}/route.ts`, import.meta.url), 'utf8');
  assert.match(source, /force-dynamic/); checks++;
}
const trialRoute = readFileSync(new URL('../app/api/billing/platform/trial/start/route.ts', import.meta.url), 'utf8');
assert.match(trialRoute, /force-dynamic/); checks++;
const runtime = readFileSync(new URL('../lib/billing/platform/server.ts', import.meta.url), 'utf8');
assert.match(runtime, /auth\.getUser\(token\)/); checks++;
assert.match(runtime, /PLATFORM_BILLING_API_ENABLED/); checks++;
assert.doesNotMatch(runtime.match(/function environment\(\)\{[\s\S]*?\n\}/)?.[0] ?? "", /PLATFORM_BILLING_API_ENABLED/); checks++;
assert.match(runtime, /function requirePaidBillingEnabled\(\)\{[\s\S]*?PLATFORM_BILLING_API_ENABLED/); checks++;
assert.match(runtime, /function catalog\(\):Catalog\{\s*requirePaidBillingEnabled\(\)/); checks++;
assert.match(runtime, /async startCheckout\(principal,input,signal\)\{\s*requirePaidBillingEnabled\(\)/); checks++;
assert.match(runtime, /async openPortal\(principal,input,signal\)\{requirePaidBillingEnabled\(\)/); checks++;
assert.match(runtime, /SUPABASE_SECRET_KEY/); checks++;
assert.match(runtime, /readStripeRuntimeConfig/); checks++;
console.log(`Platform billing HTTP: ${checks} checks passed (fake transport only; no DB/provider requests)`);
