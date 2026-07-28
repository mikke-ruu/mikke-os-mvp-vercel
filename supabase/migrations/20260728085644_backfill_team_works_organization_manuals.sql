-- Team Works organization manuals are masters: copying is one-way so every
-- project can keep editing its own manual without later source changes leaking
-- into that project.

create or replace function private.team_works_copy_shared_manual_to_projects()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source_organization_id uuid;
begin
  if new.sharing_scope <> 'organization'
     or new.status <> 'active'
     or new.archived_at is not null then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.sharing_scope = 'organization'
     and old.status = new.status
     and old.archived_at is not distinct from new.archived_at then
    return new;
  end if;

  select p.organization_id
    into source_organization_id
  from public.team_works_projects p
  where p.id = new.project_id;

  insert into public.team_works_manuals (
    project_id,
    source_template_manual_id,
    no,
    title,
    body,
    material_type,
    material_url,
    questions,
    expressions,
    cautions,
    status,
    sharing_scope
  )
  select
    target.id,
    new.id,
    new.no,
    new.title,
    new.body,
    new.material_type,
    new.material_url,
    new.questions,
    new.expressions,
    new.cautions,
    'active',
    'project'
  from public.team_works_projects target
  where target.organization_id = source_organization_id
    and target.id <> new.project_id
    and target.style = 'operations'
    and target.status = 'active'
    and target.archived_at is null
    and not exists (
      select 1
      from public.team_works_manuals existing
      where existing.project_id = target.id
        and existing.archived_at is null
        and (
          existing.no = new.no
          or existing.source_template_manual_id = new.id
        )
    )
  on conflict (project_id, no) do nothing;

  return new;
end
$$;

drop trigger if exists team_works_manuals_copy_shared on public.team_works_manuals;
create trigger team_works_manuals_copy_shared
after insert or update of sharing_scope, status, archived_at
on public.team_works_manuals
for each row
execute function private.team_works_copy_shared_manual_to_projects();

create or replace function private.team_works_copy_shared_manuals_to_new_project()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.style <> 'operations'
     or new.status <> 'active'
     or new.archived_at is not null then
    return new;
  end if;

  insert into public.team_works_manuals (
    project_id,
    source_template_manual_id,
    no,
    title,
    body,
    material_type,
    material_url,
    questions,
    expressions,
    cautions,
    status,
    sharing_scope
  )
  select
    new.id,
    source.id,
    source.no,
    source.title,
    source.body,
    source.material_type,
    source.material_url,
    source.questions,
    source.expressions,
    source.cautions,
    'active',
    'project'
  from (
    select distinct on (manual.no) manual.*
    from public.team_works_manuals manual
    join public.team_works_projects source_project
      on source_project.id = manual.project_id
    where source_project.organization_id = new.organization_id
      and source_project.id <> new.id
      and manual.sharing_scope = 'organization'
      and manual.status = 'active'
      and manual.archived_at is null
    order by manual.no, manual.updated_at desc, manual.id
  ) source
  on conflict (project_id, no) do nothing;

  return new;
end
$$;

drop trigger if exists team_works_projects_copy_shared_manuals on public.team_works_projects;
create trigger team_works_projects_copy_shared_manuals
after insert
on public.team_works_projects
for each row
execute function private.team_works_copy_shared_manuals_to_new_project();

-- Repair projects created before the propagation triggers existed.
insert into public.team_works_manuals (
  project_id,
  source_template_manual_id,
  no,
  title,
  body,
  material_type,
  material_url,
  questions,
  expressions,
  cautions,
  status,
  sharing_scope
)
select
  target.id,
  source.id,
  source.no,
  source.title,
  source.body,
  source.material_type,
  source.material_url,
  source.questions,
  source.expressions,
  source.cautions,
  'active',
  'project'
from public.team_works_manuals source
join public.team_works_projects source_project
  on source_project.id = source.project_id
join public.team_works_projects target
  on target.organization_id = source_project.organization_id
 and target.id <> source.project_id
 and target.style = 'operations'
 and target.status = 'active'
 and target.archived_at is null
where source.sharing_scope = 'organization'
  and source.status = 'active'
  and source.archived_at is null
  and not exists (
    select 1
    from public.team_works_manuals existing
    where existing.project_id = target.id
      and existing.archived_at is null
      and (
        existing.no = source.no
        or existing.source_template_manual_id = source.id
      )
  )
on conflict (project_id, no) do nothing;

comment on function private.team_works_copy_shared_manual_to_projects() is
  'Copies a newly organization-shared Team Works manual into existing active operations projects without keeping the copies synchronized.';

comment on function private.team_works_copy_shared_manuals_to_new_project() is
  'Seeds a new operations project with independent copies of the organization shared manual masters.';
