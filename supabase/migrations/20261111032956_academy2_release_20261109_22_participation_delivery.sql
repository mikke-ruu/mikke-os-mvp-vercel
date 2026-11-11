-- Release candidate. No historical enqueue/backfill and no provider calls.
begin;
create table academy2_access.guest_participation_mail (
 id uuid primary key default gen_random_uuid(),
 application_id uuid not null references academy2_access.guest_applications(id),
 headquarters_id uuid not null references public.academy_headquarters(id),
 payment_at timestamptz not null, payload jsonb not null,
 state text not null default 'queued' check(state in('queued','sending','sent','failed','unknown','cancelled')),
 revision integer not null default 0, attempt integer not null default 0,
 delivery_token uuid, provider_id text, message jsonb, sent_at timestamptz, contacted_at timestamptz,
 created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
 unique(application_id,payment_at)
);
alter table academy2_access.guest_participation_mail enable row level security;
revoke all on academy2_access.guest_participation_mail from public,anon,authenticated,service_role;

create function academy2_access.queue_guest_participation_mail() returns trigger
language plpgsql security definer set search_path='' as $$
declare payload jsonb; cfg jsonb; c public.academy_classes; h public.academy_headquarters; loc academy2_access.event_location_documents;
begin
 if old.paid_at is not null and new.paid_at is null then
  update academy2_access.guest_participation_mail set state='cancelled',revision=revision+1,updated_at=clock_timestamp()
   where application_id=new.id and state in('queued','failed');
  -- An in-flight delivery is not declared cancelled or failed: it may already have been accepted.
  update academy2_access.guest_participation_mail set state='unknown',revision=revision+1,updated_at=clock_timestamp()
   where application_id=new.id and state='sending';
 end if;
 if old.paid_at is null and new.paid_at is not null then
  select * into h from public.academy_headquarters where id=new.headquarters_id;
  select r.configuration into cfg from academy2_access.sales_plan_draft_revisions r where r.draft_id=new.plan_id and r.revision=new.plan_revision;
  select * into c from public.academy_classes where id=new.class_id and headquarters_id=new.headquarters_id;
  select * into loc from academy2_access.event_location_documents where class_id=c.id and headquarters_id=new.headquarters_id;
  payload:=jsonb_build_object('name',new.name,'email',new.email,'title',new.snapshot#>>'{intake,offering,title}','price',new.price,
   'headquartersName',h.name,'contactEmail',h.contact_email,'headquartersId',h.id,'offeringId',new.offering_id,'studyStyle',cfg->>'study_style',
   'homePath','/academy/site/'||h.handle,'planPath','/academy/o/'||new.offering_id::text,
   'event',jsonb_build_object('startsAt',c.starts_at,'endsAt',c.ends_at,'format',c.format,'venueName',c.venue_name,'meetingUrl',c.meeting_url,
    'address',case when loc.address_visibility in('applicants','public') then loc.address else '' end,'note',loc.participant_note));
  insert into academy2_access.guest_participation_mail(application_id,headquarters_id,payment_at,payload)
   values(new.id,new.headquarters_id,new.paid_at,payload) on conflict do nothing;
 end if;
 return new;
end$$;
revoke all on function academy2_access.queue_guest_participation_mail() from public,anon,authenticated,service_role;
create trigger academy2_guest_participation_mail after update of paid_at on academy2_access.guest_applications
 for each row execute function academy2_access.queue_guest_participation_mail();


create function public.academy2_claim_guest_participation_mail(p_job uuid) returns jsonb
language plpgsql security definer set search_path='' as $mail$
declare j academy2_access.guest_participation_mail; a academy2_access.guest_applications;
begin
 select * into j from academy2_access.guest_participation_mail where id=p_job;
 if not found then return jsonb_build_object('outcome','missing');end if;
 select * into a from academy2_access.guest_applications where id=j.application_id for update;
 select * into j from academy2_access.guest_participation_mail where id=p_job for update;
 if j.state='sending' and j.updated_at<clock_timestamp()-interval '5 minutes' then
  update academy2_access.guest_participation_mail set state='unknown',revision=revision+1,updated_at=clock_timestamp() where id=p_job;
  return jsonb_build_object('outcome','unknown');
 end if;
 if j.state<>'queued' then return jsonb_build_object('outcome',j.state);end if;
 if a.paid_at is null or a.paid_at is distinct from j.payment_at then
  update academy2_access.guest_participation_mail set state='cancelled',revision=revision+1,updated_at=clock_timestamp() where id=p_job;
  return jsonb_build_object('outcome','cancelled');
 end if;
 update academy2_access.guest_participation_mail set state='sending',delivery_token=gen_random_uuid(),attempt=attempt+1,revision=revision+1,updated_at=clock_timestamp() where id=p_job returning * into j;
 return jsonb_build_object('outcome','claimed','token',j.delivery_token,'payload',j.payload,'idempotencyKey','academy-guest-participation-'||j.id::text);
