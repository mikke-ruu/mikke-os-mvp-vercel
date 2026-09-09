-- No activation: external clock/failover fencing evidence is still required.
-- An empty, postgres-only approval registry replaces the unconditional block.
create table academy_publication_private.runtime_epoch_approvals (
 epoch_id uuid primary key default gen_random_uuid(),
 database_signature jsonb not null,
 approved boolean not null default false,
 not_before timestamptz not null,
 valid_until timestamptz not null,
 evidence_sha256 text not null check (evidence_sha256 ~ '^[0-9a-f]{64}$'),
 check (isfinite(not_before) and isfinite(valid_until) and valid_until > not_before)
);
alter table academy_publication_private.runtime_epoch_approvals enable row level security;
revoke all on academy_publication_private.runtime_epoch_approvals from public,anon,authenticated,service_role;

create function academy_publication_private.runtime_signature()
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if pg_is_in_recovery() or current_setting('transaction_isolation') <> 'read committed'
  or current_setting('synchronous_commit') <> 'on' then raise exception 'unsafe_runtime'; end if;
 select jsonb_build_object('postmaster_start_epoch',extract(epoch from pg_postmaster_start_time()),
  'system_identifier',s.system_identifier::text,'timeline_id',c.timeline_id)
 into result from pg_control_system() s cross join pg_control_checkpoint() c;
 if result is null or result->>'system_identifier' is null or result->>'timeline_id' is null then raise exception 'runtime_unavailable'; end if;
 return result;
end $$;
revoke all on function academy_publication_private.runtime_signature() from public,anon,authenticated,service_role;

alter table academy_publication_private.receipt_barriers add column database_signature jsonb;
alter table academy_publication_private.receipt_proofs add column database_signature jsonb, add column proof_xid xid8;

