-- Candidate only. No epoch approval, policy activation, or automatic hold release.
-- A clock fault records cancellation intent, not a successful cancellation receipt.
create table academy_publication_private.cancellation_clock_faults (
 fault_id uuid primary key default gen_random_uuid(),
 headquarters_id uuid not null references academy_publication_private.enrollments(headquarters_id),
 actor_user_id uuid not null references auth.users(id),
 idempotency_key uuid not null,
 intent text not null default 'cancel_conversion' check(intent='cancel_conversion'),
 receipt_xid xid8 not null,
 raw_received_at timestamptz not null check(isfinite(raw_received_at)),
 entry_snapshot pg_snapshot not null,
 database_signature jsonb not null,
 barrier_id uuid not null references academy_publication_private.receipt_barriers(barrier_id),
 barrier_xid xid8 not null,
 barrier_observed_at timestamptz not null,
 reason text not null check(reason='causally_prior_barrier_clock_regression'),
 unique(actor_user_id,idempotency_key),
 check(raw_received_at<barrier_observed_at)
);
create index cancellation_clock_faults_hq on academy_publication_private.cancellation_clock_faults(headquarters_id);
alter table academy_publication_private.cancellation_clock_faults enable row level security;
revoke all on academy_publication_private.cancellation_clock_faults from public,anon,authenticated,service_role;
create trigger cancellation_clock_faults_immutable before update or delete or truncate
 on academy_publication_private.cancellation_clock_faults for each statement
 execute function academy_publication_private.immutable_history();

create function academy_publication_private.clock_fault_dto(f academy_publication_private.cancellation_clock_faults)
returns jsonb language sql immutable security definer set search_path='' as $$
 select jsonb_build_object('status','clock_fault','fault_id',f.fault_id,
  'headquarters_id',f.headquarters_id,'idempotency_key',f.idempotency_key,'billing_held',true)
$$;
revoke all on function academy_publication_private.clock_fault_dto(academy_publication_private.cancellation_clock_faults) from public,anon,authenticated,service_role;

create or replace function public.academy_first_publication_cancel_append(p_headquarters_id uuid,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); x xid8; received timestamptz; entry pg_snapshot; signature jsonb;
 e academy_publication_private.enrollments%rowtype; r academy_publication_private.receipt_inbox%rowtype;
 f academy_publication_private.cancellation_clock_faults%rowtype; b academy_publication_private.receipt_barriers%rowtype; n bigint;
begin
 if actor is null or p_idempotency_key is null or not exists(select 1 from auth.users where id=actor and not coalesce(is_anonymous,false)) then raise exception 'forbidden'; end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'read_committed_required'; end if;
 if pg_current_xact_id_if_assigned() is not null then raise exception 'fresh_receipt_transaction_required'; end if;
 -- Snapshot establishes commit-before-observation causality, NOT a replacement clock.
 entry:=pg_current_snapshot();
 x:=pg_current_xact_id();
 received:=clock_timestamp();
 signature:=academy_publication_private.runtime_signature();
 select e1.* into e from academy_publication_private.enrollments e1 join public.academy_headquarters h on h.id=e1.headquarters_id
 where h.id=p_headquarters_id and h.owner_user_id=actor and e1.owner_user_id=actor;
 if e.headquarters_id is null then raise exception 'forbidden'; end if;
 if e.first_published_at is null or e.trial_ends_at is null then raise exception 'trial_not_started'; end if;
 insert into academy_publication_private.receipt_scopes(headquarters_id) values(p_headquarters_id) on conflict do nothing;
 perform 1 from academy_publication_private.receipt_scopes where headquarters_id=p_headquarters_id for update;
 if not exists(select 1 from public.academy_headquarters where id=p_headquarters_id and owner_user_id=actor) then raise exception 'forbidden'; end if;
 select * into f from academy_publication_private.cancellation_clock_faults where actor_user_id=actor and idempotency_key=p_idempotency_key;
 if found then
  if f.headquarters_id<>p_headquarters_id then raise exception 'idempotency_scope_mismatch'; end if;
  return academy_publication_private.clock_fault_dto(f);
 end if;
 select * into r from academy_publication_private.receipt_inbox where actor_user_id=actor and idempotency_key=p_idempotency_key;
 if found then
  if r.headquarters_id<>p_headquarters_id then raise exception 'idempotency_scope_mismatch'; end if;
  return jsonb_build_object('status','awaiting_durable_acknowledgment');
 end if;
 -- Only a barrier committed before the entry snapshot can prove a contradiction.
 -- A larger XID alone, a concurrent barrier, or another runtime epoch cannot.
 select * into b from academy_publication_private.receipt_barriers
 where headquarters_id=p_headquarters_id and database_signature=signature
  and barrier_xid<>x and pg_visible_in_snapshot(barrier_xid,entry)
  and observed_after_deadline_at>received
 order by observed_after_deadline_at desc,barrier_id limit 1;
 if b.barrier_id is not null then
  insert into academy_publication_private.cancellation_clock_faults
   (headquarters_id,actor_user_id,idempotency_key,receipt_xid,raw_received_at,entry_snapshot,database_signature,barrier_id,barrier_xid,barrier_observed_at,reason)
  values(p_headquarters_id,actor,p_idempotency_key,x,received,entry,signature,b.barrier_id,b.barrier_xid,b.observed_after_deadline_at,'causally_prior_barrier_clock_regression') returning * into f;
  -- The immutable row IS the durable HQ/dispatch hold. Do not throw or call a
  -- business command here: either would risk rolling the intent/hold back.
  return academy_publication_private.clock_fault_dto(f);
 end if;
 if received>e.trial_ends_at then raise exception 'paid_cancellation_required'; end if;
 update academy_publication_private.receipt_scopes set last_sequence=last_sequence+1 where headquarters_id=p_headquarters_id returning last_sequence into n;
 insert into academy_publication_private.receipt_inbox(headquarters_id,actor_user_id,idempotency_key,verified_authority,request_received_at,receipt_xid,sequence)
 values(p_headquarters_id,actor,p_idempotency_key,'academy_headquarters_owner',received,x,n);
 return jsonb_build_object('status','awaiting_durable_acknowledgment');
