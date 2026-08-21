-- Academy I-6: headquarters managers must be able to read and operate both
-- headquarters-intake and instructor-intake applications for their own
-- headquarters. The current production policy limits managers to
-- intake_source = 'honbu', which makes instructor-intake detail loading fail.
--
-- Keep instructor and applicant access unchanged. The manager branch is
-- headquarters-scoped and restricted to owner/administrator by
-- private.academy_can_manage_headquarters(uuid).

drop policy if exists "applications read hq or instructor or self"
  on public.academy_applications;

create policy "applications read hq or instructor or self"
  on public.academy_applications
  for select
  to authenticated
  using (
    private.academy_can_manage_headquarters(headquarters_id)
    or academy_is_instructor_self(instructor_id)
    or user_id = (select auth.uid())
    or (
      user_id is null
      and applicant_email = ((select auth.jwt()) ->> 'email')
    )
  );

drop policy if exists "applications update hq or instructor or self"
  on public.academy_applications;

create policy "applications update hq or instructor or self"
  on public.academy_applications
  for update
  to authenticated
  using (
    private.academy_can_manage_headquarters(headquarters_id)
    or academy_is_instructor_self(instructor_id)
    or user_id = (select auth.uid())
    or (
      user_id is null
      and applicant_email = ((select auth.jwt()) ->> 'email')
    )
  )
  with check (
    private.academy_can_manage_headquarters(headquarters_id)
    or academy_is_instructor_self(instructor_id)
    or user_id = (select auth.uid())
    or (
      user_id is null
      and applicant_email = ((select auth.jwt()) ->> 'email')
    )
  );
