-- MIGRATION CANDIDATE: not approved for production. Requires fresh replay and target/ACL review.
-- Original source: docs/academy2-course-images.local.sql
-- Local-only candidate. Preserve existing authorization, revision guards and request idempotency.
-- No public execution grants, new tables or material-body changes.
begin;
do $guard$begin
 -- Target identity must be verified by the runner before this transaction.
 if md5(replace(pg_get_functiondef('academy2_access.course_editor_save(uuid,uuid,uuid,timestamptz,integer,timestamptz,jsonb,jsonb,jsonb)'::regprocedure),chr(13),''))<>'e3bd486321f847ba1e2f7c5386b7966b' then raise exception 'course_editor_definition_changed';end if;
end$guard$;
CREATE OR REPLACE FUNCTION academy2_access.course_editor_save(p_hq uuid, p_request uuid, p_course uuid, p_expected timestamp with time zone, p_material_revision integer, p_legacy_updated_at timestamp with time zone, p_basic jsonb, p_editor jsonb, p_blocks jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare payload jsonb;r academy2_access.course_editor_requests;c jsonb;v_course_id uuid;v_result jsonb;key text;
begin
 if auth.uid() is null or not academy2_access.can(p_hq,'courses.edit') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if p_request is null or jsonb_typeof(p_editor) is distinct from 'object' then raise exception 'academy2_invalid_editor' using errcode='22023';end if;
 for key in select jsonb_object_keys(p_editor) loop
  if key not in ('targetAudience','showIntroduction','sampleName') then raise exception 'academy2_invalid_editor' using errcode='22023';end if;
 end loop;
 if jsonb_typeof(p_editor->'targetAudience') is distinct from 'string' or length(p_editor->>'targetAudience')>10000
 or jsonb_typeof(p_editor->'showIntroduction') is distinct from 'boolean'
 or jsonb_typeof(p_editor->'sampleName') is distinct from 'string' or length(p_editor->>'sampleName')>120 then raise exception 'academy2_invalid_editor' using errcode='22023';end if;
 if p_basic ? 'images' then
  if jsonb_typeof(p_basic->'images') is distinct from 'array' then raise exception 'academy2_invalid_images' using errcode='22023';end if;
  if jsonb_array_length(p_basic->'images')>6 or exists(select 1 from jsonb_array_elements(p_basic->'images') i where jsonb_typeof(i)<>'string' or length(i#>>'{}')>2048 or (i#>>'{}') !~* '^https?://') or coalesce(p_basic->>'main_image_url','')<>coalesce(p_basic#>>'{images,0}','') then raise exception 'academy2_invalid_images' using errcode='22023';end if;
 end if;
 payload:=jsonb_build_object('course',p_course,'expected',p_expected,'materialRevision',p_material_revision,'legacyUpdatedAt',p_legacy_updated_at,'basic',p_basic,'editor',p_editor,'blocks',p_blocks);
 insert into academy2_access.course_editor_requests(request_id,headquarters_id,actor_id,input_snapshot) values(p_request,p_hq,auth.uid(),payload) on conflict(request_id) do nothing;
 select * into r from academy2_access.course_editor_requests where request_id=p_request for update;
 if r.headquarters_id<>p_hq or r.actor_id<>auth.uid() then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if r.input_snapshot<>payload then raise exception 'academy2_editor_retry_conflict' using errcode='PT409';end if;
 if r.result is not null then return r.result;end if;
 if p_course is null then
  if p_expected is not null or p_material_revision is distinct from 0 or p_legacy_updated_at is not null then raise exception 'academy2_invalid_creation' using errcode='22023';end if;
  c:=academy2_access.course_draft_create(p_hq,p_request,p_basic-'images');v_course_id:=(c->>'id')::uuid;
 else
  v_course_id:=p_course;c:=academy2_access.course_basic_update(p_hq,p_course,p_expected,p_basic-'images');
 end if;
 -- Existing functions reauthorize and lock, and any failure rolls back basic fields and request together.
 perform academy2_access.save_course_materials(p_hq,v_course_id,p_material_revision,p_blocks,p_legacy_updated_at);
 insert into academy2_access.course_editor_settings(course_id,headquarters_id,target_audience,show_introduction,sample_name,updated_by)
 values(v_course_id,p_hq,p_editor->>'targetAudience',(p_editor->>'showIntroduction')::boolean,p_editor->>'sampleName',auth.uid())
 on conflict(course_id) do update set target_audience=excluded.target_audience,show_introduction=excluded.show_introduction,sample_name=excluded.sample_name,updated_by=excluded.updated_by,updated_at=now();
 insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(p_hq,auth.uid(),'course.editor.saved',v_course_id);
 if p_basic ? 'images' then
  update public.academy_courses set feature_settings=jsonb_set(coalesce(feature_settings,'{}'::jsonb),'{marketing}',(case when jsonb_typeof(feature_settings->'marketing')='object' then feature_settings->'marketing' else '{}'::jsonb end)||jsonb_build_object('images',p_basic->'images'),true) where id=v_course_id and headquarters_id=p_hq;
 end if;
 v_result:=academy2_access.course_editor_get(p_hq,v_course_id);
 update academy2_access.course_editor_requests set result=v_result where request_id=p_request;
 return v_result;
end$function$
;
notify pgrst,'reload schema';
commit;
