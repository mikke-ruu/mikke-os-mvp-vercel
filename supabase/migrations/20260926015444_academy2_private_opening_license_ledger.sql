-- PRIVATE INFRASTRUCTURE ONLY. No public RPC, legacy hook, provider call or scan.
-- A future instructor-sale command must verify the live instructor contract,
-- plan-specific instructor license and actual Connect capabilities before it
-- authorizes enrollment/payment. Activity.status alone is NOT such proof.
-- Authorizations below may only be written by that trusted server verifier;
-- there is deliberately no writer API. Client-supplied proof is never accepted.
create table academy2_access.opening_license_rollouts (
 headquarters_id uuid primary key references academy2_access.tenants(headquarters_id),
 cutover_at timestamptz not null check(isfinite(cutover_at))
);
-- Separate instructor-sale mapping; never reuse/relax the HQ-only source bridge.
create table academy2_access.opening_license_sources (
 offering_id uuid primary key references public.academy_offerings(id),
 headquarters_id uuid not null references academy2_access.tenants(headquarters_id),
 plan_id uuid not null,plan_revision integer not null,
 unique(offering_id,headquarters_id,plan_id,plan_revision),
 foreign key(plan_id,plan_revision) references academy2_access.sales_plan_draft_revisions(draft_id,revision)
);
create table academy2_access.opening_license_origins (
 application_id uuid primary key references public.academy_offering_applications(id),
 headquarters_id uuid not null references academy2_access.tenants(headquarters_id),
 learner_user_id uuid not null references auth.users(id),
 instructor_id uuid not null references public.academy_instructors(id),
 instructor_user_id uuid not null references auth.users(id),
 activity_id uuid not null references academy2_access.instructor_activities(id),
 plan_id uuid not null,plan_revision integer not null,offering_id uuid not null,
 created_at timestamptz not null default clock_timestamp(),
 unique(application_id,headquarters_id,learner_user_id),
 unique(application_id,headquarters_id,learner_user_id,instructor_id,instructor_user_id,plan_id,plan_revision),
 foreign key(plan_id,plan_revision) references academy2_access.sales_plan_draft_revisions(draft_id,revision),
 foreign key(offering_id,headquarters_id,plan_id,plan_revision) references academy2_access.opening_license_sources(offering_id,headquarters_id,plan_id,plan_revision)
);
create table academy2_access.opening_license_intake_permits (
 application_id uuid primary key,activity_id uuid not null references academy2_access.instructor_activities(id),
 plan_revision integer not null,learner_user_id uuid not null references auth.users(id),transaction_id bigint not null
);
create table academy2_access.opening_license_authorizations (
 application_id uuid primary key references academy2_access.opening_license_origins(application_id),
 contract_reference text not null check(length(trim(contract_reference))>0),
 instructor_license_reference text not null check(length(trim(instructor_license_reference))>0),
 connect_account_reference text not null check(length(trim(connect_account_reference))>0),
 verifier_revision text not null check(length(trim(verifier_revision))>0),
 verified_at timestamptz not null,valid_until timestamptz not null,
 check(isfinite(verified_at) and isfinite(valid_until) and valid_until>verified_at)
);
create table academy2_access.opening_license_fee_overrides (
 activity_id uuid not null references academy2_access.instructor_activities(id),
 plan_revision integer not null,amount_minor bigint not null check(amount_minor>=0),
 version text not null check(length(trim(version))>0),
 primary key(activity_id,plan_revision)
);
create table academy2_access.opening_license_payment_events (
 event_id uuid primary key,application_id uuid not null unique references academy2_access.opening_license_origins(application_id),
 headquarters_id uuid not null references academy2_access.tenants(headquarters_id),
 learner_user_id uuid not null references auth.users(id),confirmed_by uuid not null references auth.users(id),
 confirmed_at timestamptz not null,previous_status text not null check(previous_status='pending'),
 status text not null check(status='paid'),created_at timestamptz not null default clock_timestamp(),
 fee_snapshot jsonb not null,offering_snapshot jsonb not null,
 unique(event_id,application_id),
 foreign key(application_id,headquarters_id,learner_user_id) references academy2_access.opening_license_origins(application_id,headquarters_id,learner_user_id)
);
create table academy2_access.opening_license_payment_permits (
 application_id uuid primary key references academy2_access.opening_license_origins(application_id),
 event_id uuid not null unique,actor_id uuid not null references auth.users(id),transaction_id bigint not null
);
create table academy2_access.opening_license_invoices (
 id uuid primary key default gen_random_uuid(),application_id uuid not null unique references academy2_access.opening_license_origins(application_id),
 event_id uuid not null unique references academy2_access.opening_license_payment_events(event_id),
 headquarters_id uuid not null references academy2_access.tenants(headquarters_id),learner_user_id uuid not null references auth.users(id),
 instructor_id uuid not null references public.academy_instructors(id),instructor_user_id uuid not null references auth.users(id),
 plan_id uuid not null,plan_revision integer not null,amount_minor bigint not null check(amount_minor>0),
 currency text not null check(currency='JPY'),fee_snapshot jsonb not null,offering_snapshot jsonb not null,
 scheduled_at timestamptz,created_at timestamptz not null default clock_timestamp(),
 status text not null default 'unpaid' check(status in('unpaid','paid')),paid_at timestamptz,
 foreign key(plan_id,plan_revision) references academy2_access.sales_plan_draft_revisions(draft_id,revision),
 foreign key(application_id,headquarters_id,learner_user_id,instructor_id,instructor_user_id,plan_id,plan_revision) references academy2_access.opening_license_origins(application_id,headquarters_id,learner_user_id,instructor_id,instructor_user_id,plan_id,plan_revision),
 foreign key(event_id,application_id) references academy2_access.opening_license_payment_events(event_id,application_id),
 check((status='unpaid' and paid_at is null) or (status='paid' and paid_at is not null))
);
do $$declare t text;begin
 foreach t in array array['opening_license_rollouts','opening_license_sources','opening_license_origins','opening_license_intake_permits','opening_license_authorizations','opening_license_fee_overrides','opening_license_payment_events','opening_license_payment_permits','opening_license_invoices'] loop
  execute format('alter table academy2_access.%I enable row level security',t);
  execute format('revoke all on academy2_access.%I from public,anon,authenticated,service_role',t);
 end loop;
