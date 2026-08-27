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
assert.match(migration, /source_reference = trim\(p_source_reference\)/);
assert.match(migration, /source <> 'academy_subscription'/);
assert.match(migration, /This access is already included with an active Academy benefit/);
assert.match(migration, /revoke insert on table public\.community_payment_claims from authenticated/);
assert.match(migration, /on delete restrict/);
assert.doesNotMatch(migration, /stripe/i);
assert.doesNotMatch(migration, /grant execute[\s\S]{0,200}community_sync_academy_entitlement[\s\S]{0,100}authenticated/i);

assert.match(test, /linked_rooms member can access a normal free Room/);
assert.match(test, /Revoking one Academy source revoked another source/);
assert.match(test, /Academy revocation changed the existing paid Community entitlement/);
assert.match(test, /Equivalent paid Community claim was accepted/);
assert.match(test, /Another user can read Academy entitlement claims/);
assert.match(test, /Archived Academy mapping still accepted a pending invitation/);
assert.match(test, /Academy invitation reactivated a suspended Community member/);
assert.match(test, /linked_rooms member can read a Community-wide event/);
assert.match(test, /linked_rooms member can read a Community-wide resource/);
assert.match(client, /rpc\("community_create_payment_claim"/);
assert.match(client, /source: "subscription"/);
assert.match(types, /"academy_subscription"/);

assert.match(uiMigration, /invitation\.user_id = \(select auth\.uid\(\)\)/);
assert.match(uiMigration, /provider_type <> 'academy_subscription'/);
assert.match(uiMigration, /private\.academy_can_manage_headquarters\(p_headquarters_id\)/);
assert.match(uiMigration, /community_private\.is_staff\(p_community_id\)/);
assert.match(uiMigration, /termsVersion/);
assert.match(uiMigration, /rulesVersion/);
assert.match(uiMigration, /privacyVersion/);
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
