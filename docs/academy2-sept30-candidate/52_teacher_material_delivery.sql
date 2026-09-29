-- Production candidate; review and isolated validation required before approval.
-- Local candidate: reuse immutable per-course materials for teacher-led course/WS plans.
-- Existing course snapshots, tenant boundary, payment and explicit completion checks stay mandatory.
create or replace function academy2_access.material_publication_ready(p_hq uuid,p_conf jsonb) returns boolean
language sql stable security definer set search_path='' as $$
 select p_conf->>'study_style' in ('materials_only','instructor')
 and p_conf#>>'{materials,enabled}'='true'
 and (p_conf#>>'{materials,starts}'='from_start' or (p_conf->>'study_style'='instructor' and p_conf#>>'{materials,starts}'='after_attendance'))
 and coalesce(p_conf->>'progression','all')='all'
 and jsonb_array_length(p_conf->'course_ids')>0
 and not exists(select 1 from jsonb_array_elements_text(p_conf->'course_ids') x where not exists(
  select 1 from academy2_access.course_material_drafts d join public.academy_courses c on c.id=d.course_id and c.headquarters_id=d.headquarters_id
  join academy2_access.course_material_revisions r on r.course_id=d.course_id and r.revision=d.revision and r.blocks=d.blocks
  where d.course_id=x::uuid and d.headquarters_id=p_hq and jsonb_array_length(d.blocks)>0));
$$;
revoke all on function academy2_access.material_publication_ready(uuid,jsonb) from public,anon,authenticated,service_role;
create or replace function academy2_access.freeze_plan_materials(p_hq uuid,p_plan uuid,p_revision integer) returns void
language plpgsql security definer set search_path='' as $$
declare conf jsonb;x record;d academy2_access.course_material_drafts;
begin
 if not academy2_access.can(p_hq,'applications.operate') or not academy2_access.can(p_hq,'pages.edit') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 select r.configuration into conf from academy2_access.sales_plan_draft_revisions r join academy2_access.sales_plan_drafts p on p.id=r.draft_id where r.draft_id=p_plan and r.revision=p_revision and p.headquarters_id=p_hq;
 if conf#>>'{materials,enabled}' is distinct from 'true' then return;end if;
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


create or replace function academy2_access.learner_material_access(p_application uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false) and exists(
 select 1 from public.academy_offering_applications a
 join academy2_access.operation_enrollments e on e.application_id=a.id and e.headquarters_id=a.headquarters_id
 join academy2_access.sales_plan_draft_revisions r on r.draft_id=e.plan_id and r.revision=e.plan_revision
 join academy2_access.tenants t on t.headquarters_id=e.headquarters_id and t.runtime_enabled
 where a.id=p_application and a.learner_user_id=auth.uid() and a.status='paid' and a.paid_at is not null
 and r.configuration#>>'{materials,enabled}'='true'
 and (r.configuration#>>'{materials,starts}'='from_start' or (r.configuration->>'study_style'='instructor' and r.configuration#>>'{materials,starts}'='after_attendance' and a.completed_at is not null))
 and exists(select 1 from academy2_access.plan_material_publications m where m.plan_id=e.plan_id and m.plan_revision=e.plan_revision and m.headquarters_id=e.headquarters_id));
$$;
revoke all on function academy2_access.learner_material_access(uuid) from public,anon,authenticated,service_role;
create or replace function academy2_access.learner_materials(p_application uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare a public.academy_offering_applications;e academy2_access.operation_enrollments;result jsonb;
begin
 if academy2_access.learner_material_access(p_application) is distinct from true then raise exception 'academy2_material_unavailable' using errcode='42501';end if;
 select * into a from public.academy_offering_applications where id=p_application;
 select * into e from academy2_access.operation_enrollments where application_id=a.id and headquarters_id=a.headquarters_id;
 select jsonb_agg(jsonb_build_object('courseId',m.course_id,'courseName',m.course_name,'materialRevision',m.material_revision,'blocks',m.blocks) order by m.position) into result from academy2_access.plan_material_publications m where m.plan_id=e.plan_id and m.plan_revision=e.plan_revision and m.headquarters_id=e.headquarters_id;
 return jsonb_build_object('applicationId',a.id,'planName',a.offering_title,'courses',result);
end$$;
do $patch$
declare d text; old_text text:= 'a.status=''paid'' and a.paid_at is not null and exists(select 1 from academy2_access.plan_material_publications m where m.plan_id=e.plan_id and m.plan_revision=e.plan_revision and m.headquarters_id=e.headquarters_id)';
begin
 d:=pg_get_functiondef('academy2_access.learner_operations(uuid,uuid,integer,integer)'::regprocedure);
 if position(old_text in d)>0 then execute replace(d,old_text,'academy2_access.learner_material_access(a.id)');
 elsif position('academy2_access.learner_material_access(a.id)' in d)=0 then raise exception 'academy2_unrecognized_material_projection';end if;
end$patch$;
notify pgrst,'reload schema';
