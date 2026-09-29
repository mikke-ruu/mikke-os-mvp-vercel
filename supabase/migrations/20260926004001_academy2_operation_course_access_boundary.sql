-- Only old offering payments retain the legacy course-discovery path.
-- New operations do not grant lesson access as a side effect of bank confirmation.
-- Existing grants, old applications and published course metadata policies remain unchanged.
create function academy2_access.has_legacy_offering_course(p_course uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
  select 1 from public.academy_offering_applications a
  where a.learner_user_id=auth.uid() and a.status='paid' and p_course=any(a.course_ids)
  and not exists(select 1 from academy2_access.operation_enrollments e where e.application_id=a.id)
 )
$$;
revoke all on function academy2_access.has_legacy_offering_course(uuid) from public,anon,authenticated,service_role;
grant execute on function academy2_access.has_legacy_offering_course(uuid) to authenticated;
alter policy offering_learner_course_read on public.academy_courses
 using(academy2_access.has_legacy_offering_course(id));
