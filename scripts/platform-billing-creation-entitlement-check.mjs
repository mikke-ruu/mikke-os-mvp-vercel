import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context);
} });

const {
  decodeCreationEntitlementProjection,
  projectCreationEntitlementStatus,
} = await import('../lib/billing/platform/creation.ts');

const migration = readFileSync(new URL('../supabase/migrations/20260901124412_platform_billing_creation_entitlements.sql', import.meta.url), 'utf8');
const sqlTest = readFileSync(new URL('../supabase/tests/platform_billing_creation_entitlements.sql', import.meta.url), 'utf8');
const ownerScope = { product: 'community_platform', resourceId: null };
const resourceId = 'a0000000-0000-4000-8000-000000000111';
let passed = 0;

function test(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

test('Community-required table and exact consumption columns exist', () => {
  for (const pattern of [
    /create table platform_billing_private\.creation_entitlements/i,
    /id uuid primary key/i,
    /actor_user_id uuid not null/i,
    /product_key text not null/i,
    /plan_key text not null/i,
    /status text not null/i,
    /starts_at timestamptz not null/i,
    /expires_at timestamptz/i,
    /resource_id uuid/i,
    /consumed_at timestamptz/i,
    /created_at timestamptz not null/i,
    /updated_at timestamptz not null/i,
  ]) assert.match(migration, pattern);
});

test('server-only ACL and immutable identity are explicit', () => {
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on table platform_billing_private\.creation_entitlements\s+from public, anon, authenticated, service_role/i);
  assert.match(migration, /security definer\s+set search_path = ''/gi);
  assert.match(migration, /grant execute on function public\.platform_billing_creation_entitlement_grant[\s\S]*to service_role/i);
  assert.doesNotMatch(migration, /grant (?:select|insert|update|delete|truncate|all)[\s\S]{0,120}creation_entitlements[\s\S]{0,120}authenticated/i);
  assert.match(migration, /to_jsonb\(new\) - array\['status', 'resource_id', 'consumed_at', 'updated_at'\]/i);
});

test('idempotency and one available grant are database constraints', () => {
  assert.match(migration, /unique \(product_key, source_kind, source_attempt_id\)/i);
  assert.match(migration, /unique \(actor_user_id, product_key, idempotency_key\)/i);
  assert.match(migration, /create unique index platform_billing_creation_one_available_idx/i);
  assert.match(migration, /where status = 'available' and resource_id is null/i);
});

test('grant and status reject browser inference', () => {
  assert.match(migration, /perform platform_billing_private\.require_actor\(p_actor_user_id\)/gi);
  assert.match(migration, /p_source_kind not in \('verified_trial', 'verified_paid'\)/i);
  assert.match(migration, /PLATFORM_BILLING_IDEMPOTENCY_CONFLICT/i);
  assert.match(migration, /PLATFORM_BILLING_CREATION_ALREADY_AVAILABLE/i);
});

test('SQL rollback test covers ACL, idempotency, mutation and consumed projection', () => {
  for (const pattern of [
    /set local role anon/i,
    /set local role authenticated/i,
    /set local role service_role/i,
    /PLATFORM_BILLING_FORBIDDEN/i,
    /PLATFORM_BILLING_IDEMPOTENCY_CONFLICT/i,
    /PLATFORM_BILLING_CREATION_ALREADY_AVAILABLE/i,
    /PLATFORM_BILLING_CREATION_IMMUTABLE/i,
    /status projects consumed resource/i,
    /consumed grant does not reopen creation/i,
    /platform_billing_creation_entitlements_test_ok/i,
  ]) assert.match(sqlTest, pattern);
});

test('available projection enables only create_resource', () => {
  const decoded = decodeCreationEntitlementProjection({
    state: 'available', planKey: 'starter', resourceId: null, expiresAt: '2026-10-01T00:00:00.000Z',
  }, ownerScope);
  assert.ok(decoded);
  assert.deepEqual(projectCreationEntitlementStatus(ownerScope, decoded), {
    version: 0,
    product: 'community_platform',
    resourceId: null,
    availability: 'ready',
    subscription: null,
    creation: { state: 'available' },
    allowedActions: ['create_resource'],
    noticeCode: null,
  });
});

test('consumed projection is bound to the requested resource', () => {
  const scope = { product: 'community_platform', resourceId };
  assert.ok(decodeCreationEntitlementProjection({ state: 'consumed', planKey: 'starter', resourceId, expiresAt: null }, scope));
  assert.equal(decodeCreationEntitlementProjection({ state: 'consumed', planKey: 'starter', resourceId: 'a0000000-0000-4000-8000-000000000112', expiresAt: null }, scope), null);
});

test('unknown and malformed states fail closed', () => {
  for (const raw of [
    null,
    {},
    { state: 'available', planKey: null, resourceId: null, expiresAt: null },
    { state: 'pending', planKey: 'starter', resourceId: null, expiresAt: null },
    { state: 'none', planKey: 'starter', resourceId: null, expiresAt: null },
    { state: 'available', planKey: 'starter', resourceId: null, expiresAt: 'today' },
    { state: 'available', planKey: 'starter', resourceId: null, expiresAt: null, raw: 'leak' },
  ]) assert.equal(decodeCreationEntitlementProjection(raw, ownerScope), null);
});

console.log(`Platform billing creation entitlement contract: ${passed} checks passed; no DB/provider/network`);
