-- Team Works W3: move roster group creation and editing to the client portal.

drop policy if exists team_works_groups_insert on public.team_works_groups;
create policy team_works_groups_insert
on public.team_works_groups
for insert to authenticated
with check (
  exists (
    select 1
    from public.team_works_projects p
    where p.id = project_id
      and private.team_works_is_org_staff(p.organization_id)
  )
  or private.team_works_has_project_role(project_id, 'client')
);

drop policy if exists team_works_groups_update on public.team_works_groups;
create policy team_works_groups_update
on public.team_works_groups
for update to authenticated
using (
  exists (
    select 1
    from public.team_works_projects p
    where p.id = project_id
      and private.team_works_is_org_staff(p.organization_id)
  )
  or private.team_works_has_project_role(project_id, 'client')
)
with check (
  exists (
    select 1
    from public.team_works_projects p
    where p.id = project_id
      and private.team_works_is_org_staff(p.organization_id)
  )
  or private.team_works_has_project_role(project_id, 'client')
);
