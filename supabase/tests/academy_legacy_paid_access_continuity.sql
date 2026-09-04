begin;

create or replace function pg_temp.academy_continuity_assert(p_condition boolean, p_message text)
returns void language plpgsql as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'academy_continuity_assertion_failed: %', p_message;
  end if;
end;
$$;

select pg_temp.academy_continuity_assert(
  (select count(*) from platform_billing_private.internal_resource_grants
   where product_key = 'academy_platform' and purpose = 'legacy_paid_continuity') = 2,
  'the two state-selected pre-cutover paid headquarters must be preserved'
);

select pg_temp.academy_continuity_assert(
  not exists (
    select 1
    from platform_billing_private.internal_resource_grants grant_record
    where grant_record.product_key = 'academy_platform'
      and grant_record.purpose = 'legacy_paid_continuity'
      and (grant_record.expires_at is not null or grant_record.revoked_at is not null)
  ),
  'legacy paid continuity must not be converted into a temporary trial'
);

select pg_temp.academy_continuity_assert(
  not exists (
    select 1
    from platform_billing_private.internal_resource_grants grant_record
    cross join lateral platform_billing_private.resource_access_window(
      grant_record.product_key, grant_record.resource_id, now()
    ) access_window
    where grant_record.product_key = 'academy_platform'
      and grant_record.purpose = 'legacy_paid_continuity'
      and (access_window.status is distinct from 'internal_grant' or not access_window.write_allowed)
  ),
  'preserved paid headquarters must remain writable'
);

insert into auth.users (
  id, aud, role, email, email_confirmed_at, raw_app_meta_data,
  raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous
) values
  ('a9500000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'continuity-other@example.invalid', now(), '{}'::jsonb, '{}'::jsonb, now(), now(), false, false);

insert into public.profiles (id, user_id, display_name, handle, member_number) values
  ('b9500000-0000-4000-8000-000000000002', 'a9500000-0000-4000-8000-000000000002', 'Continuity Other', 'continuity_other', 999500002);

create temporary table academy_continuity_target on commit drop as
select actor_user_id, resource_id
from platform_billing_private.internal_resource_grants
where product_key = 'academy_platform' and purpose = 'legacy_paid_continuity'
order by resource_id
limit 1;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select actor_user_id from academy_continuity_target),
    'role', 'authenticated',
    'is_anonymous', false
  )::text,
  true
);

select pg_temp.academy_continuity_assert(
  public.academy_get_my_headquarters_role((select resource_id from academy_continuity_target)) = 'owner',
  'preserved headquarters owner must retain the owner role'
);

select pg_temp.academy_continuity_assert(
  (select status = 'internal_grant' and can_manage_drafts and can_use_live_features
   from public.academy_get_my_headquarters_access((select resource_id from academy_continuity_target))),
  'preserved headquarters owner must retain paid write access'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a9500000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}', true);
select pg_temp.academy_continuity_assert(
  public.academy_get_my_headquarters_role((select resource_id from academy_continuity_target)) is null,
  'another user must not gain owner access'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a9500000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":true}', true);
select pg_temp.academy_continuity_assert(
  public.academy_get_my_headquarters_role((select resource_id from academy_continuity_target)) is null,
  'anonymous auth must not gain owner access'
);

reset role;
select 'academy_legacy_paid_access_continuity_ok' as sentinel;
rollback;
