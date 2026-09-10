import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const app = fs.readFileSync(path.join(root, "components/community/CommunityApp.tsx"), "utf8");
const client = fs.readFileSync(path.join(root, "lib/community/client.ts"), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20260909163047_community_owner_membership_resources_ux.sql"), "utf8");
const concurrency = fs.readFileSync(path.join(root, "scripts/community-owner-ux-concurrency.mjs"), "utf8");
const storageE2e = fs.readFileSync(path.join(root, "scripts/community-owner-ux-storage-e2e.mjs"), "utf8");
const sqlTest = fs.readFileSync(path.join(root, "supabase/tests/community_owner_membership_resources_ux_test.sql"), "utf8");

const assertions = [
  [app.includes('grid grid-cols-2 gap-2 md:grid-cols-4'), "owner metrics are compact on mobile"],
  [app.includes('label="承認待ち"') && app.includes('/owner/safety'), "pending approvals are linked"],
  [app.indexOf('title="基本設定"') < app.indexOf('title="Room設定"') && app.indexOf('title="Room設定"') < app.indexOf('title="コンテンツ管理"') && app.indexOf('title="コンテンツ管理"') < app.indexOf('title="参加・安全設定"') && app.indexOf('title="参加・安全設定"') < app.indexOf('title="参加者と権限"') && app.indexOf('title="参加者と権限"') < app.indexOf('title="通報・問い合わせ"'), "owner links follow the requested order"],
  [app.includes('運営管理へ戻る'), "owner subpages include a return link"],
  [app.includes('詳細・編集') && app.includes('公開を終了'), "membership details can be edited or archived"],
  [app.includes('ユーワードポイント') && app.includes('銀行振込') && app.includes('支払い確認を記録して権限を付与'), "manual payment UI is present"],
  [app.includes('type="file"') && app.includes('video controls') && app.includes('PDFを開く'), "private file selection and viewing UI are present"],
  [client.includes('community_record_manual_payment') && client.includes('community-resources'), "client uses the new RPC and private bucket"],
  [/security definer\s+set search_path = ''/i.test(migration), "manual payment RPC has an empty search_path"],
  [migration.includes("community_record_manual_payment(uuid, uuid, uuid, text, text, text, uuid)") && migration.includes("from public, anon, service_role") && migration.includes("grant execute on function public.community_record_manual_payment") && migration.includes("to authenticated"), "manual payment RPC ACL is explicit"],
  [migration.includes("external_payment_url = ''") && migration.includes("external_payment_url ~ '^https://'") && sqlTest.includes("manual plans allow an empty URL but reject insecure payment URLs"), "manual plans allow no URL but reject insecure URLs"],
  [migration.includes("'community-resources'") && migration.includes("public, file_size_limit") && migration.includes("false,"), "resource bucket is private"],
  [migration.includes("community_resource_objects_select") && migration.includes("membership.access_scope = 'community'") && migration.includes("community_private.is_staff"), "resource reads are tenant and membership scoped"],
  [migration.includes("file_size_bytes is not null") && migration.includes("split_part(storage_path, '/', 1) = community_id::text") && migration.includes("resource.id::text = (storage.foldername(name))[2]"), "file metadata and object paths are fail closed"],
  [migration.includes("cardinality(pg_catalog.string_to_array(storage_path, '/')) = 4") && sqlTest.includes("partial file metadata is rejected independently") && sqlTest.includes("cross-namespace metadata is rejected independently"), "resource paths and metadata failures are independently covered"],
  [migration.includes("'external', 'manual-payment-claim:'"), "manual payment grants only an external Community entitlement"],
  [migration.includes("manual_request_id") && migration.includes("pg_advisory_xact_lock") && migration.includes("payload does not match"), "manual payment retries are idempotent"],
  [concurrency.includes("both identical retries must succeed") && concurrency.includes("wait_event_type='Lock'") && concurrency.includes("idempotent replay waiting behind revocation must fail") && concurrency.includes("revokedRequestClaims: 0"), "concurrency runner proves waits for new and replay authority revocation"],
  [app.includes("actorClient={actorClient}") && app.includes("updateCommunityMembershipPlan(actorClient") && app.includes("recordCommunityManualPayment(actorClient") && app.includes("if (!actorIsCurrent()) return;") && app.includes("JSON.stringify({ requestId: manualRequestId, planId: manualPlanId, paymentMethod: manualPaymentMethod, externalReference: manualReference, note: manualNote })") && app.includes("この端末では再送情報を保存できません"), "new owner mutations are actor scoped and full retry payload survives a reload"],
  [migration.includes("mapping.provider_type = 'academy_subscription'") && migration.includes("already included with an active Academy benefit"), "manual payment rejects an active Academy duplicate"],
  [sqlTest.includes("active Academy access rejects duplicate manual payment") && sqlTest.includes("Academy duplicate rejection leaves no payment claim"), "SQL test covers Academy duplicate rollback"],
  [storageE2e.includes('Only an isolated local Supabase Storage endpoint is allowed') && storageE2e.includes('signedTarget.origin, base.origin') && storageE2e.includes('upload larger than 50MB') && storageE2e.includes('disallowed MIME upload') && storageE2e.includes('suspended member access') && storageE2e.includes('fixtureObjectsRemaining: 0'), "isolated Storage API runner covers tenant access, bytes, MIME, size, cleanup and signed URLs"],
];

for (const [condition, message] of assertions) {
  if (!condition) throw new Error(`community-owner-ux-check failed: ${message}`);
}

console.log(`community-owner-ux-check ok (${assertions.length} assertions)`);
