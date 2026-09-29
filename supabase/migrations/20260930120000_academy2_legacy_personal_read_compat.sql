-- Preserve existing personal Academy routes when headquarters authoring opts in.
-- The old permissive RLS policies still decide which individual rows are visible.
-- This layer never restores legacy headquarters writes or provisions memberships.
create function academy2_access.legacy_personal_reader(p_hq uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null
  and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false)
  and (
   exists(select 1 from public.academy_applications a
          where a.headquarters_id=p_hq and a.user_id=(select auth.uid()))
   or exists(select 1 from public.academy_offering_applications a
             where a.headquarters_id=p_hq and a.learner_user_id=(select auth.uid()))
   or exists(select 1 from public.academy_instructors i
             where i.headquarters_id=p_hq and i.user_id=(select auth.uid())
               and i.registration_status='registered' and i.is_certified)
  )
$$;
revoke all on function academy2_access.legacy_personal_reader(uuid) from public,anon,authenticated,service_role;
grant execute on function academy2_access.legacy_personal_reader(uuid) to anon,authenticated;

-- Separate SELECT from writes: an existing learner or instructor may read old
-- rows through their original RLS, but cannot revive old owner/write routes.
do $$ declare item record; begin
 for item in select * from (values
  ('academy_headquarters','academy2_hq_legacy_fence','id'),
  ('academy_applications','academy2_application_legacy_fence','headquarters_id'),
  ('academy_instructors','academy2_instructor_legacy_fence','headquarters_id'),
  ('academy_classes','academy2_classes_legacy_only','headquarters_id')
 ) as v(tab,old_policy,hq_column) loop
  execute format('drop policy %I on public.%I',item.old_policy,item.tab);
  execute format('create policy academy2_legacy_personal_select on public.%I as restrictive for select to anon,authenticated using(academy2_access.legacy_allowed(%I) or academy2_access.legacy_personal_reader(%I))',item.tab,item.hq_column,item.hq_column);
  execute format('create policy academy2_legacy_write_insert on public.%I as restrictive for insert to anon,authenticated with check(academy2_access.legacy_allowed(%I))',item.tab,item.hq_column);
  execute format('create policy academy2_legacy_write_update on public.%I as restrictive for update to anon,authenticated using(academy2_access.legacy_allowed(%I)) with check(academy2_access.legacy_allowed(%I))',item.tab,item.hq_column,item.hq_column);
  execute format('create policy academy2_legacy_write_delete on public.%I as restrictive for delete to anon,authenticated using(academy2_access.legacy_allowed(%I))',item.tab,item.hq_column);
 end loop;
end $$;

-- The legacy source is already self-scoped. On an enabled HQ expose only its
-- instructor/learner portal and capabilities, leaving manage to v2 membership.
create or replace function public.academy_list_my_contexts()
returns table(academy_id uuid,academy_name text,academy_handle text,roles text[],portals text[],capabilities text[])
language sql stable security definer set search_path='' as $$
 select c.academy_id,c.academy_name,c.academy_handle,
  case when academy2_access.legacy_allowed(c.academy_id) then c.roles
       else array(select r from unnest(c.roles) r where r in('instructor','learner')) end,
  case when academy2_access.legacy_allowed(c.academy_id) then c.portals
       else array['teach']::text[] end,
  case when academy2_access.legacy_allowed(c.academy_id) then c.capabilities
       else array(select cap from unnest(c.capabilities) cap
                  where cap in('academy:learner_portal:view','academy:instructor_portal:view',
                               'academy:instructor_materials:view','academy:instructor:operate')) end
 from academy2_access.legacy_list_my_contexts() c
 where academy2_access.legacy_allowed(c.academy_id)
    or ((select auth.uid()) is not null and c.roles && array['instructor','learner']::text[])
$$;
notify pgrst, 'reload schema';
