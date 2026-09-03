import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20260903193000_academy_platform_access_lifecycle.sql", import.meta.url),
  "utf8",
);
const test = readFileSync(
  new URL("../supabase/tests/academy_platform_access_lifecycle_test.sql", import.meta.url),
  "utf8",
);

for (const phrase of [
  "platform_billing_private.resource_access_window",
  "status = 'ended' and p_at < v_owner_read_until",
  "v_status in ('active', 'past_due')",
  "return 'paid_readonly'",
  "academy_export_my_headquarters",
  "academy_anonymize_ended_headquarters",
  "academy_retention_anonymization_runs",
  "academy-retention:",
  "about:blank#retained-record",
  "app.academy_retention_worker",
]) assert.ok(migration.includes(phrase), phrase);

assert.match(migration, /window\.write_allowed/);
assert.match(migration, /window\.actor_user_id\s*=\s*headquarters\.owner_user_id/);
assert.match(migration, /current_setting\('role', true\) = 'service_role'/);
assert.match(migration, /v_window\.owner_read_until is distinct from v_window\.anonymize_after/);
assert.match(migration, /revoke all on function public\.academy_anonymize_ended_headquarters\(uuid\)[\s\S]*grant execute[^;]+service_role/);
assert.doesNotMatch(migration, /grant\s+(all|insert|update|delete|truncate)[^;]+academy_retention_anonymization_runs/i);
assert.doesNotMatch(migration, /delete\s+from\s+public\.academy_/i);
assert.doesNotMatch(migration, /update\s+public\.academy_(enrollments|credential_holders|credentials|step_progress|step_submissions)/i);

for (const phrase of [
  "active write succeeds",
  "past_due write denied",
  "ended owner export within 90 days",
  "ended owner export after 90 days denied",
  "reactivated write succeeds",
  "anonymization before boundary denied",
  "history rows retained",
  "anonymous export denied",
  "academy_platform_access_lifecycle_test_ok",
]) assert.ok(test.includes(phrase), phrase);

console.log("Academy platform access lifecycle contract: OK");
