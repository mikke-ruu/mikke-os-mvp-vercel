import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260902042322_community_join_rpc_security_hardening.sql",
    import.meta.url,
  ),
  "utf8",
);
const test = readFileSync(
  new URL("../supabase/tests/community_membership_rpc_security.sql", import.meta.url),
  "utf8",
);

const signatures = [
  "public.community_invite_by_mikke_id",
  "public.community_leave",
  "public.community_submit_join_application",
  "public.community_review_join_application",
];

assert.equal((migration.match(/^security definer$/gim) ?? []).length, 4);
assert.equal((migration.match(/set search_path = ''/gi) ?? []).length, 4);
assert.equal((migration.match(/COMMUNITY_ANONYMOUS_DENIED/g) ?? []).length, 4);
assert.doesNotMatch(migration, /set search_path\s*=\s*(?:pg_catalog|public|community_private)/i);

for (const signature of signatures) {
  assert.match(migration, new RegExp(`create or replace function ${signature.replaceAll(".", "\\.")}`));
  assert.match(test, new RegExp(signature.replaceAll(".", "\\.")));
}

assert.match(migration, /Invitation expiry must be in the future/);
assert.match(migration, /This user is already an active member/);
assert.match(migration, /Only pending applications can be reviewed/);
assert.match(migration, /from public\.community_memberships/);
assert.match(migration, /from auth\.users/);
assert.match(migration, /community_private\.is_staff/);

assert.equal((migration.match(/from public, anon;/g) ?? []).length, 4);
assert.equal((migration.match(/to authenticated;/g) ?? []).length, 4);
assert.match(test, /search_path=""/);
assert.match(test, /COMMUNITY_ANONYMOUS_DENIED/);
assert.match(test, /Invitation expiry must be in the future/);
assert.match(test, /This user is already an active member/);
assert.match(test, /Only pending applications can be reviewed/);
assert.match(test, /invited application activates membership/);
assert.match(test, /invitation becomes accepted/);
assert.match(test, /leaving member is marked left/);
assert.match(test, /leaving member entitlement is revoked/);
assert.match(test, /both applications retain three consent records/);
assert.match(test, /community_membership_rpc_security_test_ok/);
assert.match(test, /rollback;/i);

console.log("community_membership_rpc_security_contract_ok");
