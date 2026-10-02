import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context);
} });
const { executeTestCheckout: execute, checkoutSessionHash } = await import('../lib/billing/platform/checkout.ts');
const owner = 'a0000000-0000-4000-8000-000000000001';
const resourceId = 'a0000000-0000-4000-8000-000000000002';
const requestId = 'a0000000-0000-4000-8000-000000000003';
const attemptId = 'a0000000-0000-4000-8000-000000000004';
const now = new Date('2026-09-01T01:00:00.000Z');
const reference = { version: 'fixture-v1', url: 'https://example.invalid/approved-fixture' };
const scope = { ownerUserId: owner, productKey: 'academy_platform', resourceId, planKey: 'fixture', requestId };
const context = { ...scope, policyApprovalId: 'fixture-approval', policyRevision: 1 };
const quote = {
  quoteId: 'quote-fixture', revision: 1, purchaseIntent: 'explicit_paid_start', scope, currency: 'JPY', taxIncluded: true,
  dueNow: { totalYen: 123, dueOn: '2026-09-01' }, nextPayment: { totalYen: 456, dueOn: '2026-10-01' },
  merchant: { merchantId: 'fixture', legalName: 'Fixture only', address: 'Fixture only', contactUrl: 'https://example.invalid/contact' },
  policies: { approved: true, approvalId: 'fixture-approval', revision: 1, ...Object.fromEntries(['terms','privacy','refund','cancellation','proration','renewal','commercialDisclosure'].map(key => [key, reference])) },
  issuedAt: '2026-09-01T00:00:00.000Z', expiresAt: '2026-09-01T02:00:00.000Z'
};
const consent = { quoteId: quote.quoteId, revision: 1, termsVersion: 'fixture-v1', accepted: true };
const input = { version: 1, product: 'academy_platform', resourceId, planKey: 'fixture', requestId, consent };
const session = { id: 'cs_test_fixture1', url: 'https://checkout.stripe.com/c/fixture', expiresAt: '2026-09-01T02:00:00.000Z' };
let count = 0;
async function test(name, fn) { await fn(); count++; console.log(`ok ${count} - ${name}`); }
function setup(overrides = {}) {
  let row = null;
  const calls = { create: 0, retrieve: 0, reserve: 0, uncertain: 0, ready: 0, authorization: 0 };
  const dependencies = {
    providerMode: 'test',
    now: () => now,
    selectAuthorizedContext: async () => { calls.authorization++; return structuredClone(context); },
    loadQuote: async () => structuredClone(quote),
    reserve: async () => {
      calls.reserve++;
      if (row) return { ...row, created: false };
      row = { attempt_id: attemptId, quote_id: quote.quoteId, quote_revision: 1, status: 'prepared',
        provider_idempotency_key: `platform-checkout-${attemptId}`, provider_session_id: null, provider_result_hash: null };
      return { ...row, created: true };
    },
    createTestSession: async (_quote, key) => { calls.create++; assert.equal(key, `platform-checkout-${attemptId}`); return session; },
    retrieveTestSession: async () => { calls.retrieve++; return session; },
    markReady: async (_owner, id, providerId, hash) => {
      calls.ready++; assert.equal(id, attemptId);
      row = { ...row, status: 'provider_ready', provider_session_id: providerId, provider_result_hash: hash }; return { ...row };
    },
    markUncertain: async () => { calls.uncertain++; if (row.status !== 'provider_ready') row.status = 'uncertain'; return { ...row }; },
    ...overrides
  };
  return { dependencies, calls, run: (value = input, signal = new AbortController().signal) => execute(value, dependencies, signal) };
}
await test('persist before redirect; repeat retrieves same session without a second create', async () => {
  const s = setup(); const expected = { state: 'redirect', redirectUrl: session.url };
  assert.deepEqual(await s.run(), expected); assert.deepEqual(await s.run(), expected);
  assert.equal(s.calls.create, 1); assert.equal(s.calls.retrieve, 1); assert.equal(s.calls.ready, 1);
});
await test('concurrent calls create once; second is pending', async () => {
  const s = setup(); const values = await Promise.all([s.run(), s.run()]);
  assert.equal(values.filter(v => v.state === 'redirect').length, 1);
  assert.equal(values.filter(v => v.state === 'pending').length, 1); assert.equal(s.calls.create, 1);
});
for (const change of [{ version:0 }, { amount:1 }, { ownerUserId:owner }, { priceId:'price_bad' }, { returnUrl:'https://bad.invalid' }, { consent:{ ...consent, accepted:false } }, { consent:{ ...consent, totalYen:1 } }]) {
  await test(`reject invalid browser request ${Object.keys(change)[0]}`, async () => {
    const s = setup(); await assert.rejects(s.run({ ...input, ...change })); assert.equal(s.calls.create,0); assert.equal(s.calls.reserve,0);
  });
}
for (const property of ['ownerUserId','productKey','resourceId','planKey','requestId','policyApprovalId','policyRevision']) {
  await test(`server authorization mismatch ${property}`, async () => {
    const s = setup({ selectAuthorizedContext: async () => ({ ...context, [property]: property === 'policyRevision' ? 2 : 'different' }) });
    await assert.rejects(s.run()); assert.equal(s.calls.reserve,0);
  });
}
await test('scope revocation between reserve and provider stops provider', async () => {
  let calls=0; const s=setup({ selectAuthorizedContext:async()=>++calls===1 ? context : { ...context, policyRevision:2 } });
  assert.deepEqual(await s.run(), {state:'pending'}); assert.equal(s.calls.create,0); assert.equal(s.calls.uncertain,1);
});
for (const result of [{ ...session, id:'cs_prod_unsafe' }, { ...session, url:'https://evil.invalid' }, { ...session, expiresAt:now.toISOString() }, { ...session, secret:'leak' }, null]) {
  await test('reject unsafe provider result and leave uncertain', async () => {
    const s=setup({ createTestSession:async()=>result }); assert.deepEqual(await s.run(),{state:'pending'}); assert.equal(s.calls.ready,0); assert.equal(s.calls.uncertain,1);
  });
}
await test('provider timeout retains uncertain and never auto-creates again', async () => {
  let creates=0; const s=setup({createTestSession:async()=>{creates++; throw Error('secret-provider-detail');}});
  assert.deepEqual(await s.run(),{state:'pending'}); assert.deepEqual(await s.run(),{state:'pending'}); assert.equal(creates,1);
});
await test('persistence failure after provider response does not redirect or retry create', async () => {
  const s=setup({ markReady:async()=>{throw Error('storage-unavailable');} });
  assert.deepEqual(await s.run(),{state:'pending'}); assert.deepEqual(await s.run(),{state:'pending'}); assert.equal(s.calls.create,1);
});
await test('result hash mismatch on replay stops redirect', async () => {
  const s=setup({retrieveTestSession:async()=>({...session,url:'https://checkout.stripe.com/c/different'})});
  assert.equal((await s.run()).state,'redirect'); assert.deepEqual(await s.run(),{state:'pending'});
});
await test('aborted before reserve calls nothing', async () => {
  const s=setup(); await assert.rejects(s.run(input,AbortSignal.abort())); assert.equal(s.calls.authorization,0); assert.equal(s.calls.reserve,0);
});
await test('quote expiry before reserve rejected', async () => {
  const s=setup({now:()=>new Date(quote.expiresAt)}); await assert.rejects(s.run()); assert.equal(s.calls.reserve,0);
});
await test('malformed reserve record stops provider', async () => {
  const s=setup({reserve:async()=>({})}); await assert.rejects(s.run()); assert.equal(s.calls.create,0);
});
await test('session hash is stable and sensitive to expiration', async () => {
  assert.equal(checkoutSessionHash(session),checkoutSessionHash({...session}));
  assert.notEqual(checkoutSessionHash(session),checkoutSessionHash({...session,expiresAt:'2026-10-01T00:00:00.000Z'}));
});
console.log(`Platform checkout execution: ${count} checks passed (fake store/provider only)`);
