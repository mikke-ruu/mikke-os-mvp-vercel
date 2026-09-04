import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260904051550_mikkeos_academy_billing_exclusion_admin.sql");
const route = read("app/api/hq/billing-exclusions/route.ts");
const server = read("lib/hq/billing-exclusions-admin.ts");
const client = read("lib/hq/billing-exclusions.ts");
const page = read("app/hq/billing-exclusions/page.tsx");
const shell = read("components/hq/HqShell.tsx");
const sqlTest = read("supabase/tests/mikkeos_academy_billing_exclusion_admin.sql");

const checks = [
  [migration.includes("canonical_handle = 'ayumi'"), "canonical @ayumi admin pin"],
  [migration.includes("lower(profile.handle) = 'ayumi'"), "current canonical handle revalidation"],
  [migration.includes("p_actor_user_id <> (select auth.uid())"), "database binds signed-in @ayumi"],
  [migration.includes("from public, anon, authenticated, service_role"), "direct ledger writes revoked"],
  [migration.includes("academy_billing_exclusion_events"), "immutable audit events"],
  [server.includes("auth.getUser(accessToken)"), "server revalidates user token"],
  [server.includes('import "server-only"') && !server.includes("SUPABASE_SECRET_KEY"), "no admin secret dependency"],
  [route.includes("accessToken(request)"), "same-origin API accepts bearer"],
  [client.includes('credentials: "omit"') && client.includes('redirect: "error"'), "client request boundary"],
  [page.includes("この画面は @ayumi だけが操作できます"), "operator notice"],
  [page.includes("利用権の付与やStripe契約の解約ではありません"), "scope notice"],
  [shell.includes('profile.handle.toLowerCase() === "ayumi"'), "navigation hidden for other accounts"],
  [sqlTest.includes("expected non-ayumi denial") && sqlTest.includes("expected direct service-role write denial"), "negative SQL authorization coverage"],
  [sqlTest.includes("same HQ and mikke ID must be idempotent") && sqlTest.includes("one grant and one revoke audit event"), "SQL lifecycle coverage"]
];

for (const [ok, label] of checks) {
  if (!ok) throw new Error(`billing exclusion admin contract failed: ${label}`);
}

console.log(`mikkeos_academy_billing_exclusion_admin_check_ok (${checks.length} checks)`);
