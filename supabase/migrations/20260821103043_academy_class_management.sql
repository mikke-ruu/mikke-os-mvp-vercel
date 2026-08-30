-- Academy class management: let headquarters owners and administrators create
-- and update classes. Course editors can keep read access but cannot manage
-- schedules or instructor assignments.

drop policy if exists "academy_classes_owner_insert" on public.academy_classes;
drop policy if exists "academy_classes_manager_insert" on public.academy_classes;
create policy "academy_classes_manager_insert"
on public.academy_classes
for insert to authenticated
with check (
  private.academy_can_manage_headquarters(headquarters_id)
  and created_by_user_id = (select auth.uid())
  and private.academy_class_scope_valid(
    headquarters_id,
    course_id,
    program_id,
    instructor_id
  )
);

drop policy if exists "academy_classes_owner_update" on public.academy_classes;
drop policy if exists "academy_classes_manager_update" on public.academy_classes;
create policy "academy_classes_manager_update"
on public.academy_classes
for update to authenticated
using (private.academy_can_manage_headquarters(headquarters_id))
with check (
  private.academy_can_manage_headquarters(headquarters_id)
  and private.academy_class_scope_valid(
    headquarters_id,
    course_id,
    program_id,
    instructor_id
  )
);
