-- New instructor tuition is not a legacy lesson entitlement. Preserve the
-- published-course metadata policy and every pre-existing grant/application path.
-- Opening-license payment also does not create a lesson grant by itself.
create or replace function academy2_access.has_legacy_offering_course(p_course uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
  select 1 from public.academy_offering_applications a
  where a.learner_user_id=auth.uid() and a.status='paid' and p_course=any(a.course_ids)
  and not exists(select 1 from academy2_access.operation_enrollments e where e.application_id=a.id)
  and not exists(select 1 from academy2_access.opening_license_origins o where o.application_id=a.id)
 )
$$;
revoke all on function academy2_access.has_legacy_offering_course(uuid) from public,anon,authenticated,service_role;
grant execute on function academy2_access.has_legacy_offering_course(uuid) to authenticated;
notify pgrst,'reload schema';
