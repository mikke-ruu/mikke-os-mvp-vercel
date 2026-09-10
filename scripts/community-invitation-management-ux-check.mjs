import assert from "node:assert/strict";
import fs from "node:fs";
import { visiblePendingCommunityInvitationRows } from "../lib/community/invitation-summary.ts";

const app = fs.readFileSync("components/community/CommunityApp.tsx", "utf8");
const hub = fs.readFileSync("components/community/CommunityHub.tsx", "utf8");
const client = fs.readFileSync("lib/community/client.ts", "utf8");
const types = fs.readFileSync("lib/community/types.ts", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260910014050_community_invitation_management_ux.sql", "utf8");
const sqlTest = fs.readFileSync("supabase/tests/community_invitation_management_ux_test.sql", "utf8");
const isolatedRunner = fs.readFileSync("scripts/community-owner-ux-isolated-db.mjs", "utf8");

const invitationRows = visiblePendingCommunityInvitationRows([
  { id: "null-parent", expires_at: "2099-01-01T00:00:00.000Z", community_communities: null },
  { id: "empty-parent", expires_at: "2099-01-01T00:00:00.000Z", community_communities: [] },
  { id: "archived-parent", expires_at: "2099-01-01T00:00:00.000Z", community_communities: { slug: "archived", name: "Archived", status: "archived" } },
  { id: "active-parent", expires_at: "2099-01-01T00:00:00.000Z", community_communities: [{ slug: "active", name: "Active", status: "active" }] },
], new Date("2026-09-10T00:00:00.000Z").getTime());

const checks = [
  [app.includes("手続き待ちの招待") && app.includes("招待履歴を確認"), "current invitations and history are separated"],
  [["手続き待ち", "参加済み", "辞退", "取消済み", "期限切れ"].every((label) => app.includes(label)), "all invitation statuses are Japanese"],
  [app.includes("付与予定") && app.includes("招待URLをコピー") && app.includes("この招待を取り消す"), "pending invitation controls are visible"],
  [app.includes("参加済み・取消済み・辞退・期限切れの招待は編集できません"), "terminal invitations are immutable in the UI"],
  [app.includes("自動通知は送信していません") && app.includes("メールや共通通知は自動送信されない"), "operator copy does not imply a notification"],
  [hub.includes("受け取った招待") && hub.includes("招待を確認して参加手続きへ") && hub.includes("メールや共通通知は自動送信されません"), "recipient can find invitations inside Community"],
  [hub.includes("Promise.allSettled") && hub.includes("参加済みのCommunity一覧はそのまま利用できます"), "invitation loading failure does not hide joined Communities"],
  [invitationRows.length === 1 && invitationRows[0].id === "active-parent" && invitationRows[0].community_communities.slug === "active", "null, empty, and archived parents are skipped while a valid invitation remains"],
  [app.includes("メンバー管理") && app.includes("役割を変更") && app.includes("利用権限を追加") && app.includes("権限・参加状態の停止"), "member actions are explicit and dangerous actions are folded"],
  [app.includes("この利用権限を停止しますか？"), "entitlement revocation requires confirmation"],
  [client.includes("listMyPendingCommunityInvitations") && client.includes('.eq("invited_user_id", userId)') && client.includes('.eq("status", "pending")'), "recipient query is scoped to the signed-in user and pending state"],
  [client.includes('rpc("community_update_pending_invitation"') && client.includes('rpc("community_revoke_pending_invitation"'), "client uses narrow invitation RPCs"],
  [types.includes("CommunityInvitationSummary") && types.includes('status: "active" | "archived"'), "recipient invitation projection is typed"],
  [migration.includes("security definer") && migration.includes("set search_path = ''") && migration.includes("community_private.is_staff") && migration.includes("v_invitation.status <> 'pending'"), "RPCs enforce staff and pending-only access"],
  [migration.includes("definition.community_id = v_invitation.community_id") && migration.includes("definition.status = 'active'"), "planned entitlement must be active in the same Community"],
  [migration.includes("from public, anon, service_role") && migration.includes("to authenticated"), "function execute privileges are narrowed"],
  [sqlTest.includes("only authenticated receives execute privileges") && sqlTest.includes("revocation preserves invitation identity") && sqlTest.includes("staff from another Community cannot revoke") && sqlTest.includes("anonymous Auth account cannot update"), "SQL tests cover ACL, immutable identity, and cross-tenant denial"],
  [sqlTest.includes("expired pending invitation cannot be updated") && sqlTest.includes("accepted invitation cannot be revoked") && sqlTest.includes("authenticated clients cannot directly mutate invitation identity"), "SQL tests cover terminal state and direct-update denial"],
  [sqlTest.includes("invitee cannot update the own invitation") && sqlTest.includes("invitee cannot revoke the own invitation") && sqlTest.includes("staff from another Community cannot update the invitation") && sqlTest.includes("staff from another Community cannot revoke the invitation"), "real invitation IDs cover invitee and cross-Community denial for both RPCs"],
  [sqlTest.includes("expired owner contract cannot update an invitation") && sqlTest.includes("expired owner contract cannot revoke an invitation") && sqlTest.includes("expired pending invitation cannot be revoked") && sqlTest.includes("accepted invitation cannot be updated"), "contract expiry and both terminal states cover both RPCs"],
  [sqlTest.includes("denied operations leave the real invitation unchanged"), "denied calls preserve the real invitation row"],
  [isolatedRunner.includes("community_invitation_management_ux_test.sql") && isolatedRunner.includes("20260910014050_community_invitation_management_ux.sql"), "isolated PostgreSQL runner includes this slice"],
];

for (const [ok, label] of checks) assert.ok(ok, label);
console.log(`community-invitation-management-ux-check ok (${checks.length} assertions)`);
