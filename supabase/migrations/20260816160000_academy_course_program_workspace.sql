alter table public.academy_programs
  add column if not exists course_id uuid references public.academy_courses(id) on delete cascade;

create unique index if not exists academy_programs_course_id_unique
  on public.academy_programs(course_id)
  where course_id is not null;

create or replace function private.academy_guard_program_course_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (
    new.headquarters_id is distinct from old.headquarters_id
    or new.course_id is distinct from old.course_id
  ) then
    raise exception 'academy_program_scope_is_immutable';
  end if;

  if new.course_id is not null and not exists (
    select 1
    from public.academy_courses course
    where course.id = new.course_id
      and course.headquarters_id = new.headquarters_id
  ) then
    raise exception 'academy_program_course_scope_invalid';
  end if;
  return new;
end;
$$;

drop trigger if exists academy_guard_program_course_scope on public.academy_programs;
create trigger academy_guard_program_course_scope
before insert or update on public.academy_programs
for each row execute function private.academy_guard_program_course_scope();

grant delete on public.academy_programs, public.academy_program_sections, public.academy_program_steps to authenticated;

create policy "academy_programs_collaborator_all"
on public.academy_programs for all to authenticated
using (private.academy_can_edit_courses(headquarters_id))
with check (private.academy_can_edit_courses(headquarters_id));

create policy "academy_program_sections_collaborator_all"
on public.academy_program_sections for all to authenticated
using (exists (
  select 1 from public.academy_programs program
  where program.id = academy_program_sections.program_id
    and private.academy_can_edit_courses(program.headquarters_id)
))
with check (exists (
  select 1 from public.academy_programs program
  where program.id = academy_program_sections.program_id
    and private.academy_can_edit_courses(program.headquarters_id)
));

create policy "academy_program_steps_collaborator_all"
on public.academy_program_steps for all to authenticated
using (exists (
  select 1
  from public.academy_program_sections section
  join public.academy_programs program on program.id = section.program_id
  where section.id = academy_program_steps.section_id
    and private.academy_can_edit_courses(program.headquarters_id)
))
with check (exists (
  select 1
  from public.academy_program_sections section
  join public.academy_programs program on program.id = section.program_id
  where section.id = academy_program_steps.section_id
    and private.academy_can_edit_courses(program.headquarters_id)
));
