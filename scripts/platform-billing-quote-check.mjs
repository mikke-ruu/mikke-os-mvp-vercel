import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

// No dependency install, compilation output or .ts-extension imports in app code.
const source = readFileSync(new URL('../lib/billing/platform/quote.ts', import.meta.url), 'utf8');
const code = stripTypeScriptTypes(source, { mode: 'strip' });
const { validatePlatformBillingQuote: validate, validatePlatformBillingConsent: accept } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const now = new Date('2026-09-01T01:00:00.000Z');
const scope = { ownerUserId: 'owner-fixture', productKey: 'academy', resourceId: 'hq-fixture', planKey: 'plan-fixture', requestId: 'request-fixture' };
const expected = { ...scope, policyApprovalId: 'approval-fixture', policyRevision: 1 };
const reference = { version: 'fixture-v1', url: 'https://example.invalid/approved-fixture' };
// Deliberately fictitious totals/dates: no real plan price or commercial rule.
const fixture = () => ({
  quoteId: 'quote-fixture', revision: 1, purchaseIntent: 'explicit_paid_start', scope: { ...scope }, currency: 'JPY', taxIncluded: true,
  dueNow: { totalYen: 123, dueOn: '2026-09-01' }, nextPayment: { totalYen: 456, dueOn: '2026-10-01' },
  merchant: { merchantId: 'merchant-fixture', legalName: 'Fixture merchant only', address: 'Fixture address only', contactUrl: 'https://example.invalid/contact' },
  policies: { approved: true, approvalId: 'approval-fixture', revision: 1, ...Object.fromEntries(['terms', 'privacy', 'refund', 'cancellation', 'proration', 'renewal', 'commercialDisclosure'].map((name) => [name, { ...reference }])) },
  issuedAt: '2026-09-01T00:00:00.000Z', expiresAt: '2026-09-01T02:00:00.000Z',
});
const consent = { quoteId: 'quote-fixture', revision: 1, termsVersion: 'fixture-v1', accepted: true };
let count = 0;
function test(name, run) { run(); count++; console.log(`ok ${count} - ${name}`); }
function invalid(name, change, reason) {
  test(name, () => { const quote = fixture(); change(quote); assert.deepEqual(validate(quote, expected, now), { ok: false, code: reason }); });
}

