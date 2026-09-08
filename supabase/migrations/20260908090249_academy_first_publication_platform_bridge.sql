-- New-origin bridge. No policy activation, Checkout fabrication or external I/O.
-- Depends on academy_first_publication_runtime. All first-payment proof is server verified.
alter table platform_billing_private.subscriptions
  alter column source_attempt_id drop not null,
  add column origin_kind text not null default 'checkout',
  add column source_first_publication_hq uuid unique references academy_publication_private.enrollments(headquarters_id) on delete restrict,
  add constraint platform_subscription_origin_exclusive check (
    (origin_kind='checkout' and source_attempt_id is not null and source_first_publication_hq is null)
    or (origin_kind='academy_first_publication' and product_key='academy_platform' and source_attempt_id is null and source_first_publication_hq is not null)
  );

create table academy_publication_private.first_invoice_proofs (
  headquarters_id uuid primary key references academy_publication_private.enrollments(headquarters_id) on delete restrict,
  subscription_id uuid not null unique references platform_billing_private.subscriptions(id) on delete restrict,
  event_key text not null unique references academy_publication_private.outbox(event_key) on delete restrict,
  quote_id uuid not null references academy_publication_private.quotes(id) on delete restrict,
  policy_version text not null references academy_publication_private.policies(version) on delete restrict,
  provider_invoice_id text not null unique check(provider_invoice_id ~ '^in_[A-Za-z0-9]+$'),
  provider_result_hash text not null check(provider_result_hash ~ '^[0-9a-f]{64}$'),
  verified_result jsonb not null,
  created_at timestamptz not null default clock_timestamp()
);
create table academy_publication_private.renewal_prices (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references platform_billing_private.subscriptions(id) on delete restrict,
  snapshot_id uuid not null references public.academy_monthly_billing_snapshots(id) on delete restrict,
  period_start timestamptz not null check(isfinite(period_start)),
  amount_yen bigint not null check(amount_yen>=0),
  created_at timestamptz not null default clock_timestamp(),
  unique(subscription_id,period_start)
);
create table academy_publication_private.renewal_invoice_proofs (
  provider_invoice_id text primary key check(provider_invoice_id ~ '^in_[A-Za-z0-9]+$'),
  subscription_id uuid not null references platform_billing_private.subscriptions(id) on delete restrict,
  price_id uuid not null references academy_publication_private.renewal_prices(id) on delete restrict,
  provider_event_id text not null unique check(provider_event_id ~ '^evt_[A-Za-z0-9]+$'),
  provider_result_hash text not null check(provider_result_hash ~ '^[0-9a-f]{64}$'),
  period_end timestamptz not null check(isfinite(period_end)),
  created_at timestamptz not null default clock_timestamp(),
  unique(subscription_id,price_id)
);
create table academy_publication_private.renewal_jobs (
 event_key text primary key,
 subscription_id uuid not null references platform_billing_private.subscriptions(id) on delete restrict,
 kind text not null check(kind in ('renew_price','renew_pay')),
 period_start timestamptz not null check(isfinite(period_start)),
 period_end timestamptz not null check(isfinite(period_end) and period_end>period_start),
 available_at timestamptz not null,
 lease_token uuid,lease_until timestamptz,delivered_at timestamptz,blocked boolean not null default false,result jsonb,
 unique(subscription_id,kind,period_start)
);
create table academy_publication_private.renewal_steps (
 event_key text not null references academy_publication_private.renewal_jobs(event_key) on delete restrict,
 step text not null check(step in ('price_update','invoice_select','line_update','finalize','pay')),
 operation_key text not null unique,provider_id text,started_at timestamptz not null default clock_timestamp(),
 primary key(event_key,step)
);
create index academy_publication_renewal_due on academy_publication_private.renewal_jobs(available_at,event_key) where delivered_at is null and not blocked;
alter table academy_publication_private.renewal_jobs enable row level security;
alter table academy_publication_private.renewal_steps enable row level security;
revoke all on academy_publication_private.renewal_jobs,academy_publication_private.renewal_steps from public,anon,authenticated,service_role;
do $$ declare t text; begin
 foreach t in array array['first_invoice_proofs','renewal_prices','renewal_invoice_proofs'] loop
  execute format('alter table academy_publication_private.%I enable row level security',t);
  execute format('revoke all on academy_publication_private.%I from public,anon,authenticated,service_role',t);
  execute format('create trigger immutable before update or delete on academy_publication_private.%I for each row execute function platform_billing_private.verified_provider_event_guard()',t);
  execute format('create trigger no_truncate before truncate on academy_publication_private.%I for each statement execute function platform_billing_private.verified_provider_event_guard()',t);
 end loop;
end $$;

create function academy_publication_private.require_bridge_worker() returns void
language plpgsql security invoker set search_path='' as $$
begin
 if session_user<>'service_role' and coalesce(current_setting('role',true),'')<>'service_role' then
  raise exception using errcode='42501',message='academy_bridge_forbidden';
 end if;
end $$;
revoke all on function academy_publication_private.require_bridge_worker() from public,anon,authenticated,service_role;

