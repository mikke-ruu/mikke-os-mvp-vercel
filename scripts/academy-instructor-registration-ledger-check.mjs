import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20260820110909_academy_instructor_registration_ledger.sql", import.meta.url),
  "utf8"
);
const instructorData = readFileSync(new URL("../lib/academy/instructors.ts", import.meta.url), "utf8");
const instructorList = readFileSync(new URL("../app/academy/instructors/page.tsx", import.meta.url), "utf8");
const instructorDetail = readFileSync(new URL("../app/academy/instructors/[id]/page.tsx", import.meta.url), "utf8");

const requiredMigrationContracts = [
  "registration_status text not null default 'registered'",
  "check (registration_status in ('registered', 'withdrawn'))",
  'drop policy if exists "instructors delete hq"',
  "revoke delete on public.academy_instructors from anon, authenticated",
  "create or replace function public.academy_withdraw_instructor",
  "security definer",
  "revoke all on function public.academy_withdraw_instructor(uuid) from public, anon",
  "registration_status = 'withdrawn'",
  "withdrawn_at = now()",
  "is_active = false",
  "is_listed = false",
  "accepts_applications = false",
  "display_on_story = false",
  "and status = 'requested'",
  "and starts_at >= now()",
  "and status = 'planned'",
  "and instructor.registration_status = 'registered'",
  "private.academy_can_manage_headquarters(new.headquarters_id)",
  "and program.course_id = p_course_id",
  "and instructor.course_id = p_course_id",
  "and i.is_active = true",
  "revoke all on function public.academy_is_course_instructor(uuid, boolean)",
  "revoke all on function public.academy_is_instructor_self(uuid)"
];

for (const contract of requiredMigrationContracts) {
  assert.ok(migration.includes(contract), `Missing migration contract: ${contract}`);
}

assert.ok(!/delete\s+from\s+public\.academy_instructors/i.test(migration), "Migration must not delete instructor ledger rows");
assert.ok(instructorData.includes('.rpc("academy_withdraw_instructor"'), "Client must use the withdrawal RPC");
assert.ok(instructorList.includes("INSTRUCTOR_REGISTRATION_STATUS_LABELS"), "List must display registration status");
assert.ok(instructorDetail.includes("非公開の認定台帳"), "Detail must explain retained private ledger history");
assert.ok(instructorDetail.includes("origin && !isWithdrawn"), "Withdrawn instructors must not show a public URL or QR");

console.log("Academy instructor registration ledger contracts: OK");
