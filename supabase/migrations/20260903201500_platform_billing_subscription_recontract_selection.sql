-- Allow a resource to be purchased again after its previous subscription ended,
-- while preserving every immutable checkout/subscription row.

alter table platform_billing_private.attempts drop constraint if exists attempts_scope_id_key;
create index if not exists platform_billing_attempt_scope_idx
  on platform_billing_private.attempts(scope_id,created_at,id);
create index if not exists platform_billing_paid_resource_attempt_idx
  on platform_billing_private.creation_entitlements(actor_user_id,product_key,resource_id,source_attempt_id)
  where source_kind='verified_paid' and status='consumed' and resource_id is not null;
create index if not exists platform_billing_subscription_event_occurred_idx
  on platform_billing_private.subscription_events(subscription_id,occurred_at desc,id);

create or replace function public.platform_billing_attempt_reserve(p_actor_user_id uuid,p_quote_id text,p_consent jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare q platform_billing_private.quotes%rowtype; a platform_billing_private.attempts%rowtype; v_scope uuid; v_now timestamptz; v_id uuid:=gen_random_uuid();
begin
 perform platform_billing_private.require_actor(p_actor_user_id);
 select scope_id into v_scope from platform_billing_private.quotes where quote_id=p_quote_id and owner_user_id=p_actor_user_id;
 if not found then raise exception using errcode='P0002',message='PLATFORM_BILLING_NOT_FOUND'; end if;
 perform 1 from platform_billing_private.scopes where id=v_scope and owner_user_id=p_actor_user_id for update;
 select * into q from platform_billing_private.quotes where quote_id=p_quote_id and scope_id=v_scope and owner_user_id=p_actor_user_id for update;
 if not found then raise exception using errcode='P0002',message='PLATFORM_BILLING_NOT_FOUND'; end if;
 v_now:=clock_timestamp();
 if q.issued_at>v_now or q.expires_at<=v_now or (q.payload#>>'{dueNow,dueOn}')::date<(v_now at time zone 'Asia/Tokyo')::date then
  raise exception using errcode='22023',message='PLATFORM_BILLING_QUOTE_EXPIRED';
 end if;
 if not platform_billing_private.exact_keys(p_consent,array['quoteId','revision','termsVersion','accepted'])
  or p_consent->'accepted' is distinct from 'true'::jsonb or p_consent->'quoteId' is distinct from q.payload->'quoteId'
  or p_consent->'revision' is distinct from q.payload->'revision' or p_consent->'termsVersion' is distinct from q.payload#>'{policies,terms,version}' then
  raise exception using errcode='22023',message='PLATFORM_BILLING_INVALID_CONSENT';
 end if;
 select * into a from platform_billing_private.attempts where owner_user_id=p_actor_user_id and product_key=q.product_key and request_id=q.request_id for update;
 if found then
  if a.quote_id is distinct from q.quote_id or a.quote_revision is distinct from q.revision or a.consent is distinct from p_consent or a.scope_id is distinct from v_scope then
   raise exception using errcode='23505',message='PLATFORM_BILLING_IDEMPOTENCY_CONFLICT'; end if;
  return platform_billing_private.attempt_result(a,false);
 end if;
 if exists (
   select 1 from platform_billing_private.attempts prior
   where prior.scope_id=v_scope and (
     prior.status<>'provider_ready' or
     (select count(*) from platform_billing_private.subscriptions s where s.source_attempt_id=prior.id and s.status='ended')<>1
   )
 ) then raise exception using errcode='23505',message='PLATFORM_BILLING_SCOPE_PENDING'; end if;
 insert into platform_billing_private.attempts(id,scope_id,owner_user_id,product_key,resource_id,plan_key,request_id,quote_id,quote_revision,consent,provider_idempotency_key)
 values(v_id,v_scope,p_actor_user_id,q.product_key,q.resource_id,q.plan_key,q.request_id,q.quote_id,q.revision,p_consent,'platform-checkout-'||v_id::text) returning * into a;
 return platform_billing_private.attempt_result(a,true);
end $$;

create or replace function platform_billing_private.resource_access_window(p_product_key text,p_resource_id uuid,p_at timestamptz)
returns table(actor_user_id uuid,status text,current_period_start timestamptz,current_period_end timestamptz,write_allowed boolean,owner_read_until timestamptz,anonymize_after timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare v platform_billing_private.subscriptions%rowtype; t platform_billing_private.creation_entitlements%rowtype; n int; ended_at timestamptz; latest timestamptz;
begin
 if p_product_key not in ('academy_platform','community_platform') or p_resource_id is null or p_at is null or not isfinite(p_at) then return; end if;
 select count(*) into n from platform_billing_private.creation_entitlements e join platform_billing_private.subscriptions s on s.source_attempt_id=e.source_attempt_id
 where e.product_key=p_product_key and e.source_kind='verified_paid' and e.status='consumed' and e.resource_id=p_resource_id
 and s.actor_user_id=e.actor_user_id and s.product_key=e.product_key and s.plan_key=e.plan_key and s.status in ('active','past_due')
 and s.current_period_start<=p_at and s.current_period_end>p_at and e.starts_at<=p_at and (e.expires_at is null or e.expires_at>p_at);
 if n>1 then return; end if;
 if n=1 then
  select s.* into strict v from platform_billing_private.creation_entitlements e join platform_billing_private.subscriptions s on s.source_attempt_id=e.source_attempt_id
  where e.product_key=p_product_key and e.source_kind='verified_paid' and e.status='consumed' and e.resource_id=p_resource_id
  and s.actor_user_id=e.actor_user_id and s.product_key=e.product_key and s.plan_key=e.plan_key and s.status in ('active','past_due')
  and s.current_period_start<=p_at and s.current_period_end>p_at and e.starts_at<=p_at and (e.expires_at is null or e.expires_at>p_at);
  return query select v.actor_user_id,v.status,v.current_period_start,v.current_period_end,v.status='active',null::timestamptz,null::timestamptz; return;
 end if;
 -- A stale active/past_due projection remains owner-readable while provider
 -- reconciliation is pending. It never restores writes or starts retention.
 select max(s.current_period_end) into latest from platform_billing_private.creation_entitlements e join platform_billing_private.subscriptions s on s.source_attempt_id=e.source_attempt_id
 where e.product_key=p_product_key and e.source_kind='verified_paid' and e.status='consumed' and e.resource_id=p_resource_id
 and s.actor_user_id=e.actor_user_id and s.product_key=e.product_key and s.plan_key=e.plan_key and s.status in ('active','past_due');
 if latest is not null then
  select count(*) into n from platform_billing_private.creation_entitlements e join platform_billing_private.subscriptions s on s.source_attempt_id=e.source_attempt_id
  where e.product_key=p_product_key and e.source_kind='verified_paid' and e.status='consumed' and e.resource_id=p_resource_id
  and s.actor_user_id=e.actor_user_id and s.product_key=e.product_key and s.plan_key=e.plan_key and s.status in ('active','past_due') and s.current_period_end=latest;
  if n<>1 then return; end if;
  select s.* into strict v from platform_billing_private.creation_entitlements e join platform_billing_private.subscriptions s on s.source_attempt_id=e.source_attempt_id
  where e.product_key=p_product_key and e.source_kind='verified_paid' and e.status='consumed' and e.resource_id=p_resource_id
  and s.actor_user_id=e.actor_user_id and s.product_key=e.product_key and s.plan_key=e.plan_key and s.status in ('active','past_due') and s.current_period_end=latest;
  return query select v.actor_user_id,v.status,v.current_period_start,v.current_period_end,false,null::timestamptz,null::timestamptz; return;
 end if;
 select max(x.ended_at) into latest from (
  select greatest(s.current_period_end,coalesce(max(se.occurred_at) filter(where se.applied and se.projected_status='ended'),s.current_period_end)) ended_at
  from platform_billing_private.creation_entitlements e join platform_billing_private.subscriptions s on s.source_attempt_id=e.source_attempt_id
  left join platform_billing_private.subscription_events se on se.subscription_id=s.id
  where e.product_key=p_product_key and e.source_kind='verified_paid' and e.status='consumed' and e.resource_id=p_resource_id and s.status='ended'
  and s.actor_user_id=e.actor_user_id and s.product_key=e.product_key and s.plan_key=e.plan_key group by s.id) x;
 if latest is not null then
  select count(*) into n from (
   select s.id from platform_billing_private.creation_entitlements e join platform_billing_private.subscriptions s on s.source_attempt_id=e.source_attempt_id left join platform_billing_private.subscription_events se on se.subscription_id=s.id
   where e.product_key=p_product_key and e.source_kind='verified_paid' and e.status='consumed' and e.resource_id=p_resource_id and s.status='ended'
   group by s.id having greatest(s.current_period_end,coalesce(max(se.occurred_at) filter(where se.applied and se.projected_status='ended'),s.current_period_end))=latest) z;
  if n<>1 then return; end if;
  select s.* into strict v from platform_billing_private.creation_entitlements e join platform_billing_private.subscriptions s on s.source_attempt_id=e.source_attempt_id left join platform_billing_private.subscription_events se on se.subscription_id=s.id
  where e.product_key=p_product_key and e.source_kind='verified_paid' and e.status='consumed' and e.resource_id=p_resource_id and s.status='ended'
  group by s.id having greatest(s.current_period_end,coalesce(max(se.occurred_at) filter(where se.applied and se.projected_status='ended'),s.current_period_end))=latest;
  ended_at:=latest;
  return query select v.actor_user_id,v.status,v.current_period_start,v.current_period_end,false,ended_at+interval '90 days',ended_at+interval '90 days'; return;
 end if;
 if p_product_key<>'community_platform' then return; end if;
 select count(*) into n from platform_billing_private.creation_entitlements e where e.product_key='community_platform' and e.source_kind='verified_trial' and e.plan_key='trial' and e.status='consumed' and e.resource_id=p_resource_id;
 if n<>1 then return; end if;
 select * into strict t from platform_billing_private.creation_entitlements e where e.product_key='community_platform' and e.source_kind='verified_trial' and e.plan_key='trial' and e.status='consumed' and e.resource_id=p_resource_id;
 if t.expires_at is null then return; end if;
 return query select t.actor_user_id,case when t.starts_at<=p_at and t.expires_at>p_at then 'trialing' else 'ended' end,t.starts_at,t.expires_at,t.starts_at<=p_at and t.expires_at>p_at,case when t.expires_at<=p_at then t.expires_at+interval '90 days' end,case when t.expires_at<=p_at then t.expires_at+interval '90 days' end;
end $$;

-- Select the one current paid purchase before locking. Re-read every immutable
-- link after acquiring the canonical common lock order. Existing resources may
-- only use their bound entitlement; new resources may only use an unbound one.
create or replace function platform_billing_private.academy_paid_activation_verify_and_consume(p_actor_user_id uuid,p_headquarters_id uuid,p_existing_headquarters boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare n int; v_now timestamptz:=clock_timestamp(); v_scope uuid; v_quote text; v_subscription_id uuid; v_entitlement_id uuid;
 v_subscription platform_billing_private.subscriptions%rowtype; v_entitlement platform_billing_private.creation_entitlements%rowtype;
 v_attempt platform_billing_private.attempts%rowtype; v_event platform_billing_private.verified_provider_events%rowtype;
begin
 perform platform_billing_private.require_actor(p_actor_user_id);
 if p_headquarters_id is null then raise exception using errcode='22023',message='PLATFORM_BILLING_INVALID_RESOURCE'; end if;
 if session_user<>'service_role' and coalesce(current_setting('role',true),'')<>'service_role' then raise exception using errcode='42501',message='PLATFORM_BILLING_FORBIDDEN'; end if;
 select count(*) into n from platform_billing_private.subscriptions s join platform_billing_private.attempts a on a.id=s.source_attempt_id
 join platform_billing_private.creation_entitlements e on e.source_attempt_id=s.source_attempt_id
 where s.actor_user_id=p_actor_user_id and s.product_key='academy_platform' and s.status='active'
 and s.current_period_start<=v_now and s.current_period_end>v_now and a.status='provider_ready'
 and ((p_existing_headquarters and a.resource_id=p_headquarters_id::text and ((e.status='consumed' and e.resource_id=p_headquarters_id) or (e.status='available' and e.resource_id is null)))
   or (not p_existing_headquarters and a.resource_id is null and e.status='available' and e.resource_id is null))
 and e.actor_user_id=p_actor_user_id and e.product_key='academy_platform' and e.source_kind='verified_paid';
 if n<>1 then raise exception using errcode=case when n=0 then 'P0002' else '23505' end,message=case when n=0 then 'PLATFORM_BILLING_NOT_FOUND' else 'PLATFORM_BILLING_MULTIPLE_CURRENT_SUBSCRIPTIONS' end; end if;
 select a.scope_id,a.quote_id,s.id,e.id into strict v_scope,v_quote,v_subscription_id,v_entitlement_id
 from platform_billing_private.subscriptions s join platform_billing_private.attempts a on a.id=s.source_attempt_id join platform_billing_private.creation_entitlements e on e.source_attempt_id=s.source_attempt_id
 where s.actor_user_id=p_actor_user_id and s.product_key='academy_platform' and s.status='active' and s.current_period_start<=v_now and s.current_period_end>v_now and a.status='provider_ready'
 and ((p_existing_headquarters and a.resource_id=p_headquarters_id::text and ((e.status='consumed' and e.resource_id=p_headquarters_id) or (e.status='available' and e.resource_id is null))) or (not p_existing_headquarters and a.resource_id is null and e.status='available' and e.resource_id is null))
 and e.actor_user_id=p_actor_user_id and e.product_key='academy_platform' and e.source_kind='verified_paid';
 perform 1 from platform_billing_private.scopes where id=v_scope and owner_user_id=p_actor_user_id and product_key='academy_platform' for update;
 perform 1 from platform_billing_private.quotes where quote_id=v_quote and scope_id=v_scope and owner_user_id=p_actor_user_id for update;
 select * into strict v_attempt from platform_billing_private.attempts where scope_id=v_scope and quote_id=v_quote and owner_user_id=p_actor_user_id and product_key='academy_platform' and status='provider_ready' and ((p_existing_headquarters and resource_id=p_headquarters_id::text) or (not p_existing_headquarters and resource_id is null)) for update;
 select * into strict v_event from platform_billing_private.verified_provider_events where attempt_id=v_attempt.id and actor_user_id=p_actor_user_id and product_key='academy_platform' for update;
 select * into strict v_subscription from platform_billing_private.subscriptions where id=v_subscription_id and source_attempt_id=v_attempt.id and actor_user_id=p_actor_user_id and product_key='academy_platform' for update;
 select * into strict v_entitlement from platform_billing_private.creation_entitlements where id=v_entitlement_id and source_attempt_id=v_attempt.id and actor_user_id=p_actor_user_id and product_key='academy_platform' and source_kind='verified_paid' for update;
 if v_subscription.status<>'active' or v_subscription.current_period_start>v_now or v_subscription.current_period_end<=v_now
  or v_entitlement.plan_key is distinct from v_subscription.plan_key or v_entitlement.starts_at is distinct from v_event.paid_at
  or v_entitlement.expires_at is distinct from v_subscription.current_period_end then raise exception using errcode='42501',message='PLATFORM_BILLING_VERIFICATION_FAILED'; end if;
 if p_existing_headquarters then
  perform 1 from public.academy_headquarters where id=p_headquarters_id and owner_user_id=p_actor_user_id for update;
  if not found then raise exception using errcode='42501',message='PLATFORM_BILLING_RESOURCE_FORBIDDEN'; end if;
  if v_entitlement.status='available' and v_entitlement.resource_id is null then
   update platform_billing_private.creation_entitlements set status='consumed',resource_id=p_headquarters_id,consumed_at=v_now,updated_at=v_now where id=v_entitlement.id and status='available' and resource_id is null;
   if not found then raise exception using errcode='42501',message='PLATFORM_BILLING_VERIFICATION_FAILED'; end if;
  elsif v_entitlement.status<>'consumed' or v_entitlement.resource_id is distinct from p_headquarters_id then
   raise exception using errcode='42501',message='PLATFORM_BILLING_RESOURCE_FORBIDDEN';
  end if;
 else
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_headquarters_id::text,0));
  if exists(select 1 from public.academy_headquarters where id=p_headquarters_id) then raise exception using errcode='23505',message='PLATFORM_BILLING_RESOURCE_ALREADY_EXISTS'; end if;
  update platform_billing_private.creation_entitlements set status='consumed',resource_id=p_headquarters_id,consumed_at=v_now,updated_at=v_now where id=v_entitlement.id and status='available' and resource_id is null;
  if not found then raise exception using errcode='42501',message='PLATFORM_BILLING_VERIFICATION_FAILED'; end if;
 end if;
 return jsonb_build_object('verified',true,'actorUserId',p_actor_user_id,'headquartersId',p_headquarters_id,'productKey','academy_platform','planKey',v_subscription.plan_key,'sourceAttemptId',v_subscription.source_attempt_id,'paidAt',to_char(v_event.paid_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'currentPeriodEndsAt',to_char(v_subscription.current_period_end at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
end $$;

create or replace function public.platform_billing_academy_new_paid_consume(p_actor_user_id uuid,p_generated_headquarters_id uuid)
returns jsonb language sql security definer set search_path='' as $$ select platform_billing_private.academy_paid_activation_verify_and_consume(p_actor_user_id,p_generated_headquarters_id,false) $$;
create or replace function public.platform_billing_academy_existing_paid_consume(p_actor_user_id uuid,p_headquarters_id uuid)
returns jsonb language sql security definer set search_path='' as $$ select platform_billing_private.academy_paid_activation_verify_and_consume(p_actor_user_id,p_headquarters_id,true) $$;

create or replace function platform_billing_private.resource_subscription_select(p_actor_user_id uuid,p_product_key text,p_resource_id uuid,p_at timestamptz)
returns uuid language plpgsql stable security definer set search_path='' as $$
declare n int; v_id uuid; v_latest timestamptz;
begin
 select count(*),(array_agg(s.id order by s.id))[1] into n,v_id from platform_billing_private.subscriptions s join platform_billing_private.creation_entitlements e on e.source_attempt_id=s.source_attempt_id
 where s.actor_user_id=p_actor_user_id and s.product_key=p_product_key and e.actor_user_id=p_actor_user_id and e.product_key=p_product_key
 and e.status='consumed' and e.resource_id=p_resource_id and s.status in ('active','past_due') and s.current_period_start<=p_at and s.current_period_end>p_at;
 if n>1 then raise exception using errcode='23505',message='PLATFORM_BILLING_MULTIPLE_CURRENT_SUBSCRIPTIONS'; end if;
 if n=1 then return v_id; end if;
 select max(s.current_period_end) into v_latest from platform_billing_private.subscriptions s join platform_billing_private.creation_entitlements e on e.source_attempt_id=s.source_attempt_id
 where s.actor_user_id=p_actor_user_id and s.product_key=p_product_key and e.actor_user_id=p_actor_user_id and e.product_key=p_product_key
 and e.status='consumed' and e.resource_id=p_resource_id and s.status in ('active','past_due');
 if v_latest is not null then
  select count(*),(array_agg(s.id order by s.id))[1] into n,v_id from platform_billing_private.subscriptions s join platform_billing_private.creation_entitlements e on e.source_attempt_id=s.source_attempt_id
  where s.actor_user_id=p_actor_user_id and s.product_key=p_product_key and e.actor_user_id=p_actor_user_id and e.product_key=p_product_key
  and e.status='consumed' and e.resource_id=p_resource_id and s.status in ('active','past_due') and s.current_period_end=v_latest;
  if n<>1 then raise exception using errcode='23505',message='PLATFORM_BILLING_AMBIGUOUS_STALE_SUBSCRIPTION'; end if;
  return v_id;
 end if;
 select max(s.current_period_end) into v_latest from platform_billing_private.subscriptions s join platform_billing_private.creation_entitlements e on e.source_attempt_id=s.source_attempt_id
 where s.actor_user_id=p_actor_user_id and s.product_key=p_product_key and e.actor_user_id=p_actor_user_id and e.product_key=p_product_key and e.status='consumed' and e.resource_id=p_resource_id and s.status='ended';
 if v_latest is null then return null; end if;
 select count(*),(array_agg(s.id order by s.id))[1] into n,v_id from platform_billing_private.subscriptions s join platform_billing_private.creation_entitlements e on e.source_attempt_id=s.source_attempt_id
 where s.actor_user_id=p_actor_user_id and s.product_key=p_product_key and e.actor_user_id=p_actor_user_id and e.product_key=p_product_key and e.status='consumed' and e.resource_id=p_resource_id and s.status='ended' and s.current_period_end=v_latest;
 if n<>1 then raise exception using errcode='23505',message='PLATFORM_BILLING_AMBIGUOUS_ENDED_SUBSCRIPTION'; end if;
 return v_id;
end $$;

create or replace function public.platform_billing_status_get(p_actor_user_id uuid,p_product_key text,p_resource_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_creation jsonb; v_subscription platform_billing_private.subscriptions%rowtype; v_id uuid; v_state text; v_actions jsonb:='[]'::jsonb;
begin
 perform platform_billing_private.require_actor(p_actor_user_id);
 if p_product_key not in ('academy_platform','community_platform') then raise exception using errcode='22023',message='PLATFORM_BILLING_INVALID_SUBSCRIPTION_SCOPE'; end if;
 v_creation:=public.platform_billing_creation_status(p_actor_user_id,p_product_key,p_resource_id);
 if p_resource_id is not null then v_id:=platform_billing_private.resource_subscription_select(p_actor_user_id,p_product_key,p_resource_id,clock_timestamp());
 else
  select s.id into v_id from platform_billing_private.subscriptions s join platform_billing_private.creation_entitlements e on e.source_attempt_id=s.source_attempt_id
  where s.actor_user_id=p_actor_user_id and s.product_key=p_product_key and e.status='available' and e.resource_id is null order by s.created_at desc,s.id desc limit 1;
 end if;
 if v_id is not null then
  select * into strict v_subscription from platform_billing_private.subscriptions where id=v_id;
  v_state:=case when v_subscription.status='active' and v_subscription.current_period_end<=clock_timestamp() then 'past_due' else v_subscription.status end;
  v_actions:='["portal"]'::jsonb; if v_state='active' and v_creation->>'state'='available' then v_actions:='["portal","create_resource"]'::jsonb; end if;
  return jsonb_build_object('version',0,'product',p_product_key,'resourceId',p_resource_id,'availability','ready','subscription',jsonb_build_object('state',v_state,'planKey',v_subscription.plan_key,'currentPeriodEndsAt',to_char(v_subscription.current_period_end at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'cancelAtPeriodEnd',v_subscription.cancel_at_period_end),'creation',jsonb_build_object('state',v_creation->>'state'),'allowedActions',v_actions,'noticeCode',null);
 end if;
 return jsonb_build_object('version',0,'product',p_product_key,'resourceId',p_resource_id,'availability','ready','subscription',null,'creation',jsonb_build_object('state',v_creation->>'state'),'allowedActions',case when v_creation->>'state'='available' then '["create_resource"]'::jsonb else '["checkout"]'::jsonb end,'noticeCode',null);
end $$;

create or replace function public.platform_billing_portal_context(p_actor_user_id uuid,p_product_key text,p_resource_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v platform_billing_private.subscriptions%rowtype; v_id uuid;
begin
 perform platform_billing_private.require_actor(p_actor_user_id);
 v_id:=platform_billing_private.resource_subscription_select(p_actor_user_id,p_product_key,p_resource_id,clock_timestamp());
 if v_id is null then return null; end if;
 select * into strict v from platform_billing_private.subscriptions where id=v_id;
 return jsonb_build_object('providerCustomerId',v.provider_customer_id,'providerSubscriptionId',v.provider_subscription_id);
end $$;

revoke all on function platform_billing_private.academy_paid_activation_verify_and_consume(uuid,uuid,boolean) from public,anon,authenticated,service_role;
revoke all on function platform_billing_private.resource_subscription_select(uuid,text,uuid,timestamptz) from public,anon,authenticated,service_role;
revoke all on function public.platform_billing_attempt_reserve(uuid,text,jsonb),public.platform_billing_academy_new_paid_consume(uuid,uuid),public.platform_billing_academy_existing_paid_consume(uuid,uuid) from public,anon,authenticated;
grant execute on function public.platform_billing_attempt_reserve(uuid,text,jsonb),public.platform_billing_academy_new_paid_consume(uuid,uuid),public.platform_billing_academy_existing_paid_consume(uuid,uuid) to service_role;
revoke all on function platform_billing_private.resource_access_window(text,uuid,timestamptz) from public,anon,authenticated,service_role;