create function academy_publication_private.paid_bridge(p_event_key text,p_lease_token uuid,p_result jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o academy_publication_private.outbox%rowtype; e academy_publication_private.enrollments%rowtype;
 s academy_publication_private.setup_attempts%rowtype; v platform_billing_private.subscriptions%rowtype;
 f academy_publication_private.first_invoice_proofs%rowtype; result jsonb; paid timestamptz; ends timestamptz;
begin
 perform academy_publication_private.require_bridge_worker();
 perform academy_publication_private.lock_outbox(p_event_key);
 select * into o from academy_publication_private.outbox where event_key=p_event_key;
 select * into e from academy_publication_private.enrollments where headquarters_id=o.headquarters_id;
 if o.kind is distinct from 'start_paid' or e.headquarters_id is null then raise exception 'academy_bridge_wrong_operation'; end if;
 select * into f from academy_publication_private.first_invoice_proofs where event_key=p_event_key;
 if found then
  if f.verified_result is distinct from p_result then raise exception using errcode='23505',message='academy_bridge_proof_conflict'; end if;
  return jsonb_build_object('status','already_finished','subscription_id',f.subscription_id);
 end if;
 if not coalesce((public.academy_first_publication_outbox_dispatch_check(p_event_key,p_lease_token)->>'allowed')::boolean,false) then raise exception 'academy_bridge_dispatch_blocked'; end if;
 if not platform_billing_private.exact_keys(p_result,array['outcome','provider_invoice_id','provider_subscription_id','provider_customer_id','amount_yen','plan_key','paid_at','period_end','provider_result_hash'])
  or p_result->>'outcome' is distinct from 'paid'
  or coalesce(p_result->>'provider_invoice_id','') !~ '^in_[A-Za-z0-9]+$'
  or coalesce(p_result->>'provider_subscription_id','') !~ '^sub_[A-Za-z0-9]+$'
  or coalesce(p_result->>'provider_customer_id','') !~ '^cus_[A-Za-z0-9]+$'
  or coalesce(p_result->>'provider_result_hash','') !~ '^[0-9a-f]{64}$'
  or (p_result->>'amount_yen')::bigint is distinct from e.amount_yen
  or p_result->>'plan_key' is distinct from (case when e.amount_yen=5000 then 'small' when e.amount_yen=10000 then 'medium' when e.amount_yen=20000 then 'large' else null end)
 then raise exception 'academy_bridge_invalid_proof'; end if;
 paid:=(p_result->>'paid_at')::timestamptz; ends:=(p_result->>'period_end')::timestamptz;
 if paid is null or ends is null or not isfinite(paid) or not isfinite(ends)
  or paid<=e.trial_ends_at or paid>clock_timestamp()+interval '5 minutes'
  or ends is distinct from platform_billing_private.next_month_at(paid) then raise exception 'academy_bridge_invalid_period'; end if;
 select * into s from academy_publication_private.setup_attempts where quote_id=e.quote_id and headquarters_id=e.headquarters_id;
 if s.status is distinct from 'verified' or s.owner_user_id is distinct from e.owner_user_id
  or s.provider_customer_id is distinct from p_result->>'provider_customer_id'
  or not exists(select 1 from academy_publication_private.provider_steps where event_key=p_event_key and step='invoice_create' and provider_id=p_result->>'provider_invoice_id')
  or not exists(select 1 from academy_publication_private.provider_steps where event_key=p_event_key and step='subscription_create' and provider_id=p_result->>'provider_subscription_id')
  or not exists(select 1 from academy_publication_private.provider_steps where event_key=p_event_key and step='subscription_hold' and provider_id=p_result->>'provider_subscription_id')
 then raise exception 'academy_bridge_provider_binding_mismatch'; end if;
 -- No new paid origin may overlap another contract for this HQ or owner.
 if exists(select 1 from platform_billing_private.subscriptions where actor_user_id=e.owner_user_id and product_key='academy_platform' and status<>'ended') then raise exception 'academy_bridge_existing_contract'; end if;
 insert into platform_billing_private.subscriptions(actor_user_id,product_key,plan_key,source_attempt_id,origin_kind,source_first_publication_hq,
  provider_customer_id,provider_subscription_id,initial_amount_yen,currency,status,original_paid_at,current_period_start,current_period_end)
 values(e.owner_user_id,'academy_platform',p_result->>'plan_key',null,'academy_first_publication',e.headquarters_id,
  s.provider_customer_id,p_result->>'provider_subscription_id',e.amount_yen,'jpy','active',paid,paid,ends) returning * into v;
 insert into academy_publication_private.first_invoice_proofs(headquarters_id,subscription_id,event_key,quote_id,policy_version,provider_invoice_id,provider_result_hash,verified_result)
 values(e.headquarters_id,v.id,p_event_key,e.quote_id,e.policy_version,p_result->>'provider_invoice_id',p_result->>'provider_result_hash',p_result);
 result:=public.academy_first_publication_outbox_finish(p_event_key,p_lease_token,p_result);
 insert into academy_publication_private.renewal_jobs(event_key,subscription_id,kind,period_start,period_end,available_at)
 values('academy-renew-price:'||v.id||':'||extract(epoch from ends)::text,v.id,'renew_price',ends,platform_billing_private.next_anchored_month(paid,ends),clock_timestamp());
 return result||jsonb_build_object('subscription_id',v.id);
end $$;
create function public.academy_first_publication_paid_bridge(p_event_key text,p_lease_token uuid,p_result jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select academy_publication_private.paid_bridge(p_event_key,p_lease_token,p_result) $$;
revoke all on function academy_publication_private.paid_bridge(text,uuid,jsonb),public.academy_first_publication_paid_bridge(text,uuid,jsonb) from public,anon,authenticated;
grant usage on schema academy_publication_private to service_role;
grant execute on function academy_publication_private.paid_bridge(text,uuid,jsonb),public.academy_first_publication_paid_bridge(text,uuid,jsonb) to service_role;

-- Server-only canonical lookup; unknown is not an empty successful contract.
create function academy_publication_private.subscription_context(p_provider_subscription_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v platform_billing_private.subscriptions%rowtype; f academy_publication_private.first_invoice_proofs%rowtype;
begin
 perform academy_publication_private.require_bridge_worker();
 select * into v from platform_billing_private.subscriptions where provider_subscription_id=p_provider_subscription_id;
 if not found then return jsonb_build_object('kind','unknown'); end if;
 if v.origin_kind='checkout' then return jsonb_build_object('kind','legacy'); end if;
 select * into strict f from academy_publication_private.first_invoice_proofs where subscription_id=v.id;
 return jsonb_build_object('kind','academy_first_publication','headquarters_id',f.headquarters_id,'owner_user_id',v.actor_user_id,
  'provider_customer_id',v.provider_customer_id,'provider_subscription_id',v.provider_subscription_id,'provider_invoice_id',f.provider_invoice_id,
  'initial_amount_yen',v.initial_amount_yen,'plan_key',v.plan_key,'paid_at',v.original_paid_at,'current_period_start',v.current_period_start,
  'current_period_end',v.current_period_end,'status',v.status,'cancel_at_period_end',v.cancel_at_period_end,'policy_version',f.policy_version);
end $$;
create function public.academy_first_publication_subscription_context(p_provider_subscription_id text)
returns jsonb language sql security invoker set search_path='' as $$ select academy_publication_private.subscription_context(p_provider_subscription_id) $$;

create function academy_publication_private.invoice_context(p_provider_invoice_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare f academy_publication_private.first_invoice_proofs%rowtype; o academy_publication_private.outbox%rowtype;
 e academy_publication_private.enrollments%rowtype; s academy_publication_private.setup_attempts%rowtype; sub text;
begin
 perform academy_publication_private.require_bridge_worker();
 select * into f from academy_publication_private.first_invoice_proofs where provider_invoice_id=p_provider_invoice_id;
 if found then
  select provider_subscription_id into sub from platform_billing_private.subscriptions where id=f.subscription_id;
  return academy_publication_private.subscription_context(sub)||jsonb_build_object('invoice_kind','first_payment');
 end if;
 select ob.* into o from academy_publication_private.provider_steps st join academy_publication_private.outbox ob on ob.event_key=st.event_key
 where st.step='invoice_create' and st.provider_id=p_provider_invoice_id;
 if not found then return jsonb_build_object('kind','unknown'); end if;
 select * into strict e from academy_publication_private.enrollments where headquarters_id=o.headquarters_id;
 select * into strict s from academy_publication_private.setup_attempts where headquarters_id=e.headquarters_id and quote_id=e.quote_id;
 return jsonb_build_object('kind','academy_first_publication_pending','invoice_kind','first_payment','headquarters_id',e.headquarters_id,
  'owner_user_id',e.owner_user_id,'provider_customer_id',s.provider_customer_id,'provider_invoice_id',p_provider_invoice_id,
  'initial_amount_yen',e.amount_yen,'policy_version',e.policy_version,'event_key',o.event_key);
end $$;
create function public.academy_first_publication_invoice_context(p_provider_invoice_id text)
returns jsonb language sql security invoker set search_path='' as $$ select academy_publication_private.invoice_context(p_provider_invoice_id) $$;
revoke all on function academy_publication_private.subscription_context(text),academy_publication_private.invoice_context(text),public.academy_first_publication_subscription_context(text),public.academy_first_publication_invoice_context(text) from public,anon,authenticated;
grant execute on function academy_publication_private.subscription_context(text),academy_publication_private.invoice_context(text),public.academy_first_publication_subscription_context(text),public.academy_first_publication_invoice_context(text) to service_role;

-- A read model, not a new creation entitlement: the HQ already exists.
create function academy_publication_private.resource_binding(p_headquarters_id uuid)
returns table(subscription_id uuid,owner_user_id uuid,headquarters_id uuid)
language sql stable security definer set search_path='' as $$
 select s.id,s.actor_user_id,f.headquarters_id from platform_billing_private.subscriptions s
 join academy_publication_private.first_invoice_proofs f on f.subscription_id=s.id and f.headquarters_id=s.source_first_publication_hq
 join public.academy_headquarters h on h.id=f.headquarters_id and h.owner_user_id=s.actor_user_id
 where f.headquarters_id=p_headquarters_id and s.origin_kind='academy_first_publication' and s.product_key='academy_platform'
$$;
revoke all on function academy_publication_private.resource_binding(uuid) from public,anon,authenticated,service_role;

alter function platform_billing_private.resource_subscription_select(uuid,text,uuid,timestamptz) rename to resource_subscription_select_before_publication_bridge;
create function platform_billing_private.resource_subscription_select(p_actor_user_id uuid,p_product_key text,p_resource_id uuid,p_at timestamptz)
returns uuid language plpgsql stable security definer set search_path='' as $$
declare found_id uuid; old_id uuid;
begin
 old_id:=platform_billing_private.resource_subscription_select_before_publication_bridge(p_actor_user_id,p_product_key,p_resource_id,p_at);
 if p_product_key<>'academy_platform' then return old_id; end if;
 select subscription_id into found_id from academy_publication_private.resource_binding(p_resource_id) where owner_user_id=p_actor_user_id;
 if found_id is null then return old_id; end if;
 -- Re-contract migration is separate: do not silently choose one of two origins.
 if old_id is not null then return null; end if;
 return found_id;
end $$;
revoke all on function platform_billing_private.resource_subscription_select(uuid,text,uuid,timestamptz),platform_billing_private.resource_subscription_select_before_publication_bridge(uuid,text,uuid,timestamptz) from public,anon,authenticated,service_role;

alter function platform_billing_private.resource_access_window(text,uuid,timestamptz) rename to resource_access_window_before_publication_bridge;
create function platform_billing_private.resource_access_window(p_product_key text,p_resource_id uuid,p_at timestamptz)
returns table(actor_user_id uuid,status text,current_period_start timestamptz,current_period_end timestamptz,write_allowed boolean,owner_read_until timestamptz,anonymize_after timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare v platform_billing_private.subscriptions%rowtype; ended timestamptz;
begin
 if p_product_key='academy_platform' then
  select s.* into v from platform_billing_private.subscriptions s join academy_publication_private.resource_binding(p_resource_id) b on b.subscription_id=s.id;
 end if;
 if v.id is null then return query select * from platform_billing_private.resource_access_window_before_publication_bridge(p_product_key,p_resource_id,p_at); return; end if;
 if p_at is null or not isfinite(p_at) then return; end if;
 if exists(select 1 from platform_billing_private.resource_access_window_before_publication_bridge(p_product_key,p_resource_id,p_at)) then return; end if;
 if v.status='ended' then
  select greatest(v.current_period_end,coalesce(max(occurred_at) filter(where applied and projected_status='ended'),v.current_period_end)) into ended
   from platform_billing_private.subscription_events where subscription_id=v.id;
  return query select v.actor_user_id,v.status,v.current_period_start,v.current_period_end,false,ended+interval '90 days',ended+interval '90 days';
 else
  return query select v.actor_user_id,v.status,v.current_period_start,v.current_period_end,
    v.status='active' and p_at>=v.current_period_start and p_at<v.current_period_end,null::timestamptz,null::timestamptz;
 end if;
end $$;
revoke all on function platform_billing_private.resource_access_window(text,uuid,timestamptz),platform_billing_private.resource_access_window_before_publication_bridge(text,uuid,timestamptz) from public,anon,authenticated,service_role;

-- Runtime trial projection is preserved. Once bridged, the common subscription
-- ledger is the ONLY authority for ongoing paid status and expiry.
alter function private.academy_first_publication_access(uuid) rename to academy_first_publication_access_before_platform_bridge;
create function private.academy_first_publication_access(p_headquarters_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a jsonb; w record; v_id uuid;
begin
 a:=private.academy_first_publication_access_before_platform_bridge(p_headquarters_id);
 select subscription_id into v_id from academy_publication_private.resource_binding(p_headquarters_id);
 if v_id is null then return a; end if;
 select * into w from platform_billing_private.resource_access_window('academy_platform',p_headquarters_id,statement_timestamp());
 if not found then return a||jsonb_build_object('active',false,'inviteAllowed',false,'phase','attention'); end if;
 return a||jsonb_build_object('active',w.write_allowed,'inviteAllowed',w.write_allowed and a->>'cancellationAcceptedAt' is null
  and exists(select 1 from academy_publication_private.policies where version=a->>'policyVersion' and enabled),
  'phase',case when w.write_allowed then 'paid' when w.status='ended' then 'ended' else 'attention' end,'endsAt',w.current_period_end);
end $$;
revoke all on function private.academy_first_publication_access(uuid),private.academy_first_publication_access_before_platform_bridge(uuid) from public,anon,authenticated,service_role;

alter function private.academy_owner_read_allowed(uuid,timestamptz) rename to academy_owner_read_allowed_before_platform_bridge;
create function private.academy_owner_read_allowed(p_headquarters_id uuid,p_at timestamptz)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare w record;
begin
 if not exists(select 1 from academy_publication_private.resource_binding(p_headquarters_id)) then return private.academy_owner_read_allowed_before_platform_bridge(p_headquarters_id,p_at); end if;
 select * into w from platform_billing_private.resource_access_window('academy_platform',p_headquarters_id,p_at);
 if not found or p_at is null or not isfinite(p_at) then return false; end if;
 return w.status<>'ended' or p_at<w.owner_read_until;
end $$;
revoke all on function private.academy_owner_read_allowed(uuid,timestamptz),private.academy_owner_read_allowed_before_platform_bridge(uuid,timestamptz) from public,anon,authenticated,service_role;

-- Existing status and portal functions use resource_subscription_select and
-- therefore resolve a new origin without creating a fake available entitlement.
-- The dedicated renewal API rejects initial/zero invoices and verifies the
-- immutable month-end charge snapshot, including the existing notice grace.
create function academy_publication_private.renewal_quote(p_provider_subscription_id text,p_period_start timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v platform_billing_private.subscriptions%rowtype; r academy_publication_private.renewal_prices%rowtype;
 snap public.academy_monthly_billing_snapshots%rowtype; h uuid; a uuid;
begin
 perform academy_publication_private.require_bridge_worker();
 select source_first_publication_hq,actor_user_id into h,a from platform_billing_private.subscriptions where provider_subscription_id=p_provider_subscription_id and origin_kind='academy_first_publication';
 if h is null then raise exception 'academy_bridge_unknown_subscription'; end if;
 perform 1 from auth.users where id=a for update; perform 1 from public.academy_headquarters where id=h and owner_user_id=a for update;
 if not found then raise exception 'academy_bridge_owner_changed'; end if;
 select * into v from platform_billing_private.subscriptions where provider_subscription_id=p_provider_subscription_id for update;
 select * into r from academy_publication_private.renewal_prices where subscription_id=v.id and period_start=p_period_start;
 if not found then
  if p_period_start is distinct from v.current_period_end or v.status='ended' or v.cancel_at_period_end then raise exception 'academy_bridge_renewal_not_available'; end if;
  select * into snap from public.academy_monthly_billing_snapshots where headquarters_id=h and charge_month=date_trunc('month',p_period_start at time zone 'Asia/Tokyo')::date;
  if not found then raise exception 'academy_bridge_renewal_snapshot_missing'; end if;
  insert into academy_publication_private.renewal_prices(subscription_id,snapshot_id,period_start,amount_yen)
   values(v.id,snap.id,p_period_start,snap.charge_price_yen) returning * into r;
 end if;
 return jsonb_build_object('price_id',r.id,'snapshot_id',r.snapshot_id,'amount_yen',r.amount_yen,
  'plan_key',case when r.amount_yen=5000 then 'small' when r.amount_yen=10000 then 'medium' when r.amount_yen=20000 then 'large' else null end,
  'period_start',r.period_start,'period_end',platform_billing_private.next_anchored_month(v.original_paid_at,r.period_start));
end $$;
create function public.academy_first_publication_renewal_quote(p_provider_subscription_id text,p_period_start timestamptz)
returns jsonb language sql security invoker set search_path='' as $$ select academy_publication_private.renewal_quote(p_provider_subscription_id,p_period_start) $$;
revoke all on function academy_publication_private.renewal_quote(text,timestamptz),public.academy_first_publication_renewal_quote(text,timestamptz) from public,anon,authenticated;
grant execute on function academy_publication_private.renewal_quote(text,timestamptz),public.academy_first_publication_renewal_quote(text,timestamptz) to service_role;

create function academy_publication_private.subscription_event(p_provider_subscription_id text,p_result jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v platform_billing_private.subscriptions%rowtype; h uuid; a uuid; q jsonb; r academy_publication_private.renewal_invoice_proofs%rowtype; applied jsonb;
begin
 perform academy_publication_private.require_bridge_worker();
 select source_first_publication_hq,actor_user_id into h,a from platform_billing_private.subscriptions where provider_subscription_id=p_provider_subscription_id and origin_kind='academy_first_publication';
 if h is null then raise exception 'academy_bridge_unknown_subscription'; end if;
 perform 1 from auth.users where id=a for update; perform 1 from public.academy_headquarters where id=h and owner_user_id=a for update;
 if not found then raise exception 'academy_bridge_owner_changed'; end if;
 select * into v from platform_billing_private.subscriptions where provider_subscription_id=p_provider_subscription_id for update;
 if not platform_billing_private.exact_keys(p_result,array['provider_event_id','provider_result_hash','provider_customer_id','event_kind','projected_status','period_start','period_end','cancel_at_period_end','occurred_at','provider_invoice_id','amount_yen','currency'])
  or p_result->>'provider_customer_id' is distinct from v.provider_customer_id
  or coalesce(p_result->>'provider_result_hash','') !~ '^[0-9a-f]{64}$'
  or coalesce(p_result->>'provider_event_id','') !~ '^evt_[A-Za-z0-9]+$'
  or coalesce(p_result->>'event_kind','') not in ('invoice_paid','invoice_failed','subscription_state')
 then raise exception 'academy_bridge_invalid_event'; end if;
 if p_result->>'event_kind'='invoice_paid' then
  if coalesce(p_result->>'provider_invoice_id','') !~ '^in_[A-Za-z0-9]+$'
   or p_result->>'currency' is distinct from 'jpy'
   or exists(select 1 from academy_publication_private.first_invoice_proofs where provider_invoice_id=p_result->>'provider_invoice_id') then raise exception 'academy_bridge_not_renewal_invoice'; end if;
  select * into r from academy_publication_private.renewal_invoice_proofs where provider_invoice_id=p_result->>'provider_invoice_id';
  if found then
   if r.subscription_id<>v.id or r.provider_event_id is distinct from p_result->>'provider_event_id' or r.provider_result_hash is distinct from p_result->>'provider_result_hash' then raise exception 'academy_bridge_renewal_conflict'; end if;
  else
   q:=academy_publication_private.renewal_quote(p_provider_subscription_id,(p_result->>'period_start')::timestamptz);
   if (q->>'amount_yen')::bigint is distinct from (p_result->>'amount_yen')::bigint
    or (q->>'period_end')::timestamptz is distinct from (p_result->>'period_end')::timestamptz then raise exception 'academy_bridge_renewal_price_mismatch'; end if;
   insert into academy_publication_private.renewal_invoice_proofs(provider_invoice_id,subscription_id,price_id,provider_event_id,provider_result_hash,period_end)
    values(p_result->>'provider_invoice_id',v.id,(q->>'price_id')::uuid,p_result->>'provider_event_id',p_result->>'provider_result_hash',(p_result->>'period_end')::timestamptz);
  end if;
 end if;
 applied:=public.platform_billing_subscription_event_apply_unlocked_legacy(p_provider_subscription_id,p_result->>'provider_event_id',p_result->>'provider_result_hash',
  p_result->>'event_kind',p_result->>'projected_status',(p_result->>'period_start')::timestamptz,(p_result->>'period_end')::timestamptz,
  (p_result->>'cancel_at_period_end')::boolean,(p_result->>'occurred_at')::timestamptz);
 if p_result->>'event_kind'='invoice_paid' and applied->>'eventStatus'='applied' then
  update academy_publication_private.renewal_jobs set delivered_at=clock_timestamp(),result=jsonb_build_object('outcome','verified_paid','provider_invoice_id',p_result->>'provider_invoice_id','amount_yen',(p_result->>'amount_yen')::bigint,'period_start',p_result->>'period_start','period_end',p_result->>'period_end')
   where subscription_id=v.id and kind='renew_pay' and period_start=(p_result->>'period_start')::timestamptz and delivered_at is null;
  insert into academy_publication_private.renewal_jobs(event_key,subscription_id,kind,period_start,period_end,available_at)
   values('academy-renew-price:'||v.id||':'||extract(epoch from (p_result->>'period_end')::timestamptz)::text,v.id,'renew_price',(p_result->>'period_end')::timestamptz,
   platform_billing_private.next_anchored_month(v.original_paid_at,(p_result->>'period_end')::timestamptz),clock_timestamp()) on conflict do nothing;
 end if;
 return applied;
end $$;
create function public.academy_first_publication_subscription_event(p_provider_subscription_id text,p_result jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select academy_publication_private.subscription_event(p_provider_subscription_id,p_result) $$;
revoke all on function academy_publication_private.subscription_event(text,jsonb),public.academy_first_publication_subscription_event(text,jsonb) from public,anon,authenticated;
grant execute on function academy_publication_private.subscription_event(text,jsonb),public.academy_first_publication_subscription_event(text,jsonb) to service_role;

-- Generic webhook cannot bypass the richer invoice proof contract for new origins.
alter function public.platform_billing_subscription_event_apply(text,text,text,text,text,timestamptz,timestamptz,boolean,timestamptz) rename to platform_billing_subscription_event_apply_before_publication_bridge;
create function public.platform_billing_subscription_event_apply(p_provider_subscription_id text,p_provider_event_id text,p_provider_event_hash text,p_event_kind text,p_projected_status text,p_period_start timestamptz,p_period_end timestamptz,p_cancel_at_period_end boolean,p_occurred_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform academy_publication_private.require_bridge_worker();
 if exists(select 1 from platform_billing_private.subscriptions where provider_subscription_id=p_provider_subscription_id and origin_kind='academy_first_publication') then raise exception 'academy_bridge_dedicated_event_required'; end if;
 return public.platform_billing_subscription_event_apply_before_publication_bridge(p_provider_subscription_id,p_provider_event_id,p_provider_event_hash,p_event_kind,p_projected_status,p_period_start,p_period_end,p_cancel_at_period_end,p_occurred_at);
end $$;
revoke all on function public.platform_billing_subscription_event_apply_before_publication_bridge(text,text,text,text,text,timestamptz,timestamptz,boolean,timestamptz) from public,anon,authenticated,service_role;
revoke all on function public.platform_billing_subscription_event_apply(text,text,text,text,text,timestamptz,timestamptz,boolean,timestamptz) from public,anon,authenticated;
grant execute on function public.platform_billing_subscription_event_apply(text,text,text,text,text,timestamptz,timestamptz,boolean,timestamptz) to service_role;

create function academy_publication_private.lock_renewal(p_event_key text)
returns academy_publication_private.renewal_jobs language plpgsql security definer set search_path='' as $$
declare j academy_publication_private.renewal_jobs%rowtype; v platform_billing_private.subscriptions%rowtype;
begin
 select * into j from academy_publication_private.renewal_jobs where event_key=p_event_key;
 select * into v from platform_billing_private.subscriptions where id=j.subscription_id;
 if v.origin_kind is distinct from 'academy_first_publication' then raise exception 'academy_bridge_unknown_job'; end if;
 perform 1 from auth.users where id=v.actor_user_id for update;
 perform 1 from public.academy_headquarters where id=v.source_first_publication_hq and owner_user_id=v.actor_user_id for update;
 if not found then raise exception 'academy_bridge_owner_changed'; end if;
 perform 1 from platform_billing_private.subscriptions where id=v.id for update;
 select * into j from academy_publication_private.renewal_jobs where event_key=p_event_key for update;
 return j;
end $$;
revoke all on function academy_publication_private.lock_renewal(text) from public,anon,authenticated,service_role;

create function academy_publication_private.renewal_dispatch_check(p_event_key text,p_lease_token uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare j academy_publication_private.renewal_jobs%rowtype; v platform_billing_private.subscriptions%rowtype;
begin
 perform academy_publication_private.require_bridge_worker(); j:=academy_publication_private.lock_renewal(p_event_key);
 if j.lease_token is distinct from p_lease_token or j.lease_until is null or j.lease_until<=clock_timestamp() or j.delivered_at is not null or j.blocked then raise exception 'stale_lease'; end if;
 select * into v from platform_billing_private.subscriptions where id=j.subscription_id;
 if not exists(select 1 from academy_publication_private.first_invoice_proofs f join academy_publication_private.policies p on p.version=f.policy_version where f.subscription_id=v.id and p.enabled and p.dispatch_enabled) then return jsonb_build_object('allowed',false,'reason','dispatch_not_activated'); end if;
 if v.status='ended' or v.cancel_at_period_end then return jsonb_build_object('allowed',false,'reason','subscription_cancelled'); end if;
 if v.current_period_end is distinct from j.period_start then return jsonb_build_object('allowed',false,'reason','period_changed'); end if;
 if j.kind='renew_pay' and clock_timestamp()<j.period_start then return jsonb_build_object('allowed',false,'reason','not_due'); end if;
 if not exists(select 1 from public.academy_monthly_billing_snapshots where headquarters_id=v.source_first_publication_hq and charge_month=date_trunc('month',j.period_start at time zone 'Asia/Tokyo')::date) then return jsonb_build_object('allowed',false,'reason','snapshot_missing'); end if;
 return jsonb_build_object('allowed',true,'reason',null);
end $$;
create function public.academy_first_publication_renewal_dispatch_check(p_event_key text,p_lease_token uuid)
returns jsonb language sql security invoker set search_path='' as $$select academy_publication_private.renewal_dispatch_check(p_event_key,p_lease_token)$$;

create function academy_publication_private.renewal_claim(p_worker_id text,p_lease_seconds integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare j academy_publication_private.renewal_jobs%rowtype; v platform_billing_private.subscriptions%rowtype;
begin
 perform academy_publication_private.require_bridge_worker();
 if p_worker_id is null or length(p_worker_id) not between 1 and 100 or p_lease_seconds is null or p_lease_seconds not between 10 and 300 then raise exception 'academy_bridge_invalid_worker'; end if;
 -- Do not hold a job lock before owner/HQ locks. The recheck after lock handles competing workers.
 select r.* into j from academy_publication_private.renewal_jobs r join platform_billing_private.subscriptions s on s.id=r.subscription_id
 join academy_publication_private.first_invoice_proofs f on f.subscription_id=s.id join academy_publication_private.policies p on p.version=f.policy_version
 where r.delivered_at is null and not r.blocked and (r.lease_until is null or r.lease_until<clock_timestamp()) and r.available_at<=clock_timestamp()
 and s.status<>'ended' and not s.cancel_at_period_end and s.current_period_end=r.period_start and p.enabled and p.dispatch_enabled
 and exists(select 1 from public.academy_monthly_billing_snapshots where headquarters_id=s.source_first_publication_hq and charge_month=date_trunc('month',r.period_start at time zone 'Asia/Tokyo')::date)
 order by r.available_at,r.event_key limit 1;
 if not found then return null; end if;
 j:=academy_publication_private.lock_renewal(j.event_key);
 if j.delivered_at is not null or j.blocked or j.lease_until>clock_timestamp() then return null; end if;
 update academy_publication_private.renewal_jobs set lease_token=gen_random_uuid(),lease_until=clock_timestamp()+make_interval(secs=>p_lease_seconds) where event_key=j.event_key returning * into j;
 if not (academy_publication_private.renewal_dispatch_check(j.event_key,j.lease_token)->>'allowed')::boolean then return null; end if;
 select * into v from platform_billing_private.subscriptions where id=j.subscription_id;
 return jsonb_build_object('event_key',j.event_key,'lease_token',j.lease_token,'kind',j.kind,'provider_subscription_id',v.provider_subscription_id,
  'provider_customer_id',v.provider_customer_id,'headquarters_id',v.source_first_publication_hq,'period_start',j.period_start,'period_end',j.period_end);
end $$;
create function public.academy_first_publication_renewal_claim(p_worker_id text,p_lease_seconds integer default 60)
returns jsonb language sql security invoker set search_path='' as $$select academy_publication_private.renewal_claim(p_worker_id,p_lease_seconds)$$;

create function academy_publication_private.renewal_checkpoint(p_event_key text,p_lease_token uuid,p_step text,p_provider_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare j academy_publication_private.renewal_jobs%rowtype; r academy_publication_private.renewal_steps%rowtype; v platform_billing_private.subscriptions%rowtype;
begin
 perform academy_publication_private.require_bridge_worker();
 if not (academy_publication_private.renewal_dispatch_check(p_event_key,p_lease_token)->>'allowed')::boolean then raise exception 'academy_bridge_dispatch_blocked'; end if;
 select * into j from academy_publication_private.renewal_jobs where event_key=p_event_key;
 select * into v from platform_billing_private.subscriptions where id=j.subscription_id;
 if (j.kind='renew_price' and p_step is distinct from 'price_update') or (j.kind='renew_pay' and coalesce(p_step,'') not in ('invoice_select','line_update','finalize','pay')) then raise exception 'academy_bridge_invalid_step'; end if;
 if p_provider_id is not null and ((p_step='price_update' and p_provider_id is distinct from v.provider_subscription_id) or (p_step<>'price_update' and p_provider_id !~ '^in_[A-Za-z0-9]+$')) then raise exception 'academy_bridge_invalid_provider_id'; end if;
 insert into academy_publication_private.renewal_steps(event_key,step,operation_key) values(p_event_key,p_step,p_event_key||':'||p_step) on conflict do nothing;
 select * into r from academy_publication_private.renewal_steps where event_key=p_event_key and step=p_step for update;
 if r.provider_id is not null and p_provider_id is not null and r.provider_id<>p_provider_id then raise exception 'academy_bridge_provider_binding_mismatch'; end if;
 if p_provider_id is not null then update academy_publication_private.renewal_steps set provider_id=p_provider_id where event_key=p_event_key and step=p_step returning * into r; end if;
 if r.provider_id is null and clock_timestamp()>r.started_at+interval '23 hours' then
  update academy_publication_private.renewal_jobs set blocked=true where event_key=p_event_key;
  return to_jsonb(r)||jsonb_build_object('blocked',true);
 end if;
 return to_jsonb(r)||jsonb_build_object('blocked',false);
end $$;
create function public.academy_first_publication_renewal_checkpoint(p_event_key text,p_lease_token uuid,p_step text,p_provider_id text default null)
returns jsonb language sql security invoker set search_path='' as $$select academy_publication_private.renewal_checkpoint(p_event_key,p_lease_token,p_step,p_provider_id)$$;

create function academy_publication_private.renewal_finish(p_event_key text,p_lease_token uuid,p_result jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare j academy_publication_private.renewal_jobs%rowtype; v platform_billing_private.subscriptions%rowtype; q jsonb;
begin
 perform academy_publication_private.require_bridge_worker(); j:=academy_publication_private.lock_renewal(p_event_key);
 if j.delivered_at is not null then
  if j.result->>'outcome'='verified_paid' and p_result->>'outcome'='paid'
   and j.result->>'provider_invoice_id' is not distinct from p_result->>'provider_invoice_id'
   and (j.result->>'amount_yen')::bigint is not distinct from (p_result->>'amount_yen')::bigint
   and (j.result->>'period_start')::timestamptz is not distinct from (p_result->>'period_start')::timestamptz
   and (j.result->>'period_end')::timestamptz is not distinct from (p_result->>'period_end')::timestamptz then
   return jsonb_build_object('status','already_finished');
  end if;
  if j.result is distinct from p_result then raise exception 'academy_bridge_finish_conflict'; end if;
  return jsonb_build_object('status','already_finished');
 end if;
 if not (academy_publication_private.renewal_dispatch_check(p_event_key,p_lease_token)->>'allowed')::boolean then raise exception 'academy_bridge_dispatch_blocked'; end if;
 select * into v from platform_billing_private.subscriptions where id=j.subscription_id;
 q:=academy_publication_private.renewal_quote(v.provider_subscription_id,j.period_start);
 if p_result->>'outcome'='price_ready' and j.kind='renew_price' then
  if not exists(select 1 from academy_publication_private.renewal_steps where event_key=p_event_key and step='price_update' and provider_id=v.provider_subscription_id)
   or p_result->>'price_id' is distinct from q->>'price_id' then raise exception 'academy_bridge_price_unverified'; end if;
  insert into academy_publication_private.renewal_jobs(event_key,subscription_id,kind,period_start,period_end,available_at)
   values(replace(j.event_key,'academy-renew-price:','academy-renew-pay:'),j.subscription_id,'renew_pay',j.period_start,j.period_end,j.period_start) on conflict do nothing;
 elsif p_result->>'outcome'='paid' and j.kind='renew_pay' then
  if not exists(select 1 from academy_publication_private.renewal_steps where event_key=p_event_key and step='pay' and provider_id=p_result->>'provider_invoice_id')
   or (p_result->>'amount_yen')::bigint is distinct from (q->>'amount_yen')::bigint
   or (p_result->>'period_start')::timestamptz is distinct from j.period_start or (p_result->>'period_end')::timestamptz is distinct from j.period_end
   or (p_result->>'paid_at')::timestamptz is null or (p_result->>'paid_at')::timestamptz<j.period_start
  then raise exception 'academy_bridge_renewal_receipt_mismatch'; end if;
  -- A transport receipt is durable but does not impersonate a signed provider event.
  -- The dedicated verified event RPC advances access exactly once.
 elsif p_result->>'outcome'='attention' then
  update academy_publication_private.renewal_jobs set blocked=true,result=p_result where event_key=p_event_key;
  return jsonb_build_object('status','attention');
 else raise exception 'academy_bridge_invalid_outcome'; end if;
 update academy_publication_private.renewal_jobs set delivered_at=clock_timestamp(),result=p_result where event_key=p_event_key;
 return jsonb_build_object('status','finished');
end $$;
create function public.academy_first_publication_renewal_finish(p_event_key text,p_lease_token uuid,p_result jsonb)
returns jsonb language sql security invoker set search_path='' as $$select academy_publication_private.renewal_finish(p_event_key,p_lease_token,p_result)$$;
revoke all on function academy_publication_private.renewal_dispatch_check(text,uuid),academy_publication_private.renewal_claim(text,integer),academy_publication_private.renewal_checkpoint(text,uuid,text,text),academy_publication_private.renewal_finish(text,uuid,jsonb),public.academy_first_publication_renewal_dispatch_check(text,uuid),public.academy_first_publication_renewal_claim(text,integer),public.academy_first_publication_renewal_checkpoint(text,uuid,text,text),public.academy_first_publication_renewal_finish(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function academy_publication_private.renewal_dispatch_check(text,uuid),academy_publication_private.renewal_claim(text,integer),academy_publication_private.renewal_checkpoint(text,uuid,text,text),academy_publication_private.renewal_finish(text,uuid,jsonb),public.academy_first_publication_renewal_dispatch_check(text,uuid),public.academy_first_publication_renewal_claim(text,integer),public.academy_first_publication_renewal_checkpoint(text,uuid,text,text),public.academy_first_publication_renewal_finish(text,uuid,jsonb) to service_role;

-- Scheduler entry point is limited to explicitly enrolled new-scheme HQs.
-- Reuses the existing price/count/exclusion/notice calculation without copying it.
-- No cron job or extension is installed by this migration.
create function academy_publication_private.capture_due_snapshots(p_limit integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare h uuid; captured integer:=0; cutoff timestamptz; month_key date;
begin
 perform academy_publication_private.require_bridge_worker();
 if p_limit is null or p_limit not between 1 and 100 then raise exception 'academy_bridge_invalid_limit'; end if;
 month_key:=(date_trunc('month',statement_timestamp() at time zone 'Asia/Tokyo')-interval '1 month')::date;
 cutoff:=((month_key+interval '1 month')::timestamp at time zone 'Asia/Tokyo');
 for h in select e.headquarters_id from academy_publication_private.enrollments e
  join academy_publication_private.policies p on p.version=e.policy_version and p.enabled
  where e.first_published_at<cutoff and e.cancellation_accepted_at is null
   and not exists(select 1 from academy_publication_private.cancel_intents c where c.headquarters_id=e.headquarters_id)
   and (e.trial_ends_at>=cutoff or exists(select 1 from platform_billing_private.subscriptions s where s.source_first_publication_hq=e.headquarters_id and s.origin_kind='academy_first_publication' and s.status<>'ended'))
   and not exists(select 1 from public.academy_monthly_billing_snapshots b where b.headquarters_id=e.headquarters_id and b.snapshot_month=month_key)
  order by e.headquarters_id limit p_limit
 loop
  perform public.academy_capture_month_end_billing_snapshot(h,month_key,statement_timestamp());
  captured:=captured+1;
 end loop;
 return jsonb_build_object('captured',captured,'snapshot_month',month_key);
end $$;
create function public.academy_first_publication_capture_due_snapshots(p_limit integer default 50)
returns jsonb language sql security invoker set search_path='' as $$select academy_publication_private.capture_due_snapshots(p_limit)$$;
revoke all on function academy_publication_private.capture_due_snapshots(integer),public.academy_first_publication_capture_due_snapshots(integer) from public,anon,authenticated;
grant execute on function academy_publication_private.capture_due_snapshots(integer),public.academy_first_publication_capture_due_snapshots(integer) to service_role;

comment on function public.academy_first_publication_paid_bridge(text,uuid,jsonb) is 'Verified standalone invoice bridge; no fabricated Checkout event. Activation remains gated by the receipt watermark in outbox_dispatch_check.';
comment on function public.academy_first_publication_renewal_claim(text,integer) is 'Only explicit new scheme subscriptions. Provider must remain keep_as_draft; missing snapshot never authorizes current-price autocharge.';
