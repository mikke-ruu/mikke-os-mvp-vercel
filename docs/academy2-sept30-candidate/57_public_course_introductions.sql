-- Production candidate; review and isolated validation required before approval.
-- Local candidate. Preserve the existing publication gate and public field allowlist.
create or replace function public.academy_get_public_offering(p_offering_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;course_data jsonb;hq uuid;
begin
 result:=private.academy_get_public_offering_base(p_offering_id);
 if result is null then return null;end if;
 select headquarters_id into hq from public.academy_offerings where id=p_offering_id;
 result:=result||jsonb_build_object('completion_mode',(select completion_mode from public.academy_offerings where id=p_offering_id));
 if not exists(select 1 from academy2_access.tenants where headquarters_id=hq and runtime_enabled) then return result;end if;
 select coalesce(jsonb_agg(c||jsonb_build_object('target_audience',coalesce(s.target_audience,''),'show_introduction',coalesce(s.show_introduction,true)) order by ord),'[]') into course_data
 from jsonb_array_elements(result->'courses') with ordinality x(c,ord)
 left join academy2_access.course_editor_settings s on s.course_id=(c->>'id')::uuid and s.headquarters_id=hq;
 return result||jsonb_build_object('courses',course_data);
end$$;
revoke all on function public.academy_get_public_offering(uuid) from public,anon,authenticated,service_role;
grant execute on function public.academy_get_public_offering(uuid) to anon,authenticated;
notify pgrst,'reload schema';
