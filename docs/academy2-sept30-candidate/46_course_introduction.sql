-- Production candidate; review and isolated validation required before approval.
-- Apply after course_editor_bundle. Function-only read projection; no table or stored value mutation.
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

notify pgrst,'reload schema';
