import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20260825222427_community_academy_linked_room_entitlements.sql", import.meta.url),
  "utf8",
);
const uiMigration = readFileSync(
  new URL("../supabase/migrations/20260826011738_community_academy_link_acceptance_ui_contract.sql", import.meta.url),
  "utf8",
);
const test = readFileSync(
  new URL("../supabase/tests/community_academy_linked_room_entitlements_test.sql", import.meta.url),
  "utf8",
);
const client = readFileSync(new URL("../lib/community/client.ts", import.meta.url), "utf8");
const types = readFileSync(new URL("../lib/community/types.ts", import.meta.url), "utf8");
const acceptancePage = readFileSync(
  new URL("../app/community/academy-invitations/[invitationId]/page.tsx", import.meta.url),
  "utf8",
);
const communityApp = readFileSync(new URL("../components/community/CommunityApp.tsx", import.meta.url), "utf8");

function functionSlice(sql, start, end) {
  const startIndex = sql.indexOf(start);
  const endIndex = sql.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0 && endIndex > startIndex, `Missing SQL function slice: ${start}`);
  return sql.slice(startIndex, endIndex);
}

const acceptFunction = functionSlice(
  migration,
  "create or replace function public.community_accept_academy_access_invitation",
  "revoke all on function public.community_accept_academy_access_invitation",
);
const syncFunction = functionSlice(
  migration,
  "create or replace function public.community_sync_academy_entitlement",
  "revoke all on function public.community_sync_academy_entitlement",
);
const createPaymentFunction = functionSlice(
  migration,
  "create or replace function public.community_create_payment_claim",
  "revoke all on function public.community_create_payment_claim",
);
const reviewPaymentFunction = functionSlice(
  migration,
  "create or replace function public.community_review_payment_claim",
  "revoke all on function public.community_review_payment_claim",
);
const mappingGuardFunction = functionSlice(
  migration,
  "create or replace function community_private.guard_academy_mapping_version",
  "revoke all on function community_private.guard_academy_invitation_identity",
);
const upsertAcademyLinkFunction = functionSlice(
  uiMigration,
  "create or replace function public.academy_upsert_community_room_link",
  "revoke all on function public.academy_upsert_community_room_link",
);
const listAcademyLinkFunction = functionSlice(
  uiMigration,
  "create or replace function public.academy_list_my_community_link_options",
  "revoke all on function public.academy_list_my_community_link_options",
);

assert.match(migration, /academy_subscription/);
assert.match(migration, /access_scope in \('community', 'linked_rooms'\)/);
assert.match(migration, /membership\.access_scope = 'community' and room\.access_type = 'free'/);
assert.match(migration, /community_academy_access_invitations/);
assert.match(migration, /All required Community documents must be accepted/);
assert.match(migration, /community_access_source_mappings/);
assert.match(migration, /provider_type = 'academy_subscription'/);
assert.match(migration, /Community membership is suspended/);
assert.match(migration, /membership\.access_scope = 'community'[\s\S]*community_events/);
assert.match(migration, /membership\.access_scope = 'community'[\s\S]*community_resources/);
assert.match(migration, /source_reference = pg_catalog\.btrim\(p_source_reference\)/);
assert.match(migration, /source <> 'academy_subscription'/);
assert.match(migration, /This access is already included with an active Academy benefit/);
assert.match(migration, /revoke insert on table public\.community_payment_claims from authenticated/);
assert.match(migration, /drop policy if exists "staff can review payment claims"/);
assert.match(migration, /community_review_payment_claim/);
assert.match(migration, /Resolve the pending Community payment claim before accepting Academy access/);
assert.match(migration, /Revoke active Academy claims before changing or archiving this mapping/);
assert.match(mappingGuardFunction, /claim\.status = 'active'\s+and \(claim\.ends_at is null or claim\.ends_at > pg_catalog\.now\(\)\)/);
assert.doesNotMatch(mappingGuardFunction, /claim\.starts_at <= pg_catalog\.now\(\)/);
assert.match(migration, /Academy invitation source identity is immutable/);
assert.match(migration, /Academy entitlement source identity is immutable/);
assert.match(migration, /invitation\.ends_at is null or invitation\.ends_at > pg_catalog\.now\(\)/);
assert.doesNotMatch(migration, /grant select on table public\.community_academy_(?:access_invitations|entitlement_claims) to authenticated/);
for (const match of migration.matchAll(/security definer\s+set search_path = ([^\n]+)/gi)) {
  assert.equal(match[1].trim(), "''", "Every SECURITY DEFINER must use an empty search_path");
}
assert.match(migration, /on delete restrict/);
assert.doesNotMatch(migration, /stripe/i);
assert.doesNotMatch(migration, /grant execute[\s\S]{0,200}community_sync_academy_entitlement[\s\S]{0,100}authenticated/i);
assert.match(acceptFunction, /LOCK ORDER 1:[\s\S]*community_entitlement_definitions[\s\S]*for update;[\s\S]*LOCK ORDER 2:[\s\S]*community_academy_access_invitations[\s\S]*for update;/i);
assert.match(syncFunction, /LOCK ORDER 1:[\s\S]*community_entitlement_definitions[\s\S]*for update;[\s\S]*LOCK ORDER 2:[\s\S]*community_academy_entitlement_claims[\s\S]*for update;/i);
assert.match(createPaymentFunction, /LOCK ORDER 1:[\s\S]*community_entitlement_definitions[\s\S]*for update;[\s\S]*insert into public\.community_payment_claims/i);
assert.match(reviewPaymentFunction, /LOCK ORDER 1:[\s\S]*community_entitlement_definitions[\s\S]*for update;[\s\S]*LOCK ORDER 2:[\s\S]*community_payment_claims[\s\S]*for update;/i);

