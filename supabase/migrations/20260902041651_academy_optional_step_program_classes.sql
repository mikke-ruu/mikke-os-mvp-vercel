-- A class is a scheduled delivery of a course. Step-by-step online learning is
-- optional, so courses that do not use it must not be forced to create a fake
-- program/version before they can schedule a class. Likewise, a class whose
-- date is arranged after application must not require a placeholder date.

alter table public.academy_classes
  alter column program_id drop not null,
  alter column starts_at drop not null;

alter table public.academy_classes
  drop constraint if exists academy_classes_ends_after_starts_check;

alter table public.academy_classes
  add constraint academy_classes_ends_after_starts_check
    check (ends_at is null or (starts_at is not null and ends_at > starts_at)),
  add constraint academy_classes_schedule_start_check
    check (
      (schedule_mode = 'fixed' and starts_at is not null)
      or schedule_mode = 'arranged_after_application'
    ),
  add constraint academy_classes_program_pair_check
    check (program_id is not null or program_version_id is null);

create or replace function private.academy_class_scope_valid(
  p_headquarters_id uuid,
  p_course_id uuid,
  p_program_id uuid,
  p_instructor_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.academy_courses course
    where course.id = p_course_id
      and course.headquarters_id = p_headquarters_id
      and (
        (
          p_program_id is null
          and coalesce((course.feature_settings ->> 'stepLearning')::boolean, true) = false
        )
        or exists (
          select 1
          from public.academy_programs program
          where program.id = p_program_id
            and program.headquarters_id = p_headquarters_id
            and program.course_id = p_course_id
        )
      )
  )
  and (
    p_instructor_id is null
    or exists (
      select 1
      from public.academy_instructors instructor
      where instructor.id = p_instructor_id
        and instructor.headquarters_id = p_headquarters_id
        and instructor.course_id = p_course_id
        and instructor.registration_status = 'registered'
        and instructor.is_active = true
    )
  );
$$;

revoke all on function private.academy_class_scope_valid(uuid, uuid, uuid, uuid)
  from public, anon;
grant execute on function private.academy_class_scope_valid(uuid, uuid, uuid, uuid)
  to authenticated;

create or replace function private.academy_pin_class_program_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_step_learning boolean;
begin
  select coalesce((course.feature_settings ->> 'stepLearning')::boolean, true)
  into v_step_learning
  from public.academy_courses course
  where course.id = new.course_id
    and course.headquarters_id = new.headquarters_id;

  if not found then
    raise exception 'academy_class_course_scope_invalid';
  end if;

  if new.program_id is null then
    if v_step_learning then
      raise exception 'academy_class_program_required';
    end if;
    if new.program_version_id is not null then
      raise exception 'academy_class_program_version_without_program';
    end if;
    return new;
  end if;

  if new.program_version_id is null then
    select version.id
    into new.program_version_id
    from public.academy_program_versions version
    where version.program_id = new.program_id
    order by version.version_number desc
    limit 1;
  elsif not exists (
    select 1
    from public.academy_program_versions version
    where version.id = new.program_version_id
      and version.program_id = new.program_id
  ) then
    raise exception 'academy_class_program_version_mismatch';
  end if;

  if new.program_version_id is null then
    raise exception 'Publish the program before creating a class';
  end if;

  return new;
end;
$$;

revoke all on function private.academy_pin_class_program_version()
  from public, anon, authenticated;