end$$;
create function academy2_access.opening_permit_must_consume() returns trigger language plpgsql security definer set search_path='' as $$
declare retained boolean;
begin
 execute format('select exists(select 1 from academy2_access.%I where application_id=$1)',tg_table_name) into retained using new.application_id;
 if retained then raise exception 'academy2_opening_unfinished_transaction' using errcode='23514';end if;
 return null;
end$$;
create constraint trigger academy2_opening_intake_consume after insert on academy2_access.opening_license_intake_permits deferrable initially deferred for each row execute function academy2_access.opening_permit_must_consume();
create constraint trigger academy2_opening_payment_consume after insert on academy2_access.opening_license_payment_permits deferrable initially deferred for each row execute function academy2_access.opening_permit_must_consume();
create function academy2_access.opening_immutable() returns trigger language plpgsql security definer set search_path='' as $$begin
 if tg_table_name='opening_license_invoices' and tg_op='UPDATE' then
  if old.status='unpaid' and new.status='paid' and new.paid_at is not null and isfinite(new.paid_at) and (to_jsonb(new)-array['status','paid_at'])=(to_jsonb(old)-array['status','paid_at']) then return new;end if;
 end if;
 raise exception 'academy2_opening_history_immutable' using errcode='42501';
end$$;
do $$declare t text;begin
 foreach t in array array['opening_license_rollouts','opening_license_sources','opening_license_origins','opening_license_authorizations','opening_license_payment_events','opening_license_invoices'] loop
  execute format('create trigger academy2_opening_immutable before update or delete on academy2_access.%I for each row execute function academy2_access.opening_immutable()',t);
 end loop;
end$$;

-- Private future intake must reserve an ABSENT application ID before INSERT.
-- Existing pending rows cannot qualify by updating xmin in the same transaction.
create function academy2_access.prepare_opening_origin(p_application uuid,p_activity uuid,p_revision integer) returns void
language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null or p_application is null or p_activity is null or p_revision is null or exists(select 1 from public.academy_offering_applications where id=p_application) then raise exception 'academy2_new_application_required' using errcode='42501';end if;
 insert into academy2_access.opening_license_intake_permits values(p_application,p_activity,p_revision,auth.uid(),txid_current());
