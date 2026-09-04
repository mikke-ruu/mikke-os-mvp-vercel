-- Run only after 20260904013000 in a disposable PostgreSQL 17 database whose
-- baseline contains the two fixed production recovery targets. This file owns
-- its transaction and leaves no committed rows.
begin;

create or replace function pg_temp.academy_recovery_assert(p_condition boolean, p_message text)
returns void language plpgsql as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'academy_recovery_assertion_failed: %', p_message;
  end if;
end;
$$;

create or replace function pg_temp.academy_recovery_assert_raises(p_sql text, p_expected text)
returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'academy_recovery_expected_error_not_raised: %', p_expected;
exception
  when others then
    if sqlerrm = 'academy_recovery_expected_error_not_raised: ' || p_expected
      or position(p_expected in sqlerrm) = 0 then
      raise;
    end if;
end;
$$;

-- Replace only the legacy projection inside this rollback transaction so the
-- precedence contract can exercise active, past_due and ended deterministically.
alter function platform_billing_private.resource_access_window_customer_legacy(text, uuid, timestamptz)
  rename to resource_access_window_customer_test_original;

create function platform_billing_private.resource_access_window_customer_legacy(
  p_product_key text, p_resource_id uuid, p_at timestamptz
)
returns table (
  actor_user_id uuid, status text, current_period_start timestamptz,
  current_period_end timestamptz, write_allowed boolean,
  owner_read_until timestamptz, anonymize_after timestamptz
)
language sql stable security definer set search_path = '' as $$
  select headquarters.owner_user_id,
         test_state.status,
         p_at - interval '1 day',
         p_at + interval '1 day',
         test_state.status = 'active',
         case when test_state.status = 'ended' then p_at + interval '90 days' end,
         case when test_state.status = 'ended' then p_at + interval '90 days' end
  from public.academy_headquarters headquarters
  cross join lateral (
    select nullif(pg_catalog.current_setting('app.academy_recovery_customer_status', true), '') as status
  ) test_state
  where headquarters.id = p_resource_id
    and p_product_key = 'academy_platform'
    and test_state.status in ('active', 'past_due', 'ended');
$$;

