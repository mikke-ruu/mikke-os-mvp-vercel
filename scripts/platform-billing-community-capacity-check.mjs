import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(new URL("../supabase/migrations/20260903011816_community_capacity_for_resource.sql", import.meta.url), "utf8");
const test = readFileSync(new URL("../supabase/tests/platform_billing_community_capacity.sql", import.meta.url), "utf8");
const activation = migration.slice(
  migration.indexOf("create or replace function public.platform_billing_verified_subscription_activate"),
  migration.indexOf("create function platform_billing_private.community_capacity_for_resource")
);

assert.match(activation, /v_attempt\.resource_id is distinct from v_quote\.resource_id/);
assert.match(activation, /set status='consumed', resource_id=v_resource_id/);
assert.match(activation, /entitlement\.status is distinct from 'consumed'/);
assert.doesNotMatch(activation, /v_attempt\.resource_id is not null\s+or v_attempt\.status/);

for (const phrase of [
  "platform_billing_private.community_capacity_for_resource",
  "'community_platform'",
  "'trial'",
  "'starter'",
  "'standard'",
  "'pro'",
  "subscription.status = 'active'",
  "subscription.current_period_start <= p_now",
  "subscription.current_period_end > p_now",
  "attempt.status = 'provider_ready'",
  "entitlement.status = 'consumed'"
]) assert.ok(migration.includes(phrase), `missing capacity contract: ${phrase}`);

assert.match(migration, /revoke all on function platform_billing_private\.community_capacity_for_resource\(uuid, uuid, timestamptz\)\s+from public, anon, authenticated, service_role/i);
assert.doesNotMatch(migration, /community_memberships|can_access_room|delete\s+from|update\s+public\.community/i);
for (const exactMapping of [
  /when 'starter' then 50/,
  /when 'standard' then 200/,
  /when 'pro' then 1000/,
  /plan_key = 'trial' then 10/
]) assert.match(migration, exactMapping);
assert.doesNotMatch(migration, /trial10|starter50|standard200|pro1000/);
assert.match(test, /active starter returns 50/);
assert.match(test, /existing resource payment binds entitlement and leaves no create grant/);
assert.match(test, /different owner fails closed/);
assert.match(test, /period end is exclusive/);
assert.match(test, /past_due fails closed/);
assert.match(test, /active trial returns 10/);
assert.match(test, /expired trial fails closed/);
assert.match(test, /multiple trial sources fail closed/);
assert.match(test, /platform_billing_community_capacity_test_ok/);

console.log("platform_billing_community_capacity_check_ok");
