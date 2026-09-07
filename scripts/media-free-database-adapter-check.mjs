import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const wrapper = readFileSync(new URL("../lib/media-app/database.ts", import.meta.url), "utf8");
const source = readFileSync(new URL("../lib/media-app/database-operations.ts", import.meta.url), "utf8");
assert.match(wrapper, /createMediaDatabaseOperations\(supabase\)/);
assert.match(source, /client\.rpc\("media_create_site"/);
assert.match(source, /client\.rpc\("media_publish_article"/);
assert.match(source, /client\.rpc\("media_unpublish_article"/);
assert.match(source, /\.from\("media_sites"\)/);
assert.match(source, /\.eq\("publishing_policy", "direct_owner"\)/);
assert.doesNotMatch(source, /localStorage|mikke\.media\.free\.v1|ownerProfileId/);
assert.doesNotMatch(source, /p_owner|user_id\s*:/);
console.log("Media Free database adapter boundary: PASS");

const { createMediaDatabaseOperations } = await import("../lib/media-app/database-operations.ts");
const calls = [];
const chain = {
  insert(value) { calls.push(["insert", value]); return this; },
  update(value) { calls.push(["update", value]); return this; },
  select(value) { calls.push(["select", value]); return this; },
  eq(key, value) { calls.push(["eq", key, value]); return this; },
  async single() { return { data: { id: "article" }, error: null }; },
  async maybeSingle() { return { data: null, error: null }; }
};
const operations = createMediaDatabaseOperations({
  from(table) { assert.equal(table, "media_articles"); return chain; }
});
const input = {
  title: "Synthetic draft", slug: "synthetic-draft", blocks: [],
  owner_id: "injected", site_id: "injected", status: "published",
  current_published_version_id: "injected"
};
await operations.createMediaArticleDraftInDatabase("site", input);
await operations.updateMediaArticleDraftInDatabase("article", input);
assert.equal(await operations.readMediaArticleDraftFromDatabase("other"), null);
const insert = calls.find(([method]) => method === "insert")[1];
const update = calls.find(([method]) => method === "update")[1];
assert.deepEqual(insert, {
  site_id: "site", title: input.title, slug: input.slug,
  excerpt: "", locale: "ja-JP", draft_blocks: []
});
assert.deepEqual(update, {
  title: input.title, slug: input.slug, excerpt: "", locale: "ja-JP", draft_blocks: []
});
assert.ok(calls.filter(([method]) => method === "select").every(([, columns]) =>
  !/owner_id|status|current_published_version_id|\*/.test(columns)));
console.log("Media Free injected operations / publication-field exclusion: PASS");