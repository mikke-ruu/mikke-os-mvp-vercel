import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const apps = read("lib/mikkeos/apps.ts");
const managementLayout = read("app/apps/media/layout.tsx");
const publicLayout = read("app/media/layout.tsx");
const publicLoader = read("lib/media-app/public-loader.ts");
const publicContract = read("lib/media-app/public-contract.ts");
const publicHome = read("components/media-app/PublicMediaHome.tsx");
const publicArticle = read("components/media-app/PublicMediaArticle.tsx");
const publicSitePage = read("app/media/[mediaSlug]/page.tsx");
const publicArticlePage = read("app/media/[mediaSlug]/[articleSlug]/page.tsx");
const authGate = read("components/AuthGate.tsx");
const sqlTest = read("supabase/tests/media_free_foundation_rls.sql");

assert.match(apps, /NEXT_PUBLIC_MEDIA_FREE_ENABLED[\s\S]*\["media" as AppKey\]/);
for (const layout of [managementLayout, publicLayout]) {
  assert.match(layout, /process\.env\.NODE_ENV !== "development"/);
  assert.match(layout, /NEXT_PUBLIC_MEDIA_FREE_ENABLED/);
  assert.match(layout, /notFound\(\)/);
}
assert.match(publicLoader, /import "server-only"/);
assert.match(publicLoader, /process\.env\.NODE_ENV === "development"/);
for (const page of [publicSitePage, publicArticlePage]) {
  assert.match(page, /process\.env\.NODE_ENV !== "development"/);
  assert.match(page, /NEXT_PUBLIC_MEDIA_FREE_ENABLED/);
  assert.match(page, /notFound\(\)/);
  assert.match(page, /generateMetadata/);
  assert.match(page, /mediaCanonicalUrl/);
}
assert.doesNotMatch(`${publicHome}\n${publicArticle}\n${publicContract}`, /localStorage|getMediaSiteBySlug|getPublishedMediaArticle|listMediaArticles/);
assert.doesNotMatch(publicContract, /imageAssetId/);
assert.match(publicContract, /https:\/\/app\.mikke-os\.com/);
assert.match(authGate, /pathname\.startsWith\("\/apps\/media"\)[\s\S]*previewMode === "integration"/);
for (const sentinel of [
  "MEDIA_ANON_CREATED_SITE",
  "MEDIA_ANON_CALLED_CREATE_RPC",
  "MEDIA_CREATE_DID_NOT_MARK_OWNED",
  "MEDIA_FREE_LIMIT_BYPASSED",
  "MEDIA_DIRECT_SITE_INSERT_WORKED",
  "MEDIA_DIRECT_STATUS_UPDATE_WORKED",
  "MEDIA_CLIENT_VERSION_MUTATION_WORKED",
  "MEDIA_OWNER_VERSION_MUTATION_WORKED",
  "MEDIA_PUBLISHED_SLUG_CHANGED",
  "MEDIA_PUBLISHED_SITE_SLUG_CHANGED",
  "MEDIA_RESERVED_SLUG_REUSED",
  "MEDIA_FOREIGN_ASSET_PUBLISHED",
  "MEDIA_UNSAFE_BLOCK_PUBLISHED",
  "MEDIA_OTHER_USER_READ_SITE",
  "MEDIA_DRAFT_LEAKED_PUBLICLY"
]) assert.match(sqlTest, new RegExp(sentinel));

console.log("Media Free release boundary: PASS");
