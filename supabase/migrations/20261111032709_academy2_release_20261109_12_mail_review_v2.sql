-- MIGRATION CANDIDATE: not approved for production. Requires fresh replay and target/ACL review.
-- Original source: docs/academy2-mail-review-v2.local.sql
-- Additive local candidate; existing v1 receipts remain immutable.
begin;
create table academy2_access.receipt_v2_seeds(application_id uuid primary key references public.academy_offering_applications(id),payload jsonb not null);
create table academy2_access.receipt_v2_snapshots(application_id uuid primary key references public.academy_offering_applications(id),payload jsonb not null);
alter table academy2_access.receipt_v2_seeds enable row level security;
alter table academy2_access.receipt_v2_snapshots enable row level security;
revoke all on academy2_access.receipt_v2_seeds,academy2_access.receipt_v2_snapshots from public,anon,authenticated,service_role;
create function academy2_access.seed_receipt_v2() returns trigger language plpgsql security definer set search_path='' as $$
declare h public.academy_headquarters;begin
 if new.payment_method not in('bank','external') then return new;end if;
 select * into h from public.academy_headquarters where id=new.headquarters_id;
 insert into academy2_access.receipt_v2_seeds values(new.id,jsonb_build_object('name',new.applicant_name,'title',new.offering_title,'price',new.price,'method',new.payment_method,'headquartersName',h.name,'contactEmail',h.contact_email,'homePath','/academy/site/'||h.handle));return new;
end$$;
revoke all on function academy2_access.seed_receipt_v2() from public,anon,authenticated,service_role;
create trigger academy2_receipt_v2_seed after insert on public.academy_offering_applications for each row execute function academy2_access.seed_receipt_v2();
create function public.academy2_receipt_v2_content(p_application uuid,p_user uuid,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.academy_offering_applications; p jsonb; legacy jsonb; e academy2_access.operation_enrollments; c public.academy_classes; cfg jsonb;
begin
 select * into a from public.academy_offering_applications where id=p_application and learner_user_id=p_user and request_token=p_request for update;
 if not found then raise exception 'scope' using errcode='42501';end if;
 select payload into p from academy2_access.receipt_v2_snapshots where application_id=a.id;if found then return p;end if;
 select payload into p from academy2_access.receipt_v2_seeds where application_id=a.id;if not found then return null;end if;
 if a.payment_method='bank' then legacy:=public.academy2_bank_receipt_content(a.id,p_user,p_request);else legacy:=public.academy2_external_receipt_content(a.id,p_user,p_request);end if;
 select * into e from academy2_access.operation_enrollments where application_id=a.id;
 select * into c from public.academy_classes where id=e.class_id and headquarters_id=a.headquarters_id;
 select configuration into cfg from academy2_access.sales_plan_draft_revisions where draft_id=e.plan_id and revision=e.plan_revision;
 p:=p||legacy||jsonb_build_object('rendering_version',2,'studyStyle',cfg->>'study_style','planPath',case when e.plan_id is not null then '/academy/page/'||e.plan_id::text end,'event',jsonb_build_object('startsAt',c.starts_at));
 insert into academy2_access.receipt_v2_snapshots values(a.id,p);return p;
end$$;
revoke all on function public.academy2_receipt_v2_content(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.academy2_receipt_v2_content(uuid,uuid,uuid) to service_role;
create function public.academy2_application_mail_content(p_hq uuid,p_application uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a public.academy_offering_applications; r jsonb; p jsonb; e academy2_access.operation_enrollments; h public.academy_headquarters;
begin
 select * into a from public.academy_offering_applications where id=p_application and headquarters_id=p_hq;
 if auth.uid() is null or a.id is null or not(a.learner_user_id=auth.uid() or academy2_access.can(p_hq,'applications.read')) then raise exception 'scope' using errcode='42501';end if;
 select payload into r from academy2_access.receipt_v2_snapshots where application_id=a.id;
 select payload into p from academy2_access.participation_mail where application_id=a.id order by created_at desc,id desc limit 1;
 if not academy2_access.can(p_hq,'applications.read') and a.status<>'paid' then p:=null;end if;
 select * into e from academy2_access.operation_enrollments where application_id=a.id;
 select * into h from public.academy_headquarters where id=p_hq;
 return jsonb_build_object('receipt',r,'receiptTo',a.applicant_email,'receiptHash',(select n.payload_sha256 from public.academy_application_notifications n where n.offering_application_id=a.id and n.recipient_kind='applicant'),'participation',p,'links',jsonb_build_object('plan',case when e.plan_id is not null then '/academy/page/'||e.plan_id::text end,'home','/academy/site/'||h.handle));
end$$;
revoke all on function public.academy2_application_mail_content(uuid,uuid) from public,anon;
grant execute on function public.academy2_application_mail_content(uuid,uuid) to authenticated;
-- Local worker is restricted to new v2 applications and loopback test mailboxes.
create function public.academy2_local_review_mail_jobs() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('job',j.id,'application',j.application_id,'hq',j.headquarters_id)),'[]') from
 (select j.* from academy2_access.participation_mail j join academy2_access.receipt_v2_seeds s on s.application_id=j.application_id where j.state='queued' and j.payload->>'email' like '%.invalid' order by j.created_at limit 20) j
$$;
revoke all on function public.academy2_local_review_mail_jobs() from public,anon,authenticated;
grant execute on function public.academy2_local_review_mail_jobs() to service_role;
commit;
