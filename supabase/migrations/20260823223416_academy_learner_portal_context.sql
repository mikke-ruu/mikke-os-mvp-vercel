-- Academy personal portal: keep learner access and certified-instructor access
-- in one portal while preserving separate capabilities and RLS boundaries.

create table if not exists public.academy_learner_pages (
  id uuid primary key default gen_random_uuid(),
  headquarters_id uuid not null references public.academy_headquarters(id) on delete cascade,
  course_id uuid not null references public.academy_courses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  blocks jsonb not null default '[]'::jsonb,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academy_learner_pages_course_unique unique (course_id),
  constraint academy_learner_pages_blocks_array_check check (jsonb_typeof(blocks) = 'array')
);

create index if not exists academy_learner_pages_headquarters_idx
  on public.academy_learner_pages(headquarters_id);

alter table public.academy_learner_pages enable row level security;

revoke all on table public.academy_learner_pages from public, anon, authenticated;
grant select, insert, update on table public.academy_learner_pages to authenticated;
grant all on table public.academy_learner_pages to service_role;

create or replace function private.academy_is_course_learner(
  p_course_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id = (select auth.uid()) and exists (
    select 1
    from public.academy_applications application
    where application.course_id = p_course_id
      and application.user_id = p_user_id
      and application.status in (
        'paid',
        'kit_pending',
        'kit_preparing',
        'kit_shipped',
        'scheduled',
        'completed',
        'cert_pending',
        'certified',
        'instructor_added'
      )
  );
$$;

revoke all on function private.academy_is_course_learner(uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.academy_is_course_learner(uuid, uuid)
  to authenticated;

create or replace function private.academy_is_registered_course_instructor(
  p_course_id uuid,
  p_user_id uuid,
  p_require_active boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id = (select auth.uid()) and exists (
    select 1
    from public.academy_instructors instructor
    where instructor.course_id = p_course_id
      and instructor.user_id = p_user_id
      and instructor.registration_status = 'registered'
      and instructor.is_certified = true
      and (
        not p_require_active
        or (instructor.is_active = true and instructor.status = 'active')
      )
  );
$$;

revoke all on function private.academy_is_registered_course_instructor(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function private.academy_is_registered_course_instructor(uuid, uuid, boolean)
  to authenticated;

drop policy if exists "instructor pages read hq or active instructor"
  on public.academy_instructor_pages;
create policy "instructor pages read manager or registered instructor"
on public.academy_instructor_pages
for select
to authenticated
using (
  private.academy_can_edit_courses(headquarters_id)
  or private.academy_is_registered_course_instructor(course_id, (select auth.uid()), false)
);

drop policy if exists "materials read hq or active instructor"
  on public.academy_materials;
create policy "materials read manager or registered instructor"
on public.academy_materials
for select
to authenticated
using (
  private.academy_can_edit_courses(headquarters_id)
  or (
    is_published = true
    and private.academy_is_registered_course_instructor(
      course_id,
      (select auth.uid()),
      requires_active
    )
  )
);

drop policy if exists "academy_learner_pages_manager_select"
  on public.academy_learner_pages;
create policy "academy_learner_pages_manager_select"
on public.academy_learner_pages
for select
to authenticated
using (private.academy_can_edit_courses(headquarters_id));

drop policy if exists "academy_learner_pages_learner_select"
  on public.academy_learner_pages;
create policy "academy_learner_pages_learner_select"
on public.academy_learner_pages
for select
to authenticated
using (
  is_published = true
  and private.academy_is_course_learner(course_id, (select auth.uid()))
);

drop policy if exists "academy_learner_pages_manager_insert"
  on public.academy_learner_pages;
create policy "academy_learner_pages_manager_insert"
on public.academy_learner_pages
for insert
to authenticated
with check (
  private.academy_can_edit_courses(headquarters_id)
  and user_id = (select auth.uid())
  and exists (
    select 1
    from public.academy_courses course
    where course.id = academy_learner_pages.course_id
      and course.headquarters_id = academy_learner_pages.headquarters_id
  )
  and (
    not is_published
    or private.academy_headquarters_role(headquarters_id, (select auth.uid())) = 'owner'
  )
);

drop policy if exists "academy_learner_pages_manager_update"
  on public.academy_learner_pages;
create policy "academy_learner_pages_manager_update"
on public.academy_learner_pages
for update
to authenticated
using (private.academy_can_edit_courses(headquarters_id))
with check (private.academy_can_edit_courses(headquarters_id));

create or replace function private.academy_guard_learner_page_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.headquarters_id is distinct from old.headquarters_id
    or new.course_id is distinct from old.course_id
    or new.user_id is distinct from old.user_id then
    raise exception 'academy_learner_page_scope_is_immutable';
  end if;
  if new.is_published is distinct from old.is_published
    and private.academy_headquarters_role(new.headquarters_id, (select auth.uid())) <> 'owner' then
    raise exception 'academy_learner_page_publish_owner_required';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.academy_guard_learner_page_update()
  from public, anon, authenticated;

drop trigger if exists academy_guard_learner_page_update
  on public.academy_learner_pages;
create trigger academy_guard_learner_page_update
before update on public.academy_learner_pages
for each row execute function private.academy_guard_learner_page_update();

drop policy if exists "academy_courses_learner_select"
  on public.academy_courses;
create policy "academy_courses_learner_select"
on public.academy_courses
for select
to authenticated
using (private.academy_is_course_learner(id, (select auth.uid())));

create or replace function public.academy_list_my_contexts()
returns table (
  academy_id uuid,
  academy_name text,
  academy_handle text,
  roles text[],
  portals text[],
  capabilities text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  with actor as (
    select (select auth.uid()) as user_id
  ), instructor_access as (
    select
      instructor.headquarters_id,
      true as has_instructor,
      bool_or(instructor.is_active = true and instructor.status = 'active') as can_operate
    from public.academy_instructors instructor
    cross join actor
    where instructor.user_id = actor.user_id
      and instructor.registration_status = 'registered'
      and instructor.is_certified = true
    group by instructor.headquarters_id
  ), learner_access as (
    select distinct application.headquarters_id
    from public.academy_applications application
    cross join actor
    where application.user_id = actor.user_id
      and application.status in (
        'paid',
        'kit_pending',
        'kit_preparing',
        'kit_shipped',
        'scheduled',
        'completed',
        'cert_pending',
        'certified',
        'instructor_added'
      )
  ), context_roles as (
    select headquarters.id as academy_id, 'owner'::text as role
    from public.academy_headquarters headquarters
    cross join actor
    where headquarters.owner_user_id = actor.user_id

    union

    select member.headquarters_id, member.role
    from public.academy_headquarters_members member
    join public.profiles profile on profile.id = member.member_profile_id
    cross join actor
    where profile.user_id = actor.user_id
      and member.status = 'active'

    union

    select instructor_access.headquarters_id, 'instructor'::text
    from instructor_access

    union

    select learner_access.headquarters_id, 'learner'::text
    from learner_access
  ), grouped as (
    select
      context_roles.academy_id,
      array_agg(context_roles.role order by context_roles.role) as roles,
      bool_or(context_roles.role = 'owner') as is_owner,
      bool_or(context_roles.role = 'administrator') as is_administrator,
      bool_or(context_roles.role = 'course_editor') as is_course_editor,
      bool_or(context_roles.role = 'instructor') as is_instructor,
      bool_or(context_roles.role = 'learner') as is_learner
    from context_roles
    group by context_roles.academy_id
  )
  select
    headquarters.id,
    headquarters.name,
    headquarters.handle,
    grouped.roles,
    array_remove(array[
      case when grouped.is_owner or grouped.is_administrator or grouped.is_course_editor then 'manage' end,
      case when grouped.is_instructor or grouped.is_learner then 'teach' end
    ], null),
    array_remove(array[
      case when grouped.is_owner or grouped.is_administrator or grouped.is_course_editor then 'academy:headquarters:view' end,
      case when grouped.is_owner or grouped.is_administrator then 'academy:headquarters:manage' end,
      case when grouped.is_owner then 'academy:members:manage' end,
      case when grouped.is_owner or grouped.is_administrator or grouped.is_course_editor then 'academy:courses:manage' end,
      case when grouped.is_owner or grouped.is_administrator then 'academy:instructors:manage' end,
      case when grouped.is_owner or grouped.is_administrator then 'academy:applications:manage' end,
      case when grouped.is_owner or grouped.is_administrator then 'academy:settings:manage' end,
      case when grouped.is_learner then 'academy:learner_portal:view' end,
      case when grouped.is_instructor then 'academy:instructor_portal:view' end,
      case when grouped.is_instructor then 'academy:instructor_materials:view' end,
      case when coalesce(instructor_access.can_operate, false) then 'academy:instructor:operate' end
    ], null)
  from grouped
  join public.academy_headquarters headquarters on headquarters.id = grouped.academy_id
  left join instructor_access on instructor_access.headquarters_id = grouped.academy_id
  order by headquarters.created_at, headquarters.id;
$$;

revoke all on function public.academy_list_my_contexts() from public, anon;
grant execute on function public.academy_list_my_contexts() to authenticated;
