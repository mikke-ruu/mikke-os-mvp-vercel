-- Team Works R5 correction: keep partner invitations and client invitations on
-- separate rails. Partners get an organization-level directory first, then each
-- operations project can invite a directory partner with role fixed to worker.
-- Client invites continue to use team_works_member_invites directly with
-- role fixed to client_user from project settings/create flows.

create table public.team_works_partners (
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

create table public.team_works_project_partners (
  project_id uuid not null,
  organization_id uuid not null,
  partner_id uuid not null,
  status text not null default 'invited' check (status in ('invited', 'active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, partner_id),
  constraint team_works_project_partners_project_org_fkey
    foreign key (project_id, organization_id)
    references public.team_works_projects(id, organization_id)
    on delete restrict,
  constraint team_works_project_partners_partner_org_fkey
    foreign key (partner_id, organization_id)
    references public.team_works_partners(id, organization_id)
    on delete restrict
);

create index team_works_partners_org_status_idx
  on public.team_works_partners (organization_id, status, display_name);
create index team_works_project_partners_partner_idx
  on public.team_works_project_partners (partner_id, status);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'team_works_partners', 'team_works_project_partners'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
    execute format('grant select, insert, update on table public.%I to authenticated', table_name);
  end loop;
end $$;

create policy team_works_partners_select
on public.team_works_partners for select to authenticated
using (private.team_works_is_org_staff(organization_id));

create policy team_works_partners_insert
on public.team_works_partners for insert to authenticated
with check (private.team_works_is_org_staff(organization_id));

create policy team_works_partners_update
on public.team_works_partners for update to authenticated
using (private.team_works_is_org_staff(organization_id))
with check (private.team_works_is_org_staff(organization_id));

create policy team_works_project_partners_select
on public.team_works_project_partners for select to authenticated
using (
  exists (
    select 1
    from public.team_works_projects p
    where p.id = project_id
      and p.organization_id = organization_id
      and private.team_works_is_org_staff(p.organization_id)
  )
);

create policy team_works_project_partners_insert
on public.team_works_project_partners for insert to authenticated
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

create policy team_works_project_partners_update
on public.team_works_project_partners for update to authenticated
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

comment on table public.team_works_partners is
  'Organization-level partner directory for operations projects. It is separate from client invites and does not expose role selection to staff.';
comment on table public.team_works_project_partners is
  'Project-level assignment of directory partners before or after worker invite acceptance.';

notify pgrst, 'reload schema';
