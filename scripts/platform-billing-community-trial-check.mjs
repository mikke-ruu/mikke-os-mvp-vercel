import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../supabase/migrations/20260904004922_platform_billing_community_trial_start.sql', import.meta.url), 'utf8');
const sqlTest = readFileSync(new URL('../supabase/tests/platform_billing_community_trial_start.sql', import.meta.url), 'utf8');
const http = readFileSync(new URL('../lib/billing/platform/http.ts', import.meta.url), 'utf8');
const server = readFileSync(new URL('../lib/billing/platform/server.ts', import.meta.url), 'utf8');
const route = readFileSync(new URL('../app/api/billing/platform/trial/start/route.ts', import.meta.url), 'utf8');
const concurrency = readFileSync(new URL('./platform-billing-community-trial-concurrency.mjs', import.meta.url), 'utf8');

for (const pattern of [
  /platform_billing_creation_one_lifetime_trial_idx/,
  /where source_kind = 'verified_trial'/,
  /platform_billing_community_trial_start\(\s*p_actor_user_id uuid,\s*p_request_id uuid/,
  /from auth\.users[\s\S]*is_anonymous is false[\s\S]*for update/,
  /'community_platform',[\s\n ]*'trial',[\s\n ]*'verified_trial'/,
  /v_ends_at timestamptz := transaction_timestamp\(\) \+ interval '30 days'/,
  /PLATFORM_BILLING_STATE_CONFLICT/,
  /from platform_billing_private\.subscriptions/,
  /from public\.community_communities/,
  /security definer[\s\S]*set search_path = ''/,
  /revoke all on function public\.platform_billing_community_trial_start\(uuid, uuid\)[\s\S]*from public, anon, authenticated/,
  /grant execute on function public\.platform_billing_community_trial_start\(uuid, uuid\)[\s\S]*to service_role/,
  /'automaticBilling', false/,
  /'allowedActions',[\s\S]*'\["checkout","start_trial"\]'/
]) assert.match(migration, pattern);

for (const label of [
  'lifetime uniqueness and service-only ACL', 'trial exact safe DTO and 30 day boundary',
  'same request is idempotent', 'active trial status is authoritative and never billing',
  'expired trial never becomes paid automatically', 'PLATFORM_BILLING_FORBIDDEN',
  'PLATFORM_BILLING_STATE_CONFLICT', 'platform_billing_community_trial_start_test_ok'
]) assert.ok(sqlTest.includes(label), `missing trial SQL evidence: ${label}`);

assert.match(http, /action: 'status' \| 'quote' \| 'checkout' \| 'portal' \| 'trial_start'/);
assert.match(http, /parseCommunityTrialStart/);
assert.match(server, /platform_billing_community_trial_start/);
assert.match(route, /servePlatformRequest\('trial_start'/);
assert.doesNotMatch(route, /actor|startsAt|endsAt|days|entitlement/i);
assert.match(concurrency, /community_trial_isolated_/);
assert.match(concurrency, /NetworkMode !== 'none'/);
assert.match(concurrency, /Promise\.all/);
assert.match(concurrency, /PLATFORM_BILLING_STATE_CONFLICT/);
assert.match(concurrency, /trials: 1, subscriptions: 0, communities: 0/);

console.log('platform_billing_community_trial_contract_ok');
