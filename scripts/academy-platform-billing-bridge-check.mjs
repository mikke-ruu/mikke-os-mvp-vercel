import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/20260902231854_academy_guarded_platform_creation.sql", "utf8");
const sqlTest = fs.readFileSync("supabase/tests/academy_platform_billing_bridges.sql", "utf8");
const route = fs.readFileSync("app/academy/api/headquarters/create/route.ts", "utf8");
const admin = fs.readFileSync("lib/academy/headquarters-creation-admin.ts", "utf8");
const client = fs.readFileSync("lib/academy/headquarters.ts", "utf8");
const dashboard = fs.readFileSync("app/academy/page.tsx", "utf8");

assert.match(migration, /academy_create_headquarters_with_platform_entitlement\(\s*p_actor_user_id uuid,\s*p_name text/);
assert.match(migration, /platform_billing_academy_new_paid_consume\(\s*v_actor,\s*v_headquarters_id/);
assert.match(migration, /platform_billing_academy_existing_paid_consume\(\s*v_owner_user_id,\s*p_headquarters_id/);
assert.doesNotMatch(migration, /platform_billing_academy_(?:new_|existing_)?paid_activation_verify_and_consume/);
assert.match(migration, /revoke execute on function public\.academy_create_headquarters\(text\)\s+from authenticated/);
assert.match(migration, /revoke all on function public\.academy_create_headquarters_with_platform_entitlement\(uuid, text\)\s+from public, anon, authenticated/);
assert.match(migration, /grant execute on function public\.academy_create_headquarters_with_platform_entitlement\(uuid, text\)\s+to service_role/);
assert.match(migration, /grant execute on function public\.academy_activate_paid_access_from_platform_subscription\(uuid\)\s+to service_role/);
assert.match(migration, /v_proof ->> 'productKey' is distinct from 'academy_platform'/);
assert.match(migration, /v_current_period_ends_at <= statement_timestamp\(\)/);
assert.match(migration, /academy_paid_access_transition_ledger[\s\S]*transition\.contract_reference = v_contract_reference/);
assert.match(migration, /A construction-course purchase[\s\S]*is not enough to call this RPC/);

for (const marker of [
  "legacy browser create revoked",
  "guarded create is service only",
  "paid bridge is service only",
  "common entitlement consumed once",
  "upgrade transition exactly once",
  "academy_platform_billing_bridges_test_ok"
]) assert.match(sqlTest, new RegExp(marker));

assert.match(route, /Cache-Control.*no-store/);
assert.match(route, /authorization/);
assert.match(route, /createAcademyHeadquartersFromPlatformEntitlement/);
assert.match(admin, /import "server-only"/);
assert.match(admin, /auth\.getUser\(input\.accessToken\)/);
assert.match(admin, /userData\.user\.is_anonymous/);
assert.match(admin, /SUPABASE_SECRET_KEY \?\? process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
assert.doesNotMatch(admin, /NEXT_PUBLIC_.*SERVICE|NEXT_PUBLIC_.*SECRET/);
assert.match(client, /fetch\("\/academy\/api\/headquarters\/create"/);
assert.match(client, /credentials: "omit"/);
assert.match(client, /redirect: "error"/);
assert.doesNotMatch(client, /rpc\("academy_create_headquarters"/);
assert.match(client, /readAcademyPlatformBillingStatus\(null/);
assert.match(client, /state\.kind === "owner" && state\.allowedActions\.includes\("create_resource"\)/);
assert.match(dashboard, /setCanCreate\(platformCreationAvailable\)/);
assert.doesNotMatch(dashboard, /setCanCreate\(eligibility\.paid_creation_available\)/);

console.log("Academy platform billing bridge contract: OK");
