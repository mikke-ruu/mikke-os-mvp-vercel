-- Dedicated DB ingress. No activation: concurrent PostgreSQL verification and
-- deployment clock/transaction configuration evidence remain release gates.
create table academy_publication_private.receipt_scopes (
 headquarters_id uuid primary key references academy_publication_private.enrollments(headquarters_id),
 last_sequence bigint not null default 0 check(last_sequence>=0)
);
create table academy_publication_private.receipt_inbox (
 receipt_id uuid primary key default gen_random_uuid(),
 headquarters_id uuid not null references academy_publication_private.receipt_scopes(headquarters_id),
 actor_user_id uuid not null references auth.users(id),
 idempotency_key uuid not null,
 verified_authority text not null check(verified_authority='academy_headquarters_owner'),
 request_received_at timestamptz not null check(isfinite(request_received_at)),
 receipt_xid xid8 not null,
 sequence bigint not null check(sequence>0),
 unique(headquarters_id,sequence), unique(actor_user_id,idempotency_key)
);
create table academy_publication_private.receipt_acknowledgments (
 receipt_id uuid primary key references academy_publication_private.receipt_inbox(receipt_id),
 durable_acknowledged_at timestamptz not null,
 acknowledgment_xid xid8 not null
);
create table academy_publication_private.receipt_barriers (
 barrier_id uuid primary key default gen_random_uuid(),
 headquarters_id uuid not null references academy_publication_private.enrollments(headquarters_id),
 through_at timestamptz not null,
 barrier_xid xid8 not null,
 observed_after_deadline_at timestamptz not null check(observed_after_deadline_at>through_at)
);
create table academy_publication_private.receipt_proofs (
 headquarters_id uuid primary key references academy_publication_private.enrollments(headquarters_id),
 barrier_id uuid not null references academy_publication_private.receipt_barriers(barrier_id),
 through_at timestamptz not null,
 proof_snapshot pg_snapshot not null,
 last_sequence bigint not null check(last_sequence>=0),
 receipt_count bigint not null check(receipt_count=last_sequence),
 verified_at timestamptz not null
);
do $$ declare t text; begin
 foreach t in array array['receipt_scopes','receipt_inbox','receipt_acknowledgments','receipt_barriers','receipt_proofs'] loop
 execute format('alter table academy_publication_private.%I enable row level security',t);
 execute format('revoke all on academy_publication_private.%I from public,anon,authenticated,service_role',t);
 end loop;
end $$;
create trigger receipt_inbox_immutable before update or delete on academy_publication_private.receipt_inbox for each row execute function academy_publication_private.immutable_history();
create trigger receipt_ack_immutable before update or delete on academy_publication_private.receipt_acknowledgments for each row execute function academy_publication_private.immutable_history();
create trigger receipt_barrier_immutable before update or delete on academy_publication_private.receipt_barriers for each row execute function academy_publication_private.immutable_history();
create function academy_publication_private.guard_receipt_owner_identity() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.owner_user_id is distinct from old.owner_user_id and (exists(select 1 from academy_publication_private.enrollments where headquarters_id=old.id) or exists(select 1 from academy_publication_private.preparations where headquarters_id=old.id)) then raise exception 'first_publication_owner_immutable'; end if;
 return new;
end $$;
create trigger academy_receipt_owner_identity before update of owner_user_id on public.academy_headquarters for each row execute function academy_publication_private.guard_receipt_owner_identity();
revoke all on function academy_publication_private.guard_receipt_owner_identity() from public,anon,authenticated,service_role;

