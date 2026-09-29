-- Production candidate; review and isolated validation required before approval.
-- LOCAL CANDIDATE. Apply after conditional_intake, event_kit, teacher_material_delivery.
-- Resolve only the immutable saved revision's all-course snapshot. Never re-query eligibility.
-- No payment, staged purchase, recurring, rights or tenant guard is removed.
create or replace function academy2_access.resolved_plan_configuration(p_configuration jsonb,p_snapshot jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare ids jsonb;
begin
 if p_configuration->>'kind' is distinct from '全講座' then return p_configuration;end if;
 if jsonb_typeof(p_snapshot) is distinct from 'array' then raise exception 'academy2_invalid_course_snapshot' using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements(p_snapshot) item where jsonb_typeof(item->'course_id') is distinct from 'string') then raise exception 'academy2_invalid_course_snapshot' using errcode='22023';end if;
 select coalesce(jsonb_agg((item->>'course_id')::uuid order by ord),'[]'::jsonb) into ids from jsonb_array_elements(p_snapshot) with ordinality a(item,ord);
 if jsonb_array_length(ids)<>(select count(distinct value) from jsonb_array_elements_text(ids)) then raise exception 'academy2_duplicate_course_snapshot' using errcode='22023';end if;
 return p_configuration||jsonb_build_object('course_ids',ids);
end$$;
revoke all on function academy2_access.resolved_plan_configuration(jsonb,jsonb) from public,anon,authenticated,service_role;

-- The mutable draft row has no snapshot column. Always obtain both values from its revision.
create or replace function academy2_access.resolved_saved_plan_configuration(p_plan uuid,p_revision integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare saved academy2_access.sales_plan_draft_revisions;
begin
 select * into strict saved from academy2_access.sales_plan_draft_revisions where draft_id=p_plan and revision=p_revision;
 return academy2_access.resolved_plan_configuration(saved.configuration,saved.course_snapshot);
end$$;
revoke all on function academy2_access.resolved_saved_plan_configuration(uuid,integer) from public,anon,authenticated,service_role;

do $patch$
declare definition text; original text; name text; routine regprocedure; old_text text; new_text text;
begin
 -- A strict recognizable replacement fails closed on unexpected installed definitions.
 for name,old_text,new_text in select * from (values
 ('plan_publication_readiness','conf:=d.configuration;','conf:=academy2_access.resolved_saved_plan_configuration(d.id,d.revision);'),
 ('publish_existing_plan',$old$d.configuration->'course_ids'$old$,$new$academy2_access.resolved_saved_plan_configuration(d.id,d.revision)->'course_ids'$new$),
 ('sales_page',$old$d.configuration->'course_ids'$old$,$new$academy2_access.resolved_saved_plan_configuration(d.id,d.revision)->'course_ids'$new$),
 ('save_sales_page',$old$d.configuration->'course_ids'$old$,$new$academy2_access.resolved_saved_plan_configuration(d.id,d.revision)->'course_ids'$new$),
 ('bind_operation_source',$old$r.configuration->'course_ids'$old$,$new$academy2_access.resolved_plan_configuration(r.configuration,r.course_snapshot)->'course_ids'$new$),
 ('submit_operation',$old$r.configuration->'course_ids'$old$,$new$academy2_access.resolved_plan_configuration(r.configuration,r.course_snapshot)->'course_ids'$new$),
 ('write_event',$old$r.configuration->'course_ids'$old$,$new$academy2_access.resolved_plan_configuration(r.configuration,r.course_snapshot)->'course_ids'$new$),
 ('event_registration',$old$r.configuration->'course_ids'$old$,$new$academy2_access.resolved_plan_configuration(r.configuration,r.course_snapshot)->'course_ids'$new$),
 ('public_intake','select configuration into cfg from academy2_access.sales_plan_draft_revisions','select academy2_access.resolved_plan_configuration(configuration,course_snapshot) into cfg from academy2_access.sales_plan_draft_revisions'),
 ('freeze_plan_materials','select r.configuration into conf from','select academy2_access.resolved_plan_configuration(r.configuration,r.course_snapshot) into conf from')
 ) changes(function_name,old_value,new_value) loop
  select p.oid::regprocedure into strict routine from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='academy2_access' and p.proname=name;
  definition:=pg_get_functiondef(routine);original:=definition;
  -- Correct the already-applied initial candidate as well as supporting a clean installation.
  definition:=replace(definition,'academy2_access.resolved_plan_configuration(d.configuration,d.course_snapshot)','academy2_access.resolved_saved_plan_configuration(d.id,d.revision)');
  if position(new_text in definition)=0 then
   if position(old_text in definition)=0 then raise exception 'academy2_unrecognized_all_course_contract: %',name;end if;
   definition:=replace(definition,old_text,new_text);
  end if;
  if name='plan_publication_readiness' then
   old_text:=$old$conf->>'kind' not in('ワークショップ','単品講座','コース')$old$;
   new_text:=$new$conf->>'kind' not in('ワークショップ','単品講座','コース','全講座')$new$;
   if position(new_text in definition)=0 then
    if position(old_text in definition)=0 then raise exception 'academy2_unrecognized_all_course_kind';end if;
    definition:=replace(definition,old_text,new_text);
   end if;
  elsif name='bind_operation_source' then
   old_text:='academy2_access.material_publication_ready(p_hq,r.configuration)';
   new_text:='academy2_access.material_publication_ready(p_hq,academy2_access.resolved_plan_configuration(r.configuration,r.course_snapshot))';
   if position(new_text in definition)=0 then
    if position(old_text in definition)=0 then raise exception 'academy2_unrecognized_all_course_material_binding';end if;
    definition:=replace(definition,old_text,new_text);
   end if;
  end if;
  if definition<>original then execute definition;end if;
 end loop;
end$patch$;
notify pgrst,'reload schema';
