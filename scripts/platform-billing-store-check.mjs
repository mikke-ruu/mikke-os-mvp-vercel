import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context);
} });
const { createCheckoutStore } = await import('../lib/billing/platform/store.ts');
const { CheckoutExecutionError, executeTestCheckout, checkoutSessionHash } = await import('../lib/billing/platform/checkout.ts');
const owner = 'a0000000-0000-4000-8000-000000000001';
const resourceId = 'a0000000-0000-4000-8000-000000000002';
const requestId = 'a0000000-0000-4000-8000-000000000003';
const attemptId = 'a0000000-0000-4000-8000-000000000004';
const other = 'a0000000-0000-4000-8000-000000000005';
const now = new Date('2026-09-01T01:00:00.000Z');
const scope = { ownerUserId: owner, productKey: 'academy_platform', resourceId, planKey: 'fixture', requestId };
const expected = { ...scope, policyApprovalId: 'approval-fixture', policyRevision: 1 };
const consent = { quoteId: 'quote-fixture', revision: 1, termsVersion: 'fixture-v1', accepted: true };
const fixture = () => ({
  quoteId: consent.quoteId, revision: 1, purchaseIntent: 'explicit_paid_start', scope: { ...scope }, currency: 'JPY', taxIncluded: true,
  dueNow: { totalYen: 123, dueOn: '2026-09-01' }, nextPayment: { totalYen: 456, dueOn: '2026-10-01' },
  merchant: { merchantId: 'fixture', legalName: 'Fixture only', address: 'Fixture only', contactUrl: 'https://example.invalid/contact' },
  policies: { approved: true, approvalId: 'approval-fixture', revision: 1, ...Object.fromEntries(
    ['terms', 'privacy', 'refund', 'cancellation', 'proration', 'renewal', 'commercialDisclosure'].map(key => [key, { version: 'fixture-v1', url: 'https://example.invalid/policy' }])) },
  issuedAt: '2026-09-01T00:00:00.000Z', expiresAt: '2026-09-01T02:00:00.000Z',
});
const session = { id: 'cs_test_fixture', url: 'https://checkout.stripe.com/c/pay/cs_test_fixture', expiresAt: '2026-09-01T02:00:00.000Z' };
const baseAttempt = () => ({ attempt_id: attemptId, quote_id: consent.quoteId, quote_revision: 1, status: 'prepared',
  provider_idempotency_key: `platform-checkout-${attemptId}`, provider_session_id: null, provider_result_hash: null });
