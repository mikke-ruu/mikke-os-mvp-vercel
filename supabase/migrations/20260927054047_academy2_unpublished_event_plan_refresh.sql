-- Explicit save only; preserve published/used plan snapshots and all old rows.
create function academy2_access.update_unpublished_event(p_hq uuid,p_event uuid,p_expected integer,p_request uuid,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ep academy2_access.event_plans;c public.academy_classes;latest integer;result jsonb;
begin
 if not academy2_access.can(p_hq,'applications.operate') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if p_request is null then raise exception 'academy2_invalid_event' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,12));
 if exists(select 1 from academy2_access.event_commands where request_id=p_request) then
  return academy2_access.write_event(p_hq,p_event,p_expected,p_request,p_input);
 end if;
 select * into ep from academy2_access.event_plans where class_id=p_event and headquarters_id=p_hq for update;
 if not found then raise exception 'academy2_event_unavailable' using errcode='42501';end if;
 if ep.revision is distinct from p_expected then raise exception 'academy2_revision_conflict' using errcode='PT409';end if;
 select revision into latest from academy2_access.sales_plan_drafts where id=ep.plan_id and headquarters_id=p_hq for share;
 select * into c from public.academy_classes where id=p_event and headquarters_id=p_hq for update;
 if latest is distinct from ep.plan_revision then
  if c.status is distinct from 'planned' or c.registration_status is distinct from 'closed'
   or exists(select 1 from academy2_access.plan_publications where event_id=p_event)
   or exists(select 1 from academy2_access.operation_enrollments where class_id=p_event)
   or exists(select 1 from academy2_access.event_attendees(p_hq,p_event))
   or exists(select 1 from public.academy_class_instructor_requests where class_id=p_event)
  then raise exception 'academy2_used_event_plan_revision_locked' using errcode='PT409';end if;
  update academy2_access.event_plans set plan_revision=latest where class_id=p_event;
  insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id)
   values(p_hq,auth.uid(),'event.plan_revision.refresh',p_event);
 end if;
 -- Existing command revalidates selected course, allowed method, dates and input;
 -- any failure rolls back the refresh with the entire save.
 result:=academy2_access.write_event(p_hq,p_event,p_expected,p_request,p_input);
 return result;
end $$;
revoke all on function academy2_access.update_unpublished_event(uuid,uuid,integer,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function academy2_access.update_unpublished_event(uuid,uuid,integer,uuid,jsonb) to authenticated;
create or replace function public.academy2_update_event(p_headquarters_id uuid,p_event_id uuid,p_expected_revision integer,p_request_id uuid,p_input jsonb) returns jsonb language sql security invoker set search_path='' as $$select academy2_access.update_unpublished_event(p_headquarters_id,p_event_id,p_expected_revision,p_request_id,p_input)$$;
notify pgrst,'reload schema';
