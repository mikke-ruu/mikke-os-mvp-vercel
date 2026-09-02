import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../lib/media-app/database.ts", import.meta.url), "utf8");
assert.match(source, /supabase\.rpc\("media_create_site"/);
assert.match(source, /supabase\.rpc\("media_publish_article"/);
assert.match(source, /supabase\.rpc\("media_unpublish_article"/);
assert.match(source, /\.from\("media_sites"\)/);
assert.match(source, /\.eq\("publishing_policy", "direct_owner"\)/);
assert.doesNotMatch(source, /localStorage|mikke\.media\.free\.v1|ownerProfileId/);
assert.doesNotMatch(source, /p_owner|user_id\s*:/);
console.log("Media Free database adapter boundary: PASS");
