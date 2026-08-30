import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const migration = readFileSync(fileURLToPath(new URL("../supabase/migrations/20260830143000_academy_limited_pilot_access_controls.sql", import.meta.url)), "utf8");
const sqlTest = readFileSync(fileURLToPath(new URL("../supabase/tests/academy_limited_pilot_access_controls_test.sql", import.meta.url)), "utf8");
assert.match(migration, /create table public\.academy_trial_invitations/);
assert.match(migration, /academy_trial_invitation_required/);
assert.match(migration, /grant select, insert, update on table public\.academy_trial_invitations to service_role/);
assert.doesNotMatch(migration, /grant all on table public\.academy_trial_invitations/i);
assert.match(migration, /academy_trial_invitation_identity_is_immutable/);
assert.match(migration, /academy_trial_invitation_is_terminal/);
assert.match(migration, /academy_trial_invitation_headquarters_unique/);
assert.match(migration, /create table public\.academy_trial_consent_ledger/);
assert.match(migration, /academy_trial_consent_ledger_is_immutable/);
assert.match(migration, /grant select on table public\.academy_trial_consent_ledger to service_role/);
assert.match(migration, /academy_start_seven_day_trial\(text, text\)/);
assert.match(migration, /for update/);
assert.match(migration, /status = 'consumed'/);
assert.match(migration, /create table public\.academy_paid_access_transition_ledger/);
assert.match(migration, /academy_paid_access_transition_ledger_is_immutable/);
assert.match(migration, /grant select on table public\.academy_paid_access_transition_ledger to service_role/);
assert.match(migration, /auth\.jwt\(\) ->> 'role'.*service_role/);
assert.match(migration, /revoke all on function public\.academy_activate_paid_access\(uuid, uuid, text, timestamptz\) from public, anon, authenticated/);
assert.match(migration, /grant execute on function public\.academy_activate_paid_access\(uuid, uuid, text, timestamptz\) to service_role/);
assert.match(migration, /count\(distinct instructor\.profile_id\)/);
assert.match(migration, /academy_instructor_billing_exclusions/);
assert.match(migration, /is distinct from 'owner'/);
assert.match(migration, /auth\.jwt\(\) ->> 'is_anonymous'/);
assert.match(migration, /p_activated_at is null/);
assert.match(migration, /p_activated_at < v_access\.starts_at/);
assert.match(migration, /v_access\.access_kind is distinct from 'trial'/);
assert.match(migration, /v_access\.status not in \('trialing', 'expired'\)/);
assert.match(migration, /academy_trial_invitation_owner_idx/);
assert.match(migration, /academy_paid_access_transition_owner_idx/);
assert.doesNotMatch(migration, /on delete cascade/i);
assert.doesNotMatch(migration, /NEXT_PUBLIC_/);
for (const requiredContract of [
  "ANONYMOUS_AUTH_NEGATIVE_CALLS",
  "NULL_ROLE_AND_OTHER_HEADQUARTERS_NEGATIVE_CALLS",
  "PAID_ACTIVATION_TIME_AND_STATE_NEGATIVE_CALLS",
  "LEDGER_DIRECT_MUTATION_NEGATIVE_CALLS",
  "INVITATION_LIFECYCLE_NEGATIVE_CALLS",
  "TWO_CONNECTION_ACTIVATION_RACE_REQUIRED",
]) {
  assert.match(sqlTest, new RegExp(requiredContract));
}
assert.match(sqlTest, /academy_activate_paid_access[\s\S]*null/);
assert.match(sqlTest, /set_config\('request\.jwt\.claims'[\s\S]*is_anonymous/);
assert.match(sqlTest, /truncate table public\.academy_paid_access_transition_ledger/);
console.log("Academy limited pilot access controls static contract: OK");
