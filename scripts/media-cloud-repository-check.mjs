import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
const require = createRequire(import.meta.url);
function load(name) {
  const filename = new URL(`../lib/media-app/${name}.ts`, import.meta.url);
  const output = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, require: (id) => id.startsWith("./") ? load(id.slice(2)) : require(id), crypto: globalThis.crypto });
  return module.exports;
}
const { createMediaCloudRepository } = load("cloud-repository");
function fixture() {
  let user = { id: "user-a", is_anonymous: false };
  const listeners = new Set();
  const calls = [];
  const site = { id: "site-a", name: "Test", slug: "test", description: "", author_name: "Author", publishing_policy: "direct_owner", created_at: "2026-09-09", updated_at: "2026-09-09" };
  let beforeResult;
  const client = {
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
      onAuthStateChange(listener) { listeners.add(listener); return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } }; }
    },
    from(table) {
      calls.push({ table });
      const query = { select() { return this; }, eq() { return this; }, order() { return this; }, returns() { return this; },
        then(resolve, reject) { const action = beforeResult; beforeResult = undefined; action?.(); return Promise.resolve({ data: table === "media_sites" ? [site] : [], error: null }).then(resolve, reject); } };
      return query;
    },
    async rpc(name, values) { calls.push({ name, values }); return { data: "site-a", error: null }; }
  };
  return { repo: createMediaCloudRepository(client, "user-a"), calls, listeners, switchTo(next) { user = next; for (const listener of listeners) listener("SIGNED_IN"); }, beforeResult(action) { beforeResult = action; } };
}
{
  const f = fixture();
  const value = await f.repo.getOwnedMedia("forged-profile");
  assert.equal(value.ownerProfileId, "user-a");
  assert.equal(f.listeners.size, 0);
}
{
  const f = fixture();
  f.switchTo({ id: "anonymous", is_anonymous: true });
  await assert.rejects(() => f.repo.getOwnedMedia("user-a"));
  assert.equal(f.calls.length, 0);
}
{
  const f = fixture();
  f.switchTo({ id: "user-b", is_anonymous: false });
  await assert.rejects(() => f.repo.getOwnedMedia("user-b"));
  await assert.rejects(() => f.repo.createMediaSite({ ownerProfileId: "user-b", name: "A draft", slug: "a-draft", description: "", authorName: "A" }));
  assert.equal(f.calls.length, 0);
  assert.equal(f.listeners.size, 0);
}
{
  const f = fixture();
  f.beforeResult(() => { f.switchTo({ id: "user-b", is_anonymous: false }); f.switchTo({ id: "user-a", is_anonymous: false }); });
  await assert.rejects(() => f.repo.getOwnedMedia("user-a"));
  assert.equal(f.listeners.size, 0);
}
{
  const f = fixture();
  await f.repo.createMediaSite({ ownerProfileId: "forged-owner", name: "Test", slug: "test", description: "", authorName: "Author" });
  const call = f.calls.find((item) => item.name === "media_create_site");
  assert.ok(call);
  assert.ok(!JSON.stringify(call.values).includes("forged-owner"));
  assert.deepEqual(Object.keys(call.values).sort(), ["p_author_name", "p_default_locale", "p_description", "p_name", "p_slug"]);
}
{
  const f = fixture();
  await assert.rejects(() => f.repo.publishMediaArticle("article-a"));
  assert.equal(f.calls.length, 0);
  await assert.rejects(() => f.repo.publishMediaArticle("article-a", { termsVersion: "v1", rightsConfirmed: false, privacyConfirmed: true, affiliateFreeConfirmed: true }));
  assert.equal(f.calls.length, 0);
}
{
  const f = fixture();
  await assert.rejects(() => f.repo.updateMediaAuthorProfile("site-a", { authorBio: "bio", storyUrl: "", showStory: false }));
  await assert.rejects(() => f.repo.createMediaSite({ ownerProfileId: "x", name: "Test", slug: "test", description: "", authorName: "Author", authorBio: "must-not-drop" }));
  assert.equal(f.calls.length, 0);
}
console.log("Media cloud repository boundary checks PASS (subject, anonymous, A/B/A race, allowlist, consent, unsupported fields).");
