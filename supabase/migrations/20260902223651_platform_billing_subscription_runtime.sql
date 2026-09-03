-- Durable provider subscription projection. This migration does not contact
-- Stripe, choose a price, or turn a free-period expiry into paid consent.

alter table platform_billing_private.attempts
  drop constraint attempts_provider_session_id_check;
alter table platform_billing_private.attempts
  add constraint attempts_provider_session_id_check
  check (provider_session_id is null or provider_session_id ~ '^cs_(test|live)_[A-Za-z0-9]+$');
alter table platform_billing_private.verified_provider_events
  drop constraint verified_provider_events_provider_event_id_check;
alter table platform_billing_private.verified_provider_events
  add constraint verified_provider_events_provider_event_id_check
  check (provider_event_id ~ '^evt_[A-Za-z0-9]+$');
alter table platform_billing_private.verified_provider_events
  drop constraint verified_provider_events_provider_session_id_check;
alter table platform_billing_private.verified_provider_events
  add constraint verified_provider_events_provider_session_id_check
  check (provider_session_id ~ '^cs_(test|live)_[A-Za-z0-9]+$');

-- Preserve the original lock/idempotency contract while accepting the live
-- session namespace allowed by the corrected table constraint.
create or replace function public.platform_billing_attempt_mark_ready(p_actor_user_id uuid,p_attempt_id uuid,p_provider_session_id text,p_provider_result_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a platform_billing_private.attempts%rowtype; v_scope uuid; v_quote text;
begin
 perform platform_billing_private.require_actor(p_actor_user_id);
 if p_provider_session_id is null or p_provider_session_id !~ '^cs_(test|live)_[A-Za-z0-9]+$' or char_length(p_provider_session_id)>255
  or p_provider_result_hash is null or p_provider_result_hash !~ '^[0-9a-f]{64}$' then
  raise exception using errcode='22023',message='PLATFORM_BILLING_INVALID_PROVIDER_RESULT';
 end if;
 select scope_id,quote_id into v_scope,v_quote from platform_billing_private.attempts where id=p_attempt_id and owner_user_id=p_actor_user_id;
 if not found then raise exception using errcode='P0002',message='PLATFORM_BILLING_NOT_FOUND'; end if;
 perform 1 from platform_billing_private.scopes where id=v_scope and owner_user_id=p_actor_user_id for update;
 perform 1 from platform_billing_private.quotes where quote_id=v_quote and scope_id=v_scope and owner_user_id=p_actor_user_id for update;
 select * into a from platform_billing_private.attempts where id=p_attempt_id and scope_id=v_scope and owner_user_id=p_actor_user_id for update;
 if not found then raise exception using errcode='P0002',message='PLATFORM_BILLING_NOT_FOUND'; end if;
 if a.status='provider_ready' then
  if a.provider_session_id is distinct from p_provider_session_id or a.provider_result_hash is distinct from p_provider_result_hash then
   raise exception using errcode='23505',message='PLATFORM_BILLING_PROVIDER_RESULT_CONFLICT';
  end if;
  return platform_billing_private.attempt_result(a);
 end if;
 begin
  update platform_billing_private.attempts set status='provider_ready',provider_session_id=p_provider_session_id,provider_result_hash=p_provider_result_hash,updated_at=clock_timestamp()
  where id=p_attempt_id returning * into a;
 exception when unique_violation then raise exception using errcode='23505',message='PLATFORM_BILLING_PROVIDER_RESULT_CONFLICT'; end;
 return platform_billing_private.attempt_result(a);
end $$;

create table platform_billing_private.subscriptions (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  product_key text not null check (product_key in ('academy_platform','community_platform')),
  plan_key text not null check (platform_billing_private.token(plan_key)),
  source_attempt_id uuid not null unique references platform_billing_private.attempts(id) on delete restrict,
  provider_customer_id text not null unique check (provider_customer_id ~ '^cus_[A-Za-z0-9]+$'),
  provider_subscription_id text not null unique check (provider_subscription_id ~ '^sub_[A-Za-z0-9]+$'),
  initial_amount_yen bigint not null check (initial_amount_yen >= 0),
  currency text not null check (currency = 'jpy'),
  status text not null check (status in ('active','past_due','ended')),
  original_paid_at timestamptz not null check (isfinite(original_paid_at)),
  current_period_start timestamptz not null check (isfinite(current_period_start)),
  current_period_end timestamptz not null check (isfinite(current_period_end)),
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check (current_period_start >= original_paid_at and current_period_end > current_period_start),
  check (updated_at >= created_at)
);

create index platform_billing_subscription_actor_product_idx
  on platform_billing_private.subscriptions (actor_user_id, product_key);

create table platform_billing_private.subscription_events (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references platform_billing_private.subscriptions(id) on delete restrict,
  provider_event_id text not null unique check (provider_event_id ~ '^evt_[A-Za-z0-9]+$'),
  provider_event_hash text not null unique check (provider_event_hash ~ '^[0-9a-f]{64}$'),
  event_kind text not null check (event_kind in ('invoice_paid','invoice_failed','subscription_state')),
  projected_status text not null check (projected_status in ('active','past_due','ended')),
  period_start timestamptz not null check (isfinite(period_start)),
  period_end timestamptz not null check (isfinite(period_end) and period_end > period_start),
  cancel_at_period_end boolean not null,
  occurred_at timestamptz not null check (isfinite(occurred_at)),
  applied boolean not null,
  applied_at timestamptz not null default clock_timestamp()
);

create index platform_billing_subscription_event_subscription_idx
  on platform_billing_private.subscription_events (subscription_id, applied_at);

create function platform_billing_private.subscription_immutable_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'subscriptions' and tg_op = 'UPDATE' then
    if (to_jsonb(new) - array['status','current_period_start','current_period_end','cancel_at_period_end','updated_at'])
        is not distinct from
        (to_jsonb(old) - array['status','current_period_start','current_period_end','cancel_at_period_end','updated_at'])
      and new.current_period_start >= old.current_period_start
      and new.current_period_end >= old.current_period_end
      and (old.status <> 'ended' or new.status = 'ended')
      and new.updated_at >= old.updated_at then
      return new;
    end if;
  end if;
  raise exception using errcode='42501', message='PLATFORM_BILLING_SUBSCRIPTION_IMMUTABLE';
end $$;

create trigger platform_billing_subscription_guard
before update or delete on platform_billing_private.subscriptions
for each row execute function platform_billing_private.subscription_immutable_guard();
create trigger platform_billing_subscription_no_truncate
before truncate on platform_billing_private.subscriptions
for each statement execute function platform_billing_private.subscription_immutable_guard();
create trigger platform_billing_subscription_event_guard
before update or delete on platform_billing_private.subscription_events
for each row execute function platform_billing_private.subscription_immutable_guard();
create trigger platform_billing_subscription_event_no_truncate
before truncate on platform_billing_private.subscription_events
for each statement execute function platform_billing_private.subscription_immutable_guard();

alter table platform_billing_private.subscriptions enable row level security;
alter table platform_billing_private.subscription_events enable row level security;
revoke all on table platform_billing_private.subscriptions,
  platform_billing_private.subscription_events from public,anon,authenticated,service_role;

create function platform_billing_private.next_anchored_month(
  p_original timestamptz, p_period_start timestamptz
) returns timestamptz language plpgsql immutable set search_path='' as $$
declare
  v_original timestamp := p_original at time zone 'Asia/Tokyo';
  v_start timestamp := p_period_start at time zone 'Asia/Tokyo';
  v_first date;
  v_last date;
  v_day integer;
begin
  v_first := (date_trunc('month', v_start) + interval '1 month')::date;
  v_last := (v_first + interval '1 month - 1 day')::date;
  v_day := least(extract(day from v_original)::integer, extract(day from v_last)::integer);
  return (v_first + (v_day - 1) + v_original::time) at time zone 'Asia/Tokyo';
end $$;

create function public.platform_billing_verified_subscription_activate(
  p_attempt_id uuid,
  p_provider_event_id text,
  p_provider_event_hash text,
  p_provider_session_id text,
  p_provider_customer_id text,
  p_provider_subscription_id text,
  p_amount_total bigint,
  p_currency text,
  p_paid_at timestamptz
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_scope uuid;
  v_actor uuid;
  v_attempt platform_billing_private.attempts%rowtype;
  v_quote platform_billing_private.quotes%rowtype;
  v_event platform_billing_private.verified_provider_events%rowtype;
  v_subscription platform_billing_private.subscriptions%rowtype;
  v_grant jsonb;
  v_end timestamptz;
begin
  if p_attempt_id is null or p_provider_event_id !~ '^evt_[A-Za-z0-9]+$'
    or p_provider_event_hash !~ '^[0-9a-f]{64}$'
    or p_provider_session_id !~ '^cs_(test|live)_[A-Za-z0-9]+$'
    or p_provider_customer_id !~ '^cus_[A-Za-z0-9]+$'
    or p_provider_subscription_id !~ '^sub_[A-Za-z0-9]+$'
    or p_amount_total is null or p_amount_total < 0 or p_currency is distinct from 'jpy'
    or p_paid_at is null or not isfinite(p_paid_at) then
    raise exception using errcode='22023',message='PLATFORM_BILLING_INVALID_SUBSCRIPTION';
  end if;

  select owner_user_id,scope_id into v_actor,v_scope
  from platform_billing_private.attempts where id=p_attempt_id;
  if not found then raise exception using errcode='P0002',message='PLATFORM_BILLING_NOT_FOUND'; end if;
  perform platform_billing_private.require_actor(v_actor);
  perform 1 from platform_billing_private.scopes where id=v_scope and owner_user_id=v_actor for update;
  if not found then raise exception using errcode='P0002',message='PLATFORM_BILLING_NOT_FOUND'; end if;
  select quote.* into v_quote from platform_billing_private.quotes quote
  join platform_billing_private.attempts attempt on attempt.quote_id=quote.quote_id and attempt.scope_id=quote.scope_id
    and attempt.owner_user_id=quote.owner_user_id and attempt.product_key=quote.product_key
    and attempt.request_id=quote.request_id and attempt.quote_revision=quote.revision
  where attempt.id=p_attempt_id and attempt.scope_id=v_scope for update of quote;
  select * into v_attempt from platform_billing_private.attempts where id=p_attempt_id and scope_id=v_scope for update;
  if v_attempt.status<>'provider_ready' or v_attempt.resource_id is not null
    or v_attempt.provider_session_id is distinct from p_provider_session_id
    or v_attempt.product_key is distinct from v_quote.product_key or v_attempt.plan_key is distinct from v_quote.plan_key
    or v_attempt.owner_user_id is distinct from v_quote.owner_user_id
    or v_quote.payload->>'purchaseIntent' is distinct from 'explicit_paid_start'
    or (v_quote.payload#>>'{dueNow,totalYen}')::bigint is distinct from p_amount_total
    or lower(v_quote.payload->>'currency') is distinct from p_currency
    or v_quote.payload#>'{policies,approved}' is distinct from 'true'::jsonb
    or p_paid_at<v_attempt.created_at-interval '5 minutes' or p_paid_at>clock_timestamp()+interval '5 minutes' then
    raise exception using errcode='42501',message='PLATFORM_BILLING_VERIFIED_EVENT_SCOPE_MISMATCH';
  end if;
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
      or v_event.paid_at is distinct from p_paid_at or v_event.entitlement_expires_at is distinct from v_end then
      raise exception using errcode='23505',message='PLATFORM_BILLING_VERIFIED_EVENT_CONFLICT';
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
      raise exception using errcode='23505',message='PLATFORM_BILLING_VERIFIED_EVENT_CONFLICT';
    end;
  end if;
  v_grant:=public.platform_billing_creation_entitlement_grant(
    v_attempt.owner_user_id,v_attempt.product_key,v_attempt.plan_key,'verified_paid',p_attempt_id,
    p_paid_at,v_end,v_event.id
  );

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
      raise exception using errcode='23505',message='PLATFORM_BILLING_SUBSCRIPTION_CONFLICT';
    end if;
  else
    begin
      insert into platform_billing_private.subscriptions(
        actor_user_id,product_key,plan_key,source_attempt_id,
        provider_customer_id,provider_subscription_id,initial_amount_yen,currency,status,original_paid_at,
        current_period_start,current_period_end
      ) values (
        v_attempt.owner_user_id,v_attempt.product_key,v_attempt.plan_key,p_attempt_id,
        p_provider_customer_id,p_provider_subscription_id,p_amount_total,p_currency,'active',p_paid_at,p_paid_at,v_end
      ) returning * into v_subscription;
    exception when unique_violation then
      raise exception using errcode='23505',message='PLATFORM_BILLING_SUBSCRIPTION_CONFLICT';
    end;
  end if;

  return jsonb_build_object(
    'eventStatus','verified','subscriptionStatus',v_subscription.status,
    'productKey',v_subscription.product_key,'planKey',v_subscription.plan_key,
    'currentPeriodEndsAt',to_char(v_subscription.current_period_end at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'creation',v_grant
  );
end $$;

create function public.platform_billing_subscription_event_apply(
  p_provider_subscription_id text,
  p_provider_event_id text,
  p_provider_event_hash text,
  p_event_kind text,
  p_projected_status text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_occurred_at timestamptz
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_subscription platform_billing_private.subscriptions%rowtype;
  v_event platform_billing_private.subscription_events%rowtype;
  v_expected_end timestamptz;
  v_cancel_at_period_end boolean;
  v_now timestamptz:=clock_timestamp();
begin
  if p_provider_subscription_id !~ '^sub_[A-Za-z0-9]+$'
    or p_provider_event_id !~ '^evt_[A-Za-z0-9]+$'
    or p_provider_event_hash !~ '^[0-9a-f]{64}$'
    or p_event_kind not in ('invoice_paid','invoice_failed','subscription_state')
    or p_projected_status not in ('active','past_due','ended')
    or p_period_start is null or not isfinite(p_period_start)
    or p_period_end is null or not isfinite(p_period_end) or p_period_end<=p_period_start
    or (p_event_kind='subscription_state' and p_cancel_at_period_end is null)
    or (p_event_kind<>'subscription_state' and p_cancel_at_period_end is not null)
    or p_occurred_at is null or not isfinite(p_occurred_at)
    or p_occurred_at>v_now+interval '5 minutes' then
    raise exception using errcode='22023',message='PLATFORM_BILLING_INVALID_SUBSCRIPTION_EVENT';
  end if;
  if session_user<>'service_role' and coalesce(current_setting('role',true),'')<>'service_role' then
    raise exception using errcode='42501',message='PLATFORM_BILLING_FORBIDDEN';
  end if;

  select * into v_subscription from platform_billing_private.subscriptions
  where provider_subscription_id=p_provider_subscription_id for update;
  if not found then raise exception using errcode='P0002',message='PLATFORM_BILLING_NOT_FOUND'; end if;

  select * into v_event from platform_billing_private.subscription_events
  where provider_event_id=p_provider_event_id or provider_event_hash=p_provider_event_hash
  order by applied_at,id limit 1;
  if found then
    if v_event.subscription_id is distinct from v_subscription.id
      or v_event.provider_event_id is distinct from p_provider_event_id
      or v_event.provider_event_hash is distinct from p_provider_event_hash
      or v_event.event_kind is distinct from p_event_kind
      or v_event.projected_status is distinct from p_projected_status
      or v_event.period_start is distinct from p_period_start
      or v_event.period_end is distinct from p_period_end
      or (p_event_kind='subscription_state' and v_event.cancel_at_period_end is distinct from p_cancel_at_period_end)
      or v_event.occurred_at is distinct from p_occurred_at then
      raise exception using errcode='23505',message='PLATFORM_BILLING_SUBSCRIPTION_EVENT_CONFLICT';
    end if;
    return jsonb_build_object('eventStatus',case when v_event.applied then 'already_applied' else 'stale_ignored' end,'subscriptionStatus',v_subscription.status);
  end if;

  if p_occurred_at <= coalesce((select max(event.occurred_at) from platform_billing_private.subscription_events event
      where event.subscription_id=v_subscription.id),'-infinity'::timestamptz) then
    insert into platform_billing_private.subscription_events(
      subscription_id,provider_event_id,provider_event_hash,event_kind,projected_status,
      period_start,period_end,cancel_at_period_end,occurred_at,applied
    ) values (
      v_subscription.id,p_provider_event_id,p_provider_event_hash,p_event_kind,p_projected_status,
      p_period_start,p_period_end,coalesce(p_cancel_at_period_end,v_subscription.cancel_at_period_end),p_occurred_at,false
    );
    return jsonb_build_object('eventStatus','stale_ignored','subscriptionStatus',v_subscription.status);
  end if;

  if p_event_kind='invoice_paid' then
    v_expected_end:=platform_billing_private.next_anchored_month(v_subscription.original_paid_at,p_period_start);
    if p_projected_status<>'active' or p_period_start is distinct from v_subscription.current_period_end
      or p_period_end is distinct from v_expected_end then
      raise exception using errcode='22023',message='PLATFORM_BILLING_INVALID_RENEWAL_PERIOD';
    end if;
  elsif p_period_start is distinct from v_subscription.current_period_start
    or p_period_end is distinct from v_subscription.current_period_end
    or (p_event_kind='invoice_failed' and p_projected_status<>'past_due') then
    raise exception using errcode='22023',message='PLATFORM_BILLING_INVALID_SUBSCRIPTION_EVENT';
  end if;

  v_cancel_at_period_end:=case when p_event_kind='subscription_state'
    then p_cancel_at_period_end else v_subscription.cancel_at_period_end end;

  insert into platform_billing_private.subscription_events(
    subscription_id,provider_event_id,provider_event_hash,event_kind,projected_status,
    period_start,period_end,cancel_at_period_end,occurred_at,applied
  ) values (
    v_subscription.id,p_provider_event_id,p_provider_event_hash,p_event_kind,p_projected_status,
    p_period_start,p_period_end,v_cancel_at_period_end,p_occurred_at,true
  );
  update platform_billing_private.subscriptions set
    status=p_projected_status,current_period_start=p_period_start,current_period_end=p_period_end,
    cancel_at_period_end=v_cancel_at_period_end,updated_at=v_now
  where id=v_subscription.id;
  return jsonb_build_object('eventStatus','applied','subscriptionStatus',p_projected_status);
end $$;

create function public.platform_billing_status_get(
  p_actor_user_id uuid,p_product_key text,p_resource_id uuid default null
) returns jsonb language plpgsql security definer stable set search_path='' as $$
declare v_creation jsonb; v_subscription platform_billing_private.subscriptions%rowtype; v_state text; v_actions jsonb:='[]'::jsonb;
begin
  perform platform_billing_private.require_actor(p_actor_user_id);
  if p_product_key not in ('academy_platform','community_platform') then
    raise exception using errcode='22023',message='PLATFORM_BILLING_INVALID_SUBSCRIPTION_SCOPE';
  end if;
  v_creation:=public.platform_billing_creation_status(p_actor_user_id,p_product_key,p_resource_id);
  select subscription.* into v_subscription
  from platform_billing_private.subscriptions subscription
  join platform_billing_private.creation_entitlements entitlement
    on entitlement.source_attempt_id=subscription.source_attempt_id
   and entitlement.actor_user_id=subscription.actor_user_id
   and entitlement.product_key=subscription.product_key
  where subscription.actor_user_id=p_actor_user_id and subscription.product_key=p_product_key
    and ((p_resource_id is null and entitlement.status='available' and entitlement.resource_id is null)
      or (p_resource_id is not null and entitlement.status='consumed' and entitlement.resource_id=p_resource_id))
  order by subscription.created_at desc limit 1;
  if found then
    v_state:=case when v_subscription.status='active' and v_subscription.current_period_end<=clock_timestamp()
      then 'past_due' else v_subscription.status end;
    v_actions:='["portal"]'::jsonb;
    if v_state='active' and v_creation->>'state'='available' then v_actions:='["portal","create_resource"]'::jsonb; end if;
    return jsonb_build_object('version',0,'product',p_product_key,'resourceId',p_resource_id,
      'availability','ready','subscription',jsonb_build_object('state',v_state,'planKey',v_subscription.plan_key,
      'currentPeriodEndsAt',to_char(v_subscription.current_period_end at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'cancelAtPeriodEnd',v_subscription.cancel_at_period_end),'creation',jsonb_build_object('state',v_creation->>'state'),
      'allowedActions',v_actions,'noticeCode',null);
  end if;
  return jsonb_build_object('version',0,'product',p_product_key,'resourceId',p_resource_id,
    'availability','ready','subscription',null,'creation',jsonb_build_object('state',v_creation->>'state'),
    'allowedActions',case when v_creation->>'state'='available' then '["create_resource"]'::jsonb else '["checkout"]'::jsonb end,
    'noticeCode',null);
end $$;

create function public.platform_billing_portal_context(
  p_actor_user_id uuid,p_product_key text,p_resource_id uuid
) returns jsonb language plpgsql security definer stable set search_path='' as $$
declare v_subscription platform_billing_private.subscriptions%rowtype;
begin
  perform platform_billing_private.require_actor(p_actor_user_id);
  select subscription.* into v_subscription from platform_billing_private.subscriptions subscription
  join platform_billing_private.creation_entitlements entitlement
    on entitlement.source_attempt_id=subscription.source_attempt_id
  where subscription.actor_user_id=p_actor_user_id and subscription.product_key=p_product_key
    and entitlement.actor_user_id=p_actor_user_id and entitlement.product_key=p_product_key
    and entitlement.status='consumed' and entitlement.resource_id=p_resource_id
    and subscription.status in ('active','past_due','ended') limit 1;
  if not found then return null; end if;
  return jsonb_build_object('providerCustomerId',v_subscription.provider_customer_id,
    'providerSubscriptionId',v_subscription.provider_subscription_id);
end $$;

-- Shared implementation. Identify rows without locks, then acquire the stable
-- common-parent order before any Academy resource lock:
-- actor -> scope -> quote -> attempt -> verified event -> subscription ->
-- entitlement -> generated/existing HQ.
create function platform_billing_private.academy_paid_activation_verify_and_consume(
  p_actor_user_id uuid,
  p_headquarters_id uuid,
  p_existing_headquarters boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_entitlement platform_billing_private.creation_entitlements%rowtype;
  v_scope uuid;
  v_quote text;
  v_attempt platform_billing_private.attempts%rowtype;
  v_event platform_billing_private.verified_provider_events%rowtype;
  v_subscription platform_billing_private.subscriptions%rowtype;
  v_now timestamptz:=clock_timestamp();
begin
  perform platform_billing_private.require_actor(p_actor_user_id);
  if p_headquarters_id is null then
    raise exception using errcode='22023',message='PLATFORM_BILLING_INVALID_RESOURCE';
  end if;
  if session_user<>'service_role' and coalesce(current_setting('role',true),'')<>'service_role' then
    raise exception using errcode='42501',message='PLATFORM_BILLING_FORBIDDEN';
  end if;

  perform 1 from auth.users where id=p_actor_user_id and coalesce(is_anonymous,false)=false for update;
  if not found then raise exception using errcode='42501',message='PLATFORM_BILLING_FORBIDDEN'; end if;
  select entitlement.* into v_entitlement
  from platform_billing_private.creation_entitlements entitlement
  where entitlement.actor_user_id=p_actor_user_id
    and entitlement.product_key='academy_platform'
    and entitlement.source_kind='verified_paid'
    and (entitlement.status='available' or (entitlement.status='consumed' and entitlement.resource_id=p_headquarters_id))
  order by entitlement.created_at,entitlement.id limit 1;
  if not found then raise exception using errcode='P0002',message='PLATFORM_BILLING_NOT_FOUND'; end if;

  select attempt.scope_id,attempt.quote_id into v_scope,v_quote
  from platform_billing_private.attempts attempt where attempt.id=v_entitlement.source_attempt_id;
  if not found then raise exception using errcode='42501',message='PLATFORM_BILLING_VERIFICATION_FAILED'; end if;
  perform 1 from platform_billing_private.scopes where id=v_scope and owner_user_id=p_actor_user_id and product_key='academy_platform' for update;
  if not found then raise exception using errcode='42501',message='PLATFORM_BILLING_VERIFICATION_FAILED'; end if;
  perform 1 from platform_billing_private.quotes where quote_id=v_quote and scope_id=v_scope and owner_user_id=p_actor_user_id for update;
  if not found then raise exception using errcode='42501',message='PLATFORM_BILLING_VERIFICATION_FAILED'; end if;
  select * into v_attempt from platform_billing_private.attempts
  where id=v_entitlement.source_attempt_id and scope_id=v_scope and owner_user_id=p_actor_user_id
    and product_key='academy_platform' and status='provider_ready' for update;
  if not found then raise exception using errcode='42501',message='PLATFORM_BILLING_VERIFICATION_FAILED'; end if;
  select * into v_event from platform_billing_private.verified_provider_events
  where attempt_id=v_attempt.id and actor_user_id=p_actor_user_id and product_key='academy_platform' for update;
  if not found then raise exception using errcode='42501',message='PLATFORM_BILLING_VERIFICATION_FAILED'; end if;
  select * into v_subscription from platform_billing_private.subscriptions
  where source_attempt_id=v_attempt.id and actor_user_id=p_actor_user_id and product_key='academy_platform' for update;
  if not found or v_subscription.status<>'active' or v_subscription.current_period_start>v_now
    or v_subscription.current_period_end<=v_now or v_subscription.plan_key is distinct from v_event.plan_key then
    raise exception using errcode='42501',message='PLATFORM_BILLING_VERIFICATION_FAILED';
  end if;
  select * into v_entitlement from platform_billing_private.creation_entitlements
  where id=v_entitlement.id and actor_user_id=p_actor_user_id and product_key='academy_platform'
    and source_kind='verified_paid' and source_attempt_id=v_attempt.id for update;
  if not found or v_entitlement.plan_key is distinct from v_subscription.plan_key
    or v_entitlement.starts_at is distinct from v_event.paid_at
    or v_entitlement.expires_at is distinct from v_event.entitlement_expires_at
    or v_entitlement.expires_at is distinct from v_subscription.current_period_end
    or (v_entitlement.status='consumed' and v_entitlement.resource_id is distinct from p_headquarters_id)
    or v_entitlement.status not in ('available','consumed') then
    raise exception using errcode='42501',message='PLATFORM_BILLING_VERIFICATION_FAILED';
  end if;
  if p_existing_headquarters then
    perform 1 from public.academy_headquarters
    where id=p_headquarters_id and owner_user_id=p_actor_user_id for update;
    if not found then raise exception using errcode='42501',message='PLATFORM_BILLING_RESOURCE_FORBIDDEN'; end if;
  else
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_headquarters_id::text,0));
    if exists(select 1 from public.academy_headquarters where id=p_headquarters_id) then
      raise exception using errcode='23505',message='PLATFORM_BILLING_RESOURCE_ALREADY_EXISTS';
    end if;
  end if;
  if v_entitlement.status='available' then
    update platform_billing_private.creation_entitlements set
      status='consumed',resource_id=p_headquarters_id,consumed_at=v_now,updated_at=v_now
    where id=v_entitlement.id returning * into v_entitlement;
  end if;
  return jsonb_build_object(
    'verified',true,'actorUserId',p_actor_user_id,'headquartersId',p_headquarters_id,
    'productKey','academy_platform','planKey',v_subscription.plan_key,
    'sourceAttemptId',v_attempt.id,
    'paidAt',to_char(v_event.paid_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'currentPeriodEndsAt',to_char(v_subscription.current_period_end at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end $$;

-- Both public wrappers must be invoked inside the Academy-owned activation RPC
-- transaction. The new-HQ wrapper permits only a generated, currently absent
-- resource id; the Academy wrapper must insert that owner HQ immediately after
-- this call so any failure rolls the entitlement binding back too.
create function public.platform_billing_academy_new_paid_consume(
  p_actor_user_id uuid,p_generated_headquarters_id uuid
) returns jsonb language sql security definer set search_path='' as $$
  select platform_billing_private.academy_paid_activation_verify_and_consume(
    p_actor_user_id,p_generated_headquarters_id,false)
$$;

create function public.platform_billing_academy_existing_paid_consume(
  p_actor_user_id uuid,p_headquarters_id uuid
) returns jsonb language sql security definer set search_path='' as $$
  select platform_billing_private.academy_paid_activation_verify_and_consume(
    p_actor_user_id,p_headquarters_id,true)
$$;

revoke all on function platform_billing_private.subscription_immutable_guard() from public,anon,authenticated,service_role;
revoke all on function platform_billing_private.next_anchored_month(timestamptz,timestamptz) from public,anon,authenticated,service_role;
revoke all on function platform_billing_private.academy_paid_activation_verify_and_consume(uuid,uuid,boolean) from public,anon,authenticated,service_role;
revoke all on function public.platform_billing_verified_subscription_activate(uuid,text,text,text,text,text,bigint,text,timestamptz) from public,anon,authenticated;
revoke all on function public.platform_billing_subscription_event_apply(text,text,text,text,text,timestamptz,timestamptz,boolean,timestamptz) from public,anon,authenticated;
revoke all on function public.platform_billing_status_get(uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.platform_billing_portal_context(uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.platform_billing_attempt_mark_ready(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.platform_billing_academy_new_paid_consume(uuid,uuid) from public,anon,authenticated;
revoke all on function public.platform_billing_academy_existing_paid_consume(uuid,uuid) from public,anon,authenticated;
grant execute on function public.platform_billing_attempt_mark_ready(uuid,uuid,text,text) to service_role;
grant execute on function public.platform_billing_verified_subscription_activate(uuid,text,text,text,text,text,bigint,text,timestamptz) to service_role;
grant execute on function public.platform_billing_subscription_event_apply(text,text,text,text,text,timestamptz,timestamptz,boolean,timestamptz) to service_role;
grant execute on function public.platform_billing_status_get(uuid,text,uuid) to service_role;
grant execute on function public.platform_billing_portal_context(uuid,text,uuid) to service_role;
grant execute on function public.platform_billing_academy_new_paid_consume(uuid,uuid) to service_role;
grant execute on function public.platform_billing_academy_existing_paid_consume(uuid,uuid) to service_role;

comment on table platform_billing_private.subscriptions is 'Server-only Stripe subscription projection; no raw events, secrets or customer PII.';
