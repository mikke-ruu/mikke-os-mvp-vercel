-- LOCAL CANDIDATE. No policy seed, no enrollment backfill, no billing worker.
-- Runtime activation requires isolated DB tests and an approved trusted quote producer.
create schema academy_publication_private;
revoke all on schema academy_publication_private from public, anon, authenticated;

create table academy_publication_private.policies (
  version text primary key check (length(trim(version)) > 0),
  approval_id text not null check (length(trim(approval_id)) > 0),
  terms_revision text not null,
  quote_ttl_seconds integer not null check (quote_ttl_seconds > 0),
  enabled boolean not null default false,
  initial_price text not null check (initial_price = 'fixed_at_publication'),
  cancellation text not null check (cancellation = 'inclusive_deadline'),
  eligibility text not null check (eligibility = 'no_previous_trial_or_contract')
);
-- Trusted server only. Producer must recompute price/count and revoke superseded
-- quotes under the SAME owner/HQ locks as the command before returning a quote.
create table academy_publication_private.quotes (
  id uuid primary key,
  headquarters_id uuid not null references public.academy_headquarters(id),
  owner_user_id uuid not null references auth.users(id),
  policy_version text not null references academy_publication_private.policies(version),
  terms_revision text not null,
  amount_yen bigint not null check (amount_yen > 0),
  instructor_count integer not null check (instructor_count >= 0),
  issued_at timestamptz not null check (isfinite(issued_at)),
  expires_at timestamptz not null check (isfinite(expires_at) and expires_at > issued_at),
  payment_preparation_id text,
  payment_verified boolean not null default false,
  revoked boolean not null default false,
  -- Separate integration gate. Never set by request data.
  current_price_verified boolean not null default false
);
create index academy_publication_quotes_scope on academy_publication_private.quotes(headquarters_id);
create table academy_publication_private.enrollments (
  headquarters_id uuid primary key references public.academy_headquarters(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  policy_version text not null references academy_publication_private.policies(version),
  approval_id text not null, terms_revision text not null,
  quote_id uuid not null references academy_publication_private.quotes(id),
  amount_yen bigint not null, instructor_count integer not null,
  consent_at timestamptz not null, payment_preparation_id text not null,
  first_published_at timestamptz, trial_ends_at timestamptz,
  cancellation_accepted_at timestamptz,
  phase text not null check (phase in ('prepared','sync_pending','trialing','cancelled','attention')),
  check ((first_published_at is null and trial_ends_at is null) or
    (first_published_at is not null and trial_ends_at = first_published_at + interval '168 hours'))
);
create index academy_publication_enrollment_owner on academy_publication_private.enrollments(owner_user_id);
create table academy_publication_private.owner_history (
  owner_user_id uuid primary key references auth.users(id) on delete restrict,
  headquarters_id uuid not null unique references public.academy_headquarters(id) on delete restrict,
  first_published_at timestamptz not null
);
create table academy_publication_private.outbox (
  event_key text primary key,
  headquarters_id uuid not null references academy_publication_private.enrollments(headquarters_id),
  kind text not null check (kind in ('synchronize_trial','cancel_conversion')),
  created_at timestamptz not null default clock_timestamp(),
  payload jsonb not null,
  delivered_at timestamptz
);
create index academy_publication_outbox_pending on academy_publication_private.outbox(created_at) where delivered_at is null;
create table academy_publication_private.publication_permits (
  transaction_id bigint not null,
  course_id uuid not null,
  primary key(transaction_id,course_id)
);
do $$ declare t text; begin
  foreach t in array array['policies','quotes','enrollments','owner_history','outbox','publication_permits'] loop
    execute format('alter table academy_publication_private.%I enable row level security', t);
    execute format('revoke all on table academy_publication_private.%I from public, anon, authenticated', t);
  end loop;
end $$;

create function academy_publication_private.immutable_history() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin raise exception 'academy_first_publication_history_immutable'; end $$;
create trigger academy_first_publication_history_immutable before update or delete
on academy_publication_private.owner_history for each row execute function academy_publication_private.immutable_history();

create function academy_publication_private.command(
  p_headquarters_id uuid, p_action text, p_course_id uuid, p_quote_id uuid,
  p_confirmed boolean, p_terms_revision text, p_amount_yen bigint
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid(); owner_id uuid; t timestamptz; current_count integer;
  received_at timestamptz := statement_timestamp();
  e academy_publication_private.enrollments%rowtype;
  q academy_publication_private.quotes%rowtype;
  p academy_publication_private.policies%rowtype;
begin
  if actor is null or not exists (select 1 from auth.users u where u.id=actor and not coalesce(u.is_anonymous,false)) then
    raise exception 'forbidden';
  end if;
  if p_action is null or p_action not in ('status','prepare','publish','unpublish','cancel_conversion') then raise exception 'invalid_action'; end if;
  -- Lock actor row, then HQ. Different HQs of the same owner serialize too.
  perform 1 from auth.users where id=actor for update;
  select h.owner_user_id into owner_id from public.academy_headquarters h where h.id=p_headquarters_id for update;
  if owner_id is distinct from actor then raise exception 'forbidden'; end if;
  select * into e from academy_publication_private.enrollments where headquarters_id=p_headquarters_id for update;
  if e.headquarters_id is not null and e.owner_user_id is distinct from actor then raise exception 'scope_mismatch'; end if;
  if p_action='status' then
    if e.headquarters_id is null then return null; end if;
    return to_jsonb(e);
  end if;
  t := clock_timestamp();
  if p_action in ('publish','unpublish') then
    perform 1 from public.academy_courses c where c.id=p_course_id and c.headquarters_id=p_headquarters_id for update;
    if not found then raise exception 'course_not_found'; end if;
  end if;
  if p_action in ('unpublish','cancel_conversion') then
    if e.headquarters_id is null then raise exception 'enrollment_not_found'; end if;
    if p_action='unpublish' then
      update public.academy_courses set is_published=false where id=p_course_id;
    elsif e.cancellation_accepted_at is null then
      if e.trial_ends_at is not null and received_at > e.trial_ends_at then raise exception 'paid_cancellation_required'; end if;
      update academy_publication_private.enrollments set cancellation_accepted_at=received_at,phase='cancelled'
        where headquarters_id=p_headquarters_id returning * into e;
      insert into academy_publication_private.outbox(event_key,headquarters_id,kind,payload)
        values ('academy-first-publication-cancel:'||p_headquarters_id,p_headquarters_id,'cancel_conversion',to_jsonb(e)) on conflict do nothing;
    end if;
    return to_jsonb(e);
  end if;
  if p_confirmed is distinct from true then raise exception 'explicit_consent_required'; end if;
  if e.first_published_at is not null then
    select * into p from academy_publication_private.policies where version=e.policy_version;
    if not coalesce(p.enabled,false) then raise exception 'policy_not_approved'; end if;
    if p.approval_id<>e.approval_id or p.terms_revision<>e.terms_revision then raise exception 'scheme_mismatch'; end if;
    if p_action <> 'publish' or e.phase not in ('sync_pending','trialing') or t >= e.trial_ends_at then raise exception 'publication_blocked'; end if;
  else
    if e.phase in ('cancelled','attention') then raise exception 'publication_blocked'; end if;
    if exists(select 1 from public.academy_trial_usage_ledger where owner_user_id=actor)
      or exists(select 1 from public.academy_headquarters_access_states where owner_user_id=actor)
      or exists(select 1 from academy_publication_private.owner_history where owner_user_id=actor)
      or exists(select 1 from platform_billing_private.subscriptions where actor_user_id=actor and product_key='academy_platform')
      or exists(select 1 from platform_billing_private.creation_entitlements where actor_user_id=actor and product_key='academy_platform')
      or exists(select 1 from public.academy_courses c join public.academy_headquarters h on h.id=c.headquarters_id where h.owner_user_id=actor and c.is_published)
      or coalesce(private.academy_has_headquarters_creation_entitlement(actor),false)
      then raise exception 'not_eligible_for_new_scheme'; end if;
    select * into q from academy_publication_private.quotes where id=p_quote_id for update;
    if q.id is null or q.headquarters_id<>p_headquarters_id or q.owner_user_id<>actor then raise exception 'quote_not_found'; end if;
    select * into p from academy_publication_private.policies where version=q.policy_version for share;
    if not coalesce(p.enabled,false) then raise exception 'policy_not_approved'; end if;
    if q.terms_revision<>p.terms_revision or q.revoked or not q.current_price_verified then raise exception 'requote_required'; end if;
    if e.headquarters_id is not null and (e.policy_version<>p.version or e.approval_id<>p.approval_id or e.terms_revision<>p.terms_revision) then raise exception 'scheme_mismatch'; end if;
    if q.issued_at>t or t>=q.expires_at or q.expires_at>q.issued_at+make_interval(secs=>p.quote_ttl_seconds) then raise exception 'quote_expired'; end if;
    if not q.payment_verified or nullif(trim(q.payment_preparation_id),'') is null then raise exception 'payment_preparation_unverified'; end if;
    -- Conservative local candidate: block concurrent count/exclusion changes.
    -- Replace with per-HQ writer lock protocol only after all writers participate.
    lock table public.academy_instructors, public.academy_instructor_billing_exclusions in share mode;
    t:=clock_timestamp();
    if t>=q.expires_at then raise exception 'quote_expired'; end if;
    select count(distinct i.profile_id)::integer into current_count
      from public.academy_instructors i where i.headquarters_id=p_headquarters_id
      and i.created_at<=t and (i.withdrawn_at is null or i.withdrawn_at>t)
      and not exists(select 1 from public.academy_instructor_billing_exclusions x
        where x.headquarters_id=i.headquarters_id and x.profile_id=i.profile_id
          and x.effective_from<=t and (x.effective_until is null or x.effective_until>t));
    if current_count<>q.instructor_count or private.academy_catalog_monthly_price_yen(current_count) is distinct from q.amount_yen then
      raise exception 'requote_required';
    end if;
    if p_action='prepare' then
      if p_terms_revision is distinct from q.terms_revision or p_amount_yen is distinct from q.amount_yen then raise exception 'explicit_consent_required'; end if;
      insert into academy_publication_private.enrollments(headquarters_id,owner_user_id,policy_version,approval_id,terms_revision,quote_id,amount_yen,instructor_count,consent_at,payment_preparation_id,phase)
      values(p_headquarters_id,actor,p.version,p.approval_id,q.terms_revision,q.id,q.amount_yen,q.instructor_count,t,q.payment_preparation_id,'prepared')
      on conflict(headquarters_id) do update set policy_version=excluded.policy_version,approval_id=excluded.approval_id,terms_revision=excluded.terms_revision,quote_id=excluded.quote_id,amount_yen=excluded.amount_yen,instructor_count=excluded.instructor_count,consent_at=excluded.consent_at,payment_preparation_id=excluded.payment_preparation_id
      returning * into e;
      return to_jsonb(e);
    end if;
    if e.headquarters_id is null then raise exception 'explicit_enrollment_required'; end if;
    if e.quote_id<>q.id or e.policy_version<>p.version or e.approval_id<>p.approval_id or e.terms_revision<>q.terms_revision then raise exception 'confirmation_changed'; end if;
    insert into academy_publication_private.owner_history values(actor,p_headquarters_id,t);
    update academy_publication_private.enrollments set first_published_at=t,trial_ends_at=t+interval '168 hours',phase='sync_pending'
      where headquarters_id=p_headquarters_id returning * into e;
    insert into academy_publication_private.outbox(event_key,headquarters_id,kind,payload)
      values('academy-first-publication:'||p_headquarters_id,p_headquarters_id,'synchronize_trial',to_jsonb(e));
  end if;
  insert into academy_publication_private.publication_permits values(txid_current(),p_course_id);
  update public.academy_courses set is_published=true where id=p_course_id;
  delete from academy_publication_private.publication_permits where transaction_id=txid_current() and course_id=p_course_id;
  return to_jsonb(e);
end $$;

-- Create a server-priced quote without creating payment, consent or enrollment.
create function academy_publication_private.quote(p_headquarters_id uuid,p_policy_version text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid(); p academy_publication_private.policies%rowtype;
  estimate record; q academy_publication_private.quotes%rowtype; t timestamptz;
begin
  if actor is null or not exists(select 1 from auth.users where id=actor and not coalesce(is_anonymous,false)) then raise exception 'forbidden'; end if;
  perform 1 from auth.users where id=actor for update;
  perform 1 from public.academy_headquarters where id=p_headquarters_id and owner_user_id=actor for update;
  if not found then raise exception 'forbidden'; end if;
  select * into p from academy_publication_private.policies where version=p_policy_version and enabled for share;
  if not found then raise exception 'policy_not_approved'; end if;
  select * into estimate from public.academy_get_my_current_billing_estimate(p_headquarters_id);
  if estimate.catalog_price_yen is null or estimate.catalog_price_yen<=0 or estimate.registered_instructor_count>200 then raise exception 'variable_price_requires_review'; end if;
  t:=clock_timestamp();
  update academy_publication_private.quotes set revoked=true where headquarters_id=p_headquarters_id and not revoked;
  insert into academy_publication_private.quotes(id,headquarters_id,owner_user_id,policy_version,terms_revision,amount_yen,instructor_count,issued_at,expires_at,current_price_verified)
    values(gen_random_uuid(),p_headquarters_id,actor,p.version,p.terms_revision,estimate.catalog_price_yen,estimate.registered_instructor_count,t,t+make_interval(secs=>p.quote_ttl_seconds),true)
    returning * into q;
  return jsonb_build_object('id',q.id,'headquarters_id',q.headquarters_id,'owner_user_id',q.owner_user_id,'policy_version',q.policy_version,'terms_revision',q.terms_revision,'amount_yen',q.amount_yen,'instructor_count',q.instructor_count,'issued_at',q.issued_at,'expires_at',q.expires_at);
end $$;
revoke all on function academy_publication_private.quote(uuid,text) from public,anon;
grant execute on function academy_publication_private.quote(uuid,text) to authenticated;
create function public.academy_first_publication_quote(p_headquarters_id uuid,p_policy_version text)
returns jsonb language sql security invoker set search_path = '' as $$
  select academy_publication_private.quote(p_headquarters_id,p_policy_version);
$$;
revoke all on function public.academy_first_publication_quote(uuid,text) from public,anon;
grant execute on function public.academy_first_publication_quote(uuid,text) to authenticated;
revoke all on all functions in schema academy_publication_private from public,anon,authenticated;
-- Narrow invoker wrapper; privileged body stays in an unexposed schema.
grant usage on schema academy_publication_private to authenticated;
grant execute on function academy_publication_private.quote(uuid,text) to authenticated;
grant execute on function academy_publication_private.command(uuid,text,uuid,uuid,boolean,text,bigint) to authenticated;
create function public.academy_first_publication_command(
  p_headquarters_id uuid,p_action text,p_course_id uuid default null,p_quote_id uuid default null,
  p_confirmed boolean default false,p_terms_revision text default null,p_amount_yen bigint default null
) returns jsonb language sql security invoker set search_path = '' as $$
  select academy_publication_private.command(p_headquarters_id,p_action,p_course_id,p_quote_id,p_confirmed,p_terms_revision,p_amount_yen);
$$;
revoke all on function public.academy_first_publication_command(uuid,text,uuid,uuid,boolean,text,bigint) from public,anon;
grant execute on function public.academy_first_publication_command(uuid,text,uuid,uuid,boolean,text,bigint) to authenticated;

-- Legacy guard retained verbatim below the explicit new-enrollment branch.
create or replace function private.academy_guard_trial_course_draft() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_headquarters_id uuid := case when tg_op='DELETE' then old.headquarters_id else new.headquarters_id end;
  v_mode text := private.academy_headquarters_access_mode(v_headquarters_id);
  e academy_publication_private.enrollments%rowtype;
begin
  if tg_op='UPDATE' and (new.id is distinct from old.id or new.headquarters_id is distinct from old.headquarters_id or new.user_id is distinct from old.user_id or new.created_at is distinct from old.created_at) then raise exception 'academy_course_scope_is_immutable'; end if;
  select * into e from academy_publication_private.enrollments where headquarters_id=v_headquarters_id;
  if found then
    -- Permit taking a page down even after expiry/cancellation, but not changes
    -- disguised as unpublish. Other writes require an active preparation/trial.
    if tg_op='UPDATE' and old.is_published and not new.is_published
      and (to_jsonb(new)-'is_published'-'updated_at')=(to_jsonb(old)-'is_published'-'updated_at') then return new; end if;
    if e.phase in ('cancelled','attention') or (e.trial_ends_at is not null and clock_timestamp()>=e.trial_ends_at) then
      raise exception 'academy_first_publication_writes_blocked';
    end if;
    if tg_op='DELETE' then return old; end if;
    if new.is_published then
      if e.first_published_at is null or e.phase not in ('sync_pending','trialing') or clock_timestamp()>=e.trial_ends_at then raise exception 'publication_blocked'; end if;
      if tg_op='INSERT' or not old.is_published then
        if not exists(select 1 from academy_publication_private.publication_permits where transaction_id=txid_current() and course_id=new.id) then raise exception 'publication_rpc_required'; end if;
      end if;
    end if;
    return new;
  end if;
  if v_mode='paid' then if tg_op='DELETE' then return old; else return new; end if; end if;
  if v_mode='trial_active' then
    if (tg_op='DELETE' and old.is_published) or (tg_op<>'DELETE' and new.is_published) or (tg_op='UPDATE' and old.is_published) then raise exception 'academy_trial_publishing_unavailable'; end if;
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  raise exception 'academy_access_inactive';
end $$;
