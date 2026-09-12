import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  "supabase/migrations/20260912090000_academy_first_publication_preparation_policy.sql",
  "utf8"
);
const alignmentSql = readFileSync(
  "supabase/migrations/20260912090500_academy_onboarding_policy_alignment.sql",
  "utf8"
);
const dashboard = readFileSync("app/academy/page.tsx", "utf8");

assert.match(sql, /academy-first-publication-trial-2026-09-08-v1/);
assert.match(sql, /academy-first-publication-trial-terms-2026-09-08-v1/);
assert.match(sql, /academy-first-publication-trial-consent-2026-09-08-v1/);
assert.match(sql, /1800/);
assert.match(sql, /true,\s*'fixed_at_publication'/s);
assert.match(sql, /'no_previous_trial_or_contract',\s*false,\s*null/s);
assert.match(sql, /and not dispatch_enabled/);
assert.match(sql, /and pricing_revision is null/);
assert.match(alignmentSql, /academy_get_my_onboarding_eligibility/);
assert.match(alignmentSql, /academy-first-publication-trial-2026-09-08-v1/);
assert.match(alignmentSql, /not owns_headquarters and not used_trial and policy_available/);
assert.match(alignmentSql, /when not policy_available then 'policy_unavailable'/);
assert.match(alignmentSql, /revoke all[\s\S]*from public, anon/);
assert.match(alignmentSql, /grant execute[\s\S]*to authenticated/);
assert.match(dashboard, /academy_first_publication_create_preparation/);
assert.match(dashboard, /このボタンでは講座は公開されず、課金も始まりません/);

console.log("academy preparation policy: enabled for preparation, billing dispatch remains disabled");
