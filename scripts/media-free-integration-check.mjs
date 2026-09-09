import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { MediaSessionBoundary } = await import("../lib/media-app/integration.ts");
const {
  createMediaPublicReader,
  mediaCanonicalUrl,
  parseMediaPublicArticle
} = await import("../lib/media-app/public-contract.ts");

const site = (name = "A") => ({
  id: `site-${name}`, name, slug: name.toLowerCase(), description: "", author_name: name,
  default_locale: "ja-JP", publishing_policy: "direct_owner", is_published: false,
  created_at: "2026-09-03T00:00:00.000Z", updated_at: "2026-09-03T00:00:00.000Z"
});

class FakeManagementTransport {
  session = { subject: "A", isAnonymous: false };
  listeners = new Set();
  rows = new Map([["A", [site("A")]],["B", [site("B")]]]);
  calls = 0;
  pending = null;
  sessionPending = null;
  failCreate = false;
  createdFor = [];
  readSession = async () => {
    const session = this.session;
    const pending = this.sessionPending?.promise;
    if (pending) await pending;
    return session;
  };
  subscribeSessionChange = (listener) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  setSession = (session) => { this.session = session; this.listeners.forEach((listener) => listener()); };
  hold = () => { this.pending = {}; this.pending.promise = new Promise((resolve) => { this.pending.resolve = resolve; }); };
  release = () => { this.pending?.resolve(); this.pending = null; };
  holdSessionRead = () => { this.sessionPending = {}; this.sessionPending.promise = new Promise((resolve) => { this.sessionPending.resolve = resolve; }); };
  releaseSessionRead = () => { this.sessionPending?.resolve(); this.sessionPending = null; };
  listDirectOwnerSites = async () => {
    this.calls += 1;
    const subject = this.session?.subject;
    const pending = this.pending?.promise;
    if (pending) await pending;
    return this.rows.get(subject) ?? [];
  };
  createDirectOwnerSite = async () => {
    this.calls += 1;
    const subject = this.session?.subject;
    const pending = this.pending?.promise;
    if (pending) await pending;
    if (this.failCreate) throw new Error("CREATE_FAILED");
    this.createdFor.push(subject);
    return `created-${subject}`;
  };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const preflightTransport = new FakeManagementTransport();
const preflightBoundary = new MediaSessionBoundary(preflightTransport);
preflightTransport.holdSessionRead();
const preflightCreate = preflightBoundary.createMyFreeMedia({ name: "A", slug: "a", description: "", authorName: "A" });
await tick();
preflightTransport.setSession({ subject: "B", isAnonymous: false });
preflightTransport.releaseSessionRead();
assert.deepEqual(await preflightCreate, { status: "stale" });
assert.equal(preflightTransport.calls, 0);
preflightBoundary.dispose();

const transport = new FakeManagementTransport();
const boundary = new MediaSessionBoundary(transport);
assert.deepEqual(await boundary.listMyFreeMedia(), { status: "ok", value: [site("A")] });
transport.setSession({ subject: "B", isAnonymous: false });
assert.deepEqual(await boundary.listMyFreeMedia(), { status: "ok", value: [site("B")] });
transport.setSession({ subject: "anon", isAnonymous: true });
const callsBeforeAnonymous = transport.calls;
assert.deepEqual(await boundary.listMyFreeMedia(), { status: "unauthenticated" });
assert.equal(transport.calls, callsBeforeAnonymous);

transport.setSession({ subject: "A", isAnonymous: false });
transport.hold();
const delayedList = boundary.listMyFreeMedia();
await tick();
transport.setSession({ subject: "B", isAnonymous: false });
transport.release();
assert.deepEqual(await delayedList, { status: "stale" });

transport.setSession({ subject: "A", isAnonymous: false });
transport.hold();
const restoredSubjectList = boundary.listMyFreeMedia();
await tick();
transport.setSession(null);
transport.setSession({ subject: "A", isAnonymous: false });
transport.release();
assert.deepEqual(await restoredSubjectList, { status: "stale" });

transport.hold();
const delayedCreate = boundary.createMyFreeMedia({ name: "A", slug: "a", description: "", authorName: "A" });
await tick();
transport.setSession({ subject: "B", isAnonymous: false });
transport.release();
assert.deepEqual(await delayedCreate, { status: "stale" });
assert.deepEqual(transport.createdFor, ["A"]);

transport.setSession({ subject: "A", isAnonymous: false });
transport.failCreate = true;
await assert.rejects(boundary.createMyFreeMedia({ name: "A", slug: "a", description: "", authorName: "A" }), /CREATE_FAILED/);
assert.deepEqual(transport.createdFor, ["A"]);

transport.rows.set("A", [{ ...site("A"), publishing_policy: "managed_brand" }]);
await assert.rejects(boundary.listMyFreeMedia(), /MEDIA_MANAGED_BRAND_IN_FREE_RESULT/);
boundary.dispose();

const publicSite = { name: "Media", slug: "media", description: "説明", authorName: "編集部", locale: "ja-JP", categories: ["お知らせ"] };
const publicSummary = { title: "記事", slug: "article", excerpt: "概要", categoryName: "お知らせ", coverImageUrl: "", locale: "ja-JP", versionNumber: 1, revisionHash: "a".repeat(64), publishedAt: "2026-09-03T00:00:00.000Z", updatedAt: "2026-09-03T00:00:00.000Z" };
const publicArticle = { ...publicSummary, blocks: [{ id: "p1", type: "paragraph", text: "公開本文" }] };
const publicReader = createMediaPublicReader({
  readSite: async () => publicSite,
  readArticles: async () => [publicSummary],
  readArticle: async () => publicArticle
});
assert.deepEqual(await publicReader.site("media"), publicSite);
assert.deepEqual(await publicReader.articles("media"), [publicSummary]);
assert.deepEqual(await publicReader.article("media", "article"), publicArticle);
for (const leaked of [
  { ...publicArticle, owner_id: "secret" },
  { ...publicArticle, site_id: "secret" },
  { ...publicArticle, article_id: "secret" },
  { ...publicArticle, draft_blocks: [] },
  { ...publicArticle, status: "draft" },
  { ...publicArticle, blocks: [{ id: "p1", type: "image", imageAssetId: "secret", imageUrl: "https://example.com/image.jpg" }] },
  { ...publicArticle, blocks: [{ id: "p1", type: "link", title: "bad", url: "javascript:alert(1)" }] },
  { ...publicArticle, blocks: [{ id: "p1", type: "image", imageUrl: "https://example.com/image.jpg", alt: "", caption: {} }] },
  { ...publicArticle, blocks: [{ id: "p1", type: "quote", text: "引用", attribution: {} }] },
  { ...publicArticle, blocks: [{ id: "p1", type: "heading", text: "見出し", level: "oops" }] },
  { ...publicArticle, blocks: [{ id: "p1", type: "divider", url: "https://example.com" }] }
]) assert.equal(parseMediaPublicArticle(leaked), null);
assert.equal(mediaCanonicalUrl("media"), "https://app.mikke-os.com/media/media");
assert.equal(mediaCanonicalUrl("media", "article"), "https://app.mikke-os.com/media/media/article");
assert.equal(mediaCanonicalUrl("../bad"), null);

const sources = [
  "lib/media-app/integration.ts", "lib/media-app/database.ts", "lib/media-app/public-contract.ts",
  "lib/media-app/public-loader.ts", "app/media/layout.tsx", "app/media/[mediaSlug]/page.tsx",
  "app/media/[mediaSlug]/[articleSlug]/page.tsx"
].map((path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")).join("\n");
assert.doesNotMatch(sources, /mikke\.media\.free\.v1|ownerProfileId|localStorage/);
assert.match(sources, /process\.env\.NODE_ENV !== "development"/);
assert.match(sources, /https:\/\/app\.mikke-os\.com/);
assert.match(sources, /notFound\(\)/);
console.log("Media Free Auth/public integration: PASS");
