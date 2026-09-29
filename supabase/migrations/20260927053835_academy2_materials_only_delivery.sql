-- Candidate after 133000, 21008, 213000 and 223000 projection. No legacy material writes.
create table academy2_access.plan_material_publications (
 plan_id uuid not null,plan_revision integer not null,headquarters_id uuid not null,
 course_id uuid not null,material_revision integer not null,course_name text not null,
 blocks jsonb not null,position integer not null,created_at timestamptz not null default now(),
 primary key(plan_id,plan_revision,course_id),
 foreign key(plan_id,plan_revision) references academy2_access.sales_plan_draft_revisions(draft_id,revision),
 foreign key(course_id,material_revision) references academy2_access.course_material_revisions(course_id,revision)
);
alter table academy2_access.plan_material_publications enable row level security;
revoke all on academy2_access.plan_material_publications from public,anon,authenticated,service_role;
create function academy2_access.material_snapshot_immutable() returns trigger language plpgsql set search_path='' as $$begin raise exception 'academy2_material_snapshot_immutable' using errcode='42501';end$$;
create trigger material_snapshot_immutable before update or delete on academy2_access.plan_material_publications for each row execute function academy2_access.material_snapshot_immutable();
revoke all on function academy2_access.material_snapshot_immutable() from public,anon,authenticated,service_role;

create function academy2_access.material_publication_ready(p_hq uuid,p_conf jsonb) returns boolean
language sql stable security definer set search_path='' as $$
 select p_conf->>'study_style'='materials_only'
 and p_conf#>>'{materials,enabled}'='true'
 and p_conf#>>'{materials,starts}'='from_start'
 and coalesce(p_conf->>'progression','all')='all'
 and jsonb_array_length(p_conf->'course_ids')>0
 and not exists(select 1 from jsonb_array_elements_text(p_conf->'course_ids') x where not exists(
  select 1 from academy2_access.course_material_drafts d join public.academy_courses c on c.id=d.course_id and c.headquarters_id=d.headquarters_id
  join academy2_access.course_material_revisions r on r.course_id=d.course_id and r.revision=d.revision and r.blocks=d.blocks
  where d.course_id=x::uuid and d.headquarters_id=p_hq and jsonb_array_length(d.blocks)>0));
$$;
revoke all on function academy2_access.material_publication_ready(uuid,jsonb) from public,anon,authenticated,service_role;
create function academy2_access.freeze_plan_materials(p_hq uuid,p_plan uuid,p_revision integer) returns void
language plpgsql security definer set search_path='' as $$
declare conf jsonb;x record;d academy2_access.course_material_drafts;
begin
 if not academy2_access.can(p_hq,'applications.operate') or not academy2_access.can(p_hq,'pages.edit') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 select r.configuration into conf from academy2_access.sales_plan_draft_revisions r join academy2_access.sales_plan_drafts p on p.id=r.draft_id where r.draft_id=p_plan and r.revision=p_revision and p.headquarters_id=p_hq;
 if conf->>'study_style' is distinct from 'materials_only' then return;end if;
 -- Republishing page copy must not replace already purchased material snapshots.
 if exists(select 1 from academy2_access.plan_material_publications where plan_id=p_plan and plan_revision=p_revision) then return;end if;
 if academy2_access.material_publication_ready(p_hq,conf) is distinct from true then raise exception 'academy2_material_publication_on_hold' using errcode='22023';end if;
 for x in select value::uuid id,ord from jsonb_array_elements_text(conf->'course_ids') with ordinality a(value,ord) loop
  perform pg_advisory_xact_lock(hashtextextended('course-materials:'||x.id::text,0));
  select * into d from academy2_access.course_material_drafts where course_id=x.id and headquarters_id=p_hq for share;
  if d.course_id is null or jsonb_array_length(d.blocks)=0 then raise exception 'academy2_material_publication_on_hold' using errcode='22023';end if;
  insert into academy2_access.plan_material_publications(plan_id,plan_revision,headquarters_id,course_id,material_revision,course_name,blocks,position)
  select p_plan,p_revision,p_hq,d.course_id,d.revision,c.name,d.blocks,x.ord from public.academy_courses c where c.id=d.course_id and c.headquarters_id=p_hq;
 end loop;
end$$;
revoke all on function academy2_access.freeze_plan_materials(uuid,uuid,integer) from public,anon,authenticated,service_role;