create function public.academy_first_publication_cancel_append(p_headquarters_id uuid,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); x xid8; received timestamptz; e academy_publication_private.enrollments%rowtype; r academy_publication_private.receipt_inbox%rowtype; n bigint;
begin
 if actor is null or p_idempotency_key is null or not exists(select 1 from auth.users where id=actor and not coalesce(is_anonymous,false)) then raise exception 'forbidden'; end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'read_committed_required'; end if;
 -- Reject an enclosing/pre-request transaction which assigned an earlier XID.
 if pg_current_xact_id_if_assigned() is not null then raise exception 'fresh_receipt_transaction_required'; end if;
 x:=pg_current_xact_id();
 received:=clock_timestamp();
 select e1.* into e from academy_publication_private.enrollments e1 join public.academy_headquarters h on h.id=e1.headquarters_id where h.id=p_headquarters_id and h.owner_user_id=actor and e1.owner_user_id=actor;
 if e.headquarters_id is null then raise exception 'forbidden'; end if;
 if e.first_published_at is null or e.trial_ends_at is null then raise exception 'trial_not_started'; end if;
 select * into r from academy_publication_private.receipt_inbox where actor_user_id=actor and idempotency_key=p_idempotency_key;
 if found then
  if r.headquarters_id<>p_headquarters_id then raise exception 'idempotency_scope_mismatch'; end if;
  return jsonb_build_object('status','awaiting_durable_acknowledgment');
 end if;
 if e.trial_ends_at is not null and received>e.trial_ends_at then raise exception 'paid_cancellation_required'; end if;
 insert into academy_publication_private.receipt_scopes(headquarters_id) values(p_headquarters_id) on conflict do nothing;
 perform 1 from academy_publication_private.receipt_scopes where headquarters_id=p_headquarters_id for update;
 -- Fresh READ COMMITTED statement after scope lock handles duplicate retries.
 select * into r from academy_publication_private.receipt_inbox where actor_user_id=actor and idempotency_key=p_idempotency_key;
 if found then
  if r.headquarters_id<>p_headquarters_id then raise exception 'idempotency_scope_mismatch'; end if;
  return jsonb_build_object('status','awaiting_durable_acknowledgment');
 end if;
 -- Current owner checked again immediately before append; ownership mutation
 -- itself is prohibited for enrolled HQs by the receipt identity guard.
 if not exists(select 1 from public.academy_headquarters where id=p_headquarters_id and owner_user_id=actor) then raise exception 'forbidden'; end if;
 update academy_publication_private.receipt_scopes set last_sequence=last_sequence+1 where headquarters_id=p_headquarters_id returning last_sequence into n;
 insert into academy_publication_private.receipt_inbox(headquarters_id,actor_user_id,idempotency_key,verified_authority,request_received_at,receipt_xid,sequence)
 values(p_headquarters_id,actor,p_idempotency_key,'academy_headquarters_owner',received,x,n);
 -- Never expose a receipt ID or success before a separate committed read.
 return jsonb_build_object('status','awaiting_durable_acknowledgment');
end $$;

create function public.academy_first_publication_cancel_acknowledge(p_headquarters_id uuid,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); r academy_publication_private.receipt_inbox%rowtype; a academy_publication_private.receipt_acknowledgments%rowtype; deadline timestamptz;
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and not coalesce(is_anonymous,false)) then raise exception 'forbidden'; end if;
 select * into r from academy_publication_private.receipt_inbox where headquarters_id=p_headquarters_id and actor_user_id=actor and idempotency_key=p_idempotency_key;
 if r.receipt_id is null then raise exception 'committed_receipt_not_found'; end if;
 if r.receipt_xid=pg_current_xact_id_if_assigned() then raise exception 'separate_acknowledgment_transaction_required'; end if;
 insert into academy_publication_private.receipt_acknowledgments values(r.receipt_id,clock_timestamp(),pg_current_xact_id()) on conflict do nothing;
 select * into a from academy_publication_private.receipt_acknowledgments where receipt_id=r.receipt_id;
 select trial_ends_at into deadline from academy_publication_private.enrollments where headquarters_id=p_headquarters_id;
 return jsonb_build_object('status','accepted','receipt_id',r.receipt_id,'headquarters_id',r.headquarters_id,'request_received_at',r.request_received_at,'durable_acknowledged_at',a.durable_acknowledged_at,'sequence',r.sequence,'trial_ends_at',deadline);
end $$;

-- The old receipt endpoint cannot retain a statement-timestamp fallback.
create function public.academy_first_publication_cancel_status(p_headquarters_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); r academy_publication_private.receipt_inbox%rowtype; a academy_publication_private.receipt_acknowledgments%rowtype; e academy_publication_private.enrollments%rowtype;
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and not coalesce(is_anonymous,false)) or not exists(select 1 from public.academy_headquarters where id=p_headquarters_id and owner_user_id=actor) then raise exception 'forbidden'; end if;
 select * into r from academy_publication_private.receipt_inbox where headquarters_id=p_headquarters_id and actor_user_id=actor order by request_received_at,sequence limit 1;
 if r.receipt_id is null then return null; end if;
 if r.receipt_xid=pg_current_xact_id_if_assigned() then raise exception 'committed_receipt_required'; end if;
 select * into a from academy_publication_private.receipt_acknowledgments where receipt_id=r.receipt_id;
 select * into e from academy_publication_private.enrollments where headquarters_id=p_headquarters_id;
 if a.receipt_id is null then return jsonb_build_object('status','awaiting_durable_acknowledgment','idempotency_key',r.idempotency_key); end if;
 return jsonb_build_object('status','accepted','idempotency_key',r.idempotency_key,'receipt_id',r.receipt_id,'headquarters_id',r.headquarters_id,'request_received_at',r.request_received_at,'durable_acknowledged_at',a.durable_acknowledged_at,'sequence',r.sequence,'trial_ends_at',e.trial_ends_at,'applied',e.cancellation_accepted_at is not null);
