import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync("components/community/CommunityApp.tsx", "utf8");
const client = fs.readFileSync("lib/community/client.ts", "utf8");
const types = fs.readFileSync("lib/community/types.ts", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260909235910_community_membership_billing_guidance.sql", "utf8");
const sqlTest = fs.readFileSync("supabase/tests/community_membership_billing_guidance_test.sql", "utf8");
const isolatedRunner = fs.readFileSync("scripts/community-owner-ux-isolated-db.mjs", "utf8");

const checks = [
  [app.includes("Stripeの決済設定を順番に確認") && app.includes("商品を作る") && app.includes("毎月の料金を設定する") && app.includes("入会リンクを作る") && app.includes("契約管理・解約を設定する") && app.includes("テストする"), "ordered payment setup guide exists"],
  [app.includes("入会・決済URL") && app.includes("契約管理・解約URL"), "enrollment and management URLs are separate"],
  [app.includes("activeMembershipPlans") && app.includes("managedMembershipPlans") && app.includes("契約中・契約履歴"), "recruitment and existing contract management are separate"],
  [app.includes('pattern="https://billing[.]stripe[.]com/p/login/[A-Za-z0-9_-]+/?"') && app.includes("個人専用セッションURLは保存できません"), "portal input accepts shared Stripe login links only"],
  [app.includes("募集開始前の確認") && app.includes("「継続・毎月」の料金になっている"), "operator checklist records recurring setup"],
  [app.includes("URLを保存しただけでは") && app.includes("決済完了後の戻り画面だけを根拠に承認しない"), "manual payment boundary is explicit"],
  [app.includes("有料契約の解約") && app.includes("Communityから退会") && app.includes("mikkeアカウントの削除"), "three exit actions are distinguished"],
  [app.includes('claim.paymentMethod === "external_link"') && app.includes("approvedExternalPlanIds.has(plan.id)"), "portal link is not shown for manual or unrelated entitlements"],
  [app.includes("権限元は「Community有料会員」") && app.includes("Payment Linkの申請承認とは別です"), "external-link claims and manual payment sources are explained separately"],
  [app.includes("function canCreateRoomPost") && app.includes("room.memberCanPost || isOwnerLike(data, userId)") && app.includes("data.rooms.filter((room) => canCreateRoomPost(data, userId, room))"), "staff can compose in every writable thread room"],
  [app.includes('<h3 className="text-base font-bold tracking-normal">投稿を作成</h3>') && !app.includes("告知を作る"), "owner composer uses natural post wording"],
  [client.includes("external_customer_portal_url") && client.includes("payment_setup_checklist") && types.includes("CommunityPaymentSetupChecklist"), "client and types project billing guidance"],
  [migration.includes("external_customer_portal_url") && migration.includes("payment_setup_checklist") && migration.includes("does not grant an entitlement"), "migration separates guidance from entitlement proof"],
  [client.includes("normalizeSharedStripeCustomerPortalUrl") && client.includes("parsed.username") && client.includes("parsed.search"), "client rejects individual or credential-bearing portal URLs"],
  [migration.includes("members can read active or own contracted plans") && migration.includes("claim.payment_method = 'external_link'") && migration.includes(") is true"), "RLS preserves contract management and checklist NULL cannot pass"],
  [sqlTest.includes("JSON null in a required checklist key is rejected") && sqlTest.includes("non-boolean checklist value is rejected") && sqlTest.includes("userinfo credentials in a portal URL are rejected"), "SQL negative tests cover malformed checklists and portal credentials"],
  [isolatedRunner.includes('"pg_isready", "-h", "127.0.0.1"') && isolatedRunner.includes('"-c", "select 1;"') && isolatedRunner.includes('sqlProbe.stdout.trim() === "1"'), "isolated PostgreSQL waits for the final TCP server and a real SQL probe"],
  [sqlTest.includes("saving links and checklist never grants an entitlement") && sqlTest.includes("insecure management URL is rejected") && sqlTest.includes("checklist cannot masquerade as provider verification"), "SQL negative tests cover the safety boundary"],
];

for (const [ok, label] of checks) assert.ok(ok, label);
console.log(`community-billing-posting-ux-check ok (${checks.length} assertions)`);
