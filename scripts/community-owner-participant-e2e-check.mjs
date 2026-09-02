import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  new URL("../supabase/tests/community_owner_participant_e2e.sql", import.meta.url),
  "utf8",
);

for (const marker of [
  "platform_billing_creation_entitlement_grant",
  "community_create_with_platform_entitlement",
  "community_invite_by_mikke_id",
  "community_submit_join_application",
  "public.community_rooms",
  "public.community_posts",
  "public.community_comments",
  "public.community_chat_messages",
  "outsider cannot read rooms",
  "outsider cannot read posts",
  "outsider cannot read chat",
  "Anonymous post",
  "creation entitlement consumed by created Community",
  "community_owner_participant_e2e_test_ok",
]) {
  assert.match(sql, new RegExp(marker.replaceAll(".", "\\.")), `missing E2E marker: ${marker}`);
}

assert.match(sql, /set local role service_role/);
assert.ok((sql.match(/set local role authenticated/g) ?? []).length >= 4);
assert.match(sql, /set local role anon/);
assert.match(sql, /"is_anonymous":false/);
assert.match(sql, /begin;/i);
assert.match(sql, /rollback;/i);
assert.doesNotMatch(sql, /service_role[^\n]*(?:key|secret|token)/i);

console.log("community_owner_participant_e2e_contract_ok");
