import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/migrations/20260903161500_platform_billing_resource_access_window.sql", "utf8");

assert.match(sql, /resource_access_window\(\s*p_product_key text,\s*p_resource_id uuid,\s*p_at timestamptz/);
assert.match(sql, /security definer\s*set search_path = ''/);
assert.match(sql, /v_match_count <> 1/);
assert.match(sql, /source_kind = 'verified_paid'/);
assert.match(sql, /p_product_key <> 'community_platform'/);
assert.match(sql, /source_kind = 'verified_trial'/);
assert.match(sql, /plan_key = 'trial'/);
assert.match(sql, /then 'trialing'::text else 'ended'::text/);
assert.match(sql, /v_trial\.starts_at <= p_at and v_trial\.expires_at > p_at/);
assert.match(sql, /v_trial\.expires_at \+ interval '90 days'/);
assert.match(sql, /status = 'consumed'/);
assert.match(sql, /subscription\.source_attempt_id = entitlement\.source_attempt_id/);
assert.match(sql, /status = 'active'[\s\S]*current_period_start <= p_at[\s\S]*current_period_end > p_at/);
assert.match(sql, /status = 'ended'[\s\S]*projected_status = 'ended'/);
assert.match(sql, /v_ended_at \+ interval '90 days'/);
assert.doesNotMatch(sql, /past_due[\s\S]*90 days/);
assert.match(sql, /revoke all on function[\s\S]*from public, anon, authenticated, service_role/);

console.log("platform_billing_resource_access_window_check_ok");
