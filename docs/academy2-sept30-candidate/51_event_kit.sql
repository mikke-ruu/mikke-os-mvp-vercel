-- Production candidate; review and isolated validation required before approval.
-- LOCAL CANDIDATE ONLY. Requires academy2_conditional_intake.sql kit_method column.
-- Existing update_unpublished_event wrapper remains intact. Existing request input/revision checks retained.
create or replace function academy2_access.write_event(p_hq uuid,p_event uuid,p_expected integer,p_request uuid,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cmd academy2_access.event_commands;ep academy2_access.event_plans;r academy2_access.sales_plan_draft_revisions;c public.academy_classes;event_id uuid:=coalesce(p_event,gen_random_uuid());key text;creating boolean:=p_event is null;mode text;method text;starts timestamptz;ends timestamptz;cap integer; kit_value text; kit_options text[]; old_kit text;
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
  if not key=any(array['plan_id','plan_revision','course_id','title','schedule_mode','starts_at','ends_at','format','capacity','venue_name','meeting_url','kit_method']) then raise exception 'academy2_invalid_event_field' using errcode='22023';end if;
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
 -- The kit method is the learner receipt method, independent of the kit recipient.
 if coalesce((r.configuration#>>'{kit,enabled}')::boolean,false) then
  select coalesce(array_agg(value),'{}'::text[]) into kit_options from jsonb_array_elements_text(coalesce(r.configuration#>'{kit,methods}','[]'::jsonb)) m(value) where value in('shipping','venue_handover') and (method<>'online' or value='shipping');
  kit_value:=case when p_input?'kit_method' then p_input->>'kit_method' else ep.kit_method end;
  if p_input->>'kit_method' is not null and not (p_input->>'kit_method')=any(kit_options) then raise exception 'academy2_invalid_kit_method' using errcode='22023';end if;
  if cardinality(kit_options)=1 then kit_value:=kit_options[1];end if;
  if kit_value is null or not kit_value=any(kit_options) then raise exception 'academy2_invalid_kit_method' using errcode='22023';end if;
 else kit_value:=null;
 end if;
 old_kit:=ep.kit_method;
 if old_kit is null and cardinality(kit_options)=1 then old_kit:=kit_options[1];end if;
 if not creating and kit_value is distinct from old_kit and (c.registration_status='open' or exists(select 1 from academy2_access.event_attendees(p_hq,p_event))) then raise exception 'academy2_kit_method_locked' using errcode='22023';end if;
 if not creating and cap is not null and cap<(select count(*) from academy2_access.event_attendees(p_hq,p_event)) then raise exception 'academy2_capacity_below_attendees' using errcode='22023';end if;
 insert into academy2_access.event_commands(request_id,headquarters_id,class_id,actor_id,action,expected_revision,input,transaction_id) values(p_request,p_hq,event_id,auth.uid(),case when creating then 'create' else 'update' end,p_expected,p_input,txid_current());
 if creating then
  insert into academy2_access.event_plans(class_id,headquarters_id,plan_id,plan_revision,kit_method) values(event_id,p_hq,ep.plan_id,ep.plan_revision,kit_value);
  insert into public.academy_classes(id,headquarters_id,course_id,title,starts_at,ends_at,format,capacity,venue_name,meeting_url,schedule_mode,registration_status,status,created_by_user_id,material_mode)
  values(event_id,p_hq,c.course_id,btrim(p_input->>'title'),starts,ends,method,cap,case when method='in_person' then nullif(p_input->>'venue_name','') else null end,case when method='online' then nullif(p_input->>'meeting_url','') else null end,mode,'closed','planned',auth.uid(),'course_current');
 else
  update public.academy_classes set title=btrim(p_input->>'title'),starts_at=starts,ends_at=ends,format=method,capacity=cap,venue_name=case when method='in_person' then nullif(p_input->>'venue_name','') else null end,meeting_url=case when method='online' then nullif(p_input->>'meeting_url','') else null end,schedule_mode=mode where id=event_id;
  update academy2_access.event_plans set revision=revision+1,kit_method=kit_value where class_id=event_id;
 end if;
 update academy2_access.event_commands set transaction_id=null where request_id=p_request;
 insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(p_hq,auth.uid(),case when creating then 'event.create' else 'event.update' end,event_id);
 return academy2_access.events(p_hq,event_id);
end $$;
-- Candidate only: additive read projection for event editing. No data writes.
-- Requires the validated Academy 2.0 operational/event migrations.
create or replace function academy2_access.event_detail(p_hq uuid,p_event uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; details jsonb;
begin
 -- Reuse the authoritative HQ membership gate and unavailable-event handling.
 result:=academy2_access.events(p_hq,p_event);
 select jsonb_build_object('course_id',c.course_id,'plan_revision',ep.plan_revision,
   'venue_name',c.venue_name,'meeting_url',c.meeting_url,'kit_method',ep.kit_method,'kit_settings',jsonb_build_object('enabled',coalesce(r.configuration#>'{kit,enabled}','false'::jsonb),'name',r.configuration#>'{kit,name}','methods',coalesce(r.configuration#>'{kit,methods}','[]'::jsonb),'recipient',r.configuration#>'{kit,recipient}'),'allowed_methods',r.configuration->'allowed_methods')
 into details from public.academy_classes c
 left join academy2_access.event_plans ep on ep.class_id=c.id and ep.headquarters_id=c.headquarters_id
 left join academy2_access.sales_plan_draft_revisions r on r.draft_id=ep.plan_id and r.revision=ep.plan_revision
 where c.id=p_event and c.headquarters_id=p_hq;
 return result||details;
end $$;
revoke all on function academy2_access.event_detail(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function academy2_access.event_detail(uuid,uuid) to authenticated;
create or replace function public.academy2_event(p_headquarters_id uuid,p_event_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select academy2_access.event_detail(p_headquarters_id,p_event_id)$$;
revoke all on function public.academy2_event(uuid,uuid) from public,anon,service_role;
grant execute on function public.academy2_event(uuid,uuid) to authenticated;
notify pgrst,'reload schema';

-- Scheduling staff need plan choices, not the financial draft configuration.
create or replace function academy2_access.event_plan_choices(p_hq uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not academy2_access.can(p_hq,'applications.operate') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'revision',d.revision,
  'configuration',jsonb_build_object('title',r.configuration->'title','study_style',r.configuration->'study_style','allowed_methods',r.configuration->'allowed_methods','kit',jsonb_build_object('enabled',coalesce(r.configuration#>'{kit,enabled}','false'::jsonb),'name',r.configuration#>'{kit,name}','methods',coalesce(r.configuration#>'{kit,methods}','[]'::jsonb),'recipient',r.configuration#>'{kit,recipient}')),
  'course_snapshot',(select coalesce(jsonb_agg(jsonb_build_object('course_id',course->'course_id','title',course->'title')),'[]'::jsonb) from jsonb_array_elements(r.course_snapshot) course)) order by d.updated_at desc,d.id),'[]'::jsonb) into result
 from academy2_access.sales_plan_drafts d join academy2_access.sales_plan_draft_revisions r on r.draft_id=d.id and r.revision=d.revision
 where d.headquarters_id=p_hq and r.configuration->>'study_style'='instructor';
 return result;
end $$;
revoke all on function academy2_access.event_plan_choices(uuid) from public,anon,authenticated,service_role;
grant execute on function academy2_access.event_plan_choices(uuid) to authenticated;
create or replace function public.academy2_event_plan_choices(p_headquarters_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select academy2_access.event_plan_choices(p_headquarters_id)$$;
revoke all on function public.academy2_event_plan_choices(uuid) from public,anon,service_role;
grant execute on function public.academy2_event_plan_choices(uuid) to authenticated;
