-- Team Works R6: give clients the same directory + assignment rails already
-- proven for partners (20260724134437_team_works_r5_partner_directory.sql).
-- This supersedes the R5 migration's comment that said client invites would
-- stay on team_works_member_invites directly from project settings/create
-- flows: that per-project raw-email-invite path caused
-- team_works_organization_members_organization_id_user_id_key violations for
-- any client contact assigned to a second project (or a staff member who is
-- also a project's client), because it always tried to insert a fresh
-- organization member row. The directory pattern fixes this the same way it
-- already does for partners: register once, then assign an activated client
-- to further projects by upserting team_works_project_members directly.

create table public.team_works_clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.team_works_organizations(id) on delete restrict,
  display_name text not null check (length(trim(display_name)) > 0),
  email text not null check (position('@' in email) > 1),
  note text,
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, email),
  unique (id, organization_id)
);

create table public.team_works_project_clients (
  project_id uuid not null,
  organization_id uuid not null,
  client_id uuid not null,
  status text not null default 'invited' check (status in ('invited', 'active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, client_id),
  constraint team_works_project_clients_project_org_fkey
    foreign key (project_id, organization_id)
    references public.team_works_projects(id, organization_id)
    on delete restrict,
  constraint team_works_project_clients_client_org_fkey
    foreign key (client_id, organization_id)
    references public.team_works_clients(id, organization_id)
    on delete restrict
);

create index team_works_clients_org_status_idx
  on public.team_works_clients (organization_id, status, display_name);
create index team_works_project_clients_client_idx
  on public.team_works_project_clients (client_id, status);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'team_works_clients', 'team_works_project_clients'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
    execute format('grant select, insert, update on table public.%I to authenticated', table_name);
  end loop;
end $$;

create policy team_works_clients_select
on public.team_works_clients for select to authenticated
using (private.team_works_is_org_staff(organization_id));

create policy team_works_clients_insert
on public.team_works_clients for insert to authenticated
with check (private.team_works_is_org_staff(organization_id));

create policy team_works_clients_update
on public.team_works_clients for update to authenticated
using (private.team_works_is_org_staff(organization_id))
with check (private.team_works_is_org_staff(organization_id));

create policy team_works_project_clients_select
on public.team_works_project_clients for select to authenticated
using (
  exists (
    select 1
    from public.team_works_projects p
    where p.id = project_id
      and p.organization_id = organization_id
      and private.team_works_is_org_staff(p.organization_id)
  )
);

create policy team_works_project_clients_insert
on public.team_works_project_clients for insert to authenticated
with check (
  exists (
    select 1
    from public.team_works_projects p
    where p.id = project_id
      and p.organization_id = organization_id
      and p.style = 'operations'
      and private.team_works_is_org_staff(p.organization_id)
  )
);

create policy team_works_project_clients_update
on public.team_works_project_clients for update to authenticated
using (
  exists (
    select 1
    from public.team_works_projects p
    where p.id = project_id
      and p.organization_id = organization_id
      and private.team_works_is_org_staff(p.organization_id)
  )
)
with check (
  exists (
    select 1
    from public.team_works_projects p
    where p.id = project_id
      and p.organization_id = organization_id
      and p.style = 'operations'
      and private.team_works_is_org_staff(p.organization_id)
  )
);

comment on table public.team_works_clients is
  'Organization-level client directory for operations projects, mirroring team_works_partners. Register once, then assign to any number of projects.';
comment on table public.team_works_project_clients is
  'Project-level assignment of directory clients before or after client_user invite acceptance.';

notify pgrst, 'reload schema';