end$mail$;

create function public.academy2_finish_guest_participation_mail(p_job uuid,p_token uuid,p_result text,p_provider text default null) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_result is null or p_result not in('sent','failed','unknown') or length(coalesce(p_provider,''))>200 or (p_result='sent' and nullif(p_provider,'') is null) then raise exception 'invalid_result' using errcode='22023';end if;
 update academy2_access.guest_participation_mail set state=p_result,provider_id=case when p_result='sent' then p_provider end,sent_at=case when p_result='sent' then clock_timestamp() end,revision=revision+1,updated_at=clock_timestamp()
 where id=p_job and delivery_token=p_token and state='sending';
 if not found then raise exception 'stale_result' using errcode='PT409';end if;
end$$;
alter table academy2_access.participation_mail add column provider_id text, add column message jsonb;
create function public.academy2_finish_participation_mail_v2(p_job uuid,p_token uuid,p_result text,p_provider text default null) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_result='sent' and (nullif(p_provider,'') is null or length(p_provider)>200) then raise exception 'provider_reference_required' using errcode='22023';end if;
 perform public.academy2_finish_participation_mail(p_job,p_token,p_result);
 if p_result='sent' then update academy2_access.participation_mail set provider_id=p_provider where id=p_job and delivery_token=p_token and state='sent';end if;
end$$;
create function public.academy2_pending_participation_mail(p_limit integer default 3) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' or p_limit is null or p_limit not between 1 and 6 then raise exception 'worker_only' using errcode='42501';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind)),'[]') from (select * from (
 select id,'member'::text as kind,created_at from academy2_access.participation_mail where state='queued' or state='sending' and updated_at<clock_timestamp()-interval '5 minutes'
 union all select id,'guest'::text,created_at from academy2_access.guest_participation_mail where state='queued' or state='sending' and updated_at<clock_timestamp()-interval '5 minutes'
 ) all_jobs order by created_at,id limit p_limit) chosen);
end$$;
revoke all on function public.academy2_claim_guest_participation_mail(uuid),public.academy2_finish_guest_participation_mail(uuid,uuid,text,text),public.academy2_finish_participation_mail_v2(uuid,uuid,text,text),public.academy2_pending_participation_mail(integer) from public,anon,authenticated,service_role;
grant execute on function public.academy2_claim_guest_participation_mail(uuid),public.academy2_finish_guest_participation_mail(uuid,uuid,text,text),public.academy2_finish_participation_mail_v2(uuid,uuid,text,text),public.academy2_pending_participation_mail(integer) to service_role;
create function public.academy2_store_participation_message(p_kind text,p_job uuid,p_token uuid,p_message jsonb) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' then raise exception 'worker_only' using errcode='42501';end if;
 if jsonb_typeof(p_message) is distinct from 'object' or octet_length(p_message::text)>100000
 or exists(select 1 from jsonb_object_keys(p_message) k where k not in('to','subject','text','html'))
 or jsonb_typeof(p_message->'subject') is distinct from 'string' or length(p_message->>'subject') not between 1 and 240
 or p_message->>'subject' ~ E'[\r\n]'
 or jsonb_typeof(p_message->'text') is distinct from 'string' or length(p_message->>'text') not between 1 and 20000
 or jsonb_typeof(p_message->'html') is distinct from 'string' or length(p_message->>'html') not between 1 and 60000 then raise exception 'invalid_message' using errcode='22023';end if;
 if p_kind='member' then
  update academy2_access.participation_mail set message=p_message where id=p_job and delivery_token=p_token and state='sending' and payload->>'email'=p_message->>'to' and (message is null or message=p_message);
 elsif p_kind='guest' then
  update academy2_access.guest_participation_mail set message=p_message where id=p_job and delivery_token=p_token and state='sending' and payload->>'email'=p_message->>'to' and (message is null or message=p_message);
 else raise exception 'invalid_kind' using errcode='22023';end if;
 if not found then raise exception 'message_changed_or_stale' using errcode='PT409';end if;
end$$;
revoke all on function public.academy2_store_participation_message(text,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.academy2_store_participation_message(text,uuid,uuid,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