create or replace function public.academy_first_publication_receipt_barrier(p_headquarters_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare deadline timestamptz; x xid8; b uuid; signature jsonb; observed timestamptz;
begin
 signature:=academy_publication_private.runtime_signature();
 select trial_ends_at into deadline from academy_publication_private.enrollments where headquarters_id=p_headquarters_id;
 if deadline is null or statement_timestamp()<=deadline then raise exception 'not_due'; end if;
 if pg_current_xact_id_if_assigned() is not null then raise exception 'fresh_barrier_transaction_required'; end if;
 x:=pg_current_xact_id(); observed:=clock_timestamp();
 if observed<=deadline then raise exception 'clock_regression'; end if;
 insert into academy_publication_private.receipt_barriers(headquarters_id,through_at,barrier_xid,observed_after_deadline_at,database_signature)
 values(p_headquarters_id,deadline,x,observed,signature) returning barrier_id into b;
 return jsonb_build_object('barrier_id',b,'status','awaiting_commit');
end $$;

create or replace function public.academy_first_publication_receipt_prove(p_barrier_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b academy_publication_private.receipt_barriers%rowtype; s pg_snapshot; n bigint; c bigint; signature jsonb; verified timestamptz;
begin
 signature:=academy_publication_private.runtime_signature();
 select * into b from academy_publication_private.receipt_barriers where barrier_id=p_barrier_id;
 if b.barrier_id is null then raise exception 'committed_barrier_required'; end if;
 if b.barrier_xid=pg_current_xact_id_if_assigned() then raise exception 'separate_proof_transaction_required'; end if;
 if pg_current_xact_id_if_assigned() is not null then raise exception 'fresh_proof_transaction_required'; end if;
 if b.database_signature is distinct from signature then return jsonb_build_object('verified',false,'reason','runtime_epoch_changed'); end if;
 s:=pg_current_snapshot();
 if pg_snapshot_xmax(s)<=b.barrier_xid or exists(select 1 from pg_snapshot_xip(s) x where x<b.barrier_xid) then
  return jsonb_build_object('verified',false,'reason','pre_barrier_transactions_pending');
 end if;
 insert into academy_publication_private.receipt_scopes(headquarters_id) values(b.headquarters_id) on conflict do nothing;
 select last_sequence into n from academy_publication_private.receipt_scopes where headquarters_id=b.headquarters_id for update;
 select count(*) into c from academy_publication_private.receipt_inbox where headquarters_id=b.headquarters_id;
 if n<>c then raise exception 'receipt_sequence_gap'; end if;
 if not exists(select 1 from academy_publication_private.enrollments where headquarters_id=b.headquarters_id and trial_ends_at=b.through_at) then raise exception 'deadline_changed'; end if;
 verified:=clock_timestamp();
 if verified<b.observed_after_deadline_at or verified<=b.through_at then return jsonb_build_object('verified',false,'reason','clock_regression'); end if;
 insert into academy_publication_private.receipt_proofs(headquarters_id,barrier_id,through_at,proof_snapshot,last_sequence,receipt_count,verified_at,database_signature,proof_xid)
 values(b.headquarters_id,b.barrier_id,b.through_at,s,n,c,verified,signature,pg_current_xact_id())
 on conflict(headquarters_id) do update set barrier_id=excluded.barrier_id,through_at=excluded.through_at,proof_snapshot=excluded.proof_snapshot,last_sequence=excluded.last_sequence,receipt_count=excluded.receipt_count,verified_at=excluded.verified_at,database_signature=excluded.database_signature,proof_xid=excluded.proof_xid;
 return jsonb_build_object('verified',true,'through_at',b.through_at,'receipt_count',c,'cancellation_exists',exists(select 1 from academy_publication_private.receipt_inbox where headquarters_id=b.headquarters_id and request_received_at<=b.through_at));
end $$;

create or replace function academy_publication_private.lock_outbox(p_event_key text)
returns academy_publication_private.outbox language plpgsql security definer set search_path='' as $$
declare o academy_publication_private.outbox%rowtype; h uuid;
begin
 select * into o from academy_publication_private.outbox where event_key=p_event_key;
 if o.event_key is null then return o; end if;
 h:=o.headquarters_id;
 -- All business paths use receipt scope -> owner -> HQ -> enrollment -> outbox.
 perform private.academy_first_publication_lock(h);
 perform 1 from academy_publication_private.enrollments e join public.academy_headquarters q on q.id=e.headquarters_id and q.owner_user_id=e.owner_user_id where e.headquarters_id=h for update of e;
 if not found then raise exception 'scope_mismatch'; end if;
 select * into o from academy_publication_private.outbox where event_key=p_event_key for update;
 if o.headquarters_id is distinct from h then raise exception 'scope_mismatch'; end if;
 return o;
end $$;

create or replace function public.academy_first_publication_outbox_dispatch_check(p_event_key text,p_lease_token uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o academy_publication_private.outbox%rowtype; e academy_publication_private.enrollments%rowtype;
 p academy_publication_private.receipt_proofs%rowtype; b academy_publication_private.receipt_barriers%rowtype;
 signature jsonb; observed timestamptz; n bigint; c bigint;
begin
 o:=academy_publication_private.lock_outbox(p_event_key);
 if o.event_key is null or p_lease_token is null or o.lease_token is distinct from p_lease_token or o.lease_until is null or o.lease_until<=clock_timestamp() or o.delivered_at is not null or o.blocked then raise exception 'stale_lease'; end if;
 if o.kind<>'start_paid' then return jsonb_build_object('allowed',true,'reason',null); end if;
 select * into e from academy_publication_private.enrollments where headquarters_id=o.headquarters_id;
 if not exists(select 1 from academy_publication_private.policies where version=e.policy_version and enabled and dispatch_enabled) then return jsonb_build_object('allowed',false,'reason','dispatch_not_activated'); end if;
 observed:=clock_timestamp();
 if e.trial_ends_at is null or observed<=e.trial_ends_at then return jsonb_build_object('allowed',false,'reason','not_due'); end if;
 if e.cancellation_accepted_at is not null or exists(select 1 from academy_publication_private.cancel_intents where headquarters_id=e.headquarters_id and received_at<=e.trial_ends_at)
  or exists(select 1 from academy_publication_private.receipt_inbox where headquarters_id=e.headquarters_id and request_received_at<=e.trial_ends_at) then return jsonb_build_object('allowed',false,'reason','conversion_cancelled'); end if;
 signature:=academy_publication_private.runtime_signature();
 if not exists(select 1 from academy_publication_private.runtime_epoch_approvals where approved and database_signature=signature and not_before<=observed and valid_until>observed) then return jsonb_build_object('allowed',false,'reason','runtime_epoch_not_approved'); end if;
 select * into p from academy_publication_private.receipt_proofs where headquarters_id=e.headquarters_id;
 select * into b from academy_publication_private.receipt_barriers where barrier_id=p.barrier_id;
 select last_sequence into n from academy_publication_private.receipt_scopes where headquarters_id=e.headquarters_id;
 select count(*) into c from academy_publication_private.receipt_inbox where headquarters_id=e.headquarters_id;
 if p.headquarters_id is null or b.headquarters_id is distinct from e.headquarters_id or p.through_at is distinct from e.trial_ends_at or b.through_at is distinct from e.trial_ends_at
  or p.database_signature is distinct from signature or b.database_signature is distinct from signature
  or p.proof_xid is null or p.proof_xid<=b.barrier_xid or p.proof_xid=pg_current_xact_id_if_assigned() or b.barrier_xid=pg_current_xact_id_if_assigned()
  or p.last_sequence is distinct from n or p.receipt_count is distinct from c or n is distinct from c
  or pg_snapshot_xmax(p.proof_snapshot)<=b.barrier_xid or exists(select 1 from pg_snapshot_xip(p.proof_snapshot) x where x<b.barrier_xid)
  or p.verified_at<b.observed_after_deadline_at or b.observed_after_deadline_at<=e.trial_ends_at or observed<p.verified_at then
  return jsonb_build_object('allowed',false,'reason','receipt_proof_unavailable');
 end if;
 return jsonb_build_object('allowed',true,'reason',null);
end $$;

-- Existing checkpoint / paid completion call the guarded dispatch function.
-- No service writer can approve an epoch or manufacture a proof directly.
revoke all on function academy_publication_private.lock_outbox(text) from public,anon,authenticated,service_role;
revoke all on function public.academy_first_publication_receipt_barrier(uuid),public.academy_first_publication_receipt_prove(uuid),public.academy_first_publication_outbox_dispatch_check(text,uuid) from public,anon,authenticated;
grant execute on function public.academy_first_publication_receipt_barrier(uuid),public.academy_first_publication_receipt_prove(uuid),public.academy_first_publication_outbox_dispatch_check(text,uuid) to service_role;
