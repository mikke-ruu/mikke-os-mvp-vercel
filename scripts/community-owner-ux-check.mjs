import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const app = fs.readFileSync(path.join(root, "components/community/CommunityApp.tsx"), "utf8");
const client = fs.readFileSync(path.join(root, "lib/community/client.ts"), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20260909163047_community_owner_membership_resources_ux.sql"), "utf8");
const concurrency = fs.readFileSync(path.join(root, "scripts/community-owner-ux-concurrency.mjs"), "utf8");
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
  [migration.includes("community_record_manual_payment(uuid, uuid, uuid, text, text, text, uuid)") && migration.includes("grant execute on function public.community_record_manual_payment") && migration.includes("to authenticated"), "manual payment RPC ACL is explicit"],
  [migration.includes("'community-resources'") && migration.includes("public, file_size_limit") && migration.includes("false,"), "resource bucket is private"],
  [migration.includes("community_resource_objects_select") && migration.includes("membership.access_scope = 'community'") && migration.includes("community_private.is_staff"), "resource reads are tenant and membership scoped"],
  [migration.includes("file_size_bytes is not null") && migration.includes("split_part(storage_path, '/', 1) = community_id::text") && migration.includes("resource.id::text = (storage.foldername(name))[2]"), "file metadata and object paths are fail closed"],
  [migration.includes("'external', 'manual-payment-claim:'"), "manual payment grants only an external Community entitlement"],
  [migration.includes("manual_request_id") && migration.includes("pg_advisory_xact_lock") && migration.includes("payload does not match"), "manual payment retries are idempotent"],
  [concurrency.includes("both identical retries must succeed") && concurrency.includes("staff revocation transaction must succeed") && concurrency.includes("revokedRequestClaims: 0"), "concurrency runner covers replay and authority revocation"],
  [migration.includes("mapping.provider_type = 'academy_subscription'") && migration.includes("already included with an active Academy benefit"), "manual payment rejects an active Academy duplicate"],
  [sqlTest.includes("active Academy access rejects duplicate manual payment") && sqlTest.includes("Academy duplicate rejection leaves no payment claim"), "SQL test covers Academy duplicate rollback"],
];

for (const [condition, message] of assertions) {
  if (!condition) throw new Error(`community-owner-ux-check failed: ${message}`);
}

console.log(`community-owner-ux-check ok (${assertions.length} assertions)`);