insert into auth.users (
  id, aud, role, email, email_confirmed_at, raw_app_meta_data,
  raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous
) values
  ('a9400000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'academy-recovery-owner@example.invalid', now(), '{}'::jsonb, '{}'::jsonb, now(), now(), false, false),
  ('a9400000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'academy-recovery-admin@example.invalid', now(), '{}'::jsonb, '{}'::jsonb, now(), now(), false, false),
  ('a9400000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'academy-recovery-editor@example.invalid', now(), '{}'::jsonb, '{}'::jsonb, now(), now(), false, false),
  ('a9400000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'academy-recovery-other@example.invalid', now(), '{}'::jsonb, '{}'::jsonb, now(), now(), false, false);

insert into public.profiles (id, user_id, display_name, handle, member_number) values
  ('b9400000-0000-4000-8000-000000000001', 'a9400000-0000-4000-8000-000000000001', 'Recovery Owner', 'academy_recovery_owner', 999400001),
  ('b9400000-0000-4000-8000-000000000002', 'a9400000-0000-4000-8000-000000000002', 'Recovery Admin', 'academy_recovery_admin', 999400002),
  ('b9400000-0000-4000-8000-000000000003', 'a9400000-0000-4000-8000-000000000003', 'Recovery Editor', 'academy_recovery_editor', 999400003),
  ('b9400000-0000-4000-8000-000000000004', 'a9400000-0000-4000-8000-000000000004', 'Recovery Other', 'academy_recovery_other', 999400004);

insert into public.academy_headquarters (
  id, owner_user_id, owner_profile_id, name, handle, plan, is_active
) values (
  'c9400000-0000-4000-8000-000000000001',
  'a9400000-0000-4000-8000-000000000001',
  'b9400000-0000-4000-8000-000000000001',
  'Recovery Academy', 'academy-recovery-test', 'small', true
);

insert into public.academy_headquarters_access_states (
  headquarters_id, owner_user_id, access_kind, status, starts_at, paid_started_at
) values (
  'c9400000-0000-4000-8000-000000000001',
  'a9400000-0000-4000-8000-000000000001',
  'paid', 'active', now() - interval '1 day', now() - interval '1 day'
);

insert into public.academy_headquarters_members (
  headquarters_id, member_profile_id, role, status, invited_by_user_id
) values
  ('c9400000-0000-4000-8000-000000000001', 'b9400000-0000-4000-8000-000000000002', 'administrator', 'active', 'a9400000-0000-4000-8000-000000000001'),
  ('c9400000-0000-4000-8000-000000000001', 'b9400000-0000-4000-8000-000000000003', 'course_editor', 'active', 'a9400000-0000-4000-8000-000000000001');

insert into platform_billing_private.internal_resource_grants (
  actor_user_id, product_key, resource_id, purpose, reason, granted_by,
  evidence, starts_at, expires_at
) values (
  'a9400000-0000-4000-8000-000000000001', 'academy_platform',
  'c9400000-0000-4000-8000-000000000001', 'test_only',
  'Academy recovery isolated fixture',
  'a9400000-0000-4000-8000-000000000001',
  'Isolated rollback test', now() - interval '1 day', null
);

select pg_temp.academy_recovery_assert(
  (select status = 'internal_grant' and write_allowed
   from platform_billing_private.resource_access_window(
     'academy_platform', 'c9400000-0000-4000-8000-000000000001', now()
   )),
  'internal grant should restore an unbound internal Academy'
);

select set_config('app.academy_recovery_customer_status', 'active', true);
select pg_temp.academy_recovery_assert(
  (select status = 'active' and write_allowed
   from platform_billing_private.resource_access_window(
     'academy_platform', 'c9400000-0000-4000-8000-000000000001', now()
   )),
  'customer active must be authoritative'
);

select set_config('app.academy_recovery_customer_status', 'past_due', true);
select pg_temp.academy_recovery_assert(
  (select status = 'past_due' and not write_allowed
   from platform_billing_private.resource_access_window(
     'academy_platform', 'c9400000-0000-4000-8000-000000000001', now()
   )),
  'customer past_due must not fall back to internal grant'
);

select set_config('app.academy_recovery_customer_status', 'ended', true);
select pg_temp.academy_recovery_assert(
  (select status = 'ended' and not write_allowed
   from platform_billing_private.resource_access_window(
     'academy_platform', 'c9400000-0000-4000-8000-000000000001', now()
   )),
  'customer ended must not revive through internal grant'
);
select set_config('app.academy_recovery_customer_status', '', true);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a9400000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}', true);
insert into public.academy_courses (headquarters_id, user_id, code, name, formats, requires_kit)
values ('c9400000-0000-4000-8000-000000000001', 'a9400000-0000-4000-8000-000000000001', 'RECOVERY-OWNER', 'Owner recovery course', array['online'], false);
select public.academy_update_headquarters_profile('c9400000-0000-4000-8000-000000000001', '{"name":"Recovery Academy"}'::jsonb);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a9400000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}', true);
insert into public.academy_courses (headquarters_id, user_id, code, name, formats, requires_kit)
values ('c9400000-0000-4000-8000-000000000001', 'a9400000-0000-4000-8000-000000000002', 'RECOVERY-ADMIN', 'Admin recovery course', array['online'], false);
select public.academy_update_headquarters_profile('c9400000-0000-4000-8000-000000000001', '{"name":"Recovery Academy"}'::jsonb);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a9400000-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":false}', true);
insert into public.academy_courses (headquarters_id, user_id, code, name, formats, requires_kit)
values ('c9400000-0000-4000-8000-000000000001', 'a9400000-0000-4000-8000-000000000003', 'RECOVERY-EDITOR', 'Editor recovery course', array['online'], false);
select pg_temp.academy_recovery_assert_raises(
  $$select public.academy_update_headquarters_profile('c9400000-0000-4000-8000-000000000001', '{"name":"Forbidden editor update"}'::jsonb)$$,
  'academy_headquarters_forbidden'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a9400000-0000-4000-8000-000000000004","role":"authenticated","is_anonymous":false}', true);
select pg_temp.academy_recovery_assert_raises(
  $$insert into public.academy_courses (headquarters_id, user_id, code, name, formats, requires_kit)
    values ('c9400000-0000-4000-8000-000000000001', 'a9400000-0000-4000-8000-000000000004', 'RECOVERY-OTHER', 'Other recovery course', array['online'], false)$$,
  'row-level security'
);

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select pg_temp.academy_recovery_assert_raises(
  $$insert into public.academy_courses (headquarters_id, user_id, code, name, formats, requires_kit)
    values ('c9400000-0000-4000-8000-000000000001', 'a9400000-0000-4000-8000-000000000004', 'RECOVERY-ANON', 'Anonymous recovery course', array['online'], false)$$,
  'permission denied'
);

reset role;
select pg_temp.academy_recovery_assert(
  (select count(*) from platform_billing_private.internal_resource_grants
   where product_key = 'academy_platform'
     and resource_id in (select id from public.academy_headquarters where handle in ('ayumi-academy', 'admin_78e6-academy'))) = 2,
  'fixed production grant count mismatch'
);
select pg_temp.academy_recovery_assert(
  exists (select 1 from platform_billing_private.internal_resource_grants where product_key = 'community_platform'),
  'Community internal grants regressed'
);

select 'academy_internal_resource_access_recovery_ok' as sentinel;
rollback;
