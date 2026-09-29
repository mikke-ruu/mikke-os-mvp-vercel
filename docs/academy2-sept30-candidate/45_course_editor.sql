-- Production candidate; review and isolated validation required before approval.
-- Local candidate. Parent creates the formal migration with the CLI after integration tests.
-- Depends on course_basic_editor, course_draft_create and course_material_drafts.
create table academy2_access.course_editor_settings (
 course_id uuid primary key references public.academy_courses(id) on delete restrict,
 headquarters_id uuid not null references academy2_access.tenants(headquarters_id) on delete restrict,
 target_audience text not null default '', show_introduction boolean not null default true,
 sample_name text not null default '', updated_by uuid not null references auth.users(id), updated_at timestamptz not null default now()
);
create table academy2_access.course_editor_requests (
 request_id uuid primary key, headquarters_id uuid not null references academy2_access.tenants(headquarters_id) on delete restrict,
 actor_id uuid not null references auth.users(id), input_snapshot jsonb not null, result jsonb, created_at timestamptz not null default now()
);
alter table academy2_access.course_editor_settings enable row level security;
alter table academy2_access.course_editor_requests enable row level security;
revoke all on academy2_access.course_editor_settings,academy2_access.course_editor_requests from public,anon,authenticated,service_role;

create or replace function academy2_access.course_basic_projection(c public.academy_courses) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',c.id,'headquarters_id',c.headquarters_id,'user_id',c.user_id,'code',c.code,'name',c.name,
 'target_audience',coalesce(editor.target_audience,''),'show_introduction',coalesce(editor.show_introduction,true),
 'subtitle',c.subtitle,'main_image_url',c.main_image_url,'description',c.description,'duration_text',c.duration_text,
 'created_at',c.created_at,'updated_at',c.updated_at,'reference_price',s.reference_price,'reference_revision',coalesce(s.revision,0),
 'lesson_count',case when jsonb_array_length(m.data->'blocks')=0 then jsonb_array_length(m.data->'curriculum') else
 (select count(*) from jsonb_array_elements(m.data->'blocks') b where b->>'type'='heading' and nullif(b->>'lessonId','') is not null)
 +case when not(coalesce(m.data#>>'{blocks,0,type}','')='heading' and nullif(m.data#>>'{blocks,0,lessonId}','') is not null) then 1 else 0 end end,
 'material_count',(select count(*) from jsonb_array_elements(m.data->'blocks') b where not(coalesce(b->>'type','')='heading' and nullif(b->>'lessonId','') is not null)))
 from (select 1) singleton left join academy2_access.course_settings s on s.course_id=c.id and s.headquarters_id=c.headquarters_id
 left join academy2_access.course_editor_settings editor on editor.course_id=c.id and editor.headquarters_id=c.headquarters_id
 cross join lateral (select academy2_access.course_materials(c.headquarters_id,c.id) data) m
$$;
revoke all on function academy2_access.course_basic_projection(public.academy_courses) from public,anon,authenticated,service_role;

create function academy2_access.course_editor_get(p_hq uuid,p_course uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare basic jsonb; settings academy2_access.course_editor_settings;
begin
 if auth.uid() is null or not academy2_access.can(p_hq,'courses.edit') then raise exception 'academy2_forbidden' using errcode='42501';end if;
 basic:=academy2_access.course_basic_get(p_hq,p_course);
 select * into settings from academy2_access.course_editor_settings where course_id=p_course and headquarters_id=p_hq;
 return jsonb_build_object('course',basic,'materials',academy2_access.course_materials(p_hq,p_course),'settings',jsonb_build_object(
 'targetAudience',coalesce(settings.target_audience,''),'showIntroduction',coalesce(settings.show_introduction,true),'sampleName',coalesce(settings.sample_name,'')));
end$$;
create function academy2_access.course_editor_save(p_hq uuid,p_request uuid,p_course uuid,p_expected timestamptz,p_material_revision integer,p_legacy_updated_at timestamptz,p_basic jsonb,p_editor jsonb,p_blocks jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
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
 payload:=jsonb_build_object('course',p_course,'expected',p_expected,'materialRevision',p_material_revision,'legacyUpdatedAt',p_legacy_updated_at,'basic',p_basic,'editor',p_editor,'blocks',p_blocks);
 insert into academy2_access.course_editor_requests(request_id,headquarters_id,actor_id,input_snapshot) values(p_request,p_hq,auth.uid(),payload) on conflict(request_id) do nothing;
 select * into r from academy2_access.course_editor_requests where request_id=p_request for update;
 if r.headquarters_id<>p_hq or r.actor_id<>auth.uid() then raise exception 'academy2_forbidden' using errcode='42501';end if;
 if r.input_snapshot<>payload then raise exception 'academy2_editor_retry_conflict' using errcode='PT409';end if;
 if r.result is not null then return r.result;end if;
 if p_course is null then
  if p_expected is not null or p_material_revision is distinct from 0 or p_legacy_updated_at is not null then raise exception 'academy2_invalid_creation' using errcode='22023';end if;
  c:=academy2_access.course_draft_create(p_hq,p_request,p_basic);v_course_id:=(c->>'id')::uuid;
 else
  v_course_id:=p_course;c:=academy2_access.course_basic_update(p_hq,p_course,p_expected,p_basic);
 end if;
 -- Existing functions reauthorize and lock, and any failure rolls back basic fields and request together.
 perform academy2_access.save_course_materials(p_hq,v_course_id,p_material_revision,p_blocks,p_legacy_updated_at);
 insert into academy2_access.course_editor_settings(course_id,headquarters_id,target_audience,show_introduction,sample_name,updated_by)
 values(v_course_id,p_hq,p_editor->>'targetAudience',(p_editor->>'showIntroduction')::boolean,p_editor->>'sampleName',auth.uid())
 on conflict(course_id) do update set target_audience=excluded.target_audience,show_introduction=excluded.show_introduction,sample_name=excluded.sample_name,updated_by=excluded.updated_by,updated_at=now();
 insert into academy2_access.audit_log(headquarters_id,actor_id,action,target_id) values(p_hq,auth.uid(),'course.editor.saved',v_course_id);
 v_result:=academy2_access.course_editor_get(p_hq,v_course_id);
 update academy2_access.course_editor_requests set result=v_result where request_id=p_request;
 return v_result;
end$$;
revoke all on function academy2_access.course_editor_get(uuid,uuid),academy2_access.course_editor_save(uuid,uuid,uuid,timestamptz,integer,timestamptz,jsonb,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function academy2_access.course_editor_get(uuid,uuid),academy2_access.course_editor_save(uuid,uuid,uuid,timestamptz,integer,timestamptz,jsonb,jsonb,jsonb) to authenticated;
create function public.academy2_course_editor(p_headquarters_id uuid,p_course_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$select academy2_access.course_editor_get(p_headquarters_id,p_course_id)$$;
create function public.academy2_save_course_editor(p_headquarters_id uuid,p_request_id uuid,p_course_id uuid,p_expected_updated_at timestamptz,p_material_revision integer,p_legacy_updated_at timestamptz,p_basic jsonb,p_editor jsonb,p_blocks jsonb) returns jsonb language sql security invoker set search_path='' as $$select academy2_access.course_editor_save(p_headquarters_id,p_request_id,p_course_id,p_expected_updated_at,p_material_revision,p_legacy_updated_at,p_basic,p_editor,p_blocks)$$;
revoke all on function public.academy2_course_editor(uuid,uuid),public.academy2_save_course_editor(uuid,uuid,uuid,timestamptz,integer,timestamptz,jsonb,jsonb,jsonb) from public,anon,service_role;
grant execute on function public.academy2_course_editor(uuid,uuid),public.academy2_save_course_editor(uuid,uuid,uuid,timestamptz,integer,timestamptz,jsonb,jsonb,jsonb) to authenticated;
notify pgrst,'reload schema';
