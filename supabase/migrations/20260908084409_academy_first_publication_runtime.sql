-- Follow-up runtime. No policy activation or existing-user migration.
alter table academy_publication_private.policies add column dispatch_enabled boolean not null default false;
alter table academy_publication_private.policies add column pricing_revision text;
alter table academy_publication_private.quotes add column pricing_revision text;
create table academy_publication_private.preparations (
 headquarters_id uuid primary key references public.academy_headquarters(id) on delete restrict,
 owner_user_id uuid not null unique references auth.users(id) on delete restrict,
 policy_version text not null references academy_publication_private.policies(version),
 created_at timestamptz not null default clock_timestamp()
);
create table academy_publication_private.paid_windows (
 headquarters_id uuid primary key references academy_publication_private.enrollments(headquarters_id),
 provider_subscription_id text not null unique,
 provider_invoice_id text not null unique,
 paid_at timestamptz not null,
 period_end timestamptz not null check(period_end>paid_at),
 status text not null check(status in ('active','ended','attention'))
);
create table academy_publication_private.setup_attempts (
 attempt_id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references auth.users(id),
 headquarters_id uuid not null references public.academy_headquarters(id),
 quote_id uuid not null unique references academy_publication_private.quotes(id),
 idempotency_key text not null unique default gen_random_uuid()::text,
 started_at timestamptz not null default clock_timestamp(),
 provider_customer_id text, checkout_session_id text unique, setup_intent_id text unique, payment_method_id text,
 status text not null default 'reserved' check(status in ('reserved','attached','verified','attention'))
);
create table academy_publication_private.cancel_intents (
 headquarters_id uuid primary key references academy_publication_private.enrollments(headquarters_id),
 owner_user_id uuid not null references auth.users(id),
 received_at timestamptz not null,
 applied_at timestamptz
);
do $$ declare t text; begin
 foreach t in array array['preparations','paid_windows','setup_attempts','cancel_intents'] loop
  execute format('alter table academy_publication_private.%I enable row level security',t);
  execute format('revoke all on academy_publication_private.%I from public,anon,authenticated,service_role',t);
 end loop;
end $$;

