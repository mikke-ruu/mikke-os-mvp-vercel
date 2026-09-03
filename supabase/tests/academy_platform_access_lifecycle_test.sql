-- Disposable PostgreSQL only. Caller owns BEGIN/ROLLBACK.
-- Apply the common resource_access_window migration and all Academy migrations
-- through 20260903193000 before this test.

create function pg_temp.academy_lifecycle_assert(ok boolean, label text)
returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'academy lifecycle assertion failed: %',label; end if; end $$;

create function pg_temp.academy_lifecycle_denied(statement text, expected text)
returns void language plpgsql as $$
declare actual text;
begin
  begin execute statement; exception when others then actual:=sqlerrm; end;
  if actual is null or position(expected in actual)=0 then raise exception 'expected %, got %',expected,actual; end if;
end $$;

create temporary table academy_lifecycle_windows(
  resource_id uuid primary key, actor_user_id uuid not null, status text not null,
  period_start timestamptz not null, period_end timestamptz not null,
  write_allowed boolean not null, owner_read_until timestamptz, anonymize_after timestamptz
);

create or replace function platform_billing_private.resource_access_window(text,uuid,timestamptz)
returns table(actor_user_id uuid,status text,current_period_start timestamptz,current_period_end timestamptz,
  write_allowed boolean,owner_read_until timestamptz,anonymize_after timestamptz)
language sql stable security definer set search_path='' as $$
  select fixture.actor_user_id,fixture.status,fixture.period_start,fixture.period_end,
    fixture.write_allowed,fixture.owner_read_until,fixture.anonymize_after
  from pg_temp.academy_lifecycle_windows fixture where $1='academy_platform' and fixture.resource_id=$2
$$;

insert into auth.users(id,is_anonymous) values
 ('ac030000-0000-4000-8000-000000000001',false),('ac030000-0000-4000-8000-000000000002',false),
 ('ac030000-0000-4000-8000-000000000003',false),('ac030000-0000-4000-8000-000000000004',true);
insert into public.profiles(id,user_id,display_name,handle,member_number) values
 ('bc030000-0000-4000-8000-000000000001','ac030000-0000-4000-8000-000000000001','Active','lifecycle_active',999300001),
 ('bc030000-0000-4000-8000-000000000002','ac030000-0000-4000-8000-000000000002','Past Due','lifecycle_due',999300002),
 ('bc030000-0000-4000-8000-000000000003','ac030000-0000-4000-8000-000000000003','Ended','lifecycle_ended',999300003),
 ('bc030000-0000-4000-8000-000000000004','ac030000-0000-4000-8000-000000000004','Anonymous','lifecycle_anon',999300004);
insert into public.academy_headquarters(id,owner_user_id,owner_profile_id,name,handle,plan,is_active) values
 ('cc030000-0000-4000-8000-000000000001','ac030000-0000-4000-8000-000000000001','bc030000-0000-4000-8000-000000000001','Active HQ','active-hq','small',true),
 ('cc030000-0000-4000-8000-000000000002','ac030000-0000-4000-8000-000000000002','bc030000-0000-4000-8000-000000000002','Past Due HQ','due-hq','small',true),
 ('cc030000-0000-4000-8000-000000000003','ac030000-0000-4000-8000-000000000003','bc030000-0000-4000-8000-000000000003','Ended HQ','ended-hq','small',true);
insert into public.academy_headquarters_access_states(headquarters_id,owner_user_id,access_kind,status,starts_at,paid_started_at) values
 ('cc030000-0000-4000-8000-000000000001','ac030000-0000-4000-8000-000000000001','paid','active',now()-interval'1 day',now()-interval'1 day'),
 ('cc030000-0000-4000-8000-000000000002','ac030000-0000-4000-8000-000000000002','paid','active',now()-interval'1 day',now()-interval'1 day'),
 ('cc030000-0000-4000-8000-000000000003','ac030000-0000-4000-8000-000000000003','paid','active',now()-interval'100 days',now()-interval'100 days');

-- The retention worker must lock the authoritative subscription and its
-- consumed entitlement before its final access-window recheck. These rows are
-- deliberately real common-ledger fixtures even though the projection below
-- is replaced with a deterministic test double.
insert into platform_billing_private.scopes(id,owner_user_id,product_key,resource_id) values
 ('fc030000-0000-4000-8000-000000000003','ac030000-0000-4000-8000-000000000003','academy_platform','cc030000-0000-4000-8000-000000000003');
