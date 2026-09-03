import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/migrations/20260903204500_platform_billing_customer_recontract_activation.sql',import.meta.url),'utf8');
for(const marker of ['subscriptions_provider_customer_id_key','platform_billing_subscription_customer_history_idx','pg_get_functiondef','PLATFORM_BILLING_ACTIVATION_DEFINITION_DRIFT','source_attempt_id=p_attempt_id or provider_subscription_id=p_provider_subscription_id','grant execute on function public.platform_billing_verified_subscription_activate']) assert.ok(sql.includes(marker),marker);
assert.match(sql,/replace\(v_definition,chr\(13\)\|\|chr\(10\),chr\(10\)\)/);
assert.ok(!sql.includes("v_new:='where source_attempt_id=p_attempt_id or provider_customer_id"));
console.log('platform_billing_customer_recontract_contract_ok');