const signal = () => new AbortController().signal;
const safe = code => err => err instanceof CheckoutExecutionError && err.code === code && err.message === code;
let passed = 0, failed = 0;
async function test(name, run) {
  try { await run(); passed++; console.log(`ok - ${name}`); }
  catch (err) { failed++; console.error(`not ok - ${name}: ${err.message}`); }
}
function transport(data, error = null) {
  const calls = [];
  return { calls, store: createCheckoutStore(async (...args) => { calls.push(args); return { data, error }; }) };
}
await test('five RPC names and exact argument contract; actor is separate from consent', async () => {
  const calls = [];
  const store = createCheckoutStore(async (name, args, requestSignal) => {
    calls.push([name, args]); assert.ok(requestSignal instanceof AbortSignal);
    if (name === 'platform_billing_quote_save') return { data: { quote_id: consent.quoteId, revision: 1 }, error: null };
    if (name === 'platform_billing_quote_get') return { data: fixture(), error: null };
    const value = baseAttempt();
    if (name.endsWith('reserve')) Object.assign(value, { created: true });
    if (name.endsWith('mark_ready')) Object.assign(value, { status: 'provider_ready', provider_session_id: session.id, provider_result_hash: checkoutSessionHash(session) });
    if (name.endsWith('mark_uncertain')) value.status = 'uncertain';
    return { data: value, error: null };
  });
  await store.saveQuote(fixture(), expected, now, signal());
  await store.loadQuote(owner, consent.quoteId, signal());
  const injected = { ...consent, p_actor_user_id: other };
  await store.reserve(owner, consent.quoteId, injected, signal());
  await store.markReady(owner, attemptId, session.id, checkoutSessionHash(session), signal());
  await store.markUncertain(owner, attemptId, signal());
  assert.deepEqual(calls.map(([name]) => name), ['platform_billing_quote_save', 'platform_billing_quote_get', 'platform_billing_attempt_reserve', 'platform_billing_attempt_mark_ready', 'platform_billing_attempt_mark_uncertain']);
  assert.deepEqual(calls.map(([, args]) => Object.keys(args).sort()), [
    ['p_actor_user_id', 'p_quote'], ['p_actor_user_id', 'p_quote_id'], ['p_actor_user_id', 'p_consent', 'p_quote_id'],
    ['p_actor_user_id', 'p_attempt_id', 'p_provider_result_hash', 'p_provider_session_id'], ['p_actor_user_id', 'p_attempt_id'],
  ]);
  for (const [, args] of calls) assert.equal(args.p_actor_user_id, owner);
  assert.equal(calls[2][1].p_consent.p_actor_user_id, other); // Never promotes nested actor into trusted top-level actor.
  assert.equal(calls[3][1].p_provider_result_hash, checkoutSessionHash(session));
  assert.equal(Object.isFrozen(calls[0][1].p_quote.scope), true);
});
await test('invalid actor never reaches transport', async () => {
  const { store, calls } = transport(null);
  await assert.rejects(store.loadQuote('invalid', consent.quoteId, signal()), safe('INVALID_REQUEST')); assert.equal(calls.length, 0);
});
await test('quote actor replacement and unapproved policy fail before persistence', async () => {
  for (const change of [q => { q.scope.ownerUserId = other; }, q => { q.policies.approved = false; }]) {
    const { store, calls } = transport(null); const quote = fixture(); change(quote);
    await assert.rejects(store.saveQuote(quote, expected, now, signal()), safe('POLICY_PENDING')); assert.equal(calls.length, 0);
  }
});
for (const code of ['23505', '22023', 'P0002', '42501', 'XX000', undefined]) {
  await test(`safe RPC error ${String(code)}`, async () => {
    const { store } = transport(null, { code, message: 'private transport detail' });
    await assert.rejects(store.loadQuote(owner, consent.quoteId, signal()), safe(code && code !== 'XX000' ? 'STATE_CONFLICT' : 'BILLING_NOT_CONFIGURED'));
  });
}
await test('transport throw hides raw error', async () => {
  const store = createCheckoutStore(async () => { throw new Error('private transport detail'); });
  await assert.rejects(store.loadQuote(owner, consent.quoteId, signal()), safe('BILLING_NOT_CONFIGURED'));
});
for (const raw of [null, undefined, [], {}, { data: fixture() }, { data: fixture(), error: false }, { data: fixture(), error: 'raw' }]) {
  await test(`unknown envelope fails safely ${JSON.stringify(raw)?.slice(0, 24)}`, async () => {
    const store = createCheckoutStore(async () => raw);
    await assert.rejects(store.loadQuote(owner, consent.quoteId, signal()), safe('BILLING_NOT_CONFIGURED'));
  });
}
const badAttempts = [null, [], {}, { ...baseAttempt(), created: true, status: 'paid' }, { ...baseAttempt(), created: true, status: ['prepared'] },
  { ...baseAttempt(), created: 'true' }, { ...baseAttempt(), created: true, quote_revision: 0 },
  { ...baseAttempt(), created: true, provider_idempotency_key: 'browser-key' }, { ...baseAttempt(), created: true, extra: 'raw' },
  { ...baseAttempt(), created: true, status: 'provider_ready', provider_session_id: 'cs_live_fixture', provider_result_hash: 'a'.repeat(64) },
  { ...baseAttempt(), created: true, provider_session_id: session.id }];
