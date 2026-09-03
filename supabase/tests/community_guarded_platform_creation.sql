-- Run after the common creation-entitlement ledger migration and
-- 20260901130000_community_guarded_platform_creation.sql. All fixtures rollback.
begin;

create function pg_temp.community_create_assert(ok boolean, label text)
returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'community create assertion failed: %', label; end if; end $$;

create function pg_temp.community_create_denied(statement text, code text, message text default null)
returns void language plpgsql as $$
declare actual_code text; actual_message text;
begin
  begin execute statement; exception when others then
    get stacked diagnostics actual_code=returned_sqlstate,actual_message=message_text;
  end;
  if actual_code is distinct from code or (message is not null and actual_message is distinct from message) then
    raise exception 'expected % / %, got % / %',code,message,actual_code,actual_message;
  end if;
end $$;

insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
 ('c9010000-0000-4000-8000-000000000001','creator-one@example.invalid','{}','{}',now(),now()),
 ('c9010000-0000-4000-8000-000000000002','creator-two@example.invalid','{}','{}',now(),now()),
 ('c9010000-0000-4000-8000-000000000003','creator-anon@example.invalid','{}','{}',now(),now()),
 ('c9010000-0000-4000-8000-000000000004','creator-rollback@example.invalid','{}','{}',now(),now()),
 ('c9010000-0000-4000-8000-000000000005','creator-future@example.invalid','{}','{}',now(),now()),
 ('c9010000-0000-4000-8000-000000000006','creator-academy@example.invalid','{}','{}',now(),now()),
 ('c9010000-0000-4000-8000-000000000007','creator-revoked@example.invalid','{}','{}',now(),now());

insert into platform_billing_private.creation_entitlements
 (id,actor_user_id,product_key,plan_key,source_kind,source_attempt_id,idempotency_key,status,starts_at,expires_at)
values
 ('c9020000-0000-4000-8000-000000000001','c9010000-0000-4000-8000-000000000001','community_platform','starter','verified_paid','c9030000-0000-4000-8000-000000000001','c9040000-0000-4000-8000-000000000001','available',now()-interval '1 minute',null),
 ('c9020000-0000-4000-8000-000000000002','c9010000-0000-4000-8000-000000000002','community_platform','starter','verified_trial','c9030000-0000-4000-8000-000000000002','c9040000-0000-4000-8000-000000000002','available',now()-interval '2 days',now()-interval '1 day'),
 ('c9020000-0000-4000-8000-000000000003','c9010000-0000-4000-8000-000000000006','academy_platform','small','verified_paid','c9030000-0000-4000-8000-000000000003','c9040000-0000-4000-8000-000000000003','available',now()-interval '1 minute',null),
 ('c9020000-0000-4000-8000-000000000005','c9010000-0000-4000-8000-000000000007','community_platform','starter','verified_paid','c9030000-0000-4000-8000-000000000005','c9040000-0000-4000-8000-000000000005','revoked',now()-interval '1 minute',null),
 ('c9020000-0000-4000-8000-000000000006','c9010000-0000-4000-8000-000000000005','community_platform','starter','verified_paid','c9030000-0000-4000-8000-000000000006','c9040000-0000-4000-8000-000000000006','available',now()+interval '1 day',null),
 ('c9020000-0000-4000-8000-000000000007','c9010000-0000-4000-8000-000000000004','community_platform','starter','verified_paid','c9030000-0000-4000-8000-000000000007','c9040000-0000-4000-8000-000000000007','available',now()-interval '1 minute',null);

select pg_temp.community_create_assert(
  not has_function_privilege('anon','public.community_create_with_platform_entitlement(text,text,text,text)','execute'),
  'anon cannot call guarded create');
select pg_temp.community_create_assert(
  not has_function_privilege('authenticated','public.community_create(text,text,text,text)','execute'),
  'legacy create bypass revoked');
select pg_temp.community_create_assert(
  not has_table_privilege('authenticated','platform_billing_private.creation_entitlements','select,insert,update,delete,truncate'),
  'ledger direct access denied');

set local role anon;
select pg_temp.community_create_denied(
 $$select public.community_create_with_platform_entitlement('No Auth','no-auth-community',null,'No auth')$$,
 '42501');
reset role;

select set_config('request.jwt.claims','{"role":"authenticated","is_anonymous":false,"sub":"c9010000-0000-4000-8000-000000000005"}',true);
select set_config('request.jwt.claim.sub','c9010000-0000-4000-8000-000000000005',true);
set local role authenticated;
select pg_temp.community_create_denied(
 $$select public.community_create_with_platform_entitlement('Future Community','future-community',null,'Future')$$,
 '40001','COMMUNITY_CREATE_ENTITLEMENT_CONFLICT');
reset role;

