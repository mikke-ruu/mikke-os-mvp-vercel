-- Candidate only: additive read projection for event editing. No data writes.
-- Requires the validated Academy 2.0 operational/event migrations.
create function academy2_access.event_detail(p_hq uuid,p_event uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; details jsonb;
begin
 -- Reuse the authoritative HQ membership gate and unavailable-event handling.
 result:=academy2_access.events(p_hq,p_event);
 select jsonb_build_object('course_id',c.course_id,'plan_revision',ep.plan_revision,
   'venue_name',c.venue_name,'meeting_url',c.meeting_url)
 into details from public.academy_classes c
 left join academy2_access.event_plans ep on ep.class_id=c.id and ep.headquarters_id=c.headquarters_id
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
create function academy2_access.event_plan_choices(p_hq uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not academy2_access.can(p_hq,'applications.operate') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'revision',d.revision,
  'configuration',jsonb_build_object('title',r.configuration->'title','study_style',r.configuration->'study_style','allowed_methods',r.configuration->'allowed_methods','kit',jsonb_build_object('enabled',coalesce(r.configuration#>'{kit,enabled}','false'::jsonb))),
  'course_snapshot',(select coalesce(jsonb_agg(jsonb_build_object('course_id',course->'course_id','title',course->'title')),'[]'::jsonb) from jsonb_array_elements(r.course_snapshot) course)) order by d.updated_at desc,d.id),'[]'::jsonb) into result
 from academy2_access.sales_plan_drafts d join academy2_access.sales_plan_draft_revisions r on r.draft_id=d.id and r.revision=d.revision
 where d.headquarters_id=p_hq and r.configuration->>'study_style'='instructor';
 return result;
end $$;
revoke all on function academy2_access.event_plan_choices(uuid) from public,anon,authenticated,service_role;
grant execute on function academy2_access.event_plan_choices(uuid) to authenticated;
create function public.academy2_event_plan_choices(p_headquarters_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select academy2_access.event_plan_choices(p_headquarters_id)$$;
revoke all on function public.academy2_event_plan_choices(uuid) from public,anon,service_role;
grant execute on function public.academy2_event_plan_choices(uuid) to authenticated;
