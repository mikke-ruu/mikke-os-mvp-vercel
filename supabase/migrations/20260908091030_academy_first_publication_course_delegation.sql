-- Post-first-publication delegation; no initial consent or billing changes.
create function private.academy_first_publication_lock(p_headquarters_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare owner_id uuid;
begin
 select owner_user_id into owner_id from public.academy_headquarters where id=p_headquarters_id;
 if owner_id is null then raise exception 'headquarters_not_found'; end if;
 perform 1 from auth.users where id=owner_id for update;
 perform 1 from public.academy_headquarters where id=p_headquarters_id and owner_user_id=owner_id for update;
 if not found then raise exception 'headquarters_identity_changed'; end if;
end $$;

-- No writer is installed or granted. A future trusted ingress authority must
-- prove gap-free receipt sequencing and drain through the deadline BEFORE
-- inserting a watermark. service_role cannot assert its own watermark.
create table academy_publication_private.verified_receipt_watermarks (
 headquarters_id uuid primary key references academy_publication_private.enrollments(headquarters_id),
 through_at timestamptz not null check(isfinite(through_at)),
 authority_revision text not null check(length(trim(authority_revision))>0),
 first_sequence bigint not null check(first_sequence>0),
 last_sequence bigint not null check(last_sequence>=first_sequence),
 receipt_count bigint not null check(receipt_count=last_sequence-first_sequence+1),
 verified_at timestamptz not null check(isfinite(verified_at) and verified_at>=through_at)
);
alter table academy_publication_private.verified_receipt_watermarks enable row level security;
revoke all on academy_publication_private.verified_receipt_watermarks from public,anon,authenticated,service_role;

create or replace function public.academy_first_publication_outbox_dispatch_check(p_event_key text,p_lease_token uuid)
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
  if not exists(select 1 from academy_publication_private.verified_receipt_watermarks where headquarters_id=e.headquarters_id and through_at>=e.trial_ends_at) then
   return jsonb_build_object('allowed',false,'reason','receipt_watermark_unavailable');
  end if;
 end if;
 return jsonb_build_object('allowed',true,'reason',null);
end $$;
revoke all on function private.academy_first_publication_lock(uuid) from public,anon,authenticated,service_role;

create function public.academy_first_publication_set_course_published(p_headquarters_id uuid,p_course_id uuid,p_published boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); e academy_publication_private.enrollments%rowtype; a jsonb;
begin
 if actor is null or p_published is null or not exists(select 1 from auth.users where id=actor and not coalesce(is_anonymous,false)) then raise exception 'forbidden'; end if;
 perform private.academy_first_publication_lock(p_headquarters_id);
 -- Prevent membership removal racing the permission check and mutation.
 perform 1 from public.academy_headquarters_members where headquarters_id=p_headquarters_id for share;
 if not coalesce(private.academy_can_edit_courses(p_headquarters_id),false) then raise exception 'forbidden'; end if;
 select * into e from academy_publication_private.enrollments where headquarters_id=p_headquarters_id for update;
 if e.first_published_at is null then raise exception 'owner_first_publication_required'; end if;
 a:=private.academy_first_publication_access(p_headquarters_id);
 if not coalesce((a->>'active')::boolean,false) then raise exception 'publication_blocked'; end if;
 perform 1 from public.academy_courses where id=p_course_id and headquarters_id=p_headquarters_id for update;
 if not found then raise exception 'course_not_found'; end if;
 if p_published then insert into academy_publication_private.publication_permits values(txid_current(),p_course_id); end if;
 update public.academy_courses set is_published=p_published where id=p_course_id;
 delete from academy_publication_private.publication_permits where transaction_id=txid_current() and course_id=p_course_id;
 return jsonb_build_object('headquarters_id',p_headquarters_id,'course_id',p_course_id,'is_published',p_published);
end $$;
revoke all on function public.academy_first_publication_set_course_published(uuid,uuid,boolean) from public,anon;
grant execute on function public.academy_first_publication_set_course_published(uuid,uuid,boolean) to authenticated;

-- Capture ingress time before acquiring the shared owner/HQ business lock.
-- Community uses the same lock before its Community/claim locks and rechecks
-- access after locking. The separate billing-watermark gate remains unresolved.
create or replace function public.academy_first_publication_record_cancel(p_headquarters_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); received timestamptz:=statement_timestamp(); e academy_publication_private.enrollments%rowtype;
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and not coalesce(is_anonymous,false)) then raise exception 'forbidden'; end if;
 perform private.academy_first_publication_lock(p_headquarters_id);
 select e1.* into e from academy_publication_private.enrollments e1 join public.academy_headquarters h on h.id=e1.headquarters_id
 where h.id=p_headquarters_id and h.owner_user_id=actor and e1.owner_user_id=actor;
 if e.headquarters_id is null then raise exception 'enrollment_not_found'; end if;
 if e.trial_ends_at is not null and received>e.trial_ends_at then raise exception 'paid_cancellation_required'; end if;
 insert into academy_publication_private.cancel_intents(headquarters_id,owner_user_id,received_at)
 values(p_headquarters_id,actor,received) on conflict(headquarters_id) do nothing;
 select received_at into received from academy_publication_private.cancel_intents where headquarters_id=p_headquarters_id;
 return jsonb_build_object('received_at',received,'headquarters_id',p_headquarters_id);
end $$;

alter table academy_publication_private.provider_steps drop constraint provider_steps_step_check;
alter table academy_publication_private.provider_steps add constraint provider_steps_step_check
check(step in ('invoice_create','invoice_item','finalize','pay','subscription_create','subscription_hold'));
do $$ declare source text; begin
 source:=pg_get_functiondef('public.academy_first_publication_outbox_checkpoint(text,uuid,text,text)'::regprocedure);
 if position('''subscription_create'')' in source)=0 then raise exception 'unexpected_checkpoint_definition'; end if;
 source:=replace(source,'''subscription_create'')','''subscription_create'',''subscription_hold'')');
 execute source;
end $$;