create function private.academy_first_publication_access(p_headquarters_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare e academy_publication_private.enrollments%rowtype; w academy_publication_private.paid_windows%rowtype;
 prep academy_publication_private.preparations%rowtype; v_active boolean; v_cancel timestamptz; v_end timestamptz;
begin
 select * into prep from academy_publication_private.preparations where headquarters_id=p_headquarters_id;
 select * into e from academy_publication_private.enrollments where headquarters_id=p_headquarters_id;
 if e.headquarters_id is null and prep.headquarters_id is null then return null; end if;
 select * into w from academy_publication_private.paid_windows where headquarters_id=p_headquarters_id;
 select received_at into v_cancel from academy_publication_private.cancel_intents where headquarters_id=p_headquarters_id;
 v_cancel:=coalesce(v_cancel,e.cancellation_accepted_at);
 v_end:=case when w.status='active' then w.period_end else e.trial_ends_at end;
 v_active:=coalesce((w.status='active' and statement_timestamp()>=w.paid_at and statement_timestamp()<w.period_end)
  or (e.phase in ('sync_pending','trialing','cancelled') and statement_timestamp()<e.trial_ends_at),false);
 return jsonb_build_object('scheme','first_publication_168h_v1','policyVersion',coalesce(e.policy_version,prep.policy_version),'active',v_active,
  'inviteAllowed',v_active and v_cancel is null and exists(select 1 from academy_publication_private.policies where version=coalesce(e.policy_version,prep.policy_version) and enabled),'endsAt',v_end,
  'phase',case when w.status='active' and statement_timestamp()<w.period_end then 'paid'
    when e.first_published_at is not null and statement_timestamp()>=e.trial_ends_at then 'expired' else coalesce(e.phase,'prepared') end,
  'cancellationAcceptedAt',v_cancel);
end $$;
revoke all on function private.academy_first_publication_access(uuid) from public,anon,authenticated,service_role;

alter function private.academy_headquarters_access_mode(uuid) rename to academy_headquarters_access_mode_before_first_publication;
create function private.academy_headquarters_access_mode(p_headquarters_id uuid)
returns text language plpgsql stable security definer set search_path='' as $$
declare a jsonb;
begin
 a:=private.academy_first_publication_access(p_headquarters_id);
 if a is null then return private.academy_headquarters_access_mode_before_first_publication(p_headquarters_id); end if;
 -- Existing guards use 'paid' as the live-write capability, not billing truth.
 -- UI/billing MUST use the explicit access projection below for actual phase.
 if (a->>'active')::boolean then return 'paid'; end if;
 if a->>'phase'='prepared' then return 'trial_active'; end if;
 return 'blocked';
end $$;
alter function private.academy_owner_read_allowed(uuid,timestamptz) rename to academy_owner_read_allowed_before_first_publication;
create function private.academy_owner_read_allowed(p_headquarters_id uuid,p_at timestamptz)
returns boolean language plpgsql stable security definer set search_path='' as $$
begin
 if private.academy_first_publication_access(p_headquarters_id) is not null then return true; end if;
 return private.academy_owner_read_allowed_before_first_publication(p_headquarters_id,p_at);
end $$;
revoke all on function private.academy_headquarters_access_mode(uuid),private.academy_owner_read_allowed(uuid,timestamptz) from public,anon,authenticated,service_role;

create function public.academy_first_publication_access(p_headquarters_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or private.academy_headquarters_role(p_headquarters_id,auth.uid()) is null then raise exception 'forbidden'; end if;
 return private.academy_first_publication_access(p_headquarters_id);
end $$;
revoke all on function public.academy_first_publication_access(uuid) from public,anon;
grant execute on function public.academy_first_publication_access(uuid) to authenticated;

alter function public.academy_get_my_headquarters_access(uuid) rename to academy_get_my_headquarters_access_before_first_publication;
create function public.academy_get_my_headquarters_access(p_headquarters_id uuid)
returns table(headquarters_id uuid,access_kind text,status text,starts_at timestamptz,ends_at timestamptz,days_remaining integer,can_manage_drafts boolean,can_use_live_features boolean)
language plpgsql stable security definer set search_path='' as $$
declare a jsonb; e academy_publication_private.enrollments%rowtype;
begin
 a:=private.academy_first_publication_access(p_headquarters_id);
 if a is null then return query select * from public.academy_get_my_headquarters_access_before_first_publication(p_headquarters_id); return; end if;
 if auth.uid() is null or private.academy_headquarters_role(p_headquarters_id,auth.uid()) is null then return; end if;
 select * into e from academy_publication_private.enrollments where enrollments.headquarters_id=p_headquarters_id;
 return query select p_headquarters_id,case when a->>'phase'='paid' then 'paid' else 'first_publication' end,
 a->>'phase',e.first_published_at,(a->>'endsAt')::timestamptz,
 case when (a->>'active')::boolean then greatest(0,ceil(extract(epoch from ((a->>'endsAt')::timestamptz-statement_timestamp()))/86400)::integer) else 0 end,
 (a->>'active')::boolean or a->>'phase'='prepared',(a->>'active')::boolean;
end $$;
revoke all on function public.academy_get_my_headquarters_access(uuid) from public,anon;
grant execute on function public.academy_get_my_headquarters_access(uuid) to authenticated;

create function public.academy_first_publication_create_preparation(p_name text,p_policy_version text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); p public.profiles%rowtype; h uuid:=gen_random_uuid(); existing uuid;
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and not coalesce(is_anonymous,false)) then raise exception 'forbidden'; end if;
 if nullif(trim(p_name),'') is null or length(trim(p_name))>100 then raise exception 'invalid_name'; end if;
 perform 1 from auth.users where id=actor for update;
 select * into p from public.profiles where user_id=actor for update;
 if p.id is null then raise exception 'profile_required'; end if;
 if not exists(select 1 from academy_publication_private.policies where version=p_policy_version and enabled) then raise exception 'policy_not_approved'; end if;
 select headquarters_id into existing from academy_publication_private.preparations where owner_user_id=actor;
 if existing is not null then return jsonb_build_object('headquarters_id',existing,'scheme','first_publication_168h_v1'); end if;
 if exists(select 1 from public.academy_headquarters where owner_user_id=actor)
 or exists(select 1 from public.academy_trial_usage_ledger where owner_user_id=actor)
 or exists(select 1 from academy_publication_private.owner_history where owner_user_id=actor)
 or exists(select 1 from platform_billing_private.subscriptions where actor_user_id=actor and product_key='academy_platform')
 or exists(select 1 from platform_billing_private.creation_entitlements where actor_user_id=actor and product_key='academy_platform')
 or coalesce(private.academy_has_headquarters_creation_entitlement(actor),false) then raise exception 'not_eligible_for_new_scheme'; end if;
 insert into public.academy_headquarters(id,owner_user_id,owner_profile_id,name,handle,plan,is_active)
 values(h,actor,p.id,trim(p_name),'academy-'||left(replace(h::text,'-',''),22),'small',false);
 insert into academy_publication_private.preparations(headquarters_id,owner_user_id,policy_version) values(h,actor,p_policy_version);
 return jsonb_build_object('headquarters_id',h,'scheme','first_publication_168h_v1');
end $$;
revoke all on function public.academy_first_publication_create_preparation(text,text) from public,anon;
grant execute on function public.academy_first_publication_create_preparation(text,text) to authenticated;

-- Preserve the prior command implementation and narrow the approved change:
-- a count change inside the SAME existing price band no longer invalidates it.
do $$ declare source text; begin
 source:=pg_get_functiondef('academy_publication_private.command(uuid,text,uuid,uuid,boolean,text,bigint)'::regprocedure);
 if position('current_count<>q.instructor_count or ' in source)=0 then raise exception 'unexpected_command_definition'; end if;
 source:=replace(source,'current_count<>q.instructor_count or ','');
 execute source;
end $$;
alter function academy_publication_private.command(uuid,text,uuid,uuid,boolean,text,bigint) rename to command_before_runtime;
revoke all on function academy_publication_private.command_before_runtime(uuid,text,uuid,uuid,boolean,text,bigint) from public,anon,authenticated,service_role;
create function academy_publication_private.command(p_headquarters_id uuid,p_action text,p_course_id uuid,p_quote_id uuid,p_confirmed boolean,p_terms_revision text,p_amount_yen bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
 declare actor uuid:=auth.uid(); e academy_publication_private.enrollments%rowtype; a jsonb; r jsonb; receipt timestamptz;
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and not coalesce(is_anonymous,false)) then raise exception 'forbidden'; end if;
 perform 1 from auth.users where id=actor for update;
 perform 1 from public.academy_headquarters where id=p_headquarters_id and owner_user_id=actor for update;
 if not found then raise exception 'forbidden'; end if;
 select * into e from academy_publication_private.enrollments where headquarters_id=p_headquarters_id for update;
 a:=private.academy_first_publication_access(p_headquarters_id);
 if p_action='cancel_conversion' then
  select received_at into receipt from academy_publication_private.cancel_intents where headquarters_id=p_headquarters_id and owner_user_id=actor;
  if receipt is not null and (e.trial_ends_at is null or receipt<=e.trial_ends_at) then
   update academy_publication_private.enrollments set cancellation_accepted_at=coalesce(cancellation_accepted_at,receipt),phase='cancelled' where headquarters_id=p_headquarters_id returning * into e;
   update academy_publication_private.cancel_intents set applied_at=clock_timestamp() where headquarters_id=p_headquarters_id;
   insert into academy_publication_private.outbox(event_key,headquarters_id,kind,payload)
    values('academy-first-publication-cancel:'||p_headquarters_id,p_headquarters_id,'cancel_conversion',to_jsonb(e)) on conflict do nothing;
   return to_jsonb(e);
  end if;
 end if;
 if p_action='publish' and e.first_published_at is not null then
  if p_confirmed is distinct from true or not coalesce((a->>'active')::boolean,false) then raise exception 'publication_blocked'; end if;
  perform 1 from public.academy_courses where id=p_course_id and headquarters_id=p_headquarters_id for update;
  if not found then raise exception 'course_not_found'; end if;
  insert into academy_publication_private.publication_permits values(txid_current(),p_course_id);
  update public.academy_courses set is_published=true where id=p_course_id;
  delete from academy_publication_private.publication_permits where transaction_id=txid_current() and course_id=p_course_id;
  return to_jsonb(e);
 end if;
 r:=academy_publication_private.command_before_runtime(p_headquarters_id,p_action,p_course_id,p_quote_id,p_confirmed,p_terms_revision,p_amount_yen);
 if p_action='publish' then update public.academy_headquarters set is_active=true where id=p_headquarters_id; end if;
 return r;
end $$;
revoke all on function academy_publication_private.command(uuid,text,uuid,uuid,boolean,text,bigint) from public,anon;
grant execute on function academy_publication_private.command(uuid,text,uuid,uuid,boolean,text,bigint) to authenticated;

-- A cancelled conversion retains the original trial's editing/publication window.
do $$ declare source text; begin
 source:=pg_get_functiondef('private.academy_guard_trial_course_draft()'::regprocedure);
 source:=replace(source,'e.phase in (''cancelled'',''attention'') or (e.trial_ends_at is not null and clock_timestamp()>=e.trial_ends_at)',
 'e.phase=''attention'' or (e.first_published_at is not null and not coalesce((private.academy_first_publication_access(v_headquarters_id)->>''active'')::boolean,false))');
 source:=replace(source,'e.phase not in (''sync_pending'',''trialing'') or clock_timestamp()>=e.trial_ends_at',
 'not coalesce((private.academy_first_publication_access(v_headquarters_id)->>''active'')::boolean,false)');
 execute source;
end $$;

create function public.academy_first_publication_setup_reserve(p_owner_user_id uuid,p_headquarters_id uuid,p_quote_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare q academy_publication_private.quotes%rowtype; a academy_publication_private.setup_attempts%rowtype;
begin
 perform 1 from auth.users where id=p_owner_user_id and not coalesce(is_anonymous,false) for update;
 if not found then raise exception 'forbidden'; end if;
 perform 1 from public.academy_headquarters where id=p_headquarters_id and owner_user_id=p_owner_user_id for update;
 if not found then raise exception 'scope_mismatch'; end if;
 select * into q from academy_publication_private.quotes where id=p_quote_id and owner_user_id=p_owner_user_id and headquarters_id=p_headquarters_id for update;
 if q.id is null or q.revoked or q.expires_at<=clock_timestamp() then raise exception 'quote_expired'; end if;
 if not exists(select 1 from academy_publication_private.policies where version=q.policy_version and enabled) then raise exception 'policy_not_approved'; end if;
 insert into academy_publication_private.setup_attempts(owner_user_id,headquarters_id,quote_id) values(p_owner_user_id,p_headquarters_id,p_quote_id) on conflict(quote_id) do nothing;
 select * into a from academy_publication_private.setup_attempts where quote_id=p_quote_id;
 return to_jsonb(a)||jsonb_build_object('amount_yen',q.amount_yen,'policy_version',q.policy_version);
end $$;
create function public.academy_first_publication_setup_attach(p_attempt_id uuid,p_provider_customer_id text,p_checkout_session_id text,p_setup_intent_id text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a academy_publication_private.setup_attempts%rowtype;
begin
 select * into a from academy_publication_private.setup_attempts where attempt_id=p_attempt_id for update;
 if a.attempt_id is null or p_provider_customer_id is null or p_provider_customer_id !~ '^cus_[A-Za-z0-9]+$' or (p_checkout_session_id is not null and p_checkout_session_id !~ '^cs_[A-Za-z0-9_]+$') then raise exception 'invalid_provider_binding'; end if;
 if (a.provider_customer_id is not null and a.provider_customer_id is distinct from p_provider_customer_id)
 or (a.checkout_session_id is not null and a.checkout_session_id is distinct from p_checkout_session_id)
 or (a.setup_intent_id is not null and a.setup_intent_id is distinct from p_setup_intent_id) then raise exception 'provider_binding_immutable'; end if;
 if a.status='attention' then raise exception 'setup_attention_required'; end if;
 if a.status='verified' then return to_jsonb(a); end if;
 update academy_publication_private.setup_attempts set provider_customer_id=p_provider_customer_id,checkout_session_id=p_checkout_session_id,setup_intent_id=p_setup_intent_id,status='attached'
 where attempt_id=p_attempt_id returning * into a;
 return to_jsonb(a);
end $$;
create function public.academy_first_publication_setup_complete(p_attempt_id uuid,p_provider_customer_id text,p_setup_intent_id text,p_payment_method_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a academy_publication_private.setup_attempts%rowtype; q academy_publication_private.quotes%rowtype; count_now integer;
begin
 select * into a from academy_publication_private.setup_attempts where attempt_id=p_attempt_id;
 perform 1 from auth.users where id=a.owner_user_id for update;
 perform 1 from public.academy_headquarters where id=a.headquarters_id and owner_user_id=a.owner_user_id for update;
 if not found then raise exception 'scope_mismatch'; end if;
 select * into q from academy_publication_private.quotes where id=a.quote_id for update;
 select * into a from academy_publication_private.setup_attempts where attempt_id=p_attempt_id for update;
 if a.attempt_id is null or a.checkout_session_id is null or a.provider_customer_id is distinct from p_provider_customer_id
 or p_setup_intent_id is null or p_setup_intent_id !~ '^seti_[A-Za-z0-9]+$' or p_payment_method_id is null or p_payment_method_id !~ '^pm_[A-Za-z0-9]+$'
 or (a.setup_intent_id is not null and a.setup_intent_id<>p_setup_intent_id)
 or (a.payment_method_id is not null and a.payment_method_id<>p_payment_method_id) then raise exception 'invalid_provider_binding'; end if;
 if a.status='attention' then raise exception 'setup_attention_required'; end if;
 select * into q from academy_publication_private.quotes where id=a.quote_id for update;
 if q.revoked or q.expires_at<=clock_timestamp() then raise exception 'quote_expired'; end if;
 if not exists(select 1 from academy_publication_private.policies where version=q.policy_version and enabled and terms_revision=q.terms_revision and pricing_revision=q.pricing_revision) then raise exception 'quote_revision_changed'; end if;
 select count(distinct i.profile_id)::integer into count_now from public.academy_instructors i
 where i.headquarters_id=q.headquarters_id and i.created_at<=statement_timestamp()
 and (i.withdrawn_at is null or i.withdrawn_at>statement_timestamp())
 and not exists(select 1 from public.academy_instructor_billing_exclusions x where x.headquarters_id=i.headquarters_id and x.profile_id=i.profile_id
   and x.effective_from<=statement_timestamp() and (x.effective_until is null or x.effective_until>statement_timestamp()));
 if private.academy_catalog_monthly_price_yen(count_now) is distinct from q.amount_yen then raise exception 'requote_required'; end if;
 update academy_publication_private.setup_attempts set setup_intent_id=p_setup_intent_id,payment_method_id=p_payment_method_id,status='verified' where attempt_id=p_attempt_id returning * into a;
 update academy_publication_private.quotes set payment_verified=true,payment_preparation_id=a.attempt_id::text where id=a.quote_id;
 return to_jsonb(a)||jsonb_build_object('quote',jsonb_build_object('id',q.id,'headquartersId',q.headquarters_id,'policyVersion',q.policy_version,'termsRevision',q.terms_revision,'amountYen',q.amount_yen,'instructorCount',q.instructor_count,'issuedAt',q.issued_at,'expiresAt',q.expires_at));
end $$;
revoke all on function public.academy_first_publication_setup_reserve(uuid,uuid,uuid),public.academy_first_publication_setup_attach(uuid,text,text,text),public.academy_first_publication_setup_complete(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.academy_first_publication_setup_reserve(uuid,uuid,uuid),public.academy_first_publication_setup_attach(uuid,text,text,text),public.academy_first_publication_setup_complete(uuid,text,text,text) to service_role;

create function academy_publication_private.quote_pricing_identity() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 select pricing_revision into new.pricing_revision from academy_publication_private.policies where version=new.policy_version;
 if nullif(trim(new.pricing_revision),'') is null then raise exception 'pricing_revision_required'; end if;
 return new;
end $$;
create trigger academy_publication_quote_pricing_identity before insert on academy_publication_private.quotes
for each row execute function academy_publication_private.quote_pricing_identity();
do $$ declare source text; begin
 source:=pg_get_functiondef('academy_publication_private.command_before_runtime(uuid,text,uuid,uuid,boolean,text,bigint)'::regprocedure);
 source:=replace(source,'if q.terms_revision<>p.terms_revision or q.revoked',
  'if q.pricing_revision is distinct from p.pricing_revision or q.pricing_revision is null or q.terms_revision<>p.terms_revision or q.revoked');
 execute source;
end $$;
revoke all on function academy_publication_private.quote_pricing_identity() from public,anon,authenticated,service_role;

alter table academy_publication_private.outbox drop constraint outbox_kind_check;
alter table academy_publication_private.outbox add constraint outbox_kind_check check(kind in ('synchronize_trial','cancel_conversion','start_paid'));
alter table academy_publication_private.outbox add column available_at timestamptz not null default clock_timestamp();
alter table academy_publication_private.outbox add column lease_token uuid;
alter table academy_publication_private.outbox add column lease_until timestamptz;
alter table academy_publication_private.outbox add column worker_id text;
alter table academy_publication_private.outbox add column result jsonb;
alter table academy_publication_private.outbox add column blocked boolean not null default false;
create table academy_publication_private.provider_steps (
 event_key text not null references academy_publication_private.outbox(event_key),
 step text not null check(step in ('invoice_create','invoice_item','finalize','pay','subscription_create')),
 operation_key text not null unique,
 started_at timestamptz not null default clock_timestamp(),
 provider_id text,
 primary key(event_key,step)
);
alter table academy_publication_private.provider_steps enable row level security;
revoke all on academy_publication_private.provider_steps from public,anon,authenticated,service_role;

create function public.academy_first_publication_record_cancel(p_headquarters_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); received timestamptz:=statement_timestamp(); e academy_publication_private.enrollments%rowtype;
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and not coalesce(is_anonymous,false)) then raise exception 'forbidden'; end if;
 select e1.* into e from academy_publication_private.enrollments e1 join public.academy_headquarters h on h.id=e1.headquarters_id
 where h.id=p_headquarters_id and h.owner_user_id=actor and e1.owner_user_id=actor;
 if e.headquarters_id is null then raise exception 'enrollment_not_found'; end if;
 if e.trial_ends_at is not null and received>e.trial_ends_at then raise exception 'paid_cancellation_required'; end if;
 -- This RPC must COMMIT before the HTTP handler applies command cancellation.
 -- start_paid remains disabled pending the precommit ingress/dispatch race gate.
 insert into academy_publication_private.cancel_intents(headquarters_id,owner_user_id,received_at)
 values(p_headquarters_id,actor,received) on conflict(headquarters_id) do nothing;
 select received_at into received from academy_publication_private.cancel_intents where headquarters_id=p_headquarters_id;
 return jsonb_build_object('received_at',received,'headquarters_id',p_headquarters_id);
end $$;
revoke all on function public.academy_first_publication_record_cancel(uuid) from public,anon;
grant execute on function public.academy_first_publication_record_cancel(uuid) to authenticated;

create function academy_publication_private.lock_outbox(p_event_key text)
returns academy_publication_private.outbox language plpgsql security definer set search_path='' as $$
declare o academy_publication_private.outbox%rowtype; owner_id uuid;
begin
 select * into o from academy_publication_private.outbox where event_key=p_event_key;
 select owner_user_id into owner_id from academy_publication_private.enrollments where headquarters_id=o.headquarters_id;
 perform 1 from auth.users where id=owner_id for update;
 perform 1 from public.academy_headquarters where id=o.headquarters_id and owner_user_id=owner_id for update;
 if not found then raise exception 'scope_mismatch'; end if;
 perform 1 from academy_publication_private.enrollments where headquarters_id=o.headquarters_id for update;
 select * into o from academy_publication_private.outbox where event_key=p_event_key for update;
 return o;
end $$;
revoke all on function academy_publication_private.lock_outbox(text) from public,anon,authenticated,service_role;

create function public.academy_first_publication_outbox_claim(p_worker_id text,p_lease_seconds integer default 60)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o academy_publication_private.outbox%rowtype; e academy_publication_private.enrollments%rowtype; s academy_publication_private.setup_attempts%rowtype;
begin
 if nullif(trim(p_worker_id),'') is null or p_lease_seconds not between 10 and 300 then raise exception 'invalid_lease'; end if;
 select * into o from academy_publication_private.outbox where delivered_at is null and not blocked
 and available_at<clock_timestamp() and (lease_until is null or lease_until<clock_timestamp())
 and (kind<>'start_paid' or exists(select 1 from academy_publication_private.enrollments e1 join academy_publication_private.policies p on p.version=e1.policy_version where e1.headquarters_id=outbox.headquarters_id and p.enabled and p.dispatch_enabled))
 order by available_at,event_key limit 1;
 if o.event_key is null then return null; end if;
 o:=academy_publication_private.lock_outbox(o.event_key);
 if o.delivered_at is not null or o.blocked or o.lease_until>clock_timestamp() then return null; end if;
 select * into e from academy_publication_private.enrollments where headquarters_id=o.headquarters_id;
 select * into s from academy_publication_private.setup_attempts where quote_id=e.quote_id and status='verified';
 if s.attempt_id is null then raise exception 'verified_setup_required'; end if;
 update academy_publication_private.outbox set worker_id=p_worker_id,lease_token=gen_random_uuid(),lease_until=clock_timestamp()+make_interval(secs=>p_lease_seconds)
 where event_key=o.event_key returning * into o;
 return jsonb_build_object('event_key',o.event_key,'kind',o.kind,'lease_token',o.lease_token,'headquarters_id',e.headquarters_id,'owner_user_id',e.owner_user_id,
 'amount_yen',e.amount_yen,'plan_key',case when e.amount_yen=5000 then 'small' when e.amount_yen=10000 then 'medium' else 'large' end,
 'trial_ends_at',e.trial_ends_at,'provider_customer_id',s.provider_customer_id,'payment_method_id',s.payment_method_id,
 'setup_intent_id',s.setup_intent_id,'operation_created_at',o.created_at,
 'proof',to_jsonb(s)||jsonb_build_object('amount_yen',e.amount_yen,'policy_version',e.policy_version),
 'provider_invoice_id',(select provider_id from academy_publication_private.provider_steps where event_key=o.event_key and step='invoice_create'),
 'provider_subscription_id',(select provider_id from academy_publication_private.provider_steps where event_key=o.event_key and step='subscription_create'));
end $$;

create function public.academy_first_publication_outbox_dispatch_check(p_event_key text,p_lease_token uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o academy_publication_private.outbox%rowtype; e academy_publication_private.enrollments%rowtype;
begin
 o:=academy_publication_private.lock_outbox(p_event_key);
 if o.event_key is null or o.lease_token is distinct from p_lease_token or o.lease_until<=clock_timestamp() or o.delivered_at is not null or o.blocked then raise exception 'stale_lease'; end if;
 select * into e from academy_publication_private.enrollments where headquarters_id=o.headquarters_id for update;
 if o.kind='start_paid' then
  if not exists(select 1 from academy_publication_private.policies where version=e.policy_version and enabled and dispatch_enabled) then return jsonb_build_object('allowed',false,'reason','dispatch_not_activated'); end if;
  if clock_timestamp()<=e.trial_ends_at or e.trial_ends_at is null then return jsonb_build_object('allowed',false,'reason','not_due'); end if;
  if e.cancellation_accepted_at is not null or exists(select 1 from academy_publication_private.cancel_intents where headquarters_id=e.headquarters_id and received_at<=e.trial_ends_at) then
   return jsonb_build_object('allowed',false,'reason','conversion_cancelled');
  end if;
 end if;
 return jsonb_build_object('allowed',true,'reason',null);
end $$;

create function public.academy_first_publication_outbox_checkpoint(p_event_key text,p_lease_token uuid,p_step text,p_provider_id text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o academy_publication_private.outbox%rowtype; s academy_publication_private.provider_steps%rowtype; d jsonb;
begin
 d:=public.academy_first_publication_outbox_dispatch_check(p_event_key,p_lease_token);
 if not (d->>'allowed')::boolean then raise exception 'dispatch_blocked'; end if;
 select * into o from academy_publication_private.outbox where event_key=p_event_key;
 if o.kind<>'start_paid' then raise exception 'invalid_provider_operation'; end if;
 if p_step not in ('invoice_create','invoice_item','finalize','pay','subscription_create') then raise exception 'invalid_provider_step'; end if;
 insert into academy_publication_private.provider_steps(event_key,step,operation_key) values(p_event_key,p_step,p_event_key||':'||p_step) on conflict do nothing;
 select * into s from academy_publication_private.provider_steps where event_key=p_event_key and step=p_step for update;
 if s.provider_id is not null and p_provider_id is not null and s.provider_id<>p_provider_id then raise exception 'provider_binding_immutable'; end if;
 if p_provider_id is not null then update academy_publication_private.provider_steps set provider_id=p_provider_id where event_key=p_event_key and step=p_step returning * into s; end if;
 if s.provider_id is null and clock_timestamp()>s.started_at+interval '23 hours' then
  update academy_publication_private.outbox set blocked=true where event_key=p_event_key;
  return to_jsonb(s)||jsonb_build_object('blocked',true);
 end if;
 return to_jsonb(s)||jsonb_build_object('blocked',false);
end $$;

create function public.academy_first_publication_outbox_finish(p_event_key text,p_lease_token uuid,p_result jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o academy_publication_private.outbox%rowtype; e academy_publication_private.enrollments%rowtype; outcome text:=p_result->>'outcome';
begin
 o:=academy_publication_private.lock_outbox(p_event_key);
 if o.event_key is null or o.lease_token is distinct from p_lease_token or o.lease_until<=clock_timestamp() or o.delivered_at is not null then raise exception 'stale_lease'; end if;
 select * into e from academy_publication_private.enrollments where headquarters_id=o.headquarters_id for update;
 if outcome='trial_ready' and o.kind='synchronize_trial' then
  update academy_publication_private.enrollments set phase=case when cancellation_accepted_at is null then 'trialing' else 'cancelled' end where headquarters_id=e.headquarters_id;
  insert into academy_publication_private.outbox(event_key,headquarters_id,kind,payload,available_at)
   values('academy-first-publication-paid:'||e.headquarters_id,e.headquarters_id,'start_paid',to_jsonb(e),e.trial_ends_at) on conflict do nothing;
 elsif outcome='cancelled' and o.kind='cancel_conversion' then
  update academy_publication_private.cancel_intents set applied_at=clock_timestamp() where headquarters_id=e.headquarters_id;
 elsif outcome='paid' and o.kind='start_paid' then
  -- Separate private verified window. This does NOT fabricate a legacy Checkout
  -- attempt or claim linkage to platform_billing_private.subscriptions.
  if not (public.academy_first_publication_outbox_dispatch_check(p_event_key,p_lease_token)->>'allowed')::boolean then raise exception 'dispatch_blocked'; end if;
  if p_result->>'provider_subscription_id' !~ '^sub_[A-Za-z0-9]+$' or p_result->>'provider_invoice_id' !~ '^in_[A-Za-z0-9]+$'
    or (p_result->>'amount_yen')::bigint is distinct from e.amount_yen or (p_result->>'paid_at')::timestamptz is null
    or (p_result->>'period_end')::timestamptz<=(p_result->>'paid_at')::timestamptz then raise exception 'invalid_paid_proof'; end if;
  insert into academy_publication_private.paid_windows(headquarters_id,provider_subscription_id,provider_invoice_id,paid_at,period_end,status)
  values(e.headquarters_id,p_result->>'provider_subscription_id',p_result->>'provider_invoice_id',(p_result->>'paid_at')::timestamptz,(p_result->>'period_end')::timestamptz,'active');
 elsif outcome='attention' then
  update academy_publication_private.outbox set blocked=true,result=p_result where event_key=p_event_key;
  return jsonb_build_object('status','attention');
 else raise exception 'invalid_outcome'; end if;
 update academy_publication_private.outbox set delivered_at=clock_timestamp(),result=p_result where event_key=p_event_key;
 return jsonb_build_object('status','finished');
end $$;
revoke all on function public.academy_first_publication_outbox_claim(text,integer),public.academy_first_publication_outbox_dispatch_check(text,uuid),public.academy_first_publication_outbox_checkpoint(text,uuid,text,text),public.academy_first_publication_outbox_finish(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.academy_first_publication_outbox_claim(text,integer),public.academy_first_publication_outbox_dispatch_check(text,uuid),public.academy_first_publication_outbox_checkpoint(text,uuid,text,text),public.academy_first_publication_outbox_finish(text,uuid,jsonb) to service_role;
