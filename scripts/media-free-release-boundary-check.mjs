import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const apps = read("lib/mikkeos/apps.ts");
const managementLayout = read("app/apps/media/layout.tsx");
const publicLayout = read("app/media/layout.tsx");
const sqlTest = read("supabase/tests/media_free_foundation_rls.sql");

assert.match(apps, /hiddenCatalogAppKeys[^\n]*\[[^\]]*"media"/);
for (const layout of [managementLayout, publicLayout]) {
  assert.match(layout, /process\.env\.NODE_ENV !== "development"/);
  assert.match(layout, /notFound\(\)/);
}
for (const sentinel of [
  "MEDIA_ANON_CREATED_SITE",
  "MEDIA_DIRECT_STATUS_UPDATE_WORKED",
  "MEDIA_VERSION_MUTATION_WORKED",
  "MEDIA_PUBLISHED_SLUG_CHANGED",
  "MEDIA_RESERVED_SLUG_REUSED",
  "MEDIA_FOREIGN_ASSET_PUBLISHED",
  "MEDIA_UNSAFE_BLOCK_PUBLISHED",
  "MEDIA_OTHER_USER_READ_SITE",
  "MEDIA_DRAFT_LEAKED_PUBLICLY"
]) assert.match(sqlTest, new RegExp(sentinel));

console.log("Media Free release boundary: PASS");
