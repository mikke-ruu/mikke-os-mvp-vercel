create table public.academy_programs (
  id uuid primary key default gen_random_uuid(),
  headquarters_id uuid not null references public.academy_headquarters(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  description text null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.academy_program_sections (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.academy_programs(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.academy_program_steps (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.academy_program_sections(id) on delete cascade,
  step_type text not null check (step_type in ('text','external_url','download','live_session','submission','test','approval','completion')),
  title text not null check (length(trim(title)) > 0),
  content text null,
  external_url text null,
  sort_order integer not null default 0,
  requires_previous boolean not null default true,
  self_completion_allowed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index academy_programs_headquarters_id_idx on public.academy_programs(headquarters_id);
create index academy_program_sections_program_id_idx on public.academy_program_sections(program_id);
create index academy_program_steps_section_id_idx on public.academy_program_steps(section_id);

alter table public.academy_programs enable row level security;
alter table public.academy_program_sections enable row level security;
alter table public.academy_program_steps enable row level security;

revoke all on public.academy_programs, public.academy_program_sections, public.academy_program_steps from anon, authenticated;
grant select, insert, update on public.academy_programs, public.academy_program_sections, public.academy_program_steps to authenticated;

create policy "academy_programs_owner_all"
on public.academy_programs for all to authenticated
using (academy_owns_hq(headquarters_id))
with check (academy_owns_hq(headquarters_id));

create policy "academy_program_sections_owner_all"
on public.academy_program_sections for all to authenticated
using (exists (
  select 1 from public.academy_programs as program
  where program.id = academy_program_sections.program_id
    and academy_owns_hq(program.headquarters_id)
))
with check (exists (
  select 1 from public.academy_programs as program
  where program.id = academy_program_sections.program_id
    and academy_owns_hq(program.headquarters_id)
));

create policy "academy_program_steps_owner_all"
on public.academy_program_steps for all to authenticated
using (exists (
  select 1
  from public.academy_program_sections as section
  join public.academy_programs as program on program.id = section.program_id
  where section.id = academy_program_steps.section_id
    and academy_owns_hq(program.headquarters_id)
))
with check (exists (
  select 1
  from public.academy_program_sections as section
  join public.academy_programs as program on program.id = section.program_id
  where section.id = academy_program_steps.section_id
    and academy_owns_hq(program.headquarters_id)
));
