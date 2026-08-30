import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migration = readFileSync(
  join(root, "supabase/migrations/20260821043626_academy_access_context_and_creation_gate.sql"),
  "utf8"
);
const headquarters = readFileSync(join(root, "lib/academy/headquarters.ts"), "utf8");
const shell = readFileSync(join(root, "components/academy/AcademyShell.tsx"), "utf8");
const dashboard = readFileSync(join(root, "app/academy/page.tsx"), "utf8");

assert.match(migration, /create table if not exists public\.academy_headquarters_creation_entitlements/);
assert.match(migration, /drop policy if exists "hq insert own"/);
assert.match(migration, /revoke insert on table public\.academy_headquarters from anon, authenticated/);
assert.match(migration, /create or replace function public\.academy_create_headquarters\(p_name text\)/);
assert.match(migration, /for update skip locked/);
assert.match(migration, /create or replace function public\.academy_list_my_contexts\(\)/);
assert.match(migration, /instructor\.registration_status = 'registered'/);
assert.match(migration, /instructor\.is_active = true/);
assert.doesNotMatch(
  migration.match(/academy_get_my_manageable_headquarters\(\)[\s\S]*?\$\$;/)?.[0] ?? "",
  /limit 1/
);
assert.doesNotMatch(headquarters, /\.from\("academy_headquarters"\)[\s\S]*?\.insert\(/);
assert.match(headquarters, /academy_create_headquarters/);
assert.match(shell, /hasPortalAccess/);
assert.match(shell, /canSwitchPortal \?/);
assert.match(shell, /contextCount > 1/);
assert.match(dashboard, /getAcademyOnboardingEligibility/);
assert.match(dashboard, /7日間お試しを始める/);
assert.match(dashboard, /契約確認済みの本部を作成する/);

console.log("academy access context and creation gate checks passed");
