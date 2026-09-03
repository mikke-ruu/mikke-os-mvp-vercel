import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const sql=readFileSync(new URL('../supabase/migrations/20260831180143_platform_billing_checkout_ledger.sql',import.meta.url),'utf8');
const test=readFileSync(new URL('../supabase/tests/platform_billing_checkout_ledger.sql',import.meta.url),'utf8');
for (const table of ['scopes','quotes','attempts']) {
 assert.ok(sql.includes(`create table platform_billing_private.${table}`));
 assert.ok(sql.includes(`alter table platform_billing_private.${table} enable row level security`));
}
assert.match(sql,/revoke all on schema platform_billing_private from public,anon,authenticated,service_role/);
assert.doesNotMatch(sql,/grant\s+(?:all|select|insert|update|delete|truncate)\s+on\s+(?:table|schema)/i);
assert.match(sql,/check\(status in \('prepared','provider_ready','uncertain'\)\)/);
assert.match(sql,/scope_id uuid not null unique/);
assert.match(sql,/unique\(owner_user_id,product_key,request_id\)/);
assert.match(sql,/platform-checkout-/);
assert.match(sql,/\^cs_test_\[A-Za-z0-9\]\+\$/);
assert.match(sql,/clock_timestamp\(\)/);
assert.match(sql,/jsonb_typeof\(item->key\) is distinct from 'string'/);
assert.match(sql,/'academy_platform','community_platform'/);
assert.match(sql,/require_actor\(p_actor_user_id\)/);
assert.match(sql,/u\.is_anonymous is false/);
assert.doesNotMatch(sql.replace(/^\s*--.*$/gm,''),/auth\.jwt|user_metadata|set_config\s*\(|set\s+(?:local\s+)?role/i);
const names=['quote_save','quote_get','attempt_reserve','attempt_mark_ready','attempt_mark_uncertain'];
for(const name of names){
 const chunk=sql.split(`create function public.platform_billing_${name}`)[1]?.split('end $$;')[0];
 assert.ok(chunk,name);assert.match(chunk,/security definer set search_path=''/);assert.match(chunk,/require_actor/);
 if(name.startsWith('attempt_')) { assert.match(chunk,/perform 1 from platform_billing_private\.scopes where[^;]+for update;[\s\S]+from platform_billing_private\.quotes where[^;]+for update;/,'scope before quote lock'); }
}
assert.match(sql,/attempt_result\(a,true\)/);
assert.match(sql,/attempt_result\(a,false\)/);
assert.match(sql,/if a.status in \('provider_ready','uncertain'\) then return/);
assert.doesNotMatch(sql,/(?:insert into|update|delete from|alter table) public\.(?:academy_|community_|mikke_app_entitlements)/i);
for(const phrase of ['same reserve one immutable attempt','ready cannot downgrade','timeout retry never fresh provider create','PLATFORM_BILLING_SCOPE_PENDING','PLATFORM_BILLING_QUOTE_EXPIRED','platform_billing_checkout_ledger_test_ok']) assert.ok(test.includes(phrase),phrase);
console.log('Platform billing ledger SQL static contract: passed');