select set_config('request.jwt.claims','{"role":"authenticated","is_anonymous":false,"sub":"c9010000-0000-4000-8000-000000000006"}',true);
select set_config('request.jwt.claim.sub','c9010000-0000-4000-8000-000000000006',true);
set local role authenticated;
select pg_temp.community_create_denied(
 $$select public.community_create_with_platform_entitlement('Academy Grant','academy-grant',null,'Academy')$$,
 '40001','COMMUNITY_CREATE_ENTITLEMENT_CONFLICT');
reset role;

select set_config('request.jwt.claims','{"role":"authenticated","is_anonymous":false,"sub":"c9010000-0000-4000-8000-000000000007"}',true);
select set_config('request.jwt.claim.sub','c9010000-0000-4000-8000-000000000007',true);
set local role authenticated;
select pg_temp.community_create_denied(
 $$select public.community_create_with_platform_entitlement('Revoked Grant','revoked-grant',null,'Revoked')$$,
 '40001','COMMUNITY_CREATE_ENTITLEMENT_CONFLICT');
reset role;

select set_config('request.jwt.claims','{"role":"authenticated","is_anonymous":true,"sub":"c9010000-0000-4000-8000-000000000003"}',true);
select set_config('request.jwt.claim.sub','c9010000-0000-4000-8000-000000000003',true);
set local role authenticated;
select pg_temp.community_create_denied(
 $$select public.community_create_with_platform_entitlement('Anon Community','anon-community',null,'Anon')$$,
 '42501','COMMUNITY_CREATE_ANONYMOUS_DENIED');
reset role;

select set_config('request.jwt.claims','{"role":"authenticated","is_anonymous":false,"sub":"c9010000-0000-4000-8000-000000000002"}',true);
select set_config('request.jwt.claim.sub','c9010000-0000-4000-8000-000000000002',true);
set local role authenticated;
select pg_temp.community_create_denied(
 $$select public.community_create_with_platform_entitlement('Wrong Community','wrong-community',null,'Wrong')$$,
 '40001','COMMUNITY_CREATE_ENTITLEMENT_CONFLICT');
reset role;

select set_config('request.jwt.claims','{"role":"authenticated","is_anonymous":false,"sub":"c9010000-0000-4000-8000-000000000001"}',true);
select set_config('request.jwt.claim.sub','c9010000-0000-4000-8000-000000000001',true);
set local role authenticated;
select public.community_create_with_platform_entitlement('Creator Community','creator-community',null,'Creator');
select pg_temp.community_create_denied(
 $$select public.community_create_with_platform_entitlement('Duplicate Community','duplicate-community',null,'Creator')$$,
 '40001','COMMUNITY_CREATE_ENTITLEMENT_CONFLICT');
reset role;

select pg_temp.community_create_assert(
 (select count(*)=1 from public.community_communities where owner_user_id='c9010000-0000-4000-8000-000000000001'),
 'exactly one Community created');
select pg_temp.community_create_assert(
 (select status='consumed' and resource_id is not null and consumed_at is not null
    from platform_billing_private.creation_entitlements where id='c9020000-0000-4000-8000-000000000001'),
 'entitlement consumed and bound');
select pg_temp.community_create_assert(
 (select count(*)=1 from public.community_memberships
   where user_id='c9010000-0000-4000-8000-000000000001' and role='owner' and status='active'),
 'owner membership created once');

create function pg_temp.fail_rollback_membership() returns trigger language plpgsql as $$
begin
  if new.user_id='c9010000-0000-4000-8000-000000000004'::uuid then
    raise exception 'FIXTURE_AFTER_RESOURCE_INSERT_FAILURE';
  end if;
  return new;
end $$;
create trigger community_create_fixture_failure before insert on public.community_memberships
for each row execute function pg_temp.fail_rollback_membership();
select set_config('request.jwt.claims','{"role":"authenticated","is_anonymous":false,"sub":"c9010000-0000-4000-8000-000000000004"}',true);
select set_config('request.jwt.claim.sub','c9010000-0000-4000-8000-000000000004',true);
set local role authenticated;
select pg_temp.community_create_denied(
 $$select public.community_create_with_platform_entitlement('Rollback Community','rollback-community',null,'Rollback')$$,
 'P0001','FIXTURE_AFTER_RESOURCE_INSERT_FAILURE');
reset role;
drop trigger community_create_fixture_failure on public.community_memberships;
select pg_temp.community_create_assert(
  not exists(select 1 from public.community_communities where owner_user_id='c9010000-0000-4000-8000-000000000004'),
  'resource insert rolled back');
select pg_temp.community_create_assert(
  (select status='available' and resource_id is null from platform_billing_private.creation_entitlements
   where id='c9020000-0000-4000-8000-000000000007'),
  'entitlement consumption rolled back');

rollback;
