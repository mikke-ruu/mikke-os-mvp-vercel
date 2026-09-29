-- Requires the existing course_current material-mode migration. Never starts a trial.
alter table academy2_access.event_plans alter constraint event_plans_class_id_fkey deferrable initially deferred;
create table academy2_access.event_commands (
 request_id uuid primary key,headquarters_id uuid not null references academy2_access.tenants(headquarters_id),
 class_id uuid not null references public.academy_classes(id) on delete restrict deferrable initially deferred,
 actor_id uuid not null references auth.users(id),action text not null,expected_revision integer not null,
 input jsonb not null,transaction_id bigint,created_at timestamptz not null default now()
);
alter table academy2_access.event_commands enable row level security;
revoke all on academy2_access.event_commands from public,anon,authenticated,service_role;
create function academy2_access.has_event_permit(p_hq uuid,p_class uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select academy2_access.can(p_hq,'applications.operate') and exists(select 1 from academy2_access.event_commands where headquarters_id=p_hq and class_id=p_class and actor_id=auth.uid() and transaction_id=txid_current())
$$;
revoke all on function academy2_access.has_event_permit(uuid,uuid) from public,anon,authenticated,service_role;
do $migration$
declare definition text;marker text:=E'\nbegin\n';addition text;
begin
 definition:=replace(pg_get_functiondef('private.academy_guard_trial_live_operation()'::regprocedure),E'\r\n',E'\n');
 if position(marker in definition)=0 or position('academy_headquarters_access_mode' in definition)=0 then raise exception 'academy2_unrecognized_live_guard';end if;
 addition:=$branch$
 if tg_table_schema='public' and tg_table_name='academy_classes' and tg_op in('INSERT','UPDATE') then
  if academy2_access.has_event_permit(new.headquarters_id,new.id) then
   if tg_op='INSERT' and new.registration_status='closed' and new.status='planned' and new.instructor_id is null and new.material_mode='course_current' then return new;end if;
   if tg_op='UPDATE' and (to_jsonb(new)-array['title','starts_at','ends_at','format','capacity','venue_name','meeting_url','schedule_mode','registration_status','updated_at'])=(to_jsonb(old)-array['title','starts_at','ends_at','format','capacity','venue_name','meeting_url','schedule_mode','registration_status','updated_at']) then return new;end if;
  end if;
 end if;
$branch$;
 execute overlay(definition placing marker||addition from position(marker in definition) for length(marker));
end $migration$;
-- Prevent a legacy direct-table manager from bypassing the scoped command.
create policy academy2_classes_legacy_only on public.academy_classes as restrictive for all to authenticated
 using(academy2_access.legacy_allowed(headquarters_id)) with check(academy2_access.legacy_allowed(headquarters_id));

create function academy2_access.write_event(p_hq uuid,p_event uuid,p_expected integer,p_request uuid,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cmd academy2_access.event_commands;ep academy2_access.event_plans;r academy2_access.sales_plan_draft_revisions;c public.academy_classes;event_id uuid:=coalesce(p_event,gen_random_uuid());key text;creating boolean:=p_event is null;mode text;method text;starts timestamptz;ends timestamptz;cap integer;
begin
 if not academy2_access.can(p_hq,'applications.operate') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if p_request is null or p_expected is null or p_input is null or jsonb_typeof(p_input)<>'object' then raise exception 'academy2_invalid_event' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,12));
 select * into cmd from academy2_access.event_commands where request_id=p_request;
 if found then
  if cmd.headquarters_id<>p_hq or cmd.actor_id<>auth.uid() or cmd.expected_revision<>p_expected or cmd.input<>p_input or cmd.action<>(case when creating then 'create' else 'update' end) or (not creating and cmd.class_id<>p_event) then raise exception 'academy2_request_conflict' using errcode='PT409';end if;
  return academy2_access.events(p_hq,cmd.class_id);
 end if;
 for key in select jsonb_object_keys(p_input) loop
  if not key=any(array['plan_id','plan_revision','course_id','title','schedule_mode','starts_at','ends_at','format','capacity','venue_name','meeting_url']) then raise exception 'academy2_invalid_event_field' using errcode='22023';end if;
  if (key in('capacity','plan_revision') and jsonb_typeof(p_input->key) not in('number','null')) or (key not in('capacity','plan_revision') and jsonb_typeof(p_input->key) not in('string','null')) then raise exception 'academy2_invalid_event_field_type' using errcode='22023';end if;
 end loop;
 if not creating then
  select * into ep from academy2_access.event_plans where class_id=p_event and headquarters_id=p_hq for update;
  if not found then raise exception 'academy2_event_unavailable' using errcode='42501';end if;
  if ep.revision<>p_expected then raise exception 'academy2_revision_conflict' using errcode='PT409';end if;
  if p_input?'plan_id' or p_input?'plan_revision' or p_input?'course_id' then raise exception 'academy2_event_identity_immutable' using errcode='22023';end if;
  select * into c from public.academy_classes where id=p_event and headquarters_id=p_hq for update;
  if c.status not in('planned','active') then raise exception 'academy2_event_closed_for_editing' using errcode='22023';end if;
 else
  if p_expected<>0 then raise exception 'academy2_revision_conflict' using errcode='PT409';end if;
  ep.plan_id:=(p_input->>'plan_id')::uuid;ep.plan_revision:=(p_input->>'plan_revision')::integer;
  c.course_id:=(p_input->>'course_id')::uuid;
 end if;
 select rev.* into r from academy2_access.sales_plan_draft_revisions rev join academy2_access.sales_plan_drafts d on d.id=rev.draft_id and d.headquarters_id=p_hq where rev.draft_id=ep.plan_id and rev.revision=ep.plan_revision;
 if r.draft_id is null or not exists(select 1 from public.academy_courses where id=c.course_id and headquarters_id=p_hq) or ((r.configuration->'course_ids')?c.course_id::text) is distinct from true then raise exception 'academy2_event_plan_scope' using errcode='42501';end if;
 mode:=p_input->>'schedule_mode';method:=p_input->>'format';starts:=nullif(p_input->>'starts_at','')::timestamptz;ends:=nullif(p_input->>'ends_at','')::timestamptz;cap:=(p_input->>'capacity')::integer;
 if (starts is not null and not isfinite(starts)) or (ends is not null and not isfinite(ends)) or length(coalesce(p_input->>'meeting_url',''))>2048 or coalesce(p_input->>'meeting_url','')~'[[:space:][:cntrl:]]' then raise exception 'academy2_invalid_event' using errcode='22023';end if;
 if nullif(btrim(p_input->>'title'),'') is null or length(p_input->>'title')>300 or (mode in('fixed','arranged_after_application')) is distinct from true or (method in('online','in_person')) is distinct from true or ((r.configuration->'allowed_methods')?method) is distinct from true or r.configuration->>'study_style' is distinct from 'instructor' or (mode='fixed' and starts is null) or (ends is not null and (starts is null or ends<=starts)) or (cap is not null and cap<1) or (nullif(p_input->>'meeting_url','') is not null and (p_input->>'meeting_url')!~'^https://') then raise exception 'academy2_invalid_event' using errcode='22023';end if;
 if not creating and cap is not null and cap<(select count(*) from academy2_access.event_attendees(p_hq,p_event)) then raise exception 'academy2_capacity_below_attendees' using errcode='22023';end if;
 insert into academy2_access.event_commands(request_id,headquarters_id,class_id,actor_id,action,expected_revision,input,transaction_id) values(p_request,p_hq,event_id,auth.uid(),case when creating then 'create' else 'update' end,p_expected,p_input,txid_current());
 if creating then
  insert into academy2_access.event_plans(class_id,headquarters_id,plan_id,plan_revision) values(event_id,p_hq,ep.plan_id,ep.plan_revision);
  insert into public.academy_classes(id,headquarters_id,course_id,title,starts_at,ends_at,format,capacity,venue_name,meeting_url,schedule_mode,registration_status,status,created_by_user_id,material_mode)
  values(event_id,p_hq,c.course_id,btrim(p_input->>'title'),starts,ends,method,cap,case when method='in_person' then nullif(p_input->>'venue_name','') else null end,case when method='online' then nullif(p_input->>'meeting_url','') else null end,mode,'closed','planned',auth.uid(),'course_current');
 else
  update public.academy_classes set title=btrim(p_input->>'title'),starts_at=starts,ends_at=ends,format=method,capacity=cap,venue_name=case when method='in_person' then nullif(p_input->>'venue_name','') else null end,meeting_url=case when method='online' then nullif(p_input->>'meeting_url','') else null end,schedule_mode=mode where id=event_id;
  update academy2_access.event_plans set revision=revision+1 where class_id=event_id;
 end if;
 update academy2_access.event_commands set transaction_id=null where request_id=p_request;
 insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(p_hq,auth.uid(),case when creating then 'event.create' else 'event.update' end,event_id);
 return academy2_access.events(p_hq,event_id);
end $$;
revoke all on function academy2_access.write_event(uuid,uuid,integer,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function academy2_access.write_event(uuid,uuid,integer,uuid,jsonb) to authenticated;
create function public.academy2_create_event(p_headquarters_id uuid,p_request_id uuid,p_input jsonb) returns jsonb language sql security invoker set search_path='' as $$select academy2_access.write_event(p_headquarters_id,null,0,p_request_id,p_input)$$;
create function public.academy2_update_event(p_headquarters_id uuid,p_event_id uuid,p_expected_revision integer,p_request_id uuid,p_input jsonb) returns jsonb language sql security invoker set search_path='' as $$select academy2_access.write_event(p_headquarters_id,p_event_id,p_expected_revision,p_request_id,p_input)$$;
revoke all on function public.academy2_create_event(uuid,uuid,jsonb),public.academy2_update_event(uuid,uuid,integer,uuid,jsonb) from public,anon,service_role;
grant execute on function public.academy2_create_event(uuid,uuid,jsonb),public.academy2_update_event(uuid,uuid,integer,uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
