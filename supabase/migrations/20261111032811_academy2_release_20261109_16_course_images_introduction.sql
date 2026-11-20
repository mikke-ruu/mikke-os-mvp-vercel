-- MIGRATION CANDIDATE: not approved for production. Requires fresh replay and target/ACL review.
-- Original source: docs/academy2-course-images-introduction.local.sql
-- Local-only companion to academy2-course-images.local.sql. Keep public access gates unchanged.
begin;
do $guard$begin
 -- Target identity must be verified by the runner before this transaction.
 if md5(replace(pg_get_functiondef('academy2_access.course_introduction_projection(uuid)'::regprocedure),chr(13),''))<>'71282987d1bbeac707099218f1b456c6' then raise exception 'introduction_definition_changed';end if;
end$guard$;
CREATE OR REPLACE FUNCTION academy2_access.course_introduction_projection(p_course uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select jsonb_build_object('id',c.id,'name',c.name,'subtitle',c.subtitle,'description',c.description,
 'target_audience',s.target_audience,'duration_text',c.duration_text,
 'images',(select coalesce(jsonb_agg(url order by ord),'[]') from (select url,min(ord) ord from jsonb_array_elements_text(
 case when nullif(c.main_image_url,'') is null then '[]'::jsonb else jsonb_build_array(c.main_image_url) end ||
 case when jsonb_typeof(c.feature_settings#>'{marketing,images}')='array' then c.feature_settings#>'{marketing,images}' else '[]'::jsonb end) with ordinality x(url,ord) where url ~* '^https?://' group by url order by min(ord) limit 6) photos),
 'physical_items',case when shipping.configuration#>'{version}'='2'::jsonb then jsonb_build_object('enabled',shipping.configuration->'enabled','name',shipping.configuration->'name','contents',shipping.configuration->'contents') else null end)
 from public.academy_courses c left join academy2_access.course_editor_settings s on s.course_id=c.id and s.headquarters_id=c.headquarters_id
 left join academy2_access.course_shipping_settings shipping on shipping.course_id=c.id and shipping.headquarters_id=c.headquarters_id
 where c.id=p_course
$function$
;
notify pgrst,'reload schema';
commit;