create function academy2_access.learner_materials(p_application uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare a public.academy_offering_applications;e academy2_access.operation_enrollments;result jsonb;
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'academy2_forbidden' using errcode='42501';end if;
 select * into a from public.academy_offering_applications where id=p_application and learner_user_id=auth.uid() and status='paid' and paid_at is not null;
 select * into e from academy2_access.operation_enrollments where application_id=a.id and headquarters_id=a.headquarters_id;
 if a.id is null or e.application_id is null or not exists(select 1 from academy2_access.tenants where headquarters_id=e.headquarters_id and runtime_enabled) then raise exception 'academy2_material_unavailable' using errcode='42501';end if;
 select jsonb_agg(jsonb_build_object('courseId',m.course_id,'courseName',m.course_name,'materialRevision',m.material_revision,'blocks',m.blocks) order by m.position) into result from academy2_access.plan_material_publications m where m.plan_id=e.plan_id and m.plan_revision=e.plan_revision and m.headquarters_id=e.headquarters_id;
 if result is null then raise exception 'academy2_material_unavailable' using errcode='42501';end if;
 return jsonb_build_object('applicationId',a.id,'planName',a.offering_title,'courses',result);
end$$;
revoke all on function academy2_access.learner_materials(uuid) from public,anon,authenticated,service_role;
grant execute on function academy2_access.learner_materials(uuid) to authenticated;
create function public.academy2_my_materials(p_application_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$select academy2_access.learner_materials(p_application_id)$$;
revoke all on function public.academy2_my_materials(uuid) from public,anon,service_role;
grant execute on function public.academy2_my_materials(uuid) to authenticated;

alter table academy2_access.plan_publications alter column event_id drop not null;
do $patch$
declare d text;old_text text;new_text text;
begin
 d:=pg_get_functiondef('academy2_access.plan_publication_readiness(uuid,uuid,integer,integer,uuid,integer)'::regprocedure);
 old_text:=$old$if conf->>'study_style' is distinct from 'instructor' or coalesce((conf#>>'{materials,enabled}')::boolean,false) then$old$;
 new_text:=$new$if ((conf->>'study_style'='instructor' and not coalesce((conf#>>'{materials,enabled}')::boolean,false)) or academy2_access.material_publication_ready(p_hq,conf)) is distinct from true then$new$;
 if position(old_text in d)=0 then raise exception 'unrecognized_material_readiness';end if;d:=replace(d,old_text,new_text);
 old_text:=$old$if jsonb_array_length(coalesce(conf->'allowed_methods','[]'))=0 or exists$old$;
 if position(old_text in d)=0 then raise exception 'unrecognized_method_readiness';end if;
 d:=replace(d,old_text,$new$if conf->>'study_style'<>'materials_only' and (jsonb_array_length(coalesce(conf->'allowed_methods','[]'))=0 or exists$new$);
 d:=replace(d,$old$x not in('in_person','online')) then$old$,$new$x not in('in_person','online'))) then$new$);
 old_text:='select * into ep from academy2_access.event_plans where class_id=p_event and headquarters_id=p_hq;';
 if position(old_text in d)=0 then raise exception 'unrecognized_event_readiness';end if;
 d:=replace(d,old_text,'if conf->>''study_style''<>''materials_only'' then '||old_text);
 d:=replace(d,'select * into pub from academy2_access.plan_publications where plan_id=p_plan;','elsif p_event is not null then reasons:=reasons||''"materials_event_not_needed"''::jsonb;end if; select * into pub from academy2_access.plan_publications where plan_id=p_plan;');
 d:=replace(d,'pub.event_id<>p_event','pub.event_id is distinct from p_event');execute d;

 d:=pg_get_functiondef('academy2_access.bind_operation_source(uuid,uuid,uuid,integer)'::regprocedure);
 old_text:=$old$or coalesce((r.configuration#>>'{materials,enabled}')::boolean,false)
  or r.configuration->>'study_style' is distinct from 'instructor'$old$;
 if position(old_text in d)=0 then raise exception 'unrecognized_material_source';end if;
 execute replace(d,old_text,$new$or ((r.configuration->>'study_style'='instructor' and not coalesce((r.configuration#>>'{materials,enabled}')::boolean,false)) or academy2_access.material_publication_ready(p_hq,r.configuration)) is distinct from true$new$);

 d:=pg_get_functiondef('academy2_access.publish_existing_plan(uuid,uuid,integer,integer,uuid,integer,uuid)'::regprocedure);
 old_text:='select * into pub from academy2_access.plan_publications where plan_id=p_plan for update;';
 if position(old_text in d)=0 then raise exception 'unrecognized_material_publication';end if;
 d:=replace(d,old_text,'perform academy2_access.freeze_plan_materials(p_hq,p_plan,p_plan_revision);'||old_text);
 old_text:='if exists(select 1 from public.academy_classes where id=p_event and registration_status<>''open'') then';
 if position(old_text in d)=0 then raise exception 'unrecognized_material_event';end if;
 d:=replace(d,old_text,'if p_event is null then event_state:=null; elsif exists(select 1 from public.academy_classes where id=p_event and registration_status<>''open'') then');execute d;

 d:=pg_get_functiondef('academy2_access.learner_operations(uuid,uuid,integer,integer)'::regprocedure);
 old_text:=$old$'application_status',a.status,$old$;
 if position(old_text in d)=0 then raise exception 'unrecognized_learner_projection';end if;
 execute replace(d,old_text,$new$'materials_available',a.status='paid' and a.paid_at is not null and exists(select 1 from academy2_access.plan_material_publications m where m.plan_id=e.plan_id and m.plan_revision=e.plan_revision and m.headquarters_id=e.headquarters_id),'application_status',a.status,$new$);
end $patch$;
notify pgrst,'reload schema';
