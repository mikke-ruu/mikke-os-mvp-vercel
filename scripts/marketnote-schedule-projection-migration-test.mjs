import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const migration = readFileSync(
  resolve(here, "../supabase/migrations/20260825230706_marketnote_schedule_projection_foundation.sql"),
  "utf8"
);

for (const table of ["market_schedule_source_preferences", "market_schedule_projections"]) {
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security;`));
  assert.match(migration, new RegExp(`revoke all on table public\\.${table} from anon, authenticated;`));
}

assert.match(migration, /grant select on table public\.market_schedule_projections to authenticated;/);
assert.doesNotMatch(migration, /grant [^;]*(insert|update|delete)[^;]*market_schedule_projections to authenticated;/i);
assert.match(migration, /market_schedule_projections_select_owner/);
assert.match(migration, /market_schedule_projections_google_manual_occurrence_key/);
assert.match(migration, /market_schedule_source_preferences_google_manual_identity_check/);
assert.match(migration, /market_schedule_projections_google_manual_identity_check/);
assert.match(migration, /\(select auth\.uid\(\)\) = user_id/);
assert.match(migration, /is_anonymous/);
assert.match(migration, /unique \(user_id, source_service, source_calendar_key, source_record_id, occurrence_key\)/);
assert.match(migration, /ends_on_exclusive > starts_on/);
assert.match(migration, /ends_at is null or ends_at >= starts_at/);
assert.match(migration, /source_href not like '\/\/%'/);
assert.match(migration, /security invoker/);
assert.match(migration, /revoke all on function public\.set_marketnote_schedule_updated_at\(\) from public, anon, authenticated;/);

const projectionTable = migration.slice(
  migration.indexOf("create table public.market_schedule_projections"),
  migration.indexOf("comment on table public.market_schedule_projections")
);
for (const forbidden of [
  "description",
  "private_note",
  "public_note",
  "reflection",
  "photo",
  "amount",
  "payment",
  "activity_log",
  "story"
]) {
  assert.equal(projectionTable.includes(forbidden), false, `projection table must not contain ${forbidden}`);
}

console.log("marketnote schedule projection migration contract: ok");
