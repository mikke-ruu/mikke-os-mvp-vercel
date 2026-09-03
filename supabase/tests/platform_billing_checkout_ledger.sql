-- Synthetic isolated Postgres only. Caller: BEGIN; migration; this file; ROLLBACK.
-- Prerequisites intentionally only auth.users(id,is_anonymous) and three roles.
create function pg_temp.billing_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'billing assertion failed: %',label; end if; end $$;
create function pg_temp.billing_denied(statement text,code text,message text default null) returns void language plpgsql as $$
declare actual_code text; actual_message text;
begin
 begin execute statement; exception when others then get stacked diagnostics actual_code=returned_sqlstate,actual_message=message_text; end;
 if actual_code is distinct from code or (message is not null and actual_message is distinct from message) then
  raise exception 'expected % / %, got % / %',code,message,actual_code,actual_message;
 end if;
end $$;
create function pg_temp.platform_billing_fixture_quote(actor uuid,qid text,request text,resource text default null,product text default 'academy_platform') returns jsonb language sql as $$
 select jsonb_build_object(
  'quoteId',qid,'revision',1,'purchaseIntent','explicit_paid_start',
  'scope',jsonb_build_object('ownerUserId',actor::text,'productKey',product,'resourceId',resource,'planKey','fixture_plan','requestId',request),
  'currency','JPY','taxIncluded',true,
  'dueNow',jsonb_build_object('totalYen',123,'dueOn',to_char(clock_timestamp() at time zone 'Asia/Tokyo','YYYY-MM-DD')),
  'nextPayment',jsonb_build_object('totalYen',456,'dueOn',to_char((clock_timestamp() at time zone 'Asia/Tokyo')+interval '30 days','YYYY-MM-DD')),
  'merchant',jsonb_build_object('merchantId','fixture-merchant','legalName','Fixture merchant','address','Fixture address','contactUrl','https://example.invalid/contact'),
  'policies',jsonb_build_object('approved',true,'approvalId','fixture-approval','revision',1)
   || (select jsonb_object_agg(key,jsonb_build_object('version','fixture-v1','url','https://example.invalid/policy')) from unnest(array['terms','privacy','refund','cancellation','proration','renewal','commercialDisclosure']) key),
  'issuedAt',to_char((clock_timestamp()-interval '1 minute') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'expiresAt',to_char((clock_timestamp()+interval '1 hour') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
$$;
create function pg_temp.billing_consent(qid text) returns jsonb language sql as $$
 select jsonb_build_object('quoteId',qid,'revision',1,'termsVersion','fixture-v1','accepted',true)
$$;
insert into auth.users(id,is_anonymous) values
 ('a9010000-0000-4000-8000-000000000001',false),
 ('a9010000-0000-4000-8000-000000000002',false),
 ('a9010000-0000-4000-8000-000000000003',true);

do $$ declare name text;role_name text; f record; begin
 foreach name in array array['scopes','quotes','attempts'] loop
  perform pg_temp.billing_assert((select relrowsecurity from pg_class where oid=('platform_billing_private.'||name)::regclass),'RLS '||name);
  foreach role_name in array array['anon','authenticated','service_role'] loop
   perform pg_temp.billing_assert(not has_table_privilege(role_name,'platform_billing_private.'||name,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'),'private ACL '||role_name||name);
  end loop;
 end loop;
 for f in select p.oid,p.proname,p.proconfig,p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'platform_billing_%' loop
  perform pg_temp.billing_assert(f.prosecdef and f.proconfig @> array['search_path=""'],'definer path');
  perform pg_temp.billing_assert(not has_function_privilege('anon',f.oid,'EXECUTE') and not has_function_privilege('authenticated',f.oid,'EXECUTE') and has_function_privilege('service_role',f.oid,'EXECUTE'),'RPC ACL '||f.proname);
 end loop;
 perform pg_temp.billing_assert((select count(*)=5 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'platform_billing_%'),'five RPCs only');
end $$;
set local role anon;
select pg_temp.billing_denied($q$select public.platform_billing_quote_get('a9010000-0000-4000-8000-000000000001','fixture-main')$q$,'42501');
select pg_temp.billing_denied($q$select * from platform_billing_private.quotes$q$,'42501');
reset role;
set local role authenticated;
select pg_temp.billing_denied($q$select public.platform_billing_attempt_reserve('a9010000-0000-4000-8000-000000000001','fixture-main','{}')$q$,'42501');
select pg_temp.billing_denied($q$select * from platform_billing_private.attempts$q$,'42501');
reset role;
set local role service_role;
select pg_temp.billing_denied($q$select * from platform_billing_private.quotes$q$,'42501');
select pg_temp.billing_denied($q$truncate platform_billing_private.attempts$q$,'42501');
select pg_temp.billing_denied($q$select public.platform_billing_quote_get(null,'fixture-main')$q$,'42501','PLATFORM_BILLING_FORBIDDEN');
select pg_temp.billing_denied($q$select public.platform_billing_quote_get('a9010000-0000-4000-8000-000000000003','fixture-main')$q$,'42501','PLATFORM_BILLING_FORBIDDEN');
select pg_temp.billing_denied($q$select public.platform_billing_quote_get('a9010000-0000-4000-8000-000000000099','fixture-main')$q$,'42501','PLATFORM_BILLING_FORBIDDEN');
select set_config('test.billing_quote',pg_temp.platform_billing_fixture_quote('a9010000-0000-4000-8000-000000000001','fixture-main','b9010000-0000-4000-8000-000000000001')::text,true);
select public.platform_billing_quote_save('a9010000-0000-4000-8000-000000000001',current_setting('test.billing_quote')::jsonb);
select pg_temp.billing_assert(public.platform_billing_quote_get('a9010000-0000-4000-8000-000000000001','fixture-main')=current_setting('test.billing_quote')::jsonb,'quote read exact');
select pg_temp.billing_assert(public.platform_billing_quote_get('a9010000-0000-4000-8000-000000000002','fixture-main') is null,'other actor read null');
select pg_temp.billing_assert(public.platform_billing_quote_save('a9010000-0000-4000-8000-000000000001',current_setting('test.billing_quote')::jsonb)->>'quote_id'='fixture-main','save idempotent');
select pg_temp.billing_denied($q$select public.platform_billing_quote_save('a9010000-0000-4000-8000-000000000002',current_setting('test.billing_quote')::jsonb)$q$,'22023','PLATFORM_BILLING_INVALID_QUOTE');
select pg_temp.billing_denied($q$select public.platform_billing_quote_save('a9010000-0000-4000-8000-000000000001',jsonb_set(current_setting('test.billing_quote')::jsonb,'{dueNow,totalYen}','124'))$q$,'23505','PLATFORM_BILLING_IDEMPOTENCY_CONFLICT');
select pg_temp.billing_denied($q$select public.platform_billing_quote_save('a9010000-0000-4000-8000-000000000001',jsonb_set(current_setting('test.billing_quote')::jsonb,'{quoteId}','"fixture-same-request"'))$q$,'23505','PLATFORM_BILLING_IDEMPOTENCY_CONFLICT');

-- Strict JSON types, approved policies, known prices/dates, no trial conversion.
do $$ declare path text[]; path_name text; replacement jsonb; begin
 foreach path_name in array array['quoteId','scope.productKey','scope.planKey','scope.requestId','policies.approvalId'] loop
  path:=string_to_array(path_name,'.');
  perform pg_temp.billing_denied(format('select public.platform_billing_quote_save(%L::uuid,%L::jsonb)','a9010000-0000-4000-8000-000000000001',jsonb_set(current_setting('test.billing_quote')::jsonb,path,'123')),'22023','PLATFORM_BILLING_INVALID_QUOTE');
 end loop;
 foreach replacement in array array['null'::jsonb,'"123"'::jsonb,'-1'::jsonb,'1.5'::jsonb,'9007199254740992'::jsonb] loop
  perform pg_temp.billing_denied(format('select public.platform_billing_quote_save(%L::uuid,%L::jsonb)','a9010000-0000-4000-8000-000000000001',jsonb_set(current_setting('test.billing_quote')::jsonb,'{nextPayment,totalYen}',replacement)),'22023','PLATFORM_BILLING_INVALID_QUOTE');
 end loop;
end $$;
select pg_temp.billing_denied($q$select public.platform_billing_quote_save('a9010000-0000-4000-8000-000000000001',jsonb_set(current_setting('test.billing_quote')::jsonb,'{scope,productKey}','"academy"'))$q$,'22023','PLATFORM_BILLING_INVALID_QUOTE');
select pg_temp.billing_denied($q$select public.platform_billing_quote_save('a9010000-0000-4000-8000-000000000001',jsonb_set(current_setting('test.billing_quote')::jsonb,'{scope,resourceId}','"not-uuid"'))$q$,'22023','PLATFORM_BILLING_INVALID_QUOTE');
select pg_temp.billing_denied($q$select public.platform_billing_quote_save('a9010000-0000-4000-8000-000000000001',jsonb_set(current_setting('test.billing_quote')::jsonb,'{policies,approved}','false'))$q$,'22023','PLATFORM_BILLING_INVALID_QUOTE');
select pg_temp.billing_denied($q$select public.platform_billing_quote_save('a9010000-0000-4000-8000-000000000001',jsonb_set(current_setting('test.billing_quote')::jsonb,'{nextPayment,dueOn}','"2026-02-30"'))$q$,'22023','PLATFORM_BILLING_INVALID_QUOTE');
select pg_temp.billing_denied($q$select public.platform_billing_quote_save('a9010000-0000-4000-8000-000000000001',jsonb_set(current_setting('test.billing_quote')::jsonb,'{purchaseIntent}','"trial_expired"'))$q$,'22023','PLATFORM_BILLING_INVALID_QUOTE');
select pg_temp.billing_denied($q$select public.platform_billing_attempt_reserve('a9010000-0000-4000-8000-000000000002','fixture-main',pg_temp.billing_consent('fixture-main'))$q$,'P0002','PLATFORM_BILLING_NOT_FOUND');
select pg_temp.billing_denied($q$select public.platform_billing_attempt_reserve('a9010000-0000-4000-8000-000000000001','fixture-main',pg_temp.billing_consent('fixture-main')||'{"totalYen":1}')$q$,'22023','PLATFORM_BILLING_INVALID_CONSENT');
select pg_temp.billing_denied($q$select public.platform_billing_attempt_reserve('a9010000-0000-4000-8000-000000000001','fixture-main',pg_temp.billing_consent('fixture-main')||'{"revision":2}')$q$,'22023','PLATFORM_BILLING_INVALID_CONSENT');
select set_config('test.billing_attempt',public.platform_billing_attempt_reserve('a9010000-0000-4000-8000-000000000001','fixture-main',pg_temp.billing_consent('fixture-main'))::text,true);
select pg_temp.billing_assert((current_setting('test.billing_attempt')::jsonb)->'created'='true','first reserve created true');
select pg_temp.billing_assert(public.platform_billing_attempt_reserve('a9010000-0000-4000-8000-000000000001','fixture-main',pg_temp.billing_consent('fixture-main')) = (current_setting('test.billing_attempt')::jsonb)||'{"created":false}','same reserve one immutable attempt');
select pg_temp.billing_assert((current_setting('test.billing_attempt')::jsonb)->>'provider_idempotency_key'='platform-checkout-'||((current_setting('test.billing_attempt')::jsonb)->>'attempt_id'),'PII-free provider key');
select pg_temp.billing_denied($q$select public.platform_billing_attempt_mark_ready('a9010000-0000-4000-8000-000000000001',((current_setting('test.billing_attempt')::jsonb)->>'attempt_id')::uuid,'cs_live_NotAllowed',repeat('a',64))$q$,'22023','PLATFORM_BILLING_INVALID_PROVIDER_RESULT');
select pg_temp.billing_denied($q$select public.platform_billing_attempt_mark_ready('a9010000-0000-4000-8000-000000000001',((current_setting('test.billing_attempt')::jsonb)->>'attempt_id')::uuid,'cs_test_Fixture','short')$q$,'22023','PLATFORM_BILLING_INVALID_PROVIDER_RESULT');
select set_config('test.billing_ready',public.platform_billing_attempt_mark_ready('a9010000-0000-4000-8000-000000000001',((current_setting('test.billing_attempt')::jsonb)->>'attempt_id')::uuid,'cs_test_Fixture',repeat('a',64))::text,true);
select pg_temp.billing_assert(not ((current_setting('test.billing_ready')::jsonb)?'created'),'mark omits created');
select pg_temp.billing_assert(public.platform_billing_attempt_mark_ready('a9010000-0000-4000-8000-000000000001',((current_setting('test.billing_attempt')::jsonb)->>'attempt_id')::uuid,'cs_test_Fixture',repeat('a',64))=current_setting('test.billing_ready')::jsonb,'provider same result idempotent');
select pg_temp.billing_denied($q$select public.platform_billing_attempt_mark_ready('a9010000-0000-4000-8000-000000000001',((current_setting('test.billing_attempt')::jsonb)->>'attempt_id')::uuid,'cs_test_Different',repeat('a',64))$q$,'23505','PLATFORM_BILLING_PROVIDER_RESULT_CONFLICT');
select pg_temp.billing_denied($q$select public.platform_billing_attempt_mark_ready('a9010000-0000-4000-8000-000000000001',((current_setting('test.billing_attempt')::jsonb)->>'attempt_id')::uuid,'cs_test_Fixture',repeat('b',64))$q$,'23505','PLATFORM_BILLING_PROVIDER_RESULT_CONFLICT');
select pg_temp.billing_assert(public.platform_billing_attempt_mark_uncertain('a9010000-0000-4000-8000-000000000001',((current_setting('test.billing_attempt')::jsonb)->>'attempt_id')::uuid)=current_setting('test.billing_ready')::jsonb,'ready cannot downgrade');
select pg_temp.billing_denied($q$select public.platform_billing_attempt_mark_uncertain('a9010000-0000-4000-8000-000000000002',((current_setting('test.billing_attempt')::jsonb)->>'attempt_id')::uuid)$q$,'P0002','PLATFORM_BILLING_NOT_FOUND');

-- Another product is independent; timeout remains blocked for all new requests.
select public.platform_billing_quote_save('a9010000-0000-4000-8000-000000000001',pg_temp.platform_billing_fixture_quote('a9010000-0000-4000-8000-000000000001','fixture-community','b9010000-0000-4000-8000-000000000002',null,'community_platform'));
select set_config('test.billing_uncertain',public.platform_billing_attempt_reserve('a9010000-0000-4000-8000-000000000001','fixture-community',pg_temp.billing_consent('fixture-community'))::text,true);
select pg_temp.billing_assert(public.platform_billing_attempt_mark_uncertain('a9010000-0000-4000-8000-000000000001',((current_setting('test.billing_uncertain')::jsonb)->>'attempt_id')::uuid)->>'status'='uncertain','timeout retained');
select pg_temp.billing_assert(public.platform_billing_attempt_reserve('a9010000-0000-4000-8000-000000000001','fixture-community',pg_temp.billing_consent('fixture-community'))->'created'='false','timeout retry never fresh provider create');
select public.platform_billing_quote_save('a9010000-0000-4000-8000-000000000001',pg_temp.platform_billing_fixture_quote('a9010000-0000-4000-8000-000000000001','fixture-community-next','b9010000-0000-4000-8000-000000000003',null,'community_platform'));
select pg_temp.billing_denied($q$select public.platform_billing_attempt_reserve('a9010000-0000-4000-8000-000000000001','fixture-community-next',pg_temp.billing_consent('fixture-community-next'))$q$,'23505','PLATFORM_BILLING_SCOPE_PENDING');
-- Prepare an almost-expired independent quote, then cross DB-clock boundary.
select public.platform_billing_quote_save('a9010000-0000-4000-8000-000000000001',jsonb_set(pg_temp.platform_billing_fixture_quote('a9010000-0000-4000-8000-000000000001','fixture-expiring','b9010000-0000-4000-8000-000000000004','c9010000-0000-4000-8000-000000000001'),'{expiresAt}',to_jsonb(to_char((clock_timestamp()+interval '200 milliseconds') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))));
select pg_sleep(0.3);
select pg_temp.billing_denied($q$select public.platform_billing_attempt_reserve('a9010000-0000-4000-8000-000000000001','fixture-expiring',pg_temp.billing_consent('fixture-expiring'))$q$,'22023','PLATFORM_BILLING_QUOTE_EXPIRED');
reset role;
select pg_temp.billing_assert((select count(*)=2 from platform_billing_private.attempts),'no duplicate attempts');
select pg_temp.billing_assert((select count(*)=0 from platform_billing_private.attempts where status not in ('prepared','provider_ready','uncertain')),'no paid state');
select pg_temp.billing_denied($q$update platform_billing_private.quotes set payload='{}' where quote_id='fixture-main'$q$,'42501','PLATFORM_BILLING_IMMUTABLE');
select pg_temp.billing_denied($q$update platform_billing_private.attempts set plan_key='other'$q$,'42501','PLATFORM_BILLING_IMMUTABLE');
select pg_temp.billing_denied($q$delete from platform_billing_private.attempts$q$,'42501','PLATFORM_BILLING_IMMUTABLE');
select pg_temp.billing_denied($q$truncate platform_billing_private.quotes cascade$q$,'42501','PLATFORM_BILLING_IMMUTABLE');
select 'platform_billing_checkout_ledger_test_ok' as result;
