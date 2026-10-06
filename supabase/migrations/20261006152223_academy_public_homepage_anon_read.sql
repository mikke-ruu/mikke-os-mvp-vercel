-- Public homepage reads must not evaluate authenticated-only helper functions
-- for anonymous visitors. Keep the existing authenticated access conditions.
drop policy if exists "courses readable" on public.academy_courses;
create policy "courses readable"
on public.academy_courses for select to authenticated
using (
  (is_published = true and public.academy_is_publicly_available(headquarters_id))
  or public.academy_owns_hq(headquarters_id)
  or public.academy_is_course_instructor(id)
);
create policy "courses public readable"
on public.academy_courses for select to anon
using (is_published = true and public.academy_is_publicly_available(headquarters_id));

drop policy if exists "instructors readable" on public.academy_instructors;
create policy "instructors readable"
on public.academy_instructors for select to authenticated
using (
  private.academy_can_manage_headquarters(headquarters_id)
  or (registration_status = 'registered' and (user_id = (select auth.uid()) or is_listed = true))
);
create policy "instructors public readable"
on public.academy_instructors for select to anon
using (registration_status = 'registered' and is_listed = true);
