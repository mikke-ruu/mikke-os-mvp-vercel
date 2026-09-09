import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../supabase/migrations/20260902054001_media_free_foundation.sql", import.meta.url), "utf8");
for (const table of [
  "media_sites",
  "media_categories",
  "media_articles",
  "media_article_versions",
  "media_article_version_assets",
  "media_published_slugs",
  "media_terms_acceptances",
  "media_article_publication_attestations",
  "media_publication_outbox"
]) {
  assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
}
assert.doesNotMatch(sql, /unique \(owner_id\)/i);
assert.match(sql, /default_locale/i);
assert.match(sql, /translation_group_id/i);
assert.match(sql, /unique \(site_id, locale, slug\)/i);
assert.match(sql, /private\.media_is_human_user/i);
assert.match(sql, /is_anonymous/i);
assert.match(sql, /security definer\s+set search_path = ''/i);
assert.match(sql, /revoke execute on function public\.media_create_site[\s\S]*public\.media_publish_article/i);
assert.match(sql, /grant execute on function public\.media_create_site[\s\S]*public\.media_publish_article\(uuid,text,boolean,boolean,boolean\)[\s\S]*to authenticated/i);
assert.doesNotMatch(sql, /grant\s+select[^;]*media_articles[^;]*anon/i);
assert.match(sql, /current_published_version_id/i);
assert.match(sql, /media_article_versions_immutable/i);
assert.match(sql, /media_sites_published_slug_immutable/i);
assert.match(sql, /MEDIA_PUBLISHED_SITE_SLUG_IMMUTABLE/);
assert.match(sql, /content_sha256/i);
assert.match(sql, /revision_hash/i);
assert.match(sql, /media_publication_outbox/i);
assert.match(sql, /media_article_publication_attestations/i);
assert.match(sql, /media_create_site\(text,text,text,text,text\)/i);
assert.match(sql, /mikke_app_entitlements/i);
assert.match(sql, /pg_advisory_xact_lock/i);
assert.doesNotMatch(sql, /grant insert \(owner_id[^;]+media_sites/i);
assert.doesNotMatch(sql, /grant\s+update\s+on\s+public\.media_articles/i);
assert.doesNotMatch(sql, /returns table \(id uuid/i);
console.log("Media Free migration contract: PASS");