insert into platform_billing_private.quotes(
 quote_id,scope_id,owner_user_id,product_key,resource_id,plan_key,request_id,revision,payload,issued_at,expires_at
) values (
 'academy-lifecycle-ended','fc030000-0000-4000-8000-000000000003','ac030000-0000-4000-8000-000000000003',
 'academy_platform','cc030000-0000-4000-8000-000000000003','small','gc030000-0000-4000-8000-000000000003',1,
 jsonb_build_object(
   'quoteId','academy-lifecycle-ended','revision',1,
   'scope',jsonb_build_object('ownerUserId','ac030000-0000-4000-8000-000000000003','productKey','academy_platform',
     'resourceId','cc030000-0000-4000-8000-000000000003','planKey','small','requestId','gc030000-0000-4000-8000-000000000003'),
   'issuedAt',to_char((statement_timestamp()-interval'121 days') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
   'expiresAt',to_char((statement_timestamp()-interval'120 days') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
 ), statement_timestamp()-interval'121 days',statement_timestamp()-interval'120 days'
 );
insert into platform_billing_private.attempts(
 id,scope_id,owner_user_id,product_key,resource_id,plan_key,request_id,quote_id,quote_revision,consent,
 status,provider_idempotency_key,provider_session_id,provider_result_hash
) values (
 'fd030000-0000-4000-8000-000000000003','fc030000-0000-4000-8000-000000000003','ac030000-0000-4000-8000-000000000003',
 'academy_platform','cc030000-0000-4000-8000-000000000003','small','gc030000-0000-4000-8000-000000000003',
 'academy-lifecycle-ended',1,'{}'::jsonb,'provider_ready',
 'platform-checkout-fd030000-0000-4000-8000-000000000003','cs_test_AcademyLifecycleEnded',repeat('a',64)
 );
insert into platform_billing_private.subscriptions(
 id,actor_user_id,product_key,plan_key,source_attempt_id,provider_customer_id,provider_subscription_id,
 initial_amount_yen,currency,status,original_paid_at,current_period_start,current_period_end
) values (
 'fe030000-0000-4000-8000-000000000003','ac030000-0000-4000-8000-000000000003','academy_platform','small',
 'fd030000-0000-4000-8000-000000000003','cus_AcademyLifecycleEnded','sub_AcademyLifecycleEnded',5000,'jpy','ended',
 statement_timestamp()-interval'120 days',statement_timestamp()-interval'120 days',statement_timestamp()-interval'100 days'
 );
insert into platform_billing_private.creation_entitlements(
 id,actor_user_id,product_key,plan_key,source_kind,source_attempt_id,idempotency_key,status,starts_at,expires_at,resource_id,consumed_at
) values (
 'ff030000-0000-4000-8000-000000000003','ac030000-0000-4000-8000-000000000003','academy_platform','small','verified_paid',
 'fd030000-0000-4000-8000-000000000003','fa030000-0000-4000-8000-000000000003','consumed',
 statement_timestamp()-interval'120 days',statement_timestamp()-interval'100 days','cc030000-0000-4000-8000-000000000003',statement_timestamp()-interval'120 days'
 );
insert into pg_temp.academy_lifecycle_windows values
 ('cc030000-0000-4000-8000-000000000001','ac030000-0000-4000-8000-000000000001','active',now()-interval'1 day',now()+interval'29 days',true,null,null),
 ('cc030000-0000-4000-8000-000000000002','ac030000-0000-4000-8000-000000000002','active',now()-interval'1 day',now()+interval'29 days',true,null,null),
 ('cc030000-0000-4000-8000-000000000003','ac030000-0000-4000-8000-000000000003','active',now()-interval'1 day',now()+interval'29 days',true,null,null);
insert into public.academy_courses(id,headquarters_id,user_id,code,name,formats,is_published) values
 ('dc030000-0000-4000-8000-000000000001','cc030000-0000-4000-8000-000000000001','ac030000-0000-4000-8000-000000000001','ACTIVE','Active course',array['online'],false),
 ('dc030000-0000-4000-8000-000000000002','cc030000-0000-4000-8000-000000000002','ac030000-0000-4000-8000-000000000002','DUE','Due course',array['online'],false),
 ('dc030000-0000-4000-8000-000000000003','cc030000-0000-4000-8000-000000000003','ac030000-0000-4000-8000-000000000003','ENDED','Ended course',array['online'],true);
insert into public.academy_applications(id,headquarters_id,course_id,intake_source,applicant_name,applicant_email,price,status,payment_status,payment_provider,certification_status)
values('ec030000-0000-4000-8000-000000000003','cc030000-0000-4000-8000-000000000003','dc030000-0000-4000-8000-000000000003','honbu','Retained Learner','retained@example.invalid',1000,'completed','paid','manual','certified');

update pg_temp.academy_lifecycle_windows set status='past_due',period_start=now()-interval'31 days',period_end=now()-interval'1 day',write_allowed=false
where resource_id='cc030000-0000-4000-8000-000000000002';
update pg_temp.academy_lifecycle_windows set status='ended',period_start=now()-interval'120 days',period_end=now()-interval'100 days',write_allowed=false,
  owner_read_until=now()+interval'1 day',anonymize_after=now()+interval'1 day'
where resource_id='cc030000-0000-4000-8000-000000000003';

set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","is_anonymous":false,"sub":"ac030000-0000-4000-8000-000000000001"}',true);
update public.academy_courses set name='Active write succeeds' where id='dc030000-0000-4000-8000-000000000001';
reset role;
select pg_temp.academy_lifecycle_assert((select name='Active write succeeds' from public.academy_courses where id='dc030000-0000-4000-8000-000000000001'),'active write succeeds');

set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","is_anonymous":false,"sub":"ac030000-0000-4000-8000-000000000002"}',true);
select pg_temp.academy_lifecycle_denied($q$update public.academy_courses set name='blocked' where id='dc030000-0000-4000-8000-000000000002'$q$,'academy_access_inactive');
reset role;
select pg_temp.academy_lifecycle_assert(true,'past_due write denied');

set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","is_anonymous":false,"sub":"ac030000-0000-4000-8000-000000000003"}',true);
select pg_temp.academy_lifecycle_assert(public.academy_export_my_headquarters('cc030000-0000-4000-8000-000000000003') is not null,'ended owner export within 90 days');
reset role;

update pg_temp.academy_lifecycle_windows set owner_read_until=now()-interval'1 second',anonymize_after=now()-interval'1 second' where resource_id='cc030000-0000-4000-8000-000000000003';
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","is_anonymous":false,"sub":"ac030000-0000-4000-8000-000000000003"}',true);
select pg_temp.academy_lifecycle_denied($q$select public.academy_export_my_headquarters('cc030000-0000-4000-8000-000000000003')$q$,'academy_export_unavailable');
reset role;
select pg_temp.academy_lifecycle_assert(true,'ended owner export after 90 days denied');

update pg_temp.academy_lifecycle_windows set status='active',period_start=now(),period_end=now()+interval'1 month',write_allowed=true where resource_id='cc030000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","is_anonymous":false,"sub":"ac030000-0000-4000-8000-000000000002"}',true);
update public.academy_courses set name='Reactivated write succeeds' where id='dc030000-0000-4000-8000-000000000002';
reset role;
select pg_temp.academy_lifecycle_assert((select name='Reactivated write succeeds' from public.academy_courses where id='dc030000-0000-4000-8000-000000000002'),'reactivated write succeeds');

update pg_temp.academy_lifecycle_windows set status='ended',owner_read_until=now()+interval'1 day',anonymize_after=now()+interval'1 day' where resource_id='cc030000-0000-4000-8000-000000000003';
select pg_temp.academy_lifecycle_denied($q$select private.academy_anonymize_ended_headquarters_at('cc030000-0000-4000-8000-000000000003',now())$q$,'academy_anonymization_not_due');
select pg_temp.academy_lifecycle_assert(true,'anonymization before boundary denied');
update pg_temp.academy_lifecycle_windows set owner_read_until=now()-interval'1 day',anonymize_after=now()-interval'1 day' where resource_id='cc030000-0000-4000-8000-000000000003';
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.academy_anonymize_ended_headquarters('cc030000-0000-4000-8000-000000000003');
reset role;
select pg_temp.academy_lifecycle_assert((select count(*)=1 and min(applicant_name)='匿名化済み' from public.academy_applications where headquarters_id='cc030000-0000-4000-8000-000000000003'),'history rows retained');

set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","is_anonymous":true,"sub":"ac030000-0000-4000-8000-000000000004"}',true);
select pg_temp.academy_lifecycle_denied($q$select public.academy_export_my_headquarters('cc030000-0000-4000-8000-000000000003')$q$,'academy_export_authentication_required');
reset role;
select pg_temp.academy_lifecycle_assert(true,'anonymous export denied');

select 'academy_platform_access_lifecycle_test_ok' as result;
