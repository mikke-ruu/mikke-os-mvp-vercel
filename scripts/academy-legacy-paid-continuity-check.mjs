import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/20260904143000_academy_legacy_paid_access_continuity.sql", "utf8");
const sqlTest = fs.readFileSync("supabase/tests/academy_legacy_paid_access_continuity.sql", "utf8");
const shell = fs.readFileSync("components/academy/AcademyShell.tsx", "utf8");
const settings = fs.readFileSync("app/academy/settings/page.tsx", "utf8");
const courseAccess = fs.readFileSync("lib/academy/course-creation-access.ts", "utf8");

for (const marker of [
  "legacy_paid_continuity",
  "2026-09-03 10:30:00+00",
  "v_eligible_count <> 2",
  "source_kind in ('verified_paid', 'verified_trial')",
  "expires_at"
]) {
  if (!migration.includes(marker)) throw new Error(`migration marker missing: ${marker}`);
}

if (/headquarters\.name\s*=|headquarters\.handle\s*=|\('mikkeOS official Academy'/iu.test(migration)) {
  throw new Error("legacy continuity must be selected by prior access state, not a headquarters name");
}
if (!/null\r?\n  from public\.academy_headquarters/u.test(migration)) {
  throw new Error("legacy continuity must not be converted to an expiring test grant");
}
if (/insert\s+into\s+public\.academy_headquarters/iu.test(migration)) {
  throw new Error("continuity migration must not create or merge headquarters");
}

for (const marker of [
  "academy_legacy_paid_access_continuity_ok",
  "status = 'internal_grant' and can_manage_drafts and can_use_live_features",
  "another user must not gain owner access",
  "anonymous auth must not gain owner access"
]) {
  if (!sqlTest.includes(marker)) throw new Error(`SQL test marker missing: ${marker}`);
}

if (!shell.includes("getAcademyAccessNotice(headquartersAccess)")) throw new Error("shell access notice missing");
if (!shell.includes("Academy利用料金を確認する")) throw new Error("billing recovery link missing");
if (!settings.includes("getMyAcademyHeadquartersAccess(hq.id)")) throw new Error("settings access state check missing");
if (!courseAccess.includes("getAcademyAccessNotice(access)")) throw new Error("course creation reason mapping missing");

console.log("academy_legacy_paid_continuity_contract_ok");
