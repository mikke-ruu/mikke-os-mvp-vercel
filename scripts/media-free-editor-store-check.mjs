import assert from "node:assert/strict";
const values = new Map();
globalThis.window = { localStorage: {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value)
} };
const store = await import("../lib/media-app/store.ts");
const makeSite = (n) => store.createMediaSite({ ownerProfileId: `person-${n}`, name: `Media ${n}`, slug: `media-${n}`, description: "unchanged", authorName: "Editor" });
const a = makeSite(1);
const b = makeSite(2);
const input = { title: "Article", slug: "", excerpt: "", category: "", coverImageUrl: "", blocks: [{ id: "p1", type: "paragraph", text: "本文の先頭です。" }] };
let article = store.saveMediaArticle(a.id, null, input);
assert.match(article.slug, /^[a-f0-9]{20}$/);
const slug = article.slug;
article = store.saveMediaArticle(a.id, article.id, { ...input, slug: "   " });
assert.equal(article.slug, slug);
assert.equal(article.excerpt, "");
const untouched = values.get(store.MEDIA_APP_STORAGE_KEY);
for (const invalid of ["日本語", "foo/bar", "hello world", "a--b", "-hello", "a".repeat(81)]) {
  assert.throws(() => store.saveMediaArticle(a.id, null, { ...input, slug: invalid }), /記事URL名/);
}
assert.throws(() => store.saveMediaArticle(a.id, null, { ...input, slug }), /すでにあります/);
assert.throws(() => store.saveMediaArticle(b.id, article.id, input), /このMedia/);
assert.throws(() => store.saveMediaArticle(a.id, "unknown", input), /このMedia/);
assert.throws(() => store.saveMediaArticle("unknown", null, input), /Mediaが見つかりません/);
assert.equal(values.get(store.MEDIA_APP_STORAGE_KEY), untouched);
const other = store.saveMediaArticle(b.id, null, { ...input, slug });
assert.equal(other.slug, slug);
const published = store.publishMediaArticle(article.id);
assert.equal(published.excerpt, "");
assert.equal(published.publishedSnapshot.excerpt, input.blocks[0].text);
const updated = store.saveMediaArticle(a.id, article.id, { ...input, slug: "new-url", blocks: [{ id: "p1", type: "paragraph", text: "改訂本文" }] });
assert.equal(updated.publishedSnapshot.excerpt, input.blocks[0].text);
assert.throws(() => store.saveMediaArticle(a.id, null, { ...input, slug }), /すでにあります/);
assert.equal(store.publishMediaArticle(article.id).publishedSnapshot.excerpt, "改訂本文");
store.saveMediaArticle(a.id, article.id, { ...input, excerpt: "手入力した概要" });
assert.equal(store.publishMediaArticle(article.id).publishedSnapshot.excerpt, "手入力した概要");
assert.equal(store.getMediaExcerpt([{ id: "p", type: "paragraph", text: "😀".repeat(151) }]), "😀".repeat(150));
assert.equal(store.getMediaExcerpt([{ id: "i", type: "image", imageUrl: "https://private.example/secret" }, { id: "p", type: "paragraph", text: " a\n b  " }, { id: "l", type: "list", items: ["c", "d"] }]), "a b c d");
const before = store.getMediaSite(a.id);
const added = store.addMediaCategory(a.id, "  新カテゴリー  ");
assert.deepEqual(added.categories, [...before.categories, "新カテゴリー"]);
for (const field of ["id", "name", "slug", "description", "authorName", "ownerProfileId", "createdAt"]) assert.equal(added[field], before[field]);
const storedAdded = values.get(store.MEDIA_APP_STORAGE_KEY);
assert.deepEqual(store.addMediaCategory(a.id, "新カテゴリー"), added);
assert.equal(values.get(store.MEDIA_APP_STORAGE_KEY), storedAdded);
assert.throws(() => store.addMediaCategory(a.id, " "), /入力/);
assert.throws(() => store.addMediaCategory(a.id, "あ".repeat(61)), /60文字/);
assert.throws(() => store.addMediaCategory("missing", "test"), /見つかりません/);
store.updateMediaSite(a.id, { ...added, categories: Array.from({ length: 100 }, (_, i) => `Category ${i}`) });
assert.equal(store.addMediaCategory(a.id, "Category 0").categories.length, 100);
assert.throws(() => store.addMediaCategory(a.id, "one more"), /100件/);
const randomUUID = crypto.randomUUID;
try {
  let attempts = 0;
  const conflict = slug + "0".repeat(12);
  const generated = "f".repeat(32);
  crypto.randomUUID = () => { attempts += 1; return attempts === 1 ? conflict : generated; };
  const regenerated = store.saveMediaArticle(b.id, null, input);
  assert.equal(attempts, 2);
  assert.equal(regenerated.slug, "f".repeat(20));
  crypto.randomUUID = () => conflict;
  const beforeFailure = values.get(store.MEDIA_APP_STORAGE_KEY);
  assert.throws(() => store.saveMediaArticle(b.id, null, input), /作成できません/);
  assert.equal(values.get(store.MEDIA_APP_STORAGE_KEY), beforeFailure);
} finally { crypto.randomUUID = randomUUID; }
console.log("Media Free editor store: blank/stable slug, collision, article scope, excerpt, category PASS");