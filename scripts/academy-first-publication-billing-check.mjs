import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(s, c, next) { return s === 'server-only' ? { url: 'data:text/javascript,export{}', shortCircuit: true } : next(s, c); } });
const { createFirstPublicationBilling, SCHEME } = await import('../lib/academy/first-publication-billing/adapter.ts');
const start = Date.parse('2026-09-08T00:00:00Z'), end = start + 168 * 3600000;
const policy = { approvalId: 'fixture-only', version: 'fixture-v1', eligibilityRule: 'fixture-new-only', priceRule: 'fixture-fixed', cancellationBoundary: 'inclusive', lateSync: 'hold' };
function fixture(overrides = {}) {
  let row = { id: 'enrollment-a', hqId: 'hq-a', scheme: SCHEME, explicitConsent: true, policyVersion: policy.version, eligible: true, customerId: 'cus_a', quoteId: 'quote_a', priceId: 'price_a', quoteValidUntil: start + 600000, preparedId: null, publishedAt: null, trialEndsAt: null, cancellationReceivedAt: null, providerId: null, status: 'unprepared', paidAt: null, ...overrides };
  let now = start, tail = Promise.resolve(), snapshot, attempts = 0, creates = 0, setups = 0, failAfterCreate = false;
  const reservations = new Map();
  const repository = { withEnrollment(id, fn) {
    const result = tail.then(() => { assert.equal(id, row.id); return fn(structuredClone(row), async next => { row = structuredClone(next); }); });
    tail = result.catch(() => {}); return result;
  } };
  const provider = {
    async prepare(input) { setups++; assert.equal(input.customerId, row.customerId); return { id: 'seti_a', customerId: row.customerId, succeeded: true }; },
    async ensureHeld(input) { attempts++; assert.equal(input.trialEndsAt, end); if (!reservations.has(input.key)) { creates++; reservations.set(input.key, { id: 'reserved_a', enrollmentId: row.id, customerId: row.customerId, status: 'held', paidAt: null }); } snapshot = reservations.get(input.key); if (failAfterCreate) { failAfterCreate = false; throw new Error('TIMEOUT_AFTER_PROVIDER_SUCCESS'); } return { ...snapshot }; },
    async retrieve() { return { ...snapshot }; },
    async cancel() { snapshot = { ...snapshot, status: 'cancelled', paidAt: null }; return { ...snapshot }; },
  };
  return { adapter: createFirstPublicationBilling({ repository, provider, policy, now: () => now }), deps: { repository, provider, now: () => now }, row: () => row, update: patch => { row = { ...row, ...patch }; }, time: n => { now = n; }, snapshot: patch => { snapshot = { ...snapshot, ...patch }; }, timeout: () => { failAfterCreate = true; }, counts: () => ({ setups, creates, attempts }) };
}
let checks = 0;
async function test(name, fn) { await fn(); checks++; console.log(`PASS ${name}`); }
await test('unconfigured policy rejects without provider calls', async () => { const f = fixture(); assert.throws(() => createFirstPublicationBilling({ ...f.deps, policy: null }).prepare('enrollment-a'), /POLICY_NOT_APPROVED/); assert.equal(f.counts().setups, 0); });
for (const patch of [{ scheme: 'legacy_trial' }, { explicitConsent: false }, { eligible: false }, { policyVersion: 'old' }]) await test(`ineligible ${JSON.stringify(patch)}`, async () => { const f = fixture(patch); await assert.rejects(f.adapter.prepare('enrollment-a'), /ENROLLMENT_NOT_ELIGIBLE/); });
await test('expired quote requires consent again', async () => { const f = fixture({ quoteValidUntil: start }); await assert.rejects(f.adapter.prepare('enrollment-a'), /RECONFIRM_REQUIRED/); });
await test('setup alone and failed publication do not start clock', async () => { const f = fixture(); await f.adapter.prepare('enrollment-a'); await f.adapter.synchronize('enrollment-a'); assert.equal(f.row().publishedAt, null); assert.equal(f.counts().creates, 0); });
await test('concurrent preparation creates once', async () => { const f = fixture(); await Promise.all([f.adapter.prepare('enrollment-a'), f.adapter.prepare('enrollment-a')]); assert.equal(f.counts().setups, 1); });
const published = { preparedId: 'seti_a', publishedAt: start, trialEndsAt: end, status: 'sync_pending' };
await test('concurrent synchronization has one reservation and fixed deadline', async () => { const f = fixture(published); await Promise.all([f.adapter.synchronize('enrollment-a'), f.adapter.synchronize('enrollment-a')]); assert.equal(f.counts().creates, 1); assert.equal(f.row().trialEndsAt, end); assert.equal(f.row().status, 'held'); });
await test('timeout after provider success recovers same reservation', async () => { const f = fixture(published); f.timeout(); await assert.rejects(f.adapter.synchronize('enrollment-a'), /TIMEOUT/); assert.equal(f.row().status, 'sync_pending'); await f.adapter.synchronize('enrollment-a'); assert.equal(f.counts().creates, 1); assert.equal(f.counts().attempts, 2); });
await test('unpublish is not cancellation or clock reset', async () => { const f = fixture(published); await f.adapter.synchronize('enrollment-a'); await f.adapter.synchronize('enrollment-a'); assert.equal(f.row().publishedAt, start); assert.equal(f.row().status, 'held'); });
await test('late synchronization does not backdate charge', async () => { const f = fixture(published); f.time(end); await f.adapter.synchronize('enrollment-a'); assert.equal(f.row().status, 'review'); assert.equal(f.counts().creates, 0); });
await test('accepted cancellation wins at exact boundary before reservation', async () => { const f = fixture({ ...published, cancellationReceivedAt: end }); f.time(end + 1); await f.adapter.synchronize('enrollment-a'); assert.equal(f.row().status, 'cancelled'); assert.equal(f.counts().creates, 0); });
await test('cancellation survives duplicated and out-of-order notifications', async () => { const f = fixture(published); await f.adapter.synchronize('enrollment-a'); f.update({ cancellationReceivedAt: end }); f.time(end + 1); await f.adapter.reconcileVerifiedNotification('enrollment-a'); await f.adapter.reconcileVerifiedNotification('enrollment-a'); assert.equal(f.row().status, 'cancelled'); });
await test('current provider state controls duplicate notification', async () => { const f = fixture(published); await f.adapter.synchronize('enrollment-a'); f.time(end + 100); f.snapshot({ status: 'paid', paidAt: end + 50 }); await f.adapter.reconcileVerifiedNotification('enrollment-a'); await f.adapter.reconcileVerifiedNotification('enrollment-a'); assert.equal(f.row().paidAt, end + 50); });
await test('cross-customer provider response rejected', async () => { const f = fixture(published); await f.adapter.synchronize('enrollment-a'); f.snapshot({ customerId: 'cus_other' }); await assert.rejects(f.adapter.synchronize('enrollment-a'), /SCOPE_MISMATCH/); assert.equal(f.row().status, 'held'); });
await test('unexpected payment after accepted cancellation is review, never paid access', async () => { const f = fixture(published); await f.adapter.synchronize('enrollment-a'); f.update({ cancellationReceivedAt: end }); f.time(end + 100); f.snapshot({ status: 'paid', paidAt: end + 50 }); await f.adapter.synchronize('enrollment-a'); assert.equal(f.row().status, 'review'); });
await test('bad publication duration rejected', async () => { const f = fixture({ ...published, trialEndsAt: end + 1 }); await assert.rejects(f.adapter.synchronize('enrollment-a'), /INVALID_PUBLICATION/); });
const { createStripeSetupTransport } = await import('../lib/academy/first-publication-billing/stripe-setup.ts');
const scope = { attemptId: 'attempt-a', headquartersId: 'hq-a', ownerUserId: 'owner-a', quoteId: 'quote-a', customerId: 'cus_a' };
let captured, responseOverride = {};
const transport = createStripeSetupTransport({ secretKey: 'sk_test_fixture', mode: 'test', approvalId: 'fixture-only', apiVersion: '2025-02-24.acacia' }, async (url, init) => {
  captured = { url, init };
  return new Response(JSON.stringify({ id: 'seti_a', object: 'setup_intent', livemode: false, customer: 'cus_a', usage: 'off_session', status: 'succeeded', payment_method: 'pm_a', client_secret: 'seti_a_secret_fixture', metadata: { scheme: SCHEME, attempt_id: 'attempt-a', headquarters_id: 'hq-a', owner_user_id: 'owner-a', quote_id: 'quote-a' }, ...responseOverride }), { status: 200 });
});
const signal = new AbortController().signal;
await test('Stripe setup POST prepares with stable key and no subscription', async () => {
  const result = await transport.create(scope, signal); assert.equal(result.ready, false);
  assert.equal(captured.url, 'https://api.stripe.com/v1/setup_intents'); assert.equal(captured.init.redirect, 'error');
  assert.equal(captured.init.body.get('usage'), 'off_session'); assert.equal(captured.init.body.has('confirm'), false);
  assert.equal(captured.init.body.has('trial_end'), false); const key = captured.init.headers['Idempotency-Key'];
  await transport.create(scope, signal); assert.equal(captured.init.headers['Idempotency-Key'], key);
});
await test('Stripe verified GET yields scoped core proof without client secret', async () => {
  const proof = await transport.verifyCompleted('seti_a', scope, signal); assert.equal(proof.verified, true); assert.equal(proof.headquartersId, scope.headquartersId);
  assert.equal('clientSecret' in proof, false); assert.equal(captured.init.method, 'GET');
});
for (const patch of [{ customer: 'cus_other' }, { livemode: true }, { metadata: {} }]) await test('Stripe cross-scope verification fails', async () => {
  responseOverride = patch; await assert.rejects(transport.verifyCompleted('seti_a', scope, signal), /SCOPE_MISMATCH/); responseOverride = {};
});
await test('Stripe pending setup is not verified', async () => { responseOverride = { status: 'requires_action' }; await assert.rejects(transport.verifyCompleted('seti_a', scope, signal), /NOT_READY/); responseOverride = {}; });
await test('Stripe autonomous billing explicitly unsupported', async () => { await assert.rejects(transport.ensureHeld(), /UNSUPPORTED/); await assert.rejects(transport.dispatchFirstCharge(), /SERIALIZATION_REQUIRED/); });
console.log(`${checks} isolated checks passed; no network, database, Stripe, email or customer data used.`);
