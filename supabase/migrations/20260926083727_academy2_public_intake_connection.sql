-- Opt-in connections for the existing public form. No legacy backfill or publication.
grant usage on schema academy2_access to anon;
create table academy2_access.instructor_intake_consents (
 application_id uuid primary key references academy2_access.opening_license_origins(application_id),
 page_id uuid not null references public.academy_instructor_offering_pages(id),
 version text not null,body text not null,consented_by uuid not null references auth.users(id),
 consented_at timestamptz not null default clock_timestamp()
);
alter table academy2_access.instructor_intake_consents enable row level security;
revoke all on academy2_access.instructor_intake_consents from public,anon,authenticated,service_role;
create trigger academy2_intake_consent_immutable before update or delete on academy2_access.instructor_intake_consents for each row execute function academy2_access.opening_immutable();

create function academy2_access.public_intake(p_id uuid,p_instructor boolean) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare offer uuid;hq uuid;plan uuid;rev integer;p public.academy_instructor_offering_pages;
 cfg jsonb;data jsonb;events jsonb:='[]';activity uuid;
begin
 if p_instructor is null then raise exception 'academy2_invalid_input' using errcode='22023';end if;
 if p_instructor then
  select * into p from public.academy_instructor_offering_pages where id=p_id;
  offer:=p.offering_id;
  select headquarters_id,plan_id,plan_revision into hq,plan,rev from academy2_access.opening_license_sources where offering_id=offer;
 else
  offer:=p_id;
  select headquarters_id,plan_id,plan_revision into hq,plan,rev from academy2_access.operation_sources where offering_id=offer;
  if plan is null and exists(select 1 from academy2_access.opening_license_sources where offering_id=offer) then return jsonb_build_object('mode','unavailable');end if;
 end if;
 if plan is null then return null;end if;
 if not exists(select 1 from academy2_access.tenants where headquarters_id=hq and runtime_enabled) then return jsonb_build_object('mode','unavailable');end if;
 data:=public.academy_get_public_offering(offer);
 select configuration into cfg from academy2_access.sales_plan_draft_revisions where draft_id=plan and revision=rev;
 if data is null or cfg is null or data->>'title' is distinct from cfg->>'title'
  or data->'price' is distinct from cfg->'price' or data->'course_ids' is distinct from cfg->'course_ids'
  or data->>'kind' is distinct from cfg->>'kind' or data->>'purchase_mode'<>'all'
  or (data->'payment_methods'?'bank') is distinct from true
  or nullif(btrim(cfg#>>'{terms,version}'),'') is null or nullif(btrim(cfg#>>'{terms,body}'),'') is null
 then return jsonb_build_object('mode','unavailable');end if;
 if p_instructor then
  if p.status<>'published' or p.headquarters_id<>hq or not academy2_access.payment_provider_ready(hq)
   or not exists(select 1 from academy2_access.opening_license_rollouts where headquarters_id=hq and cutover_at<=now())
   or exists(select 1 from academy2_access.operation_sources where offering_id=offer)
   or cfg#>'{after,instructor_license}' is distinct from 'true'::jsonb
  then return jsonb_build_object('mode','unavailable');end if;
  select a.id into activity from academy2_access.instructor_activities a
   join public.academy_instructors i on i.id=a.instructor_id and i.user_id=a.user_id and i.headquarters_id=a.headquarters_id
   join academy2_access.instructor_contracts c on c.activity_id=a.id and c.accepted_by=a.user_id
   join academy2_access.instructor_license_grants g on g.activity_id=a.id and g.contract_id=c.id
   where a.headquarters_id=hq and a.sales_plan_id=plan and a.user_id=p.owner_user_id and a.status='active'
   and c.status='active' and c.accepted_at<=now() and c.starts_at<=now() and c.ends_at>now()
   and g.status='active' and g.starts_at<=now() and g.ends_at>now() limit 1;
  if activity is null then return jsonb_build_object('mode','unavailable');end if;
 else
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,'startsAt',c.starts_at,'endsAt',c.ends_at,'scheduleMode',c.schedule_mode,'format',c.format) order by c.starts_at nulls last,c.id),'[]') into events
   from public.academy_classes c join academy2_access.event_plans ep on ep.class_id=c.id
   where ep.headquarters_id=hq and ep.plan_id=plan and ep.plan_revision=rev and c.headquarters_id=hq
   and c.registration_status='open' and c.status in('planned','active') and (cfg->'allowed_methods')?c.format;
 end if;
 return jsonb_build_object('mode',case when p_instructor then 'instructor' else 'headquarters' end,
  'offering',data||jsonb_build_object('payment_methods',jsonb_build_array('bank')),
  'page',case when p_instructor then jsonb_build_object('id',p.id,'profile',p.profile,'lp_blocks',p.lp_blocks) else null end,
  'terms',cfg->'terms','eventRequired',not p_instructor and cfg->>'study_style'<>'materials_only','events',events);
