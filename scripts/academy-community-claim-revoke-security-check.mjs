import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const admin = readFileSync("lib/academy/community-link-admin.ts", "utf8");
const route = readFileSync("app/academy/api/community-links/revoke/route.ts", "utf8");
const client = readFileSync("lib/academy/community-links.ts", "utf8");
const settings = readFileSync("app/academy/settings/page.tsx", "utf8");

assert.match(admin, /^import "server-only";/);
assert.match(admin, /SUPABASE_SECRET_KEY/);
assert.match(admin, /SUPABASE_SERVICE_ROLE_KEY/);
assert.doesNotMatch(admin, /NEXT_PUBLIC_(?:SUPABASE_)?(?:SECRET|SERVICE)/);
assert.match(admin, /persistSession: false/);
assert.match(admin, /autoRefreshToken: false/);
assert.match(admin, /detectSessionInUrl: false/);
assert.match(admin, /auth\.getUser\(input\.accessToken\)/);
assert.match(admin, /userData\.user\.is_anonymous/);
assert.match(admin, /academy_list_my_community_link_options/);
assert.match(admin, /mapping\.id === input\.mappingId/);
assert.match(admin, /selectedMapping\.isCurrent/);
assert.match(admin, /selectedMapping\.status !== "active"/);
assert.match(admin, /community_academy_entitlement_claims/);
assert.match(admin, /\.eq\("mapping_id", input\.mappingId\)/);
assert.match(admin, /\.eq\("status", "active"\)/);
assert.match(admin, /claim\.ends_at === null/);
assert.match(admin, /community_sync_academy_entitlement/);
assert.match(admin, /p_source_reference: claim\.source_reference/);
assert.match(admin, /p_status: "revoked"/);
assert.ok(
  admin.indexOf("academy_list_my_community_link_options") < admin.indexOf("const adminClient = createRequestAdminClient()"),
  "The user-scoped authorization check must finish before the admin client is created."
);

assert.match(route, /authorization\?\.startsWith\("Bearer "\)/);
assert.match(route, /Cache-Control": "no-store, max-age=0/);
assert.match(route, /uuidPattern\.test\(body\.headquartersId\)/);
assert.match(route, /uuidPattern\.test\(body\.mappingId\)/);
assert.doesNotMatch(route, /body\.(?:userId|sourceReference)/);
assert.doesNotMatch(route, /source_reference|user_id/);

assert.match(client, /sessionData\.session\?\.access_token/);
assert.match(client, /Authorization: `Bearer \$\{accessToken\}`/);
assert.match(client, /cache: "no-store"/);
assert.match(client, /safeClaimStopMessages/);
assert.doesNotMatch(client, /JSON\.stringify\(\{[^}]*userId/s);

assert.match(settings, /window\.confirm/);
assert.match(settings, /Academy由来の利用権を停止/);
assert.match(settings, /listMyAcademyCommunityLinkOptions\(headquarters\.id\)/);
assert.match(settings, /communityLinkHasActiveClaims/);
assert.match(settings, /getAcademyCommunityClaimStopErrorMessage/);

console.log("academy-community-claim-revoke-security-check: ok");
