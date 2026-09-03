import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const common = read("supabase/migrations/20260903011816_community_capacity_for_resource.sql");
const migration = read("supabase/migrations/20260903014133_community_membership_capacity_enforcement.sql");
const test = read("supabase/tests/community_membership_capacity_enforcement.sql");
const concurrency = read("scripts/community-membership-capacity-concurrency.mjs");

function slice(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `missing start: ${start}`);
  assert.notEqual(to, -1, `missing end: ${end}`);
  return source.slice(from, to);
}

assert.match(common, /create function platform_billing_private\.community_capacity_for_resource\(\s*p_owner_user_id uuid,\s*p_resource_id uuid,\s*p_now timestamptz\s*\)/s);
assert.match(common, /when 'starter' then 50[\s\S]*when 'standard' then 200[\s\S]*when 'pro' then 1000/);
assert.match(common, /when entitlement\.plan_key = 'trial' then 10/);
assert.match(common, /revoke all on function platform_billing_private\.community_capacity_for_resource\(uuid, uuid, timestamptz\)\s*from public, anon, authenticated, service_role/);

const guard = slice(
  migration,
  "create function community_private.community_assert_new_membership_capacity(",
  "-- Keep the previously reviewed implementations",
);
assert.ok(guard.indexOf("for update;") < guard.indexOf("platform_billing_private.community_capacity_for_resource("));
assert.ok(guard.indexOf("platform_billing_private.community_capacity_for_resource(") < guard.indexOf("select pg_catalog.count(*)::integer"));
assert.match(guard, /membership\.status = 'active'[\s\S]*return;/);
assert.match(guard, /COMMUNITY_MEMBER_CAPACITY_UNAVAILABLE/);
assert.match(guard, /COMMUNITY_MEMBER_CAPACITY_REACHED/);
assert.match(migration, /create function community_private\.community_require_capacity_checked_activation\(\)/);
assert.match(migration, /COMMUNITY_MEMBERSHIP_ACTIVATION_REQUIRES_GUARDED_FLOW/);
assert.match(migration, /create trigger community_membership_capacity_activation_guard/);

const wrappers = [
  ["create function public.community_submit_join_application(", "create function public.community_review_join_application(", "community_submit_join_application_without_capacity_20260903("],
  ["create function public.community_review_join_application(", "create function public.community_accept_academy_access_invitation(", "community_review_join_application_without_capacity_20260903("],
  ["create function public.community_accept_academy_access_invitation(", "create function public.community_review_payment_claim(", "community_accept_academy_invitation_pre_capacity("],
  ["create function public.community_review_payment_claim(", "revoke all on function public.community_submit_join_application", "community_review_payment_claim_without_capacity_20260903("],
];
for (const [start, end, retained] of wrappers) {
  const body = slice(migration, start, end);
  assert.ok(body.indexOf("community_assert_new_membership_capacity(") < body.indexOf(retained), `${start} must guard before mutation`);
  assert.match(body, /security definer\s+set search_path = ''/);
}

for (const name of [
  "community_submit_join_application_without_capacity_20260903",
  "community_review_join_application_without_capacity_20260903",
  "community_accept_academy_invitation_pre_capacity",
  "community_review_payment_claim_without_capacity_20260903",
]) {
  assert.match(migration, new RegExp(`revoke all on function public\\.${name}\\(`));
}
assert.doesNotMatch(migration, /(?:insert|update|delete)\s+(?:into\s+|from\s+)?public\.community_member_entitlements/i);
assert.doesNotMatch(migration, /(?:insert|update|delete)\s+(?:into\s+|from\s+)?public\.community_academy_entitlement_claims/i);

for (const label of [
  "auto/invite activation stops at capacity",
  "staff approval stops at capacity",
  "Academy invitation stops at capacity",
  "payment claim reactivation stops at capacity",
  "failed attempts do not exceed capacity",
  "capacity rejection leaves applications and claims unchanged",
  "direct membership activation is rejected",
  "expired or unknown capacity fails closed for new activation",
  "below-cap activation succeeds",
]) assert.ok(test.includes(label), `missing SQL assertion: ${label}`);
assert.ok(test.includes("community_membership_capacity_enforcement_test_ok"));

assert.ok(concurrency.includes("--run-isolated"));
assert.ok(concurrency.includes("COMMUNITY_CAPACITY_TEST_DATABASE_URL"));
assert.ok(concurrency.includes("Promise.all"));
assert.ok(concurrency.includes("COMMUNITY_MEMBER_CAPACITY_REACHED"));
assert.ok(concurrency.includes("community_membership_capacity_concurrency_test_ok"));

console.log("community_membership_capacity_contract_ok");
