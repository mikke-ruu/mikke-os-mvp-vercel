import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20260903164500_community_platform_retention_controls.sql", import.meta.url),
  "utf8",
);
const test = readFileSync(
  new URL("../supabase/tests/community_platform_retention_controls.sql", import.meta.url),
  "utf8",
);

assert.match(migration, /resource_access_window\(\s*'community_platform', community\.id, p_at\s*\)/s);
assert.match(migration, /returns table \([\s\S]*write_allowed boolean,[\s\S]*owner_read_until timestamptz,[\s\S]*anonymize_after timestamptz/);
assert.match(migration, /create or replace function community_private\.is_staff\(p_community_id uuid\)[\s\S]*community_owner_write_allowed/);
assert.match(migration, /create or replace function community_private\.is_active_member\(p_community_id uuid\)[\s\S]*community_owner_read_allowed/);
assert.match(migration, /access\.status = 'past_due'/);
assert.match(migration, /access\.status = 'ended'[\s\S]*p_at < access\.owner_read_until/);
assert.match(migration, /community_current_actor_owner_read_allowed\(\s*p_community_id uuid\s*\)/);
assert.match(migration, /grant execute on function community_private\.community_current_actor_owner_read_allowed\(uuid\) to authenticated/);
assert.match(migration, /COMMUNITY_PLATFORM_OWNER_READ_ONLY/);
assert.match(migration, /community_export_owner_archive/);
assert.match(migration, /COMMUNITY_OWNER_EXPORT_NOT_AVAILABLE/);
assert.match(migration, /community_apply_platform_retention_anonymization/);
assert.match(migration, /COMMUNITY_RETENTION_NOT_DUE/);
assert.match(migration, /request\.jwt\.claim\.role[\s\S]*auth\.jwt\(\)->>'role'/);
assert.match(migration, /revoke all on function public\.community_apply_platform_retention_anonymization\(uuid, timestamptz\) from public, anon, authenticated/);

for (const protectedTable of [
  "community_member_profiles",
  "community_posts",
  "community_comments",
  "community_chat_messages",
  "community_consent_records",
  "community_member_entitlements",
  "community_academy_entitlement_claims",
]) {
  const worker = migration.slice(migration.indexOf("create function public.community_apply_platform_retention_anonymization"));
  assert.doesNotMatch(worker, new RegExp(`(?:update|delete\\s+from)\\s+public\\.${protectedTable}\\b`, "i"));
}

for (const label of [
  "active owner can write",
  "active verified trial projects trialing write access",
  "active trial owner can write",
  "expired trial owner cannot write",
  "expired trial owner can read and export during 90 days",
  "trial owner cannot read or export after 90 days",
  "past due owner is read only",
  "ended owner can read and export during 90 days",
  "ended owner cannot read or export after 90 days",
  "ordinary participant remains active",
  "manual entitlement remains unchanged",
  "Academy claim remains unchanged",
  "anonymous export is rejected",
  "anonymization before deadline is rejected",
  "worker changes allowlisted operator fields only",
  "worker is idempotent",
]) assert.ok(test.includes(label), `missing SQL assertion: ${label}`);

assert.match(test, /'community_platform', 'trial', 'verified_trial'/);
assert.match(test, /status='trialing' and write_allowed/);

assert.ok(test.includes("community_platform_retention_controls_test_ok"));
console.log("community_platform_retention_contract_ok");
