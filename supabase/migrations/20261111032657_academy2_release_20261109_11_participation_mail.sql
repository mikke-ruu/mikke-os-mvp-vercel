-- MIGRATION CANDIDATE: not approved for production. Requires fresh replay and target/ACL review.
-- Original source: docs/academy2-participation-mail.local.sql
-- Local candidate only. No provider calls, historical backfill or production changes.
begin;
create table academy2_access.participation_mail (
 id uuid primary key default gen_random_uuid(),
 application_id uuid not null references public.academy_offering_applications(id),
 headquarters_id uuid not null references public.academy_headquarters(id),
 payment_at timestamptz not null, payload jsonb not null,
 state text not null default 'queued' check(state in('queued','sending','sent','failed','unknown','cancelled')),
 revision integer not null default 0, attempt integer not null default 0,
 delivery_token uuid, sent_at timestamptz, contacted_at timestamptz,
 created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
 unique(application_id,payment_at)
);
alter table academy2_access.participation_mail enable row level security;
revoke all on academy2_access.participation_mail from public,anon,authenticated,service_role;
create function academy2_access.queue_participation_mail() returns trigger
language plpgsql security definer set search_path='' as $$
declare payload jsonb; cfg jsonb; c public.academy_classes; h public.academy_headquarters; loc academy2_access.event_location_documents;
begin
 if old.status='paid' and new.status<>'paid' then
  update academy2_access.participation_mail set state='cancelled',revision=revision+1,updated_at=clock_timestamp()
   where application_id=new.id and state in('queued','failed');
  -- An in-flight delivery is not declared cancelled or failed: it may already have been accepted.
  update academy2_access.participation_mail set state='unknown',revision=revision+1,updated_at=clock_timestamp()
   where application_id=new.id and state='sending';
 end if;
 if old.status is distinct from 'paid' and new.status='paid' and new.paid_at is not null then
  select * into h from public.academy_headquarters where id=new.headquarters_id;
  select r.configuration into cfg from academy2_access.operation_enrollments e
   join academy2_access.sales_plan_draft_revisions r on r.draft_id=e.plan_id and r.revision=e.plan_revision where e.application_id=new.id;
  select cc.* into c from public.academy_classes cc join academy2_access.operation_enrollments e on e.class_id=cc.id
   where e.application_id=new.id and cc.headquarters_id=new.headquarters_id;
  select * into loc from academy2_access.event_location_documents where class_id=c.id and headquarters_id=new.headquarters_id;
  payload:=jsonb_build_object('name',new.applicant_name,'email',new.applicant_email,'title',new.offering_title,'price',new.price,
   'headquartersName',h.name,'contactEmail',h.contact_email,'headquartersId',h.id,'offeringId',new.offering_id,'studyStyle',cfg->>'study_style',
   'homePath','/academy/site/'||h.handle,'planPath',(select '/academy/page/'||e.plan_id::text from academy2_access.operation_enrollments e where e.application_id=new.id),
   'event',jsonb_build_object('startsAt',c.starts_at,'endsAt',c.ends_at,'format',c.format,'venueName',c.venue_name,'meetingUrl',c.meeting_url,
    'address',case when loc.address_visibility in('applicants','public') then loc.address else '' end,'note',loc.participant_note));
  insert into academy2_access.participation_mail(application_id,headquarters_id,payment_at,payload)
   values(new.id,new.headquarters_id,new.paid_at,payload) on conflict do nothing;
 end if;
 return new;
end$$;
revoke all on function academy2_access.queue_participation_mail() from public,anon,authenticated,service_role;
create trigger academy2_participation_mail after update of status on public.academy_offering_applications
 for each row execute function academy2_access.queue_participation_mail();

create function public.academy2_hq_mail_status(p_hq uuid,p_applications uuid[]) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not academy2_access.can(p_hq,'applications.read') then raise exception 'forbidden' using errcode='42501';end if;
 if cardinality(p_applications)>200 or exists(select 1 from unnest(p_applications) i where not exists(select 1 from public.academy_offering_applications a where a.id=i and a.headquarters_id=p_hq)) then raise exception 'scope' using errcode='42501';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('applicationId',a.id,'paidAt',case when academy2_access.can(p_hq,'finance.read') then a.paid_at end,
  'receipt',jsonb_build_object('state',coalesce(n.status,'unrecorded'),'sentAt',n.sent_at),
  'participation',case when j.id is null then jsonb_build_object('state','unrecorded') else jsonb_build_object('id',j.id,'state',j.state,'sentAt',j.sent_at,'contactedAt',j.contacted_at,'revision',j.revision) end,
  'canManage',academy2_access.can(p_hq,'applications.operate'))),'[]')
  from public.academy_offering_applications a
  left join public.academy_application_notifications n on n.offering_application_id=a.id and n.recipient_kind='applicant'
  left join lateral (select * from academy2_access.participation_mail where application_id=a.id order by created_at desc,id desc limit 1) j on true
  where a.headquarters_id=p_hq and a.id=any(p_applications));
