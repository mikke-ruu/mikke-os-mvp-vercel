import assert from "node:assert/strict";
import { createMediaPublicRpcTransport } from "../lib/media-app/public-rpc.ts";
import { createMediaPublicReader } from "../lib/media-app/public-contract.ts";

const article = { title: "公開記事", slug: "article", excerpt: "", category_name: "News", cover_image_url: "", blocks: [{ id: "p1", type: "paragraph", text: "公開本文" }], locale: "ja-JP", version_number: 1, revision_hash: "a".repeat(64), published_at: "2026-09-07T00:00:00Z", updated_at: "2026-09-07T00:00:00Z" };
const site = { name: "Media", slug: "media", description: "", author_name: "編集部", locale: "ja-JP", categories: [{ name: "News", slug: "news" }] };
let response = [article];
let error = null;
const calls = [];
const reader = createMediaPublicReader(createMediaPublicRpcTransport(async (name, args) => {
  calls.push({ name, args });
  return { data: response, error };
}));
const parsed = await reader.article("media", "article");
assert.equal(parsed.title, article.title);
assert.equal(parsed.revisionHash, article.revision_hash);
assert.deepEqual(calls.at(-1), { name: "media_public_article", args: { p_site_slug: "media", p_article_slug: "article", p_locale: null } });
assert.equal((await reader.articles("media"))[0].blocks, undefined);
assert.equal(calls.at(-1).args.p_limit, 50);
response = [site];
assert.deepEqual((await reader.site("media")).categories, ["News"]);
assert.equal(calls.at(-1).args.p_slug, "media");
const count = calls.length;
assert.equal(await reader.article("../bad", "article"), null);
assert.equal(await reader.site("media", "ja<script>"), null);
assert.equal(calls.length, count);
for (const bad of [[], null, [article, article], [{ ...article, owner_id: "private" }], [{ ...article, slug: "other" }], [{ ...article, blocks: [{ id: "im", type: "image", imageAssetId: "private", imageUrl: "/a.png", alt: "a" }] }], [{ ...article, blocks: [{ id: "p", type: "quote", text: "x", attribution: {} }] }]]) {
  response = bad;
  assert.equal(await reader.article("media", "article"), null);
}
const tokenUrl="/media/images/"+"b".repeat(64);
response=[{...article,cover_image_url:tokenUrl,blocks:[{id:"image",type:"image",imageUrl:tokenUrl,alt:"公開画像"}]}];
assert.equal((await reader.article("media","article")).coverImageUrl,tokenUrl);
for(const unsafe of ["/api/media/assets/11111111-1111-1111-1111-111111111111","https://storage.invalid/owner/private.webp",tokenUrl+"\n"]){
 response=[{...article,cover_image_url:unsafe}];assert.equal(await reader.article("media","article"),null);
 response=[{...article,blocks:[{id:"image",type:"image",imageUrl:unsafe,alt:"画像"}]}];assert.equal(await reader.article("media","article"),null);
}
response = [article];
assert.equal(await reader.article("media", "article", "en-US"), null);
assert.equal(await reader.articles("media", "en-US"), null);
error = { message: "private database details" };
await assert.rejects(reader.article("media", "article"), { message: "MEDIA_PUBLIC_RPC_FAILED" });
const rejectedReader = createMediaPublicReader(createMediaPublicRpcTransport(async () => {
  throw new Error("private connection details");
}));
await assert.rejects(rejectedReader.article("media", "article"), { message: "MEDIA_PUBLIC_RPC_FAILED" });
console.log("Media Free public RPC projection: PASS");