end$$;
create function academy2_access.register_opening_origin(p_application uuid,p_activity uuid,p_revision integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.academy_offering_applications;l public.academy_instructor_offering_application_links;t academy2_access.instructor_activities;o academy2_access.opening_license_origins;cutover timestamptz;consumed uuid;
begin
 select * into a from public.academy_offering_applications where id=p_application for update;
 select * into l from public.academy_instructor_offering_application_links where application_id=p_application;
 if l.application_id is null then return jsonb_build_object('outcome','not_applicable','reason','headquarters_or_legacy_source');end if;
 select * into t from academy2_access.instructor_activities where id=p_activity;
 if not exists(select 1 from academy2_access.opening_license_sources where offering_id=a.offering_id) then return jsonb_build_object('outcome','hold','reason','instructor_plan_source_not_connected');end if;
 if not exists(select 1 from academy2_access.opening_license_sources where offering_id=a.offering_id and headquarters_id=a.headquarters_id and plan_id=t.sales_plan_id and plan_revision=p_revision) or not exists(select 1 from public.academy_instructor_offering_pages p where p.id=l.page_id and p.offering_id=a.offering_id and p.headquarters_id=a.headquarters_id and p.owner_user_id=t.user_id) then raise exception 'academy2_opening_plan_source_mismatch' using errcode='42501';end if;
 if a.id is null or auth.uid() is distinct from a.learner_user_id or t.id is null or t.headquarters_id<>a.headquarters_id or l.headquarters_id<>a.headquarters_id or l.learner_user_id<>a.learner_user_id or l.owner_user_id<>t.user_id or not exists(select 1 from public.academy_instructors i where i.id=t.instructor_id and i.user_id=t.user_id and i.headquarters_id=t.headquarters_id) or not exists(select 1 from academy2_access.sales_plan_draft_revisions r join academy2_access.sales_plan_drafts d on d.id=r.draft_id where r.draft_id=t.sales_plan_id and r.revision=p_revision and d.headquarters_id=a.headquarters_id) then raise exception 'academy2_opening_scope_mismatch' using errcode='42501';end if;
 select * into o from academy2_access.opening_license_origins where application_id=p_application;
 if found then
  if o.activity_id<>p_activity or o.plan_revision<>p_revision then raise exception 'academy2_opening_origin_conflict' using errcode='PT409';end if;
  return jsonb_build_object('outcome','existing');
 end if;
 select cutover_at into cutover from academy2_access.opening_license_rollouts where headquarters_id=a.headquarters_id;
 if cutover is null then return jsonb_build_object('outcome','hold','reason','rollout_not_enabled');end if;
 if a.status<>'pending' or a.paid_at is not null or a.created_at<cutover or not exists(select 1 from public.academy_offering_applications x where x.id=p_application and x.xmin::text::bigint=mod(txid_current(),4294967296)) then return jsonb_build_object('outcome','not_applicable','reason','existing_application_preserved');end if;
 delete from academy2_access.opening_license_intake_permits where application_id=p_application and activity_id=p_activity and plan_revision=p_revision and learner_user_id=auth.uid() and transaction_id=txid_current() returning application_id into consumed;
 if consumed is null then return jsonb_build_object('outcome','not_applicable','reason','new_intake_permit_required');end if;
 insert into academy2_access.opening_license_origins(application_id,headquarters_id,learner_user_id,instructor_id,instructor_user_id,activity_id,plan_id,plan_revision,offering_id) values(a.id,a.headquarters_id,a.learner_user_id,t.instructor_id,t.user_id,t.id,t.sales_plan_id,p_revision,a.offering_id);
 return jsonb_build_object('outcome','registered','authorization','not_granted');
end$$;

-- The future tuition command must call prepare BEFORE changing tuition. This
-- records the actual pending state under a row lock; a caller cannot claim it.
create function academy2_access.prepare_opening_payment(p_application uuid,p_event uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o academy2_access.opening_license_origins;a public.academy_offering_applications;p academy2_access.opening_license_payment_permits;
begin
 select * into o from academy2_access.opening_license_origins where application_id=p_application for update;
 if not found then return jsonb_build_object('outcome','not_applicable','reason','unregistered_source_preserved');end if;
 if auth.uid() is distinct from o.instructor_user_id or p_event is null then raise exception 'academy2_opening_scope_mismatch' using errcode='42501';end if;
 if exists(select 1 from academy2_access.opening_license_payment_events where event_id=p_event and application_id<>p_application) or exists(select 1 from academy2_access.opening_license_payment_permits where event_id=p_event and application_id<>p_application) then raise exception 'academy2_opening_event_reused' using errcode='PT409';end if;
 if exists(select 1 from academy2_access.opening_license_payment_events where application_id=p_application and event_id=p_event) then return jsonb_build_object('outcome','existing');end if;
 select * into a from public.academy_offering_applications where id=p_application for update;
 if a.status<>'pending' or a.paid_at is not null then return jsonb_build_object('outcome','hold','reason','fresh_payment_transition_required');end if;
 select * into p from academy2_access.opening_license_payment_permits where application_id=p_application;
 if found then
  if p.event_id<>p_event or p.actor_id<>auth.uid() or p.transaction_id<>txid_current() then raise exception 'academy2_opening_event_conflict' using errcode='PT409';end if;
 else insert into academy2_access.opening_license_payment_permits values(p_application,p_event,auth.uid(),txid_current());end if;
 return jsonb_build_object('outcome','prepared','authorization','not_granted');
end$$;
-- Private consumer only, after the future authorized tuition update. No charge.
-- A hold persists the genuine event and frozen fee; replay of THAT event may
-- resume after server verification. Validation exceptions roll back the calling
-- business transaction. Callers must never commit a prepared permit by itself.
create function academy2_access.record_opening_payment(p_application uuid,p_event uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.academy_offering_applications;o academy2_access.opening_license_origins;t academy2_access.instructor_activities;e academy2_access.opening_license_payment_events;i academy2_access.opening_license_invoices;r academy2_access.sales_plan_draft_revisions;q academy2_access.opening_license_fee_overrides;amount bigint;snapshot jsonb;cutover timestamptz;consumed uuid;
begin
 select * into o from academy2_access.opening_license_origins where application_id=p_application for update;
 if not found then return jsonb_build_object('outcome','not_applicable','reason','unregistered_source_preserved');end if;
 if auth.uid() is distinct from o.instructor_user_id or p_event is null then raise exception 'academy2_opening_scope_mismatch' using errcode='42501';end if;
 select * into e from academy2_access.opening_license_payment_events where event_id=p_event;
 if found and e.application_id<>p_application then raise exception 'academy2_opening_event_reused' using errcode='PT409';end if;
 select * into i from academy2_access.opening_license_invoices where application_id=p_application;
 if found then return jsonb_build_object('outcome','existing','invoice_id',i.id,'status',i.status);end if;
 select * into a from public.academy_offering_applications where id=p_application for update;
 select cutover_at into cutover from academy2_access.opening_license_rollouts where headquarters_id=o.headquarters_id;
 if a.headquarters_id<>o.headquarters_id or a.learner_user_id<>o.learner_user_id or a.status<>'paid' or a.paid_at is null or a.paid_by is distinct from auth.uid() or cutover is null or a.created_at<cutover or a.paid_at<o.created_at then return jsonb_build_object('outcome','hold','reason','fresh_verified_payment_required');end if;
 select * into r from academy2_access.sales_plan_draft_revisions where draft_id=o.plan_id and revision=o.plan_revision;
 if not exists(select 1 from academy2_access.opening_license_payment_events where application_id=p_application) then
  if not exists(select 1 from public.academy_offering_applications x where x.id=p_application and x.xmin::text::bigint=mod(txid_current(),4294967296)) then return jsonb_build_object('outcome','hold','reason','same_transaction_payment_required');end if;
  delete from academy2_access.opening_license_payment_permits where application_id=p_application and event_id=p_event and actor_id=auth.uid() and transaction_id=txid_current() returning event_id into consumed;
  if consumed is null then return jsonb_build_object('outcome','hold','reason','verified_pending_transition_required');end if;
  select * into q from academy2_access.opening_license_fee_overrides where activity_id=o.activity_id and plan_revision=o.plan_revision;
  if found then amount:=q.amount_minor;snapshot:=jsonb_build_object('source','instructor_override','version',q.version,'amount_minor',amount,'currency','JPY');
  elsif (r.configuration#>>'{opening_license,amount}')~'^[0-9]{1,12}$' then amount:=(r.configuration#>>'{opening_license,amount}')::bigint;snapshot:=jsonb_build_object('source','standard','plan_revision',o.plan_revision,'amount_minor',amount,'currency','JPY');
  else snapshot:=jsonb_build_object('hold','fee_snapshot_required');end if;
  insert into academy2_access.opening_license_payment_events(event_id,application_id,headquarters_id,learner_user_id,confirmed_by,confirmed_at,previous_status,status,fee_snapshot,offering_snapshot) values(p_event,p_application,o.headquarters_id,o.learner_user_id,auth.uid(),a.paid_at,'pending','paid',snapshot,coalesce(r.configuration->'opening_license','{}'::jsonb));
 elsif not exists(select 1 from academy2_access.opening_license_payment_events where event_id=p_event and application_id=p_application) then raise exception 'academy2_opening_event_conflict' using errcode='PT409';end if;
 select * into e from academy2_access.opening_license_payment_events where event_id=p_event;
 if e.offering_snapshot->>'enabled'='false' then return jsonb_build_object('outcome','not_applicable','reason','license_not_required');end if;
 if e.offering_snapshot->>'enabled' is distinct from 'true' then return jsonb_build_object('outcome','hold','reason','license_requirement_unknown');end if;
 select * into t from academy2_access.instructor_activities where id=o.activity_id;
 if t.status<>'active' or t.headquarters_id<>o.headquarters_id or t.instructor_id<>o.instructor_id or t.user_id<>o.instructor_user_id or t.sales_plan_id<>o.plan_id or not exists(select 1 from academy2_access.opening_license_authorizations v where v.application_id=p_application and v.verified_at<=clock_timestamp() and v.valid_until>clock_timestamp()) then return jsonb_build_object('outcome','hold','reason','contract_license_connect_verifier_not_connected');end if;
 amount:=(e.fee_snapshot->>'amount_minor')::bigint;
 if amount is null then return jsonb_build_object('outcome','hold','reason','fee_snapshot_required');end if;
 if amount=0 then return jsonb_build_object('outcome','hold','reason','zero_fee_policy_unresolved');end if;
 insert into academy2_access.opening_license_invoices(application_id,event_id,headquarters_id,learner_user_id,instructor_id,instructor_user_id,plan_id,plan_revision,amount_minor,currency,fee_snapshot,offering_snapshot)
 values(p_application,p_event,o.headquarters_id,o.learner_user_id,o.instructor_id,o.instructor_user_id,o.plan_id,o.plan_revision,amount,'JPY',e.fee_snapshot,e.offering_snapshot) returning * into i;
 return jsonb_build_object('outcome','created','invoice_id',i.id,'status','unpaid','scheduled_at',null);
end$$;
-- Payment gate only: allow is NOT instructor/contract/certification authority.
-- Future callers must obtain the material condition from the frozen plan;
-- never pass an untrusted client boolean as this argument.
create function academy2_access.opening_learner_gate(p_application uuid,p_operation text,p_materials_require_paid boolean default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare i academy2_access.opening_license_invoices;
begin
 if (p_operation in('complete','completion_report','certify','issue_certificate','grant_rights','release_materials')) is distinct from true then return jsonb_build_object('outcome','hold','reason','unknown_operation');end if;
 if not exists(select 1 from academy2_access.opening_license_origins where application_id=p_application) then return jsonb_build_object('outcome','hold','reason','source_not_connected');end if;
 if exists(select 1 from academy2_access.opening_license_payment_events where application_id=p_application and offering_snapshot->>'enabled'='false') then return jsonb_build_object('outcome','allow','reason','license_not_required');end if;
 select * into i from academy2_access.opening_license_invoices where application_id=p_application;
 if not found then return jsonb_build_object('outcome','hold','reason','invoice_or_policy_not_ready');end if;
 if i.status='paid' or (p_operation='release_materials' and p_materials_require_paid=false) then return jsonb_build_object('outcome','allow');end if;
 if p_operation='release_materials' and p_materials_require_paid is null then return jsonb_build_object('outcome','hold','reason','materials_policy_unknown');end if;
 return jsonb_build_object('outcome','blocked','reason','opening_license_unpaid','learner_message','受講準備中');
end$$;
revoke all on function academy2_access.opening_immutable(),academy2_access.opening_permit_must_consume(),academy2_access.prepare_opening_origin(uuid,uuid,integer),academy2_access.register_opening_origin(uuid,uuid,integer),academy2_access.prepare_opening_payment(uuid,uuid),academy2_access.record_opening_payment(uuid,uuid),academy2_access.opening_learner_gate(uuid,text,boolean) from public,anon,authenticated,service_role;
