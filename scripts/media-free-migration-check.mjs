import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../supabase/migrations/20260902054001_media_free_foundation.sql", import.meta.url), "utf8");
for (const table of ["media_sites", "media_categories", "media_articles", "media_article_versions"]) {
  assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
}
assert.match(sql, /unique \(owner_id\)/i);
assert.match(sql, /security definer\s+set search_path = ''/i);
assert.match(sql, /revoke execute on function public\.media_publish_article/i);
assert.match(sql, /grant execute on function public\.media_publish_article\(uuid\).*authenticated/i);
assert.doesNotMatch(sql, /grant\s+select[^;]*media_articles[^;]*anon/i);
assert.match(sql, /current_published_version_id/i);
assert.match(sql, /for update of a/i);
console.log("Media Free migration contract: PASS");