end$$;
revoke all on function academy2_access.public_intake(uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function academy2_access.public_intake(uuid,boolean) to anon,authenticated;
create function public.academy2_public_intake(p_id uuid,p_instructor boolean) returns jsonb language sql stable security invoker set search_path='' as $$select academy2_access.public_intake(p_id,p_instructor)$$;
revoke all on function public.academy2_public_intake(uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function public.academy2_public_intake(uuid,boolean) to anon,authenticated;

-- A legacy endpoint cannot silently create a V2 instructor application without consent.
create function academy2_access.guard_instructor_intake() returns trigger language plpgsql security definer set search_path='' as $$begin
 if exists(select 1 from academy2_access.opening_license_sources where offering_id=new.offering_id)
 and not exists(select 1 from academy2_access.opening_license_intake_permits where application_id=new.id and learner_user_id=auth.uid() and learner_user_id=new.learner_user_id and transaction_id=txid_current())
 then raise exception 'academy2_dedicated_application_required' using errcode='42501';end if;
 return new;
end$$;
revoke all on function academy2_access.guard_instructor_intake() from public,anon,authenticated,service_role;
create trigger academy2_instructor_intake_guard before insert on public.academy_offering_applications for each row execute function academy2_access.guard_instructor_intake();

create function academy2_access.submit_public_intake(p_id uuid,p_instructor boolean,p_request uuid,p_name text,p_terms text,p_agree boolean,p_price numeric,p_class uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ctx jsonb;receipt jsonb;result jsonb;o public.academy_offerings;p public.academy_instructor_offering_pages;
 s academy2_access.opening_license_sources;a public.academy_offering_applications;activity uuid;email text;new_id uuid:=gen_random_uuid();
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'academy2_sign_in_required' using errcode='42501';end if;
 select u.email into email from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null;
 if email is null or p_request is null or p_instructor is null or p_agree is distinct from true or nullif(btrim(p_name),'') is null or length(p_name)>200 then raise exception 'academy2_application_incomplete' using errcode='22023';end if;
 if not p_instructor then
  result:=academy2_access.submit_operation(p_id,p_request,p_name,p_terms,p_agree,p_price,p_class);
  select * into a from public.academy_offering_applications where id=(result->>'id')::uuid and learner_user_id=auth.uid();
 else
  select * into p from public.academy_instructor_offering_pages where id=p_id for share;
  if p.id is null or p_class is not null then raise exception 'academy2_source_unavailable' using errcode='42501';end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p.offering_id::text,0));
  select * into a from public.academy_offering_applications where learner_user_id=auth.uid() and request_token=p_request;
  if found then
   if a.offering_id<>p.offering_id or a.applicant_name<>btrim(p_name) or a.price is distinct from p_price
    or not exists(select 1 from academy2_access.instructor_intake_consents where application_id=a.id and page_id=p_id and version=p_terms and consented_by=auth.uid())
   then raise exception 'academy2_request_conflict' using errcode='PT409';end if;
  else
   select * into o from public.academy_offerings where id=p.offering_id for share;
   select * into s from academy2_access.opening_license_sources where offering_id=o.id;
   ctx:=academy2_access.public_intake(p_id,true);
   if ctx->>'mode' is distinct from 'instructor' or p_price is distinct from o.price or p_terms is distinct from ctx#>>'{terms,version}' then raise exception 'academy2_publication_or_terms_changed' using errcode='PT409';end if;
   if exists(select 1 from public.academy_offering_applications where learner_user_id=auth.uid() and offering_id=o.id) then raise exception 'academy2_existing_application_preserved' using errcode='PT409';end if;
   select ac.id into activity from academy2_access.instructor_activities ac
    join public.academy_instructors i on i.id=ac.instructor_id and i.user_id=ac.user_id and i.headquarters_id=ac.headquarters_id
    join academy2_access.instructor_contracts c on c.activity_id=ac.id and c.accepted_by=ac.user_id
    join academy2_access.instructor_license_grants g on g.contract_id=c.id and g.activity_id=ac.id
    where ac.headquarters_id=s.headquarters_id and ac.sales_plan_id=s.plan_id and ac.user_id=p.owner_user_id and ac.status='active'
    and c.status='active' and c.accepted_at<=now() and c.starts_at<=now() and c.ends_at>now()
    and g.status='active' and g.starts_at<=now() and g.ends_at>now()
    order by ac.id,c.id,g.id limit 1 for share of ac,c,g,i;
   if activity is null then raise exception 'academy2_source_unavailable' using errcode='42501';end if;
   perform academy2_access.prepare_opening_origin(new_id,activity,s.plan_revision);
   insert into public.academy_offering_applications(id,offering_id,headquarters_id,learner_user_id,request_token,applicant_name,applicant_email,offering_title,course_ids,course_snapshot,price,currency,payment_method)
   select new_id,o.id,o.headquarters_id,auth.uid(),p_request,btrim(p_name),email,o.title,o.course_ids,r.course_snapshot,o.price,o.currency,'bank'
   from academy2_access.sales_plan_draft_revisions r where r.draft_id=s.plan_id and r.revision=s.plan_revision;
   insert into public.academy_instructor_offering_application_links(application_id,page_id,headquarters_id,owner_user_id,learner_user_id,instructor_snapshot)
   values(new_id,p.id,o.headquarters_id,p.owner_user_id,auth.uid(),jsonb_build_object('page_id',p.id,'owner_user_id',p.owner_user_id,'profile',p.profile));
   result:=academy2_access.register_opening_origin(new_id,activity,s.plan_revision);
   if result->>'outcome' is distinct from 'registered' then raise exception 'academy2_source_unavailable' using errcode='42501';end if;
   insert into academy2_access.instructor_intake_consents(application_id,page_id,version,body,consented_by) values(new_id,p.id,p_terms,ctx#>>'{terms,body}',auth.uid());
   insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(o.headquarters_id,auth.uid(),'application.submit',new_id);
   select * into a from public.academy_offering_applications where id=new_id;
  end if;
 end if;
 return jsonb_build_object('id',a.id,'price',a.price,'status',a.status,'headquarters_id',a.headquarters_id,'offering_title',a.offering_title);
end$$;
revoke all on function academy2_access.submit_public_intake(uuid,boolean,uuid,text,text,boolean,numeric,uuid) from public,anon,authenticated,service_role;
grant execute on function academy2_access.submit_public_intake(uuid,boolean,uuid,text,text,boolean,numeric,uuid) to authenticated;
create function public.academy2_submit_public_intake(p_id uuid,p_instructor boolean,p_request uuid,p_name text,p_terms text,p_agree boolean,p_price numeric,p_class uuid default null) returns jsonb language sql security invoker set search_path='' as $$select academy2_access.submit_public_intake(p_id,p_instructor,p_request,p_name,p_terms,p_agree,p_price,p_class)$$;
revoke all on function public.academy2_submit_public_intake(uuid,boolean,uuid,text,text,boolean,numeric,uuid) from public,anon,authenticated,service_role;
grant execute on function public.academy2_submit_public_intake(uuid,boolean,uuid,text,text,boolean,numeric,uuid) to authenticated;
notify pgrst,'reload schema';
