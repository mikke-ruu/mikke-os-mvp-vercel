import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20260825161200_academy_month_end_billing_snapshots.sql", import.meta.url),
  "utf8",
);
const e2e = readFileSync(
  new URL("../supabase/tests/academy_billing_snapshot_e2e.sql", import.meta.url),
  "utf8",
);
const billingClient = readFileSync(
  new URL("../lib/academy/billing.ts", import.meta.url),
  "utf8",
);
const settings = readFileSync(
  new URL("../app/academy/settings/page.tsx", import.meta.url),
  "utf8",
);

assert.match(migration, /academy_monthly_billing_snapshots/);
assert.match(migration, /academy_instructor_billing_exclusions/);
assert.match(migration, /created_at < v_cutoff/);
assert.match(migration, /withdrawn_at is null or instructor\.withdrawn_at >= v_cutoff/);
assert.match(migration, /select distinct instructor\.profile_id/);
assert.match(migration, /at time zone 'Asia\/Tokyo'/);
assert.match(migration, /registered_instructor_count <= 20 and v_count > 20/);
assert.match(migration, /registered_instructor_count <= 50 and v_count > 50/);
assert.match(migration, /academy_billing_snapshot_is_immutable/);
assert.match(migration, /auth\.role\(\)\) <> 'service_role'/);
assert.match(migration, /academy_billing_owner_required/);
assert.match(migration, /is distinct from 'owner'/);
assert.doesNotMatch(migration, /stripe_(customer|price|product|subscription)|stripe\./i);
assert.match(e2e, /BILL-OWNER/);
assert.match(e2e, /snapshot_month = '2026-02-01'[\s\S]*registered_instructor_count = 21[\s\S]*charge_price_yen = 5000/);
assert.match(e2e, /snapshot_month = '2026-04-01'[\s\S]*registered_instructor_count = 51[\s\S]*charge_price_yen = 10000/);
assert.match(e2e, /academy_billing_snapshot_is_immutable/);
assert.match(billingClient, /academy_get_my_billing_snapshot/);
assert.match(settings, /上限利用時の1名あたり/);
assert.match(settings, /本部Ownerも講師登録している場合は1名/);
assert.match(settings, /その次の更新月から通常料金/);

console.log("Academy billing snapshot contract: OK");