test('server quote and explicit matching consent accepted', () => assert.equal(accept(fixture(), expected, consent, now).ok, true));
test('resource-less product supported only with exact null context', () => { const quote=fixture(); quote.scope.resourceId=null; assert.equal(validate(quote, { ...expected, resourceId:null }, now).ok,true); });
for (const key of ['ownerUserId', 'productKey', 'resourceId', 'planKey', 'requestId']) invalid(`reject other ${key}`, (q) => { q.scope[key] = 'other-fixture'; }, 'CONTEXT_MISMATCH');
invalid('reject null-versus-resource mismatch', q => { q.scope.resourceId=null; }, 'CONTEXT_MISMATCH');
for (const amount of [undefined, null, '123', -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER+1]) {
  invalid(`reject unresolved/unsafe now amount ${String(amount)}`, q => { q.dueNow.totalYen=amount; }, 'UNRESOLVED_PRICE');
  invalid(`reject unresolved/unsafe next amount ${String(amount)}`, q => { q.nextPayment.totalYen=amount; }, 'UNRESOLVED_PRICE');
}
invalid('reject unknown next payment', q => { q.nextPayment=null; }, 'UNRESOLVED_PRICE');
invalid('reject non-JPY', q => { q.currency='USD'; }, 'UNRESOLVED_PRICE');
invalid('reject tax-exclusive price', q => { q.taxIncluded=false; }, 'UNRESOLVED_PRICE');
invalid('reject unknown date', q => { q.nextPayment.dueOn='unknown'; }, 'UNRESOLVED_PRICE');
invalid('reject rollover day', q => { q.nextPayment.dueOn='2026-02-30'; }, 'UNRESOLVED_PRICE');
invalid('reject past current charge day', q => { q.dueNow.dueOn='2026-08-31'; }, 'INVALID_SCHEDULE');
invalid('reject next day equal current', q => { q.nextPayment.dueOn=q.dueNow.dueOn; }, 'INVALID_SCHEDULE');
invalid('reject pending policy', q => { q.policies.approved=false; }, 'POLICY_UNAPPROVED');
for (const name of ['terms', 'privacy', 'refund', 'cancellation', 'proration', 'renewal', 'commercialDisclosure']) {
  invalid(`reject missing ${name} version`, q => { q.policies[name].version=''; }, 'POLICY_UNAPPROVED');
}
invalid('reject stale approval id', q => { q.policies.approvalId='superseded'; }, 'POLICY_CHANGED');
invalid('reject stale policy revision', q => { q.policies.revision=2; }, 'POLICY_CHANGED');
invalid('reject insecure legal URL', q => { q.policies.terms.url='javascript:alert(1)'; }, 'POLICY_UNAPPROVED');
invalid('reject merchant identity missing', q => { q.merchant.legalName=''; }, 'INVALID_QUOTE');
invalid('reject secret in merchant URL', q => { q.merchant.contactUrl='https://secret@example.invalid'; }, 'INVALID_QUOTE');
invalid('reject expired quote at exact boundary', q => { q.expiresAt=now.toISOString(); }, 'QUOTE_EXPIRED');
invalid('reject future quote', q => { q.issuedAt='2026-09-01T01:01:00.000Z'; }, 'QUOTE_NOT_YET_VALID');
invalid('reject malformed timestamp', q => { q.expiresAt='tomorrow'; }, 'INVALID_SCHEDULE');
invalid('reject timestamp normalization/rollover', q => { q.expiresAt='2026-09-01T24:00:00.000Z'; }, 'INVALID_SCHEDULE');
invalid('reject expiry before issue', q => { q.expiresAt='2026-08-31T23:59:59.000Z'; }, 'INVALID_SCHEDULE');
for (const intent of ['trial', 'trial_expired', 'auto_convert', 'academy_trial_7_days', 'community_trial_30_days']) invalid(`trial never implies paid consent ${intent}`, q => { q.purchaseIntent=intent; }, 'INVALID_QUOTE');
for (const change of [ { accepted:false }, { accepted:'true' }, { quoteId:'other' }, { revision:2 }, { termsVersion:'old' }, { ownerUserId:'other' }, { priceId:'price_browser' }, { totalYen:1 }, { planKey:'other' } ]) {
  test(`reject mismatched or injected consent ${JSON.stringify(change)}`, () => assert.deepEqual(accept(fixture(),expected,{...consent,...change},now),{ok:false,code:'CONSENT_MISMATCH'}));
}
test('reject missing explicit consent', () => assert.deepEqual(accept(fixture(),expected,null,now),{ok:false,code:'CONSENT_MISMATCH'}));
test('consent cannot revive expired quote', () => assert.deepEqual(accept(fixture(),expected,consent,new Date('2026-09-01T02:00:00.000Z')),{ok:false,code:'QUOTE_EXPIRED'}));
test('current approval revision rechecked', () => assert.deepEqual(accept(fixture(),{...expected,policyRevision:2},consent,now),{ok:false,code:'POLICY_CHANGED'}));
test('JST date boundary not UTC date', () => { const quote=fixture();quote.issuedAt='2026-08-31T14:00:00.000Z';quote.expiresAt='2026-08-31T16:00:00.000Z';quote.dueNow.dueOn='2026-08-31';assert.deepEqual(validate(quote,expected,new Date('2026-08-31T15:00:00.000Z')),{ok:false,code:'INVALID_SCHEDULE'}); });
test('zero is known amount, not unknown', () => { const quote=fixture();quote.dueNow.totalYen=0;assert.equal(validate(quote,expected,now).ok,true); });
test('invalid server clock fails closed', () => assert.deepEqual(validate(fixture(),expected,new Date(NaN)),{ok:false,code:'INVALID_CONTEXT'}));
test('malformed context fails closed', () => assert.deepEqual(validate(fixture(),null,now),{ok:false,code:'INVALID_CONTEXT'}));
test('unknown quote fields rejected', () => assert.deepEqual(validate({...fixture(),priceId:'browser-price'},expected,now),{ok:false,code:'INVALID_QUOTE'}));
test('detached deep-frozen snapshot resists mutation', () => { const input=fixture();const result=accept(input,expected,consent,now);assert.equal(result.ok,true);input.dueNow.totalYen=1;input.policies.terms.version='mutated';assert.equal(result.quote.dueNow.totalYen,123);assert.equal(result.quote.policies.terms.version,'fixture-v1');assert.throws(()=>{result.quote.scope.ownerUserId='other';},TypeError);assert.throws(()=>{result.quote.policies.refund.url='changed';},TypeError); });
test('no provider or persistence side effects', () => assert.doesNotMatch(source,/\b(?:fetch|XMLHttpRequest|localStorage|sessionStorage)\b|from\s+["'](?:stripe|@supabase)/));
console.log(`Platform billing quote contract: ${count}/${count} passed`);