assert.match(test, /linked_rooms member can access a normal free Room/);
assert.match(test, /Revoking one Academy source revoked another source/);
assert.match(test, /Academy revocation changed the existing paid Community entitlement/);
assert.match(test, /Equivalent paid Community claim was accepted/);
assert.match(test, /Another user can read Academy entitlement claims/);
assert.match(test, /Archived Academy mapping still accepted a pending invitation/);
assert.match(test, /Academy invitation reactivated a suspended Community member/);
assert.match(test, /Academy invitation accepted while equivalent payment claim was pending/);
assert.match(test, /Staff approved an equivalent payment claim during active Academy access/);
assert.match(test, /Expired Academy access invitation was accepted/);
assert.match(test, /Anonymous Auth user accepted Academy invitation/);
assert.match(test, /Active Academy mapping was retargeted while a claim was active/);
assert.match(test, /Academy Room scope changed before active claims were revoked/);
assert.match(test, /Academy mapping scope change overwrote immutable mapping history/);
assert.match(test, /Academy Room scope changed while a future accepted claim remained active/);
assert.match(test, /Anonymous Auth user listed Academy Community links/);
assert.match(test, /Anonymous Auth user changed an Academy Community link/);
assert.match(test, /linked_rooms member can read a Community-wide event/);
assert.match(test, /linked_rooms member can read a Community-wide resource/);
assert.match(client, /rpc\("community_create_payment_claim"/);
assert.match(client, /rpc\("community_review_payment_claim"/);
assert.match(types, /"academy_subscription"/);

assert.match(uiMigration, /invitation\.user_id = \(select auth\.uid\(\)\)/);
assert.match(uiMigration, /provider_type <> 'academy_subscription'/);
assert.match(uiMigration, /private\.academy_can_manage_headquarters\(p_headquarters_id\)/);
assert.match(uiMigration, /community_private\.is_staff\(p_community_id\)/);
assert.match(uiMigration, /termsVersion/);
assert.match(uiMigration, /rulesVersion/);
assert.match(uiMigration, /privacyVersion/);
assert.match(uiMigration, /not coalesce\(\(auth\.jwt\(\) ->> 'is_anonymous'\)::boolean, false\)/);
assert.match(uiMigration, /community_access_source_mappings_current_academy_source_uidx/);
assert.match(uiMigration, /where provider_type = 'academy_subscription' and status <> 'archived'/);
assert.match(uiMigration, /'activeClaimCount'/);
assert.match(upsertAcademyLinkFunction, /community_communities[\s\S]*for update;[\s\S]*community_entitlement_definitions[\s\S]*for update;[\s\S]*community_access_source_mappings[\s\S]*for update;/i);
assert.match(upsertAcademyLinkFunction, /set status = 'archived'[\s\S]*insert into public\.community_access_source_mappings/i);
assert.doesNotMatch(upsertAcademyLinkFunction, /on conflict/i);
assert.match(listAcademyLinkFunction, /Anonymous Auth users cannot manage Academy Community links/);
assert.match(upsertAcademyLinkFunction, /Anonymous Auth users cannot manage Academy Community links/);
assert.doesNotMatch(listAcademyLinkFunction, /claim\.starts_at <= pg_catalog\.now\(\)/);
assert.match(acceptancePage, /この団体から案内されたRoomを追加料金なしで利用できます/);
assert.match(acceptancePage, /現在見られる場所はそのまま利用できます/);
assert.match(acceptancePage, /この団体が現在公開しているRoomだけが表示されます/);
assert.doesNotMatch(acceptancePage, /Academy契約/);
assert.match(acceptancePage, /同意してCommunityへ参加する/);
assert.doesNotMatch(acceptancePage, /service_role/);
assert.match(acceptancePage, /process\.env\.NODE_ENV !== "production"/);
assert.match(communityApp, /Academy連携/);
assert.match(communityApp, /この利用範囲は利用中です/);
assert.match(communityApp, /item\.source !== "academy_subscription"/);

console.log("Community Academy linked access contract: OK");