end $$;
revoke all on function public.academy_first_publication_cancel_status(uuid) from public,anon,service_role;
grant execute on function public.academy_first_publication_cancel_status(uuid) to authenticated;

create or replace function public.academy_first_publication_record_cancel(p_headquarters_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin raise exception 'dedicated_cancel_ingress_required'; end $$;

alter function private.academy_first_publication_lock(uuid) rename to academy_first_publication_business_lock;
create function private.academy_first_publication_lock(p_headquarters_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from academy_publication_private.enrollments where headquarters_id=p_headquarters_id) then
  insert into academy_publication_private.receipt_scopes(headquarters_id) values(p_headquarters_id) on conflict do nothing;
  perform 1 from academy_publication_private.receipt_scopes where headquarters_id=p_headquarters_id for update;
 end if;
 perform private.academy_first_publication_business_lock(p_headquarters_id);
end $$;

alter function academy_publication_private.command(uuid,text,uuid,uuid,boolean,text,bigint) rename to command_before_ingress;
create function academy_publication_private.command(p_headquarters_id uuid,p_action text,p_course_id uuid,p_quote_id uuid,p_confirmed boolean,p_terms_revision text,p_amount_yen bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r academy_publication_private.receipt_inbox%rowtype;
begin
 if p_action='cancel_conversion' then
  select i.* into r from academy_publication_private.receipt_inbox i join academy_publication_private.receipt_acknowledgments a using(receipt_id)
  where i.headquarters_id=p_headquarters_id and i.actor_user_id=auth.uid()
   and i.receipt_xid is distinct from pg_current_xact_id_if_assigned()
   and a.acknowledgment_xid is distinct from pg_current_xact_id_if_assigned()
  order by i.request_received_at,i.sequence limit 1;
  if r.receipt_id is null then raise exception 'durable_acknowledged_receipt_required'; end if;
  perform private.academy_first_publication_lock(p_headquarters_id);
  insert into academy_publication_private.cancel_intents(headquarters_id,owner_user_id,received_at) values(p_headquarters_id,r.actor_user_id,r.request_received_at)
   on conflict(headquarters_id) do update set received_at=least(academy_publication_private.cancel_intents.received_at,excluded.received_at);
 end if;
 return academy_publication_private.command_before_ingress(p_headquarters_id,p_action,p_course_id,p_quote_id,p_confirmed,p_terms_revision,p_amount_yen);
end $$;
revoke all on function academy_publication_private.command_before_ingress(uuid,text,uuid,uuid,boolean,text,bigint) from public,anon,authenticated,service_role;
revoke all on function academy_publication_private.command(uuid,text,uuid,uuid,boolean,text,bigint),private.academy_first_publication_lock(uuid),private.academy_first_publication_business_lock(uuid) from public,anon,authenticated,service_role;
grant execute on function academy_publication_private.command(uuid,text,uuid,uuid,boolean,text,bigint) to authenticated;

-- Read committed durable inbox immediately. No business projection lag permits
-- new invites; Community must acquire ingress->owner->HQ->Community locks.
do $$ declare source text; access_target regprocedure; begin
 -- The earlier platform bridge wraps this helper. Patch the original body,
 -- not its paid-access wrapper. Standalone contract fixtures have no bridge.
 access_target:=coalesce(
  to_regprocedure('private.academy_first_publication_access_before_platform_bridge(uuid)'),
  to_regprocedure('private.academy_first_publication_access(uuid)')
 );
 if access_target is null then raise exception 'missing_access_definition'; end if;
 source:=pg_get_functiondef(access_target);
 if position('v_cancel:=coalesce(v_cancel,e.cancellation_accepted_at);' in source)=0 then raise exception 'unexpected_access_definition'; end if;
 source:=replace(source,'v_cancel:=coalesce(v_cancel,e.cancellation_accepted_at);',
 'select min(t) into v_cancel from (select v_cancel as t union all select e.cancellation_accepted_at union all select request_received_at from academy_publication_private.receipt_inbox where headquarters_id=p_headquarters_id) receipts;');
 execute source;
end $$;

create function public.academy_first_publication_receipt_barrier(p_headquarters_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare deadline timestamptz; x xid8; b uuid;
begin
 select trial_ends_at into deadline from academy_publication_private.enrollments where headquarters_id=p_headquarters_id;
 if deadline is null or statement_timestamp()<=deadline then raise exception 'not_due'; end if;
 if pg_current_xact_id_if_assigned() is not null then raise exception 'fresh_barrier_transaction_required'; end if;
 x:=pg_current_xact_id();
 insert into academy_publication_private.receipt_barriers(headquarters_id,through_at,barrier_xid,observed_after_deadline_at)
 values(p_headquarters_id,deadline,x,clock_timestamp()) returning barrier_id into b;
 return jsonb_build_object('barrier_id',b,'status','awaiting_commit');
end $$;

create function public.academy_first_publication_receipt_prove(p_barrier_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b academy_publication_private.receipt_barriers%rowtype; s pg_snapshot; n bigint; c bigint;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'read_committed_required'; end if;
 select * into b from academy_publication_private.receipt_barriers where barrier_id=p_barrier_id;
 if b.barrier_id is null then raise exception 'committed_barrier_required'; end if;
 if b.barrier_xid=pg_current_xact_id_if_assigned() then raise exception 'separate_proof_transaction_required'; end if;
 -- Snapshots omit the observing transaction's own XID. It must not hide an
 -- earlier self-owned receipt; pre-request/enclosing writes fail closed.
 if pg_current_xact_id_if_assigned() is not null then raise exception 'fresh_proof_transaction_required'; end if;
 s:=pg_current_snapshot();
 if pg_snapshot_xmax(s)<=b.barrier_xid or exists(select 1 from pg_snapshot_xip(s) x where x<b.barrier_xid) then
  return jsonb_build_object('verified',false,'reason','pre_barrier_transactions_pending');
 end if;
 if clock_timestamp()<=b.through_at then return jsonb_build_object('verified',false,'reason','clock_regression'); end if;
 insert into academy_publication_private.receipt_scopes(headquarters_id) values(b.headquarters_id) on conflict do nothing;
 select last_sequence into n from academy_publication_private.receipt_scopes where headquarters_id=b.headquarters_id for update;
 select count(*) into c from academy_publication_private.receipt_inbox where headquarters_id=b.headquarters_id;
 if n<>c then raise exception 'receipt_sequence_gap'; end if;
 if not exists(select 1 from academy_publication_private.enrollments where headquarters_id=b.headquarters_id and trial_ends_at=b.through_at) then raise exception 'deadline_changed'; end if;
 insert into academy_publication_private.receipt_proofs values(b.headquarters_id,b.barrier_id,b.through_at,s,n,c,clock_timestamp())
 on conflict(headquarters_id) do update set barrier_id=excluded.barrier_id,through_at=excluded.through_at,proof_snapshot=excluded.proof_snapshot,last_sequence=excluded.last_sequence,receipt_count=excluded.receipt_count,verified_at=excluded.verified_at;
 return jsonb_build_object('verified',true,'through_at',b.through_at,'receipt_count',c,'cancellation_exists',exists(select 1 from academy_publication_private.receipt_inbox where headquarters_id=b.headquarters_id and request_received_at<=b.through_at));
end $$;

-- The previous hand-seeded watermark is no authority. This hard gate remains
-- even if an operator flips dispatch_enabled. Removing it requires a reviewed
-- migration after real multi-connection PostgreSQL and clock/failover checks.
alter function public.academy_first_publication_outbox_dispatch_check(text,uuid) rename to academy_first_publication_dispatch_before_ingress;
create function public.academy_first_publication_outbox_dispatch_check(p_event_key text,p_lease_token uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o academy_publication_private.outbox%rowtype;
begin
 o:=academy_publication_private.lock_outbox(p_event_key);
 if o.event_key is null or o.lease_token is distinct from p_lease_token or o.lease_until<=clock_timestamp() or o.delivered_at is not null or o.blocked then raise exception 'stale_lease'; end if;
 if o.kind='start_paid' then return jsonb_build_object('allowed',false,'reason','ingress_concurrency_verification_pending'); end if;
 return public.academy_first_publication_dispatch_before_ingress(p_event_key,p_lease_token);
end $$;
revoke all on function public.academy_first_publication_dispatch_before_ingress(text,uuid) from public,anon,authenticated,service_role;
revoke all on function public.academy_first_publication_cancel_append(uuid,uuid),public.academy_first_publication_cancel_acknowledge(uuid,uuid) from public,anon,service_role;
grant execute on function public.academy_first_publication_cancel_append(uuid,uuid),public.academy_first_publication_cancel_acknowledge(uuid,uuid) to authenticated;
revoke all on function public.academy_first_publication_receipt_barrier(uuid),public.academy_first_publication_receipt_prove(uuid),public.academy_first_publication_outbox_dispatch_check(text,uuid) from public,anon,authenticated;
grant execute on function public.academy_first_publication_receipt_barrier(uuid),public.academy_first_publication_receipt_prove(uuid),public.academy_first_publication_outbox_dispatch_check(text,uuid) to service_role;
