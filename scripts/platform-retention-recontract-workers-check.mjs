import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/migrations/20260903203000_platform_retention_recontract_workers.sql',import.meta.url),'utf8');
const checkout=readFileSync(new URL('../supabase/migrations/20260831180143_platform_billing_checkout_ledger.sql',import.meta.url),'utf8');
const runtime=readFileSync(new URL('../supabase/migrations/20260902223651_platform_billing_subscription_runtime.sql',import.meta.url),'utf8');
const recontract=readFileSync(new URL('../supabase/migrations/20260903201500_platform_billing_subscription_recontract_selection.sql',import.meta.url),'utf8');
for(const marker of [
  'academy_anonymize_ended_headquarters_at','community_apply_platform_retention_anonymization',
  "resource_subscription_select(v_owner,'academy_platform'", "resource_subscription_select(v_owner,'community_platform'",
  "where id=v_subscription for update", "status='consumed' and resource_id=p_headquarters_id for update",
  'academy_anonymization_not_due','COMMUNITY_RETENTION_NOT_DUE','platform_retention_anonymizations',
  "security definer set search_path=''"
]) assert.ok(sql.includes(marker),marker);
assert.match(sql,/platform_billing_subscription_event_apply_unlocked_legacy/);
assert.match(sql,/from platform_billing_private\.scopes where id=v_scope for update/);
assert.match(sql,/revoke all on function public\.platform_billing_subscription_event_apply_unlocked_legacy[^;]+service_role/);
assert.match(sql,/from platform_billing_private\.scopes where id=v_scope[^;]+for update/g);
assert.match(sql,/v_scope_count<>1 then raise exception 'academy_anonymization_scope_invalid'/);
assert.match(sql,/v_scope_count>1 then raise exception using errcode='23505',message='COMMUNITY_RETENTION_SCOPE_AMBIGUOUS'/);
assert.match(sql,/source_kind='verified_trial'[^;]+for update/);
assert.ok(sql.indexOf("resource_subscription_select(v_owner,'academy_platform'")<sql.indexOf('from public.academy_headquarters where id=p_headquarters_id for update'));
assert.ok(sql.indexOf("resource_subscription_select(v_owner,'community_platform'")<sql.indexOf('from public.community_communities where id=p_community_id for update'));
assert.ok(checkout.includes('from platform_billing_private.scopes')&&checkout.includes('for update'));
assert.ok(runtime.includes('from platform_billing_private.scopes')&&runtime.includes('for update'));
assert.match(recontract,/create or replace function public\.platform_billing_attempt_reserve[\s\S]+from platform_billing_private\.scopes[^;]+for update/);
assert.match(recontract,/academy_paid_activation_verify_and_consume[\s\S]+from platform_billing_private\.scopes[^;]+for update/);
console.log('platform_retention_recontract_workers_contract_ok');