end $$;

alter function public.academy_first_publication_cancel_acknowledge(uuid,uuid) rename to academy_cancel_ack_before_clock_fault;
alter function public.academy_first_publication_cancel_status(uuid) rename to academy_cancel_status_before_clock_fault;
create function public.academy_first_publication_cancel_acknowledge(p_headquarters_id uuid,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); f academy_publication_private.cancellation_clock_faults%rowtype;
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and not coalesce(is_anonymous,false))
  or not exists(select 1 from public.academy_headquarters where id=p_headquarters_id and owner_user_id=actor) then raise exception 'forbidden'; end if;
 select * into f from academy_publication_private.cancellation_clock_faults where headquarters_id=p_headquarters_id and actor_user_id=actor and idempotency_key=p_idempotency_key;
 if f.fault_id is not null then
  if f.receipt_xid=pg_current_xact_id_if_assigned() then raise exception 'committed_clock_fault_required'; end if;
  return academy_publication_private.clock_fault_dto(f);
 end if;
 return public.academy_cancel_ack_before_clock_fault(p_headquarters_id,p_idempotency_key);
end $$;
create function public.academy_first_publication_cancel_status(p_headquarters_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); f academy_publication_private.cancellation_clock_faults%rowtype;
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and not coalesce(is_anonymous,false))
  or not exists(select 1 from public.academy_headquarters where id=p_headquarters_id and owner_user_id=actor) then raise exception 'forbidden'; end if;
 select * into f from academy_publication_private.cancellation_clock_faults where headquarters_id=p_headquarters_id and actor_user_id=actor order by receipt_xid,fault_id limit 1;
 if f.fault_id is not null then
  if f.receipt_xid=pg_current_xact_id_if_assigned() then raise exception 'committed_clock_fault_required'; end if;
  return academy_publication_private.clock_fault_dto(f);
 end if;
 return public.academy_cancel_status_before_clock_fault(p_headquarters_id);
end $$;

alter function public.academy_first_publication_outbox_dispatch_check(text,uuid) rename to academy_dispatch_before_clock_fault;
create function public.academy_first_publication_outbox_dispatch_check(p_event_key text,p_lease_token uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o academy_publication_private.outbox%rowtype;
begin
 -- Shared scope lock serializes with the fault transaction. A worker already
 -- outside the DB remains a separate provider reconciliation gate.
 o:=academy_publication_private.lock_outbox(p_event_key);
 if o.event_key is null or p_lease_token is null or o.lease_token is distinct from p_lease_token or o.lease_until is null
  or o.lease_until<=clock_timestamp() or o.delivered_at is not null or o.blocked then raise exception 'stale_lease'; end if;
 if o.kind='start_paid' and exists(select 1 from academy_publication_private.cancellation_clock_faults) then
  -- A detected database-clock anomaly freezes all NEW Academy conversion
  -- dispatch. It does not cancel/rewrite existing paid subscriptions.
  return jsonb_build_object('allowed',false,'reason','clock_fault_hold');
 end if;
 return public.academy_dispatch_before_clock_fault(p_event_key,p_lease_token);
end $$;

-- No browser/service path may bypass the wrappers, edit evidence, approve an
-- epoch, or clear a hold. A reviewed separate-authority resolution is required.
revoke all on function public.academy_cancel_ack_before_clock_fault(uuid,uuid),public.academy_cancel_status_before_clock_fault(uuid),public.academy_dispatch_before_clock_fault(text,uuid) from public,anon,authenticated,service_role;
revoke all on function public.academy_first_publication_cancel_append(uuid,uuid),public.academy_first_publication_cancel_acknowledge(uuid,uuid),public.academy_first_publication_cancel_status(uuid) from public,anon,service_role;
grant execute on function public.academy_first_publication_cancel_append(uuid,uuid),public.academy_first_publication_cancel_acknowledge(uuid,uuid),public.academy_first_publication_cancel_status(uuid) to authenticated;
revoke all on function public.academy_first_publication_outbox_dispatch_check(text,uuid) from public,anon,authenticated;
grant execute on function public.academy_first_publication_outbox_dispatch_check(text,uuid) to service_role;
notify pgrst,'reload schema';
