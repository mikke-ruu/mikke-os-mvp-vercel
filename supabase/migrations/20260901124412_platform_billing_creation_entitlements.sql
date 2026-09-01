-- Server-owned creation entitlement ledger and status projection.
-- This migration does not verify a provider event by itself and does not
-- enable billing. Only a trusted server that has already verified the source
-- event may call the grant function. App-owned SECURITY DEFINER create RPCs
-- consume rows atomically; browsers receive no table privileges or row ids.

create table platform_billing_private.creation_entitlements (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  product_key text not null
    check (product_key in ('academy_platform', 'community_platform')),
  plan_key text not null
    check (platform_billing_private.token(plan_key)),
  source_kind text not null
    check (source_kind in ('verified_trial', 'verified_paid')),
  source_attempt_id uuid not null,
  idempotency_key uuid not null,
  status text not null default 'available'
    check (status in ('available', 'consumed', 'expired', 'revoked')),
  starts_at timestamptz not null,
  expires_at timestamptz,
  resource_id uuid,
  consumed_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint platform_billing_creation_source_unique
    unique (product_key, source_kind, source_attempt_id),
  constraint platform_billing_creation_idempotency_unique
    unique (actor_user_id, product_key, idempotency_key),
  constraint platform_billing_creation_time_check
    check (
      isfinite(starts_at)
      and (expires_at is null or (isfinite(expires_at) and expires_at > starts_at))
      and (source_kind <> 'verified_trial' or expires_at is not null)
      and updated_at >= created_at
    ),
  constraint platform_billing_creation_state_check
    check (
      (status = 'available' and resource_id is null and consumed_at is null)
      or (status = 'consumed' and resource_id is not null and consumed_at is not null)
      or (status in ('expired', 'revoked') and resource_id is null and consumed_at is null)
    )
);

create unique index platform_billing_creation_one_available_idx
  on platform_billing_private.creation_entitlements (actor_user_id, product_key)
  where status = 'available' and resource_id is null;

create index platform_billing_creation_resource_idx
  on platform_billing_private.creation_entitlements (product_key, resource_id)
  where resource_id is not null;

create function platform_billing_private.creation_entitlement_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'TRUNCATE' or tg_op = 'DELETE' then
    raise exception using errcode = '42501', message = 'PLATFORM_BILLING_CREATION_IMMUTABLE';
  end if;

  if (to_jsonb(new) - array['status', 'resource_id', 'consumed_at', 'updated_at'])
       is distinct from
     (to_jsonb(old) - array['status', 'resource_id', 'consumed_at', 'updated_at'])
    or old.status <> 'available'
    or new.status not in ('consumed', 'expired', 'revoked')
    or new.updated_at < old.updated_at
    or (
      new.status = 'consumed'
      and (new.resource_id is null or new.consumed_at is null)
    )
    or (
      new.status in ('expired', 'revoked')
      and (new.resource_id is not null or new.consumed_at is not null)
    ) then
    raise exception using errcode = '42501', message = 'PLATFORM_BILLING_CREATION_IMMUTABLE';
  end if;

  return new;
end;
$$;

create trigger platform_billing_creation_entitlement_guard
before update or delete on platform_billing_private.creation_entitlements
for each row execute function platform_billing_private.creation_entitlement_guard();

create trigger platform_billing_creation_entitlement_no_truncate
before truncate on platform_billing_private.creation_entitlements
for each statement execute function platform_billing_private.creation_entitlement_guard();

alter table platform_billing_private.creation_entitlements enable row level security;
revoke all on table platform_billing_private.creation_entitlements
  from public, anon, authenticated, service_role;

