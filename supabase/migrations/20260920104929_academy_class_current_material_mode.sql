begin;
alter table public.academy_classes
  add column material_mode text not null default 'legacy_program',
  add constraint academy_classes_material_mode_check check(material_mode in ('legacy_program','course_current')),
  add constraint academy_classes_current_material_program_check check(material_mode <> 'course_current' or (program_id is null and program_version_id is null));

-- Keep the original four-argument scope function and legacy acceptance unchanged.
create function private.academy_class_material_scope_valid(p_headquarters_id uuid,p_course_id uuid,p_program_id uuid,p_instructor_id uuid,p_material_mode text)
returns boolean language sql stable security definer set search_path='' as $$
  select case when p_material_mode='legacy_program' then
    private.academy_class_scope_valid(p_headquarters_id,p_course_id,p_program_id,p_instructor_id)
  when p_material_mode='course_current' then p_program_id is null
    and exists(select 1 from public.academy_courses c where c.id=p_course_id and c.headquarters_id=p_headquarters_id)
    and (p_instructor_id is null or exists(select 1 from public.academy_instructors i
      where i.id=p_instructor_id and i.headquarters_id=p_headquarters_id and i.course_id=p_course_id
        and i.registration_status='registered' and i.is_active=true))
  else false end;
$$;
revoke all on function private.academy_class_material_scope_valid(uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function private.academy_class_material_scope_valid(uuid,uuid,uuid,uuid,text) to authenticated;

create function private.academy_guard_class_material_mode()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='UPDATE' and new.material_mode is distinct from old.material_mode then
    raise exception 'academy_class_material_mode_immutable' using errcode='23514';
  end if;
  return new;
end;
$$;
revoke all on function private.academy_guard_class_material_mode() from public,anon,authenticated,service_role;
create trigger academy_class_material_mode_guard before update on public.academy_classes
  for each row execute function private.academy_guard_class_material_mode();

-- The legacy branch below is retained from 20260902041651 without semantic changes.
create or replace function private.academy_pin_class_program_version()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_step_learning boolean;
begin
  if new.material_mode='course_current' then
    if new.program_id is not null or new.program_version_id is not null then
      raise exception 'academy_class_current_material_program_forbidden' using errcode='23514';
    end if;
    if not private.academy_class_material_scope_valid(new.headquarters_id,new.course_id,new.program_id,new.instructor_id,new.material_mode) then
      raise exception 'academy_class_course_scope_invalid';
    end if;
    return new;
  end if;
  select coalesce((course.feature_settings ->> 'stepLearning')::boolean, true)
  into v_step_learning
  from public.academy_courses course
  where course.id = new.course_id and course.headquarters_id = new.headquarters_id;
  if not found then raise exception 'academy_class_course_scope_invalid'; end if;
  if new.program_id is null then
    if v_step_learning then raise exception 'academy_class_program_required'; end if;
    if new.program_version_id is not null then raise exception 'academy_class_program_version_without_program'; end if;
    return new;
  end if;
  if new.program_version_id is null then
    select version.id into new.program_version_id from public.academy_program_versions version
    where version.program_id = new.program_id order by version.version_number desc limit 1;
  elsif not exists(select 1 from public.academy_program_versions version
    where version.id = new.program_version_id and version.program_id = new.program_id) then
    raise exception 'academy_class_program_version_mismatch';
  end if;
  if new.program_version_id is null then raise exception 'Publish the program before creating a class'; end if;
  return new;
end;
$$;
revoke all on function private.academy_pin_class_program_version() from public,anon,authenticated;

drop policy academy_classes_manager_insert on public.academy_classes;
create policy academy_classes_manager_insert on public.academy_classes for insert to authenticated with check(
  private.academy_can_manage_headquarters(headquarters_id)
  and created_by_user_id=(select auth.uid())
  and private.academy_class_material_scope_valid(headquarters_id,course_id,program_id,instructor_id,material_mode));
drop policy academy_classes_manager_update on public.academy_classes;
create policy academy_classes_manager_update on public.academy_classes for update to authenticated
  using(private.academy_can_manage_headquarters(headquarters_id))
  with check(private.academy_can_manage_headquarters(headquarters_id)
    and private.academy_class_material_scope_valid(headquarters_id,course_id,program_id,instructor_id,material_mode));
create or replace function public.academy_list_public_classes(
  p_course_id uuid,
  p_instructor_id uuid default null
)
returns table (
  id uuid,
  course_id uuid,
  instructor_id uuid,
  title text,
  starts_at timestamptz,
  ends_at timestamptz,
  capacity integer,
  remaining_capacity integer,
  venue_name text,
  schedule_mode text,
  format text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    class_record.id,
    class_record.course_id,
    class_record.instructor_id,
    class_record.title,
    class_record.starts_at,
    class_record.ends_at,
    class_record.capacity,
    case
      when class_record.capacity is null then null
      else greatest(
        class_record.capacity - count(application.id)::integer,
        0
      )
    end as remaining_capacity,
    class_record.venue_name,
    class_record.schedule_mode,
    class_record.format
  from public.academy_classes class_record
  join public.academy_courses course
    on course.id = class_record.course_id
   and course.headquarters_id = class_record.headquarters_id
   and course.is_published = true
  join public.academy_headquarters headquarters
    on headquarters.id = class_record.headquarters_id
   and headquarters.is_active = true
  left join public.academy_applications application
    on application.class_id = class_record.id
   and application.status not in ('cancelled', 'closed')
  where class_record.material_mode = 'legacy_program'
    and class_record.course_id = p_course_id
    and class_record.registration_status = 'open'
    and class_record.status in ('planned', 'active')
    and (
      class_record.schedule_mode = 'arranged_after_application'
      or class_record.starts_at >= now()
    )
    and (
      p_instructor_id is null
      or (
        class_record.instructor_id = p_instructor_id
        and exists (
          select 1
          from public.academy_instructors instructor
          where instructor.id = p_instructor_id
            and instructor.course_id = class_record.course_id
            and instructor.headquarters_id = class_record.headquarters_id
            and instructor.registration_status = 'registered'
            and instructor.is_certified = true
            and instructor.is_active = true
            and instructor.is_listed = true
            and instructor.accepts_applications = true
        )
      )
    )
  group by class_record.id
  having class_record.capacity is null
    or count(application.id) < class_record.capacity
  order by
    case when class_record.schedule_mode = 'fixed' then 0 else 1 end,
    class_record.starts_at asc,
    class_record.created_at asc;
$$;

-- New schedules must not enter the old application/program-assignment path.
create function private.academy_guard_legacy_class_binding()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.class_id is not null and exists(select 1 from public.academy_classes c
    where c.id=new.class_id and c.material_mode='course_current') then
    raise exception 'academy_current_class_requires_offering_booking' using errcode='23514';
  end if;
  return new;
end;
$$;
revoke all on function private.academy_guard_legacy_class_binding() from public,anon,authenticated,service_role;
create trigger academy_application_legacy_class_binding before insert or update of class_id on public.academy_applications
  for each row execute function private.academy_guard_legacy_class_binding();
create trigger academy_enrollment_legacy_class_binding before insert or update of class_id on public.academy_enrollments
  for each row execute function private.academy_guard_legacy_class_binding();
commit;
