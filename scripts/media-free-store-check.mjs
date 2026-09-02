import assert from "node:assert/strict";

const values = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear()
  }
};

const store = await import("../lib/media-app/store.ts");

const site = store.createMediaSite({
  ownerProfileId: "profile-1",
  name: "mikkeOS Media",
  slug: "mikkeos-media",
  description: "お知らせと使い方",
  authorName: "mikkeOS編集部"
});
assert.equal(store.getOwnedMedia("profile-1")?.id, site.id);
assert.throws(() => store.createMediaSite({ ownerProfileId: "profile-1", name: "2つ目", slug: "second", description: "", authorName: "編集部" }), /1つのMedia/);

let article = store.saveMediaArticle(site.id, null, {
  title: "Mediaを作り始めました",
  slug: "media-start",
  excerpt: "最初のお知らせです。",
  category: "お知らせ",
  coverImageUrl: "",
  blocks: [{ id: "block-1", type: "paragraph", text: "公開版の本文" }]
});
assert.equal(article.publishedSnapshot, null);

article = store.publishMediaArticle(article.id);
assert.equal(article.publishedSnapshot?.blocks[0].text, "公開版の本文");
assert.equal(store.getPublishedMediaArticle(site.id, "media-start")?.id, article.id);

article = store.saveMediaArticle(site.id, article.id, {
  title: article.title,
  slug: article.slug,
  excerpt: article.excerpt,
  category: article.category,
  coverImageUrl: article.coverImageUrl,
  blocks: [{ id: "block-1", type: "paragraph", text: "編集中の本文" }]
});
assert.equal(article.blocks[0].text, "編集中の本文");
assert.equal(article.publishedSnapshot?.blocks[0].text, "公開版の本文");

article = store.publishMediaArticle(article.id);
assert.equal(article.publishedSnapshot?.blocks[0].text, "編集中の本文");
store.unpublishMediaArticle(article.id);
assert.equal(store.getPublishedMediaArticle(site.id, "media-start"), null);

console.log("Media Free store contract: PASS");
