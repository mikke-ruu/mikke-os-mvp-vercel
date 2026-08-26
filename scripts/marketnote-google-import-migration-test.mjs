import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const migration = readFileSync(
  resolve(here, "../supabase/migrations/20260826011933_marketnote_manual_google_import_rpc.sql"),
  "utf8"
);

assert.match(migration, /security definer\s+set search_path = ''/);
assert.match(migration, /auth\.uid\(\)/);
assert.match(migration, /is_anonymous/);
assert.match(migration, /jsonb_array_length\(p_items\) not between 1 and 2000/);
assert.match(migration, /Duplicate occurrence in import request/);
assert.match(migration, /Import item contains unsupported fields/);
assert.match(migration, /source_service[^\n]*'google_manual'/);
assert.match(migration, /on conflict \(user_id, source_service, source_calendar_key, source_record_id, occurrence_key\)/);
assert.match(migration, /revoke all on function public\.marketnote_import_google_calendar_manual\(text, text, jsonb\)\s+from public, anon, authenticated;/);
assert.match(migration, /grant execute on function public\.marketnote_import_google_calendar_manual\(text, text, jsonb\)\s+to authenticated;/);

for (const forbidden of [
  "description",
  "attendee",
  "email",
  "meeting_url",
  "photo",
  "amount",
  "payment_status",
  "activity_logs",
  "story_achievements"
]) {
  assert.equal(migration.toLowerCase().includes(forbidden), false, `migration must not accept ${forbidden}`);
}

console.log("MarketNote Google manual import migration contract: ok");