for (const [index, value] of badAttempts.entries()) await test(`malformed attempt ${index} fails safely`, async () => {
  const { store } = transport(value);
  await assert.rejects(store.reserve(owner, consent.quoteId, consent, signal()), safe('BILLING_NOT_CONFIGURED'));
});
await test('pre-aborted signal never reaches RPC', async () => {
  const { store, calls } = transport(null); const controller = new AbortController(); controller.abort();
  await assert.rejects(store.loadQuote(owner, consent.quoteId, controller.signal), { name: 'AbortError' }); assert.equal(calls.length, 0);
});
await test('abort during a resolving transport cannot return success', async () => {
  const controller = new AbortController();
  const store = createCheckoutStore(async () => { controller.abort(); return { data: fixture(), error: null }; });
  await assert.rejects(store.loadQuote(owner, consent.quoteId, controller.signal), { name: 'AbortError' });
});
const request = () => ({ version: 1, product: scope.productKey, resourceId, planKey: scope.planKey, requestId, consent: { ...consent } });
function execution(options = {}) {
  const calls = { rpc: [], providerCreate: 0, providerRetrieve: 0, authorize: 0 };
  const store = createCheckoutStore(async (name, args) => {
    calls.rpc.push([name, args]);
    if (name.endsWith('quote_get')) return { data: options.quote ?? fixture(), error: null };
    const value = baseAttempt();
    if (name.endsWith('reserve')) Object.assign(value, options.reserved ?? { created: true });
    if (name.endsWith('mark_ready')) Object.assign(value, { status: 'provider_ready', provider_session_id: args.p_provider_session_id, provider_result_hash: args.p_provider_result_hash });
    if (name.endsWith('mark_uncertain')) value.status = 'uncertain';
    return { data: value, error: null };
  });
  return { calls, dependencies: {
    ...store, now: () => now,
    selectAuthorizedContext: async () => { calls.authorize++; return options.changeContext && calls.authorize > 1 ? { ...expected, ownerUserId: other } : expected; },
    createTestSession: async (_quote, key) => { calls.providerCreate++; assert.equal(key, `platform-checkout-${attemptId}`); if (options.providerMissing) throw new Error('provider not connected'); return options.session ?? session; },
    retrieveTestSession: async () => { calls.providerRetrieve++; return options.session ?? session; },
  } };
}
await test('matching consent and fake provider persist ready; no paid grant', async () => {
  const { calls, dependencies } = execution();
  assert.deepEqual(await executeTestCheckout(request(), dependencies, signal()), { state: 'redirect', redirectUrl: session.url });
  assert.equal(calls.providerCreate, 1); assert.equal(calls.authorize, 2);
  assert.equal(calls.rpc.at(-1)[0], 'platform_billing_attempt_mark_ready');
  assert.ok(calls.rpc.every(([name]) => /^platform_billing_(quote_get|attempt_reserve|attempt_mark_ready)$/.test(name)));
});
for (const patch of [{ accepted: false }, { ownerUserId: other }, { termsVersion: 'stale' }, { revision: 2 }]) {
  await test(`unconsented/stale/injected checkout blocked ${Object.keys(patch)[0]}`, async () => {
    const { calls, dependencies } = execution(); const input = request(); Object.assign(input.consent, patch);
    await assert.rejects(executeTestCheckout(input, dependencies, signal()), safe('STATE_CONFLICT'));
    assert.equal(calls.providerCreate, 0); assert.equal(calls.rpc.length, 1);
  });
}
await test('browser actor top-level rejected before owner lookup', async () => {
  const { calls, dependencies } = execution();
  await assert.rejects(executeTestCheckout({ ...request(), ownerUserId: other }, dependencies, signal()), safe('INVALID_REQUEST'));
  assert.equal(calls.authorize, 0);
});
await test('provider disconnected yields pending and uncertain, never fake redirect/paid', async () => {
  const { calls, dependencies } = execution({ providerMissing: true });
  assert.deepEqual(await executeTestCheckout(request(), dependencies, signal()), { state: 'pending' });
  assert.equal(calls.rpc.at(-1)[0], 'platform_billing_attempt_mark_uncertain');
});
for (const status of ['prepared', 'uncertain']) await test(`existing ${status} never calls provider again`, async () => {
  const { calls, dependencies } = execution({ reserved: { created: false, status } });
  assert.deepEqual(await executeTestCheckout(request(), dependencies, signal()), { state: 'pending' });
  assert.equal(calls.providerCreate + calls.providerRetrieve, 0);
});
await test('changed owner immediately before provider blocks create', async () => {
  const { calls, dependencies } = execution({ changeContext: true });
  assert.deepEqual(await executeTestCheckout(request(), dependencies, signal()), { state: 'pending' }); assert.equal(calls.providerCreate, 0);
});
for (const bad of [{ ...session, id: 'cs_live_fixture' }, { ...session, url: 'https://checkout.stripe.com.evil.invalid/path' }, { ...session, extra: 'secret' }]) {
  await test(`invalid provider session ${bad.id}/${Object.keys(bad).length} cannot redirect`, async () => {
    const { dependencies } = execution({ session: bad }); assert.deepEqual(await executeTestCheckout(request(), dependencies, signal()), { state: 'pending' });
  });
}
await test('existing ready attempt only retrieves hash-bound test session', async () => {
  const { calls, dependencies } = execution({ reserved: { created: false, status: 'provider_ready', provider_session_id: session.id, provider_result_hash: checkoutSessionHash(session) } });
  assert.deepEqual(await executeTestCheckout(request(), dependencies, signal()), { state: 'redirect', redirectUrl: session.url });
  assert.equal(calls.providerCreate, 0); assert.equal(calls.providerRetrieve, 1);
});
await test('checkout/store have no concrete DB/provider/network client', async () => {
  for (const file of ['store.ts', 'checkout.ts']) {
    const source = readFileSync(new URL(`../lib/billing/platform/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|localStorage|sessionStorage)\s*\(|from\s+['"](?:stripe|@supabase)/);
  }
});
console.log(`Platform billing store fake transport: ${passed} passed / ${failed} failed; no DB, provider, secret or network`);
if (failed) process.exitCode = 1;
