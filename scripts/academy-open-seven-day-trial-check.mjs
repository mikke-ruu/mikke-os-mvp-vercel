import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20260904150000_academy_open_seven_day_trial.sql", import.meta.url),
  "utf8"
);
const test = readFileSync(
  new URL("../supabase/tests/academy_open_seven_day_trial.sql", import.meta.url),
  "utf8"
);

assert.match(migration, /not owns_headquarters and not used_trial/);
assert.doesNotMatch(migration, /academy_trial_invitation_required/);
assert.match(migration, /academy_trial_usage_ledger/);
assert.match(migration, /academy_trial_consent_ledger/);
assert.match(migration, /v_starts_at \+ interval '7 days'/);
assert.match(migration, /'small',\s*false/);
assert.match(migration, /academy_anonymous_auth_forbidden/);
assert.match(migration, /for update/);
assert.match(migration, /revoke all on function public\.academy_start_seven_day_trial\(text, text\)/);
assert.doesNotMatch(migration, /insert\s+into\s+platform_billing_private\.subscriptions/iu);
assert.doesNotMatch(migration, /access_kind\s*=\s*'paid'|status\s*=\s*'active'/iu);

for (const sentinel of [
  "first-time account can see seven-day trial",
  "trial lasts exactly seven days",
  "trial does not activate public headquarters",
  "second trial is rejected",
  "anonymous auth is rejected",
  "expired trial remains readable but not writable",
]) {
  assert.ok(test.includes(sentinel), `missing SQL assertion: ${sentinel}`);
}

console.log("academy_open_seven_day_trial_contract_ok");
