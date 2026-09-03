import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const migrationPath = path.join(
  root,
  "supabase/migrations/20260904013000_academy_internal_resource_access_recovery.sql"
);
const sql = fs.readFileSync(migrationPath, "utf8");

const required = [
  "set lock_timeout = '5s'",
  "set statement_timeout = '60s'",
  "product_key in ('academy_platform', 'community_platform')",
  "p_product_key in ('academy_platform', 'community_platform')",
  "if found and v.actor_user_id is not null then",
  "v_status in ('active', 'past_due', 'internal_grant')",
  "('MUSUBI', 'ayumi-academy')",
  "('mikkeOS Official Academy', 'admin_78e6-academy')",
  "PLATFORM_BILLING_ACADEMY_INTERNAL_RECOVERY_PREFLIGHT",
  "PLATFORM_BILLING_ACADEMY_INTERNAL_RECOVERY_HAS_CUSTOMER_BINDING",
  "source_kind in ('verified_paid', 'verified_trial')",
  "coalesce(owner.is_anonymous, false) = false",
  "revoke all on function platform_billing_private.resource_access_window",
  "revoke all on function private.academy_owner_read_allowed"
];

for (const marker of required) {
  if (!sql.includes(marker)) throw new Error(`missing contract marker: ${marker}`);
}

if (/insert\s+into\s+public\.academy_headquarters/iu.test(sql)) {
  throw new Error("recovery migration must not create headquarters");
}
if (/delete\s+from\s+public\.academy_/iu.test(sql)) {
  throw new Error("recovery migration must not delete Academy data");
}
if (/found\s+and\s+v\.status\s+in/iu.test(sql)) {
  throw new Error("customer precedence must not depend on a writable status");
}

console.log("academy_internal_access_recovery_contract_ok");
