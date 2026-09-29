-- Minimal authenticated context for the activity settings route only.
-- Does not assert legacy owner/instructor broad capabilities or paid access.
create function academy2_access.activity_shell_context(p_activity_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'academy2_forbidden' using errcode='42501';end if;
 select jsonb_build_object('id',h.id,'name',h.name,'handle',h.handle,'activity_id',a.id)
 into result
 from academy2_access.instructor_activities a
 join academy2_access.tenants t on t.headquarters_id=a.headquarters_id and t.runtime_enabled
 join public.academy_headquarters h on h.id=a.headquarters_id
 join public.academy_instructors i on i.id=a.instructor_id and i.headquarters_id=a.headquarters_id and i.user_id=a.user_id
 where a.id=p_activity_id and a.user_id=auth.uid();
 if result is null then raise exception 'academy2_forbidden' using errcode='42501';end if;
 return result;
end $$;
revoke all on function academy2_access.activity_shell_context(uuid) from public,anon,authenticated,service_role;
grant execute on function academy2_access.activity_shell_context(uuid) to authenticated;
create function public.academy2_activity_shell_context(p_activity_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select academy2_access.activity_shell_context(p_activity_id)$$;
revoke all on function public.academy2_activity_shell_context(uuid) from public,anon,service_role;
grant execute on function public.academy2_activity_shell_context(uuid) to authenticated;
