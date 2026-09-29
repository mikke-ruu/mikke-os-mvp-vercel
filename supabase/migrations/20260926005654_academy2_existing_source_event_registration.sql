-- Existing published source only. No publication, contract, trial or payment side effects.
create function academy2_access.event_registration(p_hq uuid,p_event uuid,p_expected integer,p_request uuid,p_status text,p_offering uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ep academy2_access.event_plans;c public.academy_classes;s academy2_access.operation_sources;r academy2_access.sales_plan_draft_revisions;cmd academy2_access.event_commands;input jsonb:=jsonb_build_object('registration_status',p_status,'offering_id',p_offering);
begin
 if not academy2_access.can(p_hq,'applications.operate') or not academy2_access.can(p_hq,'public_price.edit') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if p_request is null or p_expected is null or (p_status in('open','closed')) is distinct from true then raise exception 'academy2_invalid_registration' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,12));
 select * into cmd from academy2_access.event_commands where request_id=p_request;
 if found then
  if cmd.headquarters_id<>p_hq or cmd.class_id<>p_event or cmd.actor_id<>auth.uid() or cmd.expected_revision<>p_expected or cmd.action<>'registration' or cmd.input<>input then raise exception 'academy2_request_conflict' using errcode='PT409';end if;
  return academy2_access.events(p_hq,p_event);
 end if;
 select * into ep from academy2_access.event_plans where class_id=p_event and headquarters_id=p_hq for update;
 if not found then raise exception 'academy2_event_unavailable' using errcode='42501';end if;
 if ep.revision<>p_expected then raise exception 'academy2_revision_conflict' using errcode='PT409';end if;
 select * into c from public.academy_classes where id=p_event and headquarters_id=p_hq for update;
 if c.status not in('planned','active') then raise exception 'academy2_event_closed_for_editing' using errcode='22023';end if;
 if p_status='open' then
  select * into s from academy2_access.operation_sources where offering_id=p_offering and headquarters_id=p_hq;
  if s.offering_id is null or s.plan_id<>ep.plan_id or s.plan_revision<>ep.plan_revision then raise exception 'academy2_event_source_mismatch' using errcode='42501';end if;
  perform academy2_access.bind_operation_source(p_hq,p_offering,ep.plan_id,ep.plan_revision);
  if public.academy_is_publicly_available(p_hq) is distinct from true or not exists(select 1 from public.academy_courses where id=c.course_id and headquarters_id=p_hq and is_published) then raise exception 'academy2_public_source_unavailable' using errcode='PT409';end if;
  select * into r from academy2_access.sales_plan_draft_revisions where draft_id=ep.plan_id and revision=ep.plan_revision;
  if ((r.configuration->'course_ids')?c.course_id::text) is distinct from true or ((r.configuration->'allowed_methods')?c.format) is distinct from true or (c.schedule_mode='fixed' and c.starts_at is null) then raise exception 'academy2_event_not_ready' using errcode='22023';end if;
 end if;
 insert into academy2_access.event_commands(request_id,headquarters_id,class_id,actor_id,action,expected_revision,input,transaction_id) values(p_request,p_hq,p_event,auth.uid(),'registration',p_expected,input,txid_current());
 update public.academy_classes set registration_status=p_status where id=p_event;
 update academy2_access.event_plans set revision=revision+1 where class_id=p_event;
 update academy2_access.event_commands set transaction_id=null where request_id=p_request;
 insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(p_hq,auth.uid(),'event.registration.'||p_status,p_event);
 return academy2_access.events(p_hq,p_event);
end $$;
revoke all on function academy2_access.event_registration(uuid,uuid,integer,uuid,text,uuid) from public,anon,authenticated,service_role;
grant execute on function academy2_access.event_registration(uuid,uuid,integer,uuid,text,uuid) to authenticated;
create function public.academy2_event_registration(p_headquarters_id uuid,p_event_id uuid,p_expected_revision integer,p_request_id uuid,p_registration_status text,p_offering_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$select academy2_access.event_registration(p_headquarters_id,p_event_id,p_expected_revision,p_request_id,p_registration_status,p_offering_id)$$;
revoke all on function public.academy2_event_registration(uuid,uuid,integer,uuid,text,uuid) from public,anon,service_role;
grant execute on function public.academy2_event_registration(uuid,uuid,integer,uuid,text,uuid) to authenticated;
notify pgrst,'reload schema';
