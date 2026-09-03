import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260902084655_community_content_validation_record_fix.sql",
    import.meta.url,
  ),
  "utf8",
);
const test = readFileSync(
  new URL("../supabase/tests/community_content_validation_record_fix.sql", import.meta.url),
  "utf8",
);

assert.match(migration, /create or replace function community_private\.validate_community_content\(\)/);
assert.match(migration, /security definer/);
assert.match(migration, /set search_path = pg_catalog, public, community_private/);
assert.match(migration, /to_jsonb\(new\) ->> 'title'/);
assert.doesNotMatch(migration, /new\.title/);
assert.match(migration, /revoke all on function community_private\.validate_community_content\(\)[\s\S]*from public, anon, authenticated/);
assert.equal((migration.match(/create or replace function/g) ?? []).length, 1);

for (const marker of [
  "blocked-fixture in title",
  "blocked-fixture in comment",
  "blocked-fixture in chat",
  "Safe post body",
  "Safe comment body",
  "Safe chat body",
  "New member posting limit reached",
  "Owner bypass",
  "moderator content",
  "Outsider post",
  '"is_anonymous":true',
  "community_content_validation_record_fix_test_ok",
]) {
  assert.match(test, new RegExp(marker.replaceAll(".", "\\.")), `missing content regression marker: ${marker}`);
}
assert.match(test, /begin;/i);
assert.match(test, /rollback;/i);

console.log("community_content_validation_contract_ok");
