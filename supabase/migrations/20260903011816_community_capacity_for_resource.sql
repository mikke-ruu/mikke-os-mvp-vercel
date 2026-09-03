-- Server-only Community capacity projection. This does not change existing
-- memberships or room access. Community-owned membership activation code may
-- call it from a SECURITY DEFINER function and must fail closed on NULL.

-- Correct verified checkout handling for an existing app resource. The first
-- runtime version accepted only resource_id=NULL and therefore could leave an
-- unrelated create-resource grant after an existing resource was paid for.
-- The immutable attempt/quote scope is now rechecked and a non-null resource
-- is bound to the entitlement in the same transaction. NULL continues to mean
-- a not-yet-created resource.
create or replace function public.platform_billing_verified_subscription_activate(
  p_attempt_id uuid,
  p_provider_event_id text,
  p_provider_event_hash text,
  p_provider_session_id text,
  p_provider_customer_id text,
  p_provider_subscription_id text,
  p_amount_total bigint,
  p_currency text,
  p_paid_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scope uuid;
  v_actor uuid;
  v_attempt platform_billing_private.attempts%rowtype;
  v_quote platform_billing_private.quotes%rowtype;
  v_event platform_billing_private.verified_provider_events%rowtype;
  v_entitlement platform_billing_private.creation_entitlements%rowtype;
  v_subscription platform_billing_private.subscriptions%rowtype;
  v_grant jsonb;
  v_end timestamptz;
  v_resource_id uuid;
begin
  if p_attempt_id is null or p_provider_event_id !~ '^evt_[A-Za-z0-9]+$'
    or p_provider_event_hash !~ '^[0-9a-f]{64}$'
    or p_provider_session_id !~ '^cs_(test|live)_[A-Za-z0-9]+$'
    or p_provider_customer_id !~ '^cus_[A-Za-z0-9]+$'
    or p_provider_subscription_id !~ '^sub_[A-Za-z0-9]+$'
    or p_amount_total is null or p_amount_total < 0 or p_currency is distinct from 'jpy'
    or p_paid_at is null or not isfinite(p_paid_at) then
    raise exception using errcode='22023', message='PLATFORM_BILLING_INVALID_SUBSCRIPTION';
  end if;

  select owner_user_id, scope_id into v_actor, v_scope
  from platform_billing_private.attempts where id=p_attempt_id;
  if not found then raise exception using errcode='P0002', message='PLATFORM_BILLING_NOT_FOUND'; end if;
  perform platform_billing_private.require_actor(v_actor);
  perform 1 from platform_billing_private.scopes
  where id=v_scope and owner_user_id=v_actor for update;
  if not found then raise exception using errcode='P0002', message='PLATFORM_BILLING_NOT_FOUND'; end if;

  select quote.* into v_quote
  from platform_billing_private.quotes quote
  join platform_billing_private.attempts attempt
    on attempt.quote_id=quote.quote_id and attempt.scope_id=quote.scope_id
   and attempt.owner_user_id=quote.owner_user_id and attempt.product_key=quote.product_key
   and attempt.request_id=quote.request_id and attempt.quote_revision=quote.revision
  where attempt.id=p_attempt_id and attempt.scope_id=v_scope
  for update of quote;
  select * into v_attempt from platform_billing_private.attempts
  where id=p_attempt_id and scope_id=v_scope for update;

  if v_attempt.status <> 'provider_ready'
    or v_attempt.provider_session_id is distinct from p_provider_session_id
    or v_attempt.product_key is distinct from v_quote.product_key
    or v_attempt.plan_key is distinct from v_quote.plan_key
    or v_attempt.resource_id is distinct from v_quote.resource_id
    or v_attempt.owner_user_id is distinct from v_quote.owner_user_id
    or (v_attempt.resource_id is not null and v_attempt.resource_id !~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    or v_quote.payload->>'purchaseIntent' is distinct from 'explicit_paid_start'
    or (v_quote.payload#>>'{dueNow,totalYen}')::bigint is distinct from p_amount_total
    or lower(v_quote.payload->>'currency') is distinct from p_currency
    or v_quote.payload#>'{policies,approved}' is distinct from 'true'::jsonb
    or p_paid_at < v_attempt.created_at - interval '5 minutes'
    or p_paid_at > clock_timestamp() + interval '5 minutes' then
    raise exception using errcode='42501', message='PLATFORM_BILLING_VERIFIED_EVENT_SCOPE_MISMATCH';
  end if;
  v_resource_id := v_attempt.resource_id::uuid;
  v_end := platform_billing_private.next_month_at(p_paid_at);

  select * into v_event from platform_billing_private.verified_provider_events
  where provider_event_id=p_provider_event_id or provider_event_hash=p_provider_event_hash
    or provider_session_id=p_provider_session_id or attempt_id=p_attempt_id
  order by verified_at,id limit 1;
  if found then
    if v_event.provider_event_id is distinct from p_provider_event_id
      or v_event.provider_event_hash is distinct from p_provider_event_hash
      or v_event.provider_session_id is distinct from p_provider_session_id
      or v_event.attempt_id is distinct from p_attempt_id
      or v_event.actor_user_id is distinct from v_attempt.owner_user_id
      or v_event.product_key is distinct from v_attempt.product_key
      or v_event.plan_key is distinct from v_attempt.plan_key
      or v_event.paid_at is distinct from p_paid_at
      or v_event.entitlement_expires_at is distinct from v_end then
      raise exception using errcode='23505', message='PLATFORM_BILLING_VERIFIED_EVENT_CONFLICT';
    end if;
  else
    begin
      insert into platform_billing_private.verified_provider_events(
        provider_event_id,provider_event_hash,provider_session_id,attempt_id,actor_user_id,
        product_key,plan_key,quote_id,quote_revision,paid_at,entitlement_expires_at
      ) values (
        p_provider_event_id,p_provider_event_hash,p_provider_session_id,p_attempt_id,v_attempt.owner_user_id,
        v_attempt.product_key,v_attempt.plan_key,v_attempt.quote_id,v_attempt.quote_revision,p_paid_at,v_end
      ) returning * into v_event;
    exception when unique_violation then
      raise exception using errcode='23505', message='PLATFORM_BILLING_VERIFIED_EVENT_CONFLICT';
    end;
  end if;

  v_grant := public.platform_billing_creation_entitlement_grant(
    v_attempt.owner_user_id,v_attempt.product_key,v_attempt.plan_key,'verified_paid',p_attempt_id,
    p_paid_at,v_end,v_event.id
  );
  if v_resource_id is not null then
    update platform_billing_private.creation_entitlements entitlement
    set status='consumed', resource_id=v_resource_id, consumed_at=clock_timestamp(),
        updated_at=clock_timestamp()
    where entitlement.source_attempt_id=p_attempt_id
      and entitlement.actor_user_id=v_attempt.owner_user_id
      and entitlement.product_key=v_attempt.product_key
      and entitlement.plan_key=v_attempt.plan_key
      and entitlement.source_kind='verified_paid'
      and entitlement.status='available' and entitlement.resource_id is null;

    select * into v_entitlement
    from platform_billing_private.creation_entitlements entitlement
    where entitlement.source_attempt_id=p_attempt_id for update;
    if not found
      or v_entitlement.actor_user_id is distinct from v_attempt.owner_user_id
      or v_entitlement.product_key is distinct from v_attempt.product_key
      or v_entitlement.plan_key is distinct from v_attempt.plan_key
      or v_entitlement.source_kind is distinct from 'verified_paid'
      or v_entitlement.status is distinct from 'consumed'
      or v_entitlement.resource_id is distinct from v_resource_id then
      raise exception using errcode='23505', message='PLATFORM_BILLING_CREATION_BIND_CONFLICT';
    end if;
    v_grant := jsonb_build_object(
      'created', (v_grant->>'created')::boolean, 'state','consumed',
      'productKey',v_entitlement.product_key, 'planKey',v_entitlement.plan_key,
      'resourceId',v_entitlement.resource_id,
      'expiresAt',to_char(v_entitlement.expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    );
  end if;

  select * into v_subscription from platform_billing_private.subscriptions
  where source_attempt_id=p_attempt_id or provider_customer_id=p_provider_customer_id
    or provider_subscription_id=p_provider_subscription_id
  order by created_at,id limit 1 for update;
  if found then
    if v_subscription.actor_user_id is distinct from v_attempt.owner_user_id
      or v_subscription.product_key is distinct from v_attempt.product_key
      or v_subscription.plan_key is distinct from v_attempt.plan_key
      or v_subscription.source_attempt_id is distinct from p_attempt_id
      or v_subscription.provider_customer_id is distinct from p_provider_customer_id
      or v_subscription.provider_subscription_id is distinct from p_provider_subscription_id
      or v_subscription.initial_amount_yen is distinct from p_amount_total
      or v_subscription.currency is distinct from p_currency
      or v_subscription.original_paid_at is distinct from p_paid_at
      or v_subscription.current_period_start is distinct from p_paid_at
      or v_subscription.current_period_end is distinct from v_end then
      raise exception using errcode='23505', message='PLATFORM_BILLING_SUBSCRIPTION_CONFLICT';
    end if;
  else
    begin
      insert into platform_billing_private.subscriptions(
        actor_user_id,product_key,plan_key,source_attempt_id,provider_customer_id,
        provider_subscription_id,initial_amount_yen,currency,status,original_paid_at,
        current_period_start,current_period_end
      ) values (
        v_attempt.owner_user_id,v_attempt.product_key,v_attempt.plan_key,p_attempt_id,
        p_provider_customer_id,p_provider_subscription_id,p_amount_total,p_currency,'active',
        p_paid_at,p_paid_at,v_end
      ) returning * into v_subscription;
    exception when unique_violation then
      raise exception using errcode='23505', message='PLATFORM_BILLING_SUBSCRIPTION_CONFLICT';
    end;
  end if;

  return jsonb_build_object(
    'eventStatus','verified','subscriptionStatus',v_subscription.status,
    'productKey',v_subscription.product_key,'planKey',v_subscription.plan_key,
    'currentPeriodEndsAt',to_char(v_subscription.current_period_end at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'creation',v_grant
  );
end;
$$;

revoke all on function public.platform_billing_verified_subscription_activate(uuid,text,text,text,text,text,bigint,text,timestamptz)
  from public, anon, authenticated;
grant execute on function public.platform_billing_verified_subscription_activate(uuid,text,text,text,text,text,bigint,text,timestamptz)
  to service_role;

create function platform_billing_private.community_capacity_for_resource(
  p_owner_user_id uuid,
  p_resource_id uuid,
  p_now timestamptz
)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_paid_rows integer;
  v_paid_valid_rows integer;
  v_paid_caps integer[];
  v_trial_rows integer;
  v_trial_valid_rows integer;
  v_trial_caps integer[];
begin
  if p_owner_user_id is null
     or p_resource_id is null
     or p_now is null
     or not isfinite(p_now) then
    return null;
  end if;

  -- A paid source supersedes an earlier trial source. Every paid row bound to
  -- this resource must agree and still be active; stale, unknown or ambiguous
  -- paid state therefore closes new membership activation.
  select
    count(*)::integer,
    count(*) filter (
      where subscription.id is not null
        and attempt.id is not null
        and attempt.owner_user_id = entitlement.actor_user_id
        and attempt.product_key = entitlement.product_key
        and attempt.plan_key = entitlement.plan_key
        and attempt.status = 'provider_ready'
        and subscription.actor_user_id = entitlement.actor_user_id
        and subscription.product_key = entitlement.product_key
        and subscription.plan_key = entitlement.plan_key
        and subscription.status = 'active'
        and subscription.current_period_start <= p_now
        and subscription.current_period_end > p_now
        and entitlement.starts_at <= p_now
        and entitlement.plan_key in ('starter', 'standard', 'pro')
    )::integer,
    array_agg(distinct case entitlement.plan_key
      when 'starter' then 50
      when 'standard' then 200
      when 'pro' then 1000
      else null
    end) filter (where entitlement.plan_key in ('starter', 'standard', 'pro'))
  into v_paid_rows, v_paid_valid_rows, v_paid_caps
  from platform_billing_private.creation_entitlements entitlement
  left join platform_billing_private.attempts attempt
    on attempt.id = entitlement.source_attempt_id
  left join platform_billing_private.subscriptions subscription
    on subscription.source_attempt_id = entitlement.source_attempt_id
  where entitlement.actor_user_id = p_owner_user_id
    and entitlement.product_key = 'community_platform'
    and entitlement.resource_id = p_resource_id
    and entitlement.status = 'consumed'
    and entitlement.source_kind = 'verified_paid';

  if v_paid_rows > 0 then
    if v_paid_rows <> 1
       or v_paid_valid_rows <> 1
       or cardinality(v_paid_caps) <> 1 then
      return null;
    end if;
    return v_paid_caps[1];
  end if;

  select
    count(*)::integer,
    count(*) filter (
      where entitlement.plan_key = 'trial'
        and entitlement.starts_at <= p_now
        and entitlement.expires_at is not null
        and entitlement.expires_at > p_now
    )::integer,
    array_agg(distinct case when entitlement.plan_key = 'trial' then 10 end)
      filter (where entitlement.plan_key = 'trial')
  into v_trial_rows, v_trial_valid_rows, v_trial_caps
  from platform_billing_private.creation_entitlements entitlement
  where entitlement.actor_user_id = p_owner_user_id
    and entitlement.product_key = 'community_platform'
    and entitlement.resource_id = p_resource_id
    and entitlement.status = 'consumed'
    and entitlement.source_kind = 'verified_trial';

  if v_trial_rows <> 1
     or v_trial_valid_rows <> 1
     or cardinality(v_trial_caps) <> 1 then
    return null;
  end if;
  return v_trial_caps[1];
end;
$$;

revoke all on function platform_billing_private.community_capacity_for_resource(uuid, uuid, timestamptz)
  from public, anon, authenticated, service_role;

comment on function platform_billing_private.community_capacity_for_resource(uuid, uuid, timestamptz) is
  'Internal fail-closed capacity lookup for new Community membership activation. It does not change existing membership or room access.';
