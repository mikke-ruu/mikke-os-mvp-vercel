-- One lifetime 30-day Community trial, started only by an authenticated server.
-- The browser never supplies the actor, dates, duration, entitlement id, or
-- authorization state. Existing paid and Community ownership remain separate.

do $$
begin
  if exists (
    select 1
    from platform_billing_private.creation_entitlements entitlement
    where entitlement.product_key = 'community_platform'
      and entitlement.source_kind = 'verified_trial'
    group by entitlement.actor_user_id, entitlement.product_key
    having count(*) > 1
  ) then
    raise exception using
      errcode = '23505',
      message = 'PLATFORM_BILLING_TRIAL_HISTORY_CONFLICT';
  end if;
end;
$$;

create unique index platform_billing_creation_one_lifetime_trial_idx
  on platform_billing_private.creation_entitlements (actor_user_id, product_key)
  where source_kind = 'verified_trial';

create function public.platform_billing_community_trial_start(
  p_actor_user_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing platform_billing_private.creation_entitlements%rowtype;
  v_now timestamptz := transaction_timestamp();
  v_ends_at timestamptz := transaction_timestamp() + interval '30 days';
begin
  perform platform_billing_private.require_actor(p_actor_user_id);

  if p_request_id is null then
    raise exception using errcode = '22023', message = 'PLATFORM_BILLING_INVALID_TRIAL_REQUEST';
  end if;

  -- This parent lock is the serialization point for all trial starts by the
  -- same person. Re-read every dependent fact only after obtaining it.
  perform 1
  from auth.users account
  where account.id = p_actor_user_id
    and account.is_anonymous is false
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'PLATFORM_BILLING_FORBIDDEN';
  end if;

  select entitlement.*
  into v_existing
  from platform_billing_private.creation_entitlements entitlement
  where entitlement.actor_user_id = p_actor_user_id
    and entitlement.product_key = 'community_platform'
    and entitlement.source_kind = 'verified_trial'
  order by entitlement.created_at, entitlement.id
  limit 1
  for update;

  if found then
    if v_existing.source_attempt_id = p_request_id
      and v_existing.idempotency_key = p_request_id
      and v_existing.plan_key = 'trial'
      and v_existing.status = 'available'
      and v_existing.resource_id is null
      and v_existing.starts_at <= v_now
      and v_existing.expires_at > v_now then
      return jsonb_build_object(
        'state', 'trialing',
        'startsAt', to_char(v_existing.starts_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'endsAt', to_char(v_existing.expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'automaticBilling', false,
        'creation', jsonb_build_object('state', 'available')
      );
    end if;
    raise exception using errcode = '23505', message = 'PLATFORM_BILLING_STATE_CONFLICT';
  end if;

  if exists (
    select 1
    from platform_billing_private.subscriptions subscription
    where subscription.actor_user_id = p_actor_user_id
      and subscription.product_key = 'community_platform'
  ) or exists (
    select 1
    from public.community_communities community
    where community.owner_user_id = p_actor_user_id
  ) then
    raise exception using errcode = '23505', message = 'PLATFORM_BILLING_STATE_CONFLICT';
  end if;

  begin
    perform public.platform_billing_creation_entitlement_grant(
      p_actor_user_id,
      'community_platform',
      'trial',
      'verified_trial',
      p_request_id,
      v_now,
      v_ends_at,
      p_request_id
    );
  exception when unique_violation then
    raise exception using errcode = '23505', message = 'PLATFORM_BILLING_STATE_CONFLICT';
  end;

  return jsonb_build_object(
    'state', 'trialing',
    'startsAt', to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'endsAt', to_char(v_ends_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'automaticBilling', false,
    'creation', jsonb_build_object('state', 'available')
  );
end;
$$;

create or replace function public.platform_billing_status_get(
  p_actor_user_id uuid,
  p_product_key text,
  p_resource_id uuid default null
)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_creation jsonb;
  v_subscription platform_billing_private.subscriptions%rowtype;
  v_trial platform_billing_private.creation_entitlements%rowtype;
  v_state text;
  v_actions jsonb := '[]'::jsonb;
  v_now timestamptz := clock_timestamp();
begin
  perform platform_billing_private.require_actor(p_actor_user_id);
  if p_product_key not in ('academy_platform', 'community_platform') then
    raise exception using errcode = '22023', message = 'PLATFORM_BILLING_INVALID_SUBSCRIPTION_SCOPE';
  end if;

  v_creation := public.platform_billing_creation_status(p_actor_user_id, p_product_key, p_resource_id);
  select subscription.*
  into v_subscription
  from platform_billing_private.subscriptions subscription
  join platform_billing_private.creation_entitlements entitlement
    on entitlement.source_attempt_id = subscription.source_attempt_id
   and entitlement.actor_user_id = subscription.actor_user_id
   and entitlement.product_key = subscription.product_key
  where subscription.actor_user_id = p_actor_user_id
    and subscription.product_key = p_product_key
    and ((p_resource_id is null and entitlement.status = 'available' and entitlement.resource_id is null)
      or (p_resource_id is not null and entitlement.status = 'consumed' and entitlement.resource_id = p_resource_id))
  order by subscription.created_at desc
  limit 1;

  if found then
    v_state := case
      when v_subscription.status = 'active' and v_subscription.current_period_end <= v_now then 'past_due'
      else v_subscription.status
    end;
    v_actions := '["portal"]'::jsonb;
    if v_state = 'active' and v_creation->>'state' = 'available' then
      v_actions := '["portal","create_resource"]'::jsonb;
    end if;
    return jsonb_build_object(
      'version', 0,
      'product', p_product_key,
      'resourceId', p_resource_id,
      'availability', 'ready',
      'subscription', jsonb_build_object(
        'state', v_state,
        'planKey', v_subscription.plan_key,
        'currentPeriodStartsAt', to_char(v_subscription.current_period_start at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'currentPeriodEndsAt', to_char(v_subscription.current_period_end at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'automaticBilling', true,
        'cancelAtPeriodEnd', v_subscription.cancel_at_period_end
      ),
      'creation', jsonb_build_object('state', v_creation->>'state'),
      'allowedActions', v_actions,
      'noticeCode', null
    );
  end if;

  if p_product_key = 'community_platform' then
    select entitlement.*
    into v_trial
    from platform_billing_private.creation_entitlements entitlement
    where entitlement.actor_user_id = p_actor_user_id
      and entitlement.product_key = 'community_platform'
      and entitlement.source_kind = 'verified_trial'
      and ((p_resource_id is null and entitlement.resource_id is null)
        or (p_resource_id is not null and entitlement.status = 'consumed' and entitlement.resource_id = p_resource_id))
    order by entitlement.created_at desc, entitlement.id
    limit 1;
  end if;

  if found then
    v_state := case
      when v_trial.status in ('available', 'consumed')
        and v_trial.starts_at <= v_now
        and v_trial.expires_at > v_now then 'trialing'
      else 'ended'
    end;
    if v_state = 'trialing' and v_trial.status = 'available' and p_resource_id is null then
      v_actions := '["create_resource"]'::jsonb;
    else
      v_actions := '["checkout"]'::jsonb;
    end if;
    return jsonb_build_object(
      'version', 0,
      'product', p_product_key,
      'resourceId', p_resource_id,
      'availability', 'ready',
      'subscription', jsonb_build_object(
        'state', v_state,
        'planKey', 'trial',
        'currentPeriodStartsAt', to_char(v_trial.starts_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'currentPeriodEndsAt', to_char(v_trial.expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'automaticBilling', false,
        'cancelAtPeriodEnd', false
      ),
      'creation', jsonb_build_object(
        'state', case
          when v_state = 'trialing' and v_trial.status = 'available' and p_resource_id is null then 'available'
          when v_trial.status = 'consumed' and v_trial.resource_id = p_resource_id then 'consumed'
          else 'none'
        end
      ),
      'allowedActions', v_actions,
      'noticeCode', null
    );
  end if;

  return jsonb_build_object(
    'version', 0,
    'product', p_product_key,
    'resourceId', p_resource_id,
    'availability', 'ready',
    'subscription', null,
    'creation', jsonb_build_object('state', v_creation->>'state'),
    'allowedActions', case
      when v_creation->>'state' = 'available' then '["create_resource"]'::jsonb
      when p_product_key = 'community_platform' then '["checkout","start_trial"]'::jsonb
      else '["checkout"]'::jsonb
    end,
    'noticeCode', null
  );
end;
$$;

revoke all on function public.platform_billing_community_trial_start(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.platform_billing_community_trial_start(uuid, uuid)
  to service_role;
revoke all on function public.platform_billing_status_get(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.platform_billing_status_get(uuid, text, uuid)
  to service_role;

comment on function public.platform_billing_community_trial_start(uuid, uuid) is
  'Starts one lifetime 30-day Community trial for a verified non-anonymous user. It never creates a paid subscription or automatic billing.';
