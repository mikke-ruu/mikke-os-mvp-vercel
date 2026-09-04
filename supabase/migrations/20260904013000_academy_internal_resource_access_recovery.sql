-- Restore the two explicitly approved internal Academy headquarters after the
-- platform-retention gate made legacy paid rows fail closed. Customer billing
-- remains authoritative whenever a verified paid/trial binding exists.

set lock_timeout = '5s';
set statement_timeout = '60s';

alter table platform_billing_private.internal_resource_grants
  drop constraint internal_resource_grants_product_key_check;

alter table platform_billing_private.internal_resource_grants
  add constraint internal_resource_grants_product_key_check
  check (product_key in ('academy_platform', 'community_platform'));

create or replace function platform_billing_private.resource_access_window(
  p_product_key text,
  p_resource_id uuid,
  p_at timestamptz
)
returns table (
  actor_user_id uuid,
  status text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  write_allowed boolean,
  owner_read_until timestamptz,
  anonymize_after timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v record;
  g platform_billing_private.internal_resource_grants%rowtype;
begin
  select * into v
  from platform_billing_private.resource_access_window_customer_legacy(
    p_product_key,
    p_resource_id,
    p_at
  );

  -- A verified customer binding is always authoritative, including ended or
  -- otherwise non-writable states. Never let an older internal grant revive it.
  if found and v.actor_user_id is not null then
    return query
    select v.actor_user_id, v.status, v.current_period_start,
           v.current_period_end, v.write_allowed, v.owner_read_until,
           v.anonymize_after;
    return;
  end if;

  if p_product_key in ('academy_platform', 'community_platform') then
    select * into g
    from platform_billing_private.internal_resource_grants
    where product_key = p_product_key
      and resource_id = p_resource_id;

    if found and g.revoked_at is null then
      if g.starts_at <= p_at and (g.expires_at is null or g.expires_at > p_at) then
        return query
        select g.actor_user_id, 'internal_grant'::text, g.starts_at,
               g.expires_at, true, null::timestamptz, null::timestamptz;
        return;
      elsif g.expires_at is not null and g.expires_at <= p_at then
        return query
        select g.actor_user_id, 'ended'::text, g.starts_at, g.expires_at,
               false, g.expires_at + interval '90 days',
               g.expires_at + interval '90 days';
        return;
      end if;
    end if;
  end if;

end;
$$;

revoke all on function platform_billing_private.resource_access_window(text, uuid, timestamptz)
  from public, anon, authenticated, service_role;

create or replace function private.academy_owner_read_allowed(
  p_headquarters_id uuid,
  p_at timestamptz
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_kind text;
  v_status text;
  v_owner_read_until timestamptz;
  v_count integer;
begin
  select access.access_kind into v_kind
  from public.academy_headquarters headquarters
  join public.academy_headquarters_access_states access
    on access.headquarters_id = headquarters.id
   and access.owner_user_id = headquarters.owner_user_id
  where headquarters.id = p_headquarters_id;

  if v_kind = 'trial' then return true; end if;
  if v_kind is distinct from 'paid' then return false; end if;

  select count(*), min(access_window.status), min(access_window.owner_read_until)
  into v_count, v_status, v_owner_read_until
  from private.academy_paid_access_window(p_headquarters_id, p_at) access_window;

  if v_count <> 1 then return false; end if;
  if v_status in ('active', 'past_due', 'internal_grant') then return true; end if;
  return v_status = 'ended' and p_at < v_owner_read_until;
end;
$$;

revoke all on function private.academy_owner_read_allowed(uuid, timestamptz)
  from public, anon, authenticated, service_role;

do $recovery$
declare
  v_now timestamptz := clock_timestamp();
  v_count integer;
begin
  select count(*) into v_count
  from public.academy_headquarters headquarters
  join auth.users owner on owner.id = headquarters.owner_user_id
  join public.academy_headquarters_access_states access
    on access.headquarters_id = headquarters.id
   and access.owner_user_id = headquarters.owner_user_id
   and access.access_kind = 'paid'
   and access.status = 'active'
  where (headquarters.name, headquarters.handle) in (
    ('MUSUBI', 'ayumi-academy'),
    ('mikkeOS Official Academy', 'admin_78e6-academy')
  )
    and headquarters.is_active = true
    and coalesce(owner.is_anonymous, false) = false;

  if v_count <> 2 then
    raise exception using
      errcode = '55000',
      message = 'PLATFORM_BILLING_ACADEMY_INTERNAL_RECOVERY_PREFLIGHT';
  end if;

  if exists (
    select 1
    from public.academy_headquarters headquarters
    join platform_billing_private.creation_entitlements entitlement
      on entitlement.resource_id = headquarters.id
     and entitlement.product_key = 'academy_platform'
     and entitlement.source_kind in ('verified_paid', 'verified_trial')
    where (headquarters.name, headquarters.handle) in (
      ('MUSUBI', 'ayumi-academy'),
      ('mikkeOS Official Academy', 'admin_78e6-academy')
    )
  ) then
    raise exception using
      errcode = '55000',
      message = 'PLATFORM_BILLING_ACADEMY_INTERNAL_RECOVERY_HAS_CUSTOMER_BINDING';
  end if;

  insert into platform_billing_private.internal_resource_grants (
    actor_user_id,
    product_key,
    resource_id,
    purpose,
    reason,
    granted_by,
    evidence,
    starts_at,
    expires_at
  )
  select headquarters.owner_user_id,
         'academy_platform',
         headquarters.id,
         'official_operations',
         'Restore approved internal Academy operations after access lifecycle migration',
         headquarters.owner_user_id,
         'Ayumi production recovery approval required before apply on 2026-09-04',
         v_now,
         null
  from public.academy_headquarters headquarters
  where (headquarters.name, headquarters.handle) in (
    ('MUSUBI', 'ayumi-academy'),
    ('mikkeOS Official Academy', 'admin_78e6-academy')
  );
end;
$recovery$;
