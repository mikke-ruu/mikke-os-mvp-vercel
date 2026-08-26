import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20260826033657_academy_seven_day_trial_foundation.sql", import.meta.url),
  "utf8"
);
const client = readFileSync(new URL("../lib/academy/trial.ts", import.meta.url), "utf8");
const shell = readFileSync(new URL("../components/academy/AcademyShell.tsx", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("../app/academy/page.tsx", import.meta.url), "utf8");

assert.match(migration, /create table public\.academy_headquarters_access_states/);
assert.match(migration, /create table public\.academy_trial_usage_ledger/);
assert.match(migration, /trial_ends_at = starts_at \+ interval '7 days'/);
assert.match(migration, /academy_trial_usage_ledger_is_immutable/);
assert.match(migration, /Existing headquarters predate this access ledger/);
assert.doesNotMatch(migration, /legacy_paid/);
assert.match(migration, /academy_start_seven_day_trial/);
assert.match(migration, /not owns_headquarters and not used_trial/);
assert.match(migration, /not owns_headquarters and has_paid_entitlement/);
assert.match(migration, /'small',\s*false/s);
assert.match(migration, /academy_trial_headquarters_protected_fields/);
assert.match(migration, /academy_trial_publishing_unavailable/);
assert.match(migration, /academy_trial_program_publish_unavailable/);
assert.match(migration, /academy_trial_hosted_video_unavailable/);
assert.match(migration, /create trigger academy_00_trial_guard_program_steps/);
assert.match(migration, /academy_trial_live_feature_unavailable/);
assert.match(migration, /academy_trial_community_unavailable/);
assert.match(migration, /academy_applications/);
assert.match(migration, /academy_instructors/);
assert.match(migration, /academy_video_assets/);
assert.match(migration, /academy_course_access_grants/);
assert.match(migration, /academy_program_assignments/);
assert.match(migration, /academy_create_headquarters\(p_name text\)[\s\S]*?academy_headquarters_access_states/);
assert.match(migration, /academy_headquarters_access_owner_mismatch/);
assert.match(migration, /coalesce\(private\.academy_headquarters_access_mode\(v_headquarters_id\), 'blocked'\)/);
assert.match(migration, /revoke all on function public\.academy_start_seven_day_trial\(text\) from public, anon/);
assert.match(migration, /revoke all on function public\.academy_create_headquarters\(text\) from public, anon/);
assert.match(client, /academy_get_my_onboarding_eligibility/);
assert.match(client, /academy_get_my_headquarters_access/);
assert.match(shell, /7日間お試し ・ あと/);
assert.match(shell, /自動課金はされません/);
assert.match(dashboard, /7日間お試しを始める/);
assert.doesNotMatch(dashboard, /無料トライアル/);

console.log("Academy seven-day trial contract: OK");