create function public.platform_billing_creation_entitlement_grant(
  p_actor_user_id uuid,
  p_product_key text,
  p_plan_key text,
  p_source_kind text,
  p_source_attempt_id uuid,
  p_starts_at timestamptz,
  p_expires_at timestamptz,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing platform_billing_private.creation_entitlements%rowtype;
  v_created platform_billing_private.creation_entitlements%rowtype;
  v_now timestamptz := statement_timestamp();
begin
  perform platform_billing_private.require_actor(p_actor_user_id);

  if p_product_key not in ('academy_platform', 'community_platform')
    or not platform_billing_private.token(p_plan_key)
    or p_source_kind not in ('verified_trial', 'verified_paid')
    or p_source_attempt_id is null
    or p_idempotency_key is null
    or p_starts_at is null
    or not isfinite(p_starts_at)
    or p_starts_at > v_now + interval '5 minutes'
    or (
      p_expires_at is not null
      and (not isfinite(p_expires_at) or p_expires_at <= p_starts_at)
    )
    or (p_source_kind = 'verified_trial' and p_expires_at is null) then
    raise exception using errcode = '22023', message = 'PLATFORM_BILLING_INVALID_CREATION_GRANT';
  end if;

  select entitlement.*
  into v_existing
  from platform_billing_private.creation_entitlements entitlement
  where (
    entitlement.product_key = p_product_key
    and entitlement.source_kind = p_source_kind
    and entitlement.source_attempt_id = p_source_attempt_id
  ) or (
    entitlement.actor_user_id = p_actor_user_id
    and entitlement.product_key = p_product_key
    and entitlement.idempotency_key = p_idempotency_key
  )
  order by entitlement.created_at, entitlement.id
  limit 1
  for update;

  if found then
    if v_existing.actor_user_id is distinct from p_actor_user_id
      or v_existing.product_key is distinct from p_product_key
      or v_existing.plan_key is distinct from p_plan_key
      or v_existing.source_kind is distinct from p_source_kind
      or v_existing.source_attempt_id is distinct from p_source_attempt_id
      or v_existing.starts_at is distinct from p_starts_at
      or v_existing.expires_at is distinct from p_expires_at
      or v_existing.idempotency_key is distinct from p_idempotency_key then
      raise exception using errcode = '23505', message = 'PLATFORM_BILLING_IDEMPOTENCY_CONFLICT';
    end if;

    return jsonb_build_object(
      'created', false,
      'state', v_existing.status,
      'productKey', v_existing.product_key,
      'planKey', v_existing.plan_key,
      'resourceId', v_existing.resource_id,
      'expiresAt', case when v_existing.expires_at is null then null
        else to_char(v_existing.expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end
    );
  end if;

  update platform_billing_private.creation_entitlements entitlement
  set status = 'expired', updated_at = v_now
  where entitlement.actor_user_id = p_actor_user_id
    and entitlement.product_key = p_product_key
    and entitlement.status = 'available'
    and entitlement.resource_id is null
    and entitlement.expires_at is not null
    and entitlement.expires_at <= v_now;

  if exists (
    select 1
    from platform_billing_private.creation_entitlements entitlement
    where entitlement.actor_user_id = p_actor_user_id
      and entitlement.product_key = p_product_key
      and entitlement.status = 'available'
      and entitlement.resource_id is null
  ) then
    raise exception using errcode = '23505', message = 'PLATFORM_BILLING_CREATION_ALREADY_AVAILABLE';
  end if;

  begin
    insert into platform_billing_private.creation_entitlements (
      actor_user_id,
      product_key,
      plan_key,
      source_kind,
      source_attempt_id,
      idempotency_key,
      starts_at,
      expires_at
    ) values (
      p_actor_user_id,
      p_product_key,
      p_plan_key,
      p_source_kind,
      p_source_attempt_id,
      p_idempotency_key,
      p_starts_at,
      p_expires_at
    ) returning * into v_created;
  exception when unique_violation then
    raise exception using errcode = '23505', message = 'PLATFORM_BILLING_IDEMPOTENCY_CONFLICT';
  end;

  return jsonb_build_object(
    'created', true,
    'state', v_created.status,
    'productKey', v_created.product_key,
    'planKey', v_created.plan_key,
    'resourceId', null,
    'expiresAt', case when v_created.expires_at is null then null
      else to_char(v_created.expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end
  );
end;
$$;

create function public.platform_billing_creation_status(
  p_actor_user_id uuid,
  p_product_key text,
  p_resource_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_entitlement platform_billing_private.creation_entitlements%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  perform platform_billing_private.require_actor(p_actor_user_id);

  if p_product_key not in ('academy_platform', 'community_platform') then
    raise exception using errcode = '22023', message = 'PLATFORM_BILLING_INVALID_CREATION_SCOPE';
  end if;

  if p_resource_id is null then
    select entitlement.*
    into v_entitlement
    from platform_billing_private.creation_entitlements entitlement
    where entitlement.actor_user_id = p_actor_user_id
      and entitlement.product_key = p_product_key
      and entitlement.status = 'available'
      and entitlement.resource_id is null
      and entitlement.starts_at <= v_now
      and (entitlement.expires_at is null or entitlement.expires_at > v_now)
    order by entitlement.created_at, entitlement.id
    limit 1;
  else
    select entitlement.*
    into v_entitlement
    from platform_billing_private.creation_entitlements entitlement
    where entitlement.actor_user_id = p_actor_user_id
      and entitlement.product_key = p_product_key
      and entitlement.status = 'consumed'
      and entitlement.resource_id = p_resource_id
    order by entitlement.consumed_at desc, entitlement.id
    limit 1;
  end if;

  if not found then
    return jsonb_build_object(
      'state', 'none',
      'planKey', null,
      'resourceId', p_resource_id,
      'expiresAt', null
    );
  end if;

  return jsonb_build_object(
    'state', v_entitlement.status,
    'planKey', v_entitlement.plan_key,
    'resourceId', v_entitlement.resource_id,
    'expiresAt', case when v_entitlement.expires_at is null then null
      else to_char(v_entitlement.expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end
  );
end;
$$;

revoke all on function platform_billing_private.creation_entitlement_guard()
  from public, anon, authenticated, service_role;
revoke all on function public.platform_billing_creation_entitlement_grant(
  uuid, text, text, text, uuid, timestamptz, timestamptz, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.platform_billing_creation_status(uuid, text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.platform_billing_creation_entitlement_grant(
  uuid, text, text, text, uuid, timestamptz, timestamptz, uuid
) to service_role;
grant execute on function public.platform_billing_creation_status(uuid, text, uuid)
  to service_role;