end$$;
revoke all on function public.academy2_hq_mail_status(uuid,uuid[]) from public,anon;
grant execute on function public.academy2_hq_mail_status(uuid,uuid[]) to authenticated;

create function public.academy2_hq_mail_followup(p_hq uuid,p_job uuid,p_expected integer,p_action text) returns void
language plpgsql security definer set search_path='' as $$
declare j academy2_access.participation_mail; a public.academy_offering_applications;
begin
 if auth.uid() is null or not academy2_access.can(p_hq,'applications.operate') then raise exception 'forbidden' using errcode='42501';end if;
 select * into j from academy2_access.participation_mail where id=p_job and headquarters_id=p_hq;
 if not found then raise exception 'scope' using errcode='42501';end if;
 select * into a from public.academy_offering_applications where id=j.application_id and headquarters_id=p_hq for update;
 select * into j from academy2_access.participation_mail where id=p_job for update;
 if j.revision<>p_expected then raise exception 'conflict' using errcode='PT409';end if;
 if p_action='retry' and j.state='failed' and a.status='paid' then
  update academy2_access.participation_mail set state='queued',revision=revision+1,updated_at=clock_timestamp() where id=p_job;
 elsif p_action='contacted' and j.state in('failed','unknown') and j.contacted_at is null then
  update academy2_access.participation_mail set contacted_at=clock_timestamp(),revision=revision+1,updated_at=clock_timestamp() where id=p_job;
 else raise exception 'invalid_state' using errcode='22023';end if;
end$$;
revoke all on function public.academy2_hq_mail_followup(uuid,uuid,integer,text) from public,anon;
grant execute on function public.academy2_hq_mail_followup(uuid,uuid,integer,text) to authenticated;
-- Provider adapter boundary: never infer success from queueing or payment confirmation.
create function public.academy2_claim_participation_mail(p_job uuid) returns jsonb
language plpgsql security definer set search_path='' as $mail$
declare j academy2_access.participation_mail; a public.academy_offering_applications;
begin
 select * into j from academy2_access.participation_mail where id=p_job;
 if not found then return jsonb_build_object('outcome','missing');end if;
 select * into a from public.academy_offering_applications where id=j.application_id for update;
 select * into j from academy2_access.participation_mail where id=p_job for update;
 if j.state='sending' and j.updated_at<clock_timestamp()-interval '5 minutes' then
  update academy2_access.participation_mail set state='unknown',revision=revision+1,updated_at=clock_timestamp() where id=p_job;
  return jsonb_build_object('outcome','unknown');
 end if;
 if j.state<>'queued' then return jsonb_build_object('outcome',j.state);end if;
 if a.status<>'paid' or a.paid_at is distinct from j.payment_at then
  update academy2_access.participation_mail set state='cancelled',revision=revision+1,updated_at=clock_timestamp() where id=p_job;
  return jsonb_build_object('outcome','cancelled');
 end if;
 update academy2_access.participation_mail set state='sending',delivery_token=gen_random_uuid(),attempt=attempt+1,revision=revision+1,updated_at=clock_timestamp() where id=p_job returning * into j;
 return jsonb_build_object('outcome','claimed','token',j.delivery_token,'payload',j.payload,'idempotencyKey','academy-participation-'||j.id::text);
end$mail$;
create function public.academy2_finish_participation_mail(p_job uuid,p_token uuid,p_result text) returns void
language plpgsql security definer set search_path='' as $mail$
begin
 if p_result not in('sent','failed','unknown') or p_result is null then raise exception 'invalid_result' using errcode='22023';end if;
 update academy2_access.participation_mail set state=p_result,sent_at=case when p_result='sent' then clock_timestamp() end,revision=revision+1,updated_at=clock_timestamp()
 where id=p_job and delivery_token=p_token and state='sending';
 if not found then raise exception 'stale_result' using errcode='PT409';end if;
end$mail$;
revoke all on function public.academy2_claim_participation_mail(uuid),public.academy2_finish_participation_mail(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.academy2_claim_participation_mail(uuid),public.academy2_finish_participation_mail(uuid,uuid,text) to service_role;
commit;
