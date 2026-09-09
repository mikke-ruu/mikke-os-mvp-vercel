-- Approved 2026-09-09: each newly created Community may have its own 30 days.
-- Existing periods, paid contracts and consumed entitlements are never rewritten.
-- Keep the existing one-available index and the authenticated-server-only API.
drop index platform_billing_private.platform_billing_creation_one_lifetime_trial_idx;

create table platform_billing_private.community_trial_requests (
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  request_id uuid not null,
  entitlement_id uuid not null references platform_billing_private.creation_entitlements(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  primary key (actor_user_id, request_id)
);
create index community_trial_requests_entitlement_idx
  on platform_billing_private.community_trial_requests(entitlement_id);
alter table platform_billing_private.community_trial_requests enable row level security;
revoke all on table platform_billing_private.community_trial_requests from public, anon, authenticated, service_role;

-- Retain the replay identity of all pre-migration trial requests too.
insert into platform_billing_private.community_trial_requests(actor_user_id, request_id, entitlement_id)
select actor_user_id, idempotency_key, id
from platform_billing_private.creation_entitlements
where product_key = 'community_platform' and source_kind = 'verified_trial';

create function platform_billing_private.community_trial_request_immutable()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  raise exception using errcode = '42501', message = 'PLATFORM_BILLING_TRIAL_REQUEST_IMMUTABLE';
end;
$$;
create trigger community_trial_request_immutable
before update or delete on platform_billing_private.community_trial_requests
for each row execute function platform_billing_private.community_trial_request_immutable();
create trigger community_trial_request_no_truncate
before truncate on platform_billing_private.community_trial_requests
for each statement execute function platform_billing_private.community_trial_request_immutable();
revoke all on function platform_billing_private.community_trial_request_immutable() from public, anon, authenticated, service_role;

create or replace function public.platform_billing_community_trial_start(p_actor_user_id uuid, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_entitlement platform_billing_private.creation_entitlements%rowtype;
  v_recorded uuid;
  v_now timestamptz;
begin
  perform platform_billing_private.require_actor(p_actor_user_id);
  if p_request_id is null then
    raise exception using errcode = '22023', message = 'PLATFORM_BILLING_INVALID_TRIAL_REQUEST';
  end if;
  -- Serialize starts, then re-read. Never hold this lock across a provider call.
  -- NO KEY UPDATE still serializes starts but permits FK KEY SHARE acquired
  -- by guarded create after it locks the entitlement (no reverse FK deadlock).
  perform 1 from auth.users where id = p_actor_user_id and is_anonymous is false for no key update;
  if not found then
    raise exception using errcode = '42501', message = 'PLATFORM_BILLING_FORBIDDEN';
  end if;
  v_now := clock_timestamp();
  select entitlement_id into v_recorded
  from platform_billing_private.community_trial_requests
  where actor_user_id = p_actor_user_id and request_id = p_request_id;
  if found then
    select * into strict v_entitlement from platform_billing_private.creation_entitlements
    where id = v_recorded for update;
  else
    -- Includes historical identities and prevents a paid request being relabelled.
    select * into v_entitlement from platform_billing_private.creation_entitlements
    where actor_user_id = p_actor_user_id and product_key = 'community_platform'
      and idempotency_key = p_request_id for update;
    if not found then
      select * into v_entitlement from platform_billing_private.creation_entitlements
      where actor_user_id = p_actor_user_id and product_key = 'community_platform'
        and status = 'available' and resource_id is null for update;
      -- A fresh explicit request may replace an expired, never-consumed trial,
      -- not a paid grant. Its original dates and replay identity stay intact.
      if found and v_entitlement.source_kind = 'verified_trial'
        and v_entitlement.expires_at <= v_now then
        v_entitlement := null;
      end if;
    end if;
    if v_entitlement.id is null then
      -- Administrative revocation is not a new-trial bypass.
      if exists (select 1 from platform_billing_private.creation_entitlements
        where actor_user_id = p_actor_user_id and product_key = 'community_platform'
          and source_kind = 'verified_trial' and resource_id is null and status = 'revoked') then
        raise exception using errcode = '23505', message = 'PLATFORM_BILLING_STATE_CONFLICT';
      end if;
      perform public.platform_billing_creation_entitlement_grant(
        p_actor_user_id, 'community_platform', 'trial', 'verified_trial', p_request_id,
        v_now, v_now + interval '30 days', p_request_id);
      select * into strict v_entitlement from platform_billing_private.creation_entitlements
      where actor_user_id = p_actor_user_id and product_key = 'community_platform'
        and idempotency_key = p_request_id for update;
    end if;
  end if;

  -- A consumed/expired replay is a conflict, NEVER a new grant or changed period.
  if v_entitlement.actor_user_id is distinct from p_actor_user_id
    or v_entitlement.product_key <> 'community_platform'
    or v_entitlement.source_kind <> 'verified_trial' or v_entitlement.plan_key <> 'trial'
    or v_entitlement.status <> 'available' or v_entitlement.resource_id is not null
    or v_entitlement.starts_at > v_now or v_entitlement.expires_at <= v_now then
    raise exception using errcode = '23505', message = 'PLATFORM_BILLING_STATE_CONFLICT';
  end if;

  -- Record aliases as well as the original request: an alias replay after
  -- consumption must not accidentally become a fresh trial for the next group.
  insert into platform_billing_private.community_trial_requests(actor_user_id, request_id, entitlement_id)
  values (p_actor_user_id, p_request_id, v_entitlement.id)
  on conflict (actor_user_id, request_id) do nothing;
  return jsonb_build_object(
    'state', 'trialing',
    'startsAt', to_char(v_entitlement.starts_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'endsAt', to_char(v_entitlement.expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'automaticBilling', false, 'creation', jsonb_build_object('state', 'available'));
end;
$$;
revoke all on function public.platform_billing_community_trial_start(uuid, uuid) from public, anon, authenticated;
grant execute on function public.platform_billing_community_trial_start(uuid, uuid) to service_role;
comment on function public.platform_billing_community_trial_start(uuid, uuid) is
  'Starts or reuses one pending 30-day trial for a new Community. Consumed periods and paid contracts are immutable; no automatic billing.';

-- Delegate every existing projection, including Academy and resource-bound
-- billing. Only the unbound Community creation actions need new policy logic.
alter function public.platform_billing_status_get(uuid, text, uuid)
  rename to platform_billing_status_before_community_per_resource;
revoke all on function public.platform_billing_status_before_community_per_resource(uuid, text, uuid)
  from public, anon, authenticated, service_role;
create function public.platform_billing_status_get(p_actor_user_id uuid, p_product_key text, p_resource_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb; v_pending platform_billing_private.creation_entitlements%rowtype;
begin
  v_result := public.platform_billing_status_before_community_per_resource(p_actor_user_id, p_product_key, p_resource_id);
  if p_product_key <> 'community_platform' then return v_result; end if;
  -- start_trial never means extending a specific, already-created Community.
  v_result := jsonb_set(v_result, '{allowedActions}', (v_result->'allowedActions') - 'start_trial');
  if p_resource_id is not null then return v_result; end if;
  select * into v_pending from platform_billing_private.creation_entitlements
  where actor_user_id = p_actor_user_id and product_key = 'community_platform'
    and status = 'available' and resource_id is null;
  if found then
    if v_pending.source_kind = 'verified_trial' and v_pending.plan_key = 'trial'
      and v_pending.starts_at <= clock_timestamp() and v_pending.expires_at > clock_timestamp() then
      -- Also permits a lost-response retry through the existing HTTP status gate.
      return jsonb_set(v_result, '{allowedActions}', (v_result->'allowedActions') || '["start_trial"]'::jsonb);
    end if;
    if v_pending.source_kind <> 'verified_trial' or v_pending.expires_at > clock_timestamp() then
      return v_result;
    end if;
  end if;
  if not exists (select 1 from platform_billing_private.creation_entitlements
    where actor_user_id = p_actor_user_id and product_key = 'community_platform'
      and source_kind = 'verified_trial' and resource_id is null and status = 'revoked') then
    v_result := jsonb_set(v_result, '{allowedActions}', (v_result->'allowedActions') || '["start_trial"]'::jsonb);
  end if;
  return v_result;
end;
$$;
revoke all on function public.platform_billing_status_get(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.platform_billing_status_get(uuid, text, uuid) to service_role;
notify pgrst, 'reload schema';
