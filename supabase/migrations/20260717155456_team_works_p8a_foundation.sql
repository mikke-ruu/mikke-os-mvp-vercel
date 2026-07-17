-- Team Works P8-a: authenticated organization boundary, project assignments,
-- resource audiences, and task-linked payout/invoice records.
-- Browser users archive or void records; hard delete is intentionally withheld.

create extension if not exists pgcrypto;
create schema if not exists private;

create table public.team_works_organizations (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  source_local_id text,
  name text not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, source_local_id),
  unique (id, owner_user_id)
);

create table public.team_works_organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.team_works_organizations(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  source_local_id text,
  display_name text not null,
  role text not null check (role in ('owner', 'manager', 'client_user', 'worker')),
  status text not null default 'active' check (status in ('invited', 'active', 'inactive', 'archived')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id),
  unique (organization_id, source_local_id),
  unique (id, organization_id)
);

create table public.team_works_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.team_works_organizations(id) on delete restrict,
  source_local_id text,
  client_member_id uuid,
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'on_hold', 'completed', 'cancelled', 'archived')),
  client_visible boolean not null default false,
  payouts_enabled boolean not null default false,
  invoices_enabled boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, source_local_id),
  unique (id, organization_id),
  constraint team_works_projects_client_member_fkey
    foreign key (client_member_id, organization_id)
    references public.team_works_organization_members(id, organization_id)
    on delete restrict
);

create table public.team_works_project_members (
  project_id uuid not null references public.team_works_projects(id) on delete restrict,
  organization_id uuid not null,
  organization_member_id uuid not null,
  project_role text not null check (project_role in ('owner', 'manager', 'client', 'worker')),
  created_at timestamptz not null default now(),
  primary key (project_id, organization_member_id),
  constraint team_works_project_members_project_org_fkey
    foreign key (project_id, organization_id)
    references public.team_works_projects(id, organization_id)
    on delete restrict,
  constraint team_works_project_members_member_org_fkey
    foreign key (organization_member_id, organization_id)
    references public.team_works_organization_members(id, organization_id)
    on delete restrict
);

create table public.team_works_project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.team_works_projects(id) on delete restrict,
  source_local_id text,
  assignee_member_id uuid,
  title text not null,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'review_pending', 'revising', 'completed', 'on_hold', 'cancelled', 'archived')),
  client_visible boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, source_local_id),
  unique (id, project_id),
  constraint team_works_project_tasks_assignee_fkey
    foreign key (project_id, assignee_member_id)
    references public.team_works_project_members(project_id, organization_member_id)
    on delete restrict
);

create table public.team_works_project_resources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.team_works_projects(id) on delete restrict,
  task_id uuid,
  source_local_id text,
  title text not null,
  resource_type text not null check (resource_type in ('url', 'note', 'file')),
  audience text not null check (audience in ('admin', 'members', 'client', 'all')),
  url text,
  memo text,
  storage_path text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, source_local_id),
  constraint team_works_project_resources_task_fkey
    foreign key (task_id, project_id)
    references public.team_works_project_tasks(id, project_id)
    on delete restrict,
  constraint team_works_project_resources_content_check check (
    (resource_type = 'url' and url is not null and memo is null and storage_path is null)
    or (resource_type = 'note' and memo is not null and url is null and storage_path is null)
    or (resource_type = 'file' and storage_path is not null and url is null)
  )
);

create table public.team_works_project_payouts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.team_works_projects(id) on delete restrict,
  task_id uuid not null,
  payee_member_id uuid not null,
  amount numeric(12,2) not null check (amount >= 0),
  status text not null default 'draft' check (status in ('draft', 'approved', 'scheduled', 'paid', 'void')),
  due_on date,
  paid_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id, payee_member_id),
  constraint team_works_project_payouts_task_fkey
    foreign key (task_id, project_id)
    references public.team_works_project_tasks(id, project_id)
    on delete restrict,
  constraint team_works_project_payouts_payee_fkey
    foreign key (project_id, payee_member_id)
    references public.team_works_project_members(project_id, organization_member_id)
    on delete restrict
);

create table public.team_works_project_invoices (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.team_works_projects(id) on delete restrict,
  task_id uuid not null,
  billed_member_id uuid not null,
  amount numeric(12,2) not null check (amount >= 0),
  status text not null default 'draft' check (status in ('draft', 'issued', 'paid', 'overdue', 'void')),
  due_on date,
  issued_at timestamptz,
  paid_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id, billed_member_id),
  constraint team_works_project_invoices_task_fkey
    foreign key (task_id, project_id)
    references public.team_works_project_tasks(id, project_id)
    on delete restrict,
  constraint team_works_project_invoices_billed_fkey
    foreign key (project_id, billed_member_id)
    references public.team_works_project_members(project_id, organization_member_id)
    on delete restrict
);

create index team_works_members_user_idx on public.team_works_organization_members(user_id, organization_id);
create index team_works_projects_org_idx on public.team_works_projects(organization_id);
create index team_works_project_members_member_idx on public.team_works_project_members(organization_member_id, project_id);
create index team_works_tasks_project_idx on public.team_works_project_tasks(project_id, assignee_member_id);
create index team_works_resources_project_idx on public.team_works_project_resources(project_id, audience);
create index team_works_payouts_payee_idx on public.team_works_project_payouts(payee_member_id, status);
create index team_works_invoices_billed_idx on public.team_works_project_invoices(billed_member_id, status);

create or replace function private.team_works_is_org_staff(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.team_works_organizations o
    where o.id = target_organization_id and o.owner_user_id = (select auth.uid())
  ) or exists (
    select 1 from public.team_works_organization_members m
    where m.organization_id = target_organization_id
      and m.user_id = (select auth.uid()) and m.status = 'active'
      and m.role in ('owner', 'manager')
  );
$$;

create or replace function private.team_works_current_member_id(target_organization_id uuid)
returns uuid language sql stable security definer set search_path = ''
as $$
  select m.id from public.team_works_organization_members m
  where m.organization_id = target_organization_id
    and m.user_id = (select auth.uid()) and m.status = 'active'
  limit 1;
$$;

create or replace function private.team_works_is_project_member(target_project_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.team_works_project_members pm
    join public.team_works_organization_members m on m.id = pm.organization_member_id
    where pm.project_id = target_project_id
      and m.user_id = (select auth.uid()) and m.status = 'active'
  );
$$;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;
revoke all on function private.team_works_is_org_staff(uuid) from public, anon;
revoke all on function private.team_works_current_member_id(uuid) from public, anon;
revoke all on function private.team_works_is_project_member(uuid) from public, anon;
grant execute on function private.team_works_is_org_staff(uuid) to authenticated, service_role;
grant execute on function private.team_works_current_member_id(uuid) to authenticated, service_role;
grant execute on function private.team_works_is_project_member(uuid) to authenticated, service_role;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'team_works_organizations', 'team_works_organization_members', 'team_works_projects',
    'team_works_project_members', 'team_works_project_tasks', 'team_works_project_resources',
    'team_works_project_payouts', 'team_works_project_invoices'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
  end loop;
end $$;

grant select, insert, update on public.team_works_organizations to authenticated;
grant select, insert, update on public.team_works_organization_members to authenticated;
grant select, insert, update on public.team_works_projects to authenticated;
grant select, insert, update on public.team_works_project_members to authenticated;
grant select, insert, update on public.team_works_project_tasks to authenticated;
grant select, insert, update on public.team_works_project_resources to authenticated;
grant select, insert, update on public.team_works_project_payouts to authenticated;
grant select, insert, update on public.team_works_project_invoices to authenticated;

create policy team_works_organizations_select on public.team_works_organizations for select to authenticated
using (owner_user_id = (select auth.uid()) or private.team_works_current_member_id(id) is not null);
create policy team_works_organizations_insert on public.team_works_organizations for insert to authenticated
with check (owner_user_id = (select auth.uid()));
create policy team_works_organizations_update on public.team_works_organizations for update to authenticated
using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));

create policy team_works_members_select on public.team_works_organization_members for select to authenticated
using (user_id = (select auth.uid()) or private.team_works_is_org_staff(organization_id));
create policy team_works_members_insert on public.team_works_organization_members for insert to authenticated
with check (
  (private.team_works_is_org_staff(organization_id) and (
    role <> 'owner' or exists (
      select 1 from public.team_works_organizations o
      where o.id = organization_id and o.owner_user_id = user_id
    )
  ))
  or (user_id = (select auth.uid()) and role = 'owner' and exists (
    select 1 from public.team_works_organizations o
    where o.id = organization_id and o.owner_user_id = (select auth.uid())
  ))
);
create policy team_works_members_update on public.team_works_organization_members for update to authenticated
using (private.team_works_is_org_staff(organization_id))
with check (
  private.team_works_is_org_staff(organization_id)
  and (role <> 'owner' or exists (
    select 1 from public.team_works_organizations o
    where o.id = organization_id and o.owner_user_id = user_id
  ))
);

create policy team_works_projects_select on public.team_works_projects for select to authenticated
using (private.team_works_is_org_staff(organization_id) or private.team_works_is_project_member(id));
create policy team_works_projects_insert on public.team_works_projects for insert to authenticated
with check (private.team_works_is_org_staff(organization_id));
create policy team_works_projects_update on public.team_works_projects for update to authenticated
using (private.team_works_is_org_staff(organization_id)) with check (private.team_works_is_org_staff(organization_id));

create policy team_works_project_members_select on public.team_works_project_members for select to authenticated
using (private.team_works_is_org_staff(organization_id) or private.team_works_is_project_member(project_id));
create policy team_works_project_members_insert on public.team_works_project_members for insert to authenticated
with check (private.team_works_is_org_staff(organization_id));
create policy team_works_project_members_update on public.team_works_project_members for update to authenticated
using (private.team_works_is_org_staff(organization_id)) with check (private.team_works_is_org_staff(organization_id));

create policy team_works_tasks_select on public.team_works_project_tasks for select to authenticated
using (
  exists (select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id))
  or (
    private.team_works_is_project_member(project_id)
    and (
      client_visible
      or assignee_member_id in (
        select m.id from public.team_works_organization_members m
        where m.user_id = (select auth.uid()) and m.status = 'active'
      )
    )
  )
);
create policy team_works_tasks_insert on public.team_works_project_tasks for insert to authenticated
with check (exists (select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id)));
create policy team_works_tasks_update on public.team_works_project_tasks for update to authenticated
using (exists (select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id)))
with check (exists (select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id)));

create policy team_works_resources_select on public.team_works_project_resources for select to authenticated
using (
  exists (select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id))
  or (
    private.team_works_is_project_member(project_id)
    and (
      audience = 'all'
      or (audience = 'members' and exists (
        select 1 from public.team_works_project_members pm
        join public.team_works_organization_members m on m.id = pm.organization_member_id
        where pm.project_id = project_id and m.user_id = (select auth.uid()) and pm.project_role = 'worker'
      ))
      or (audience = 'client' and exists (
        select 1 from public.team_works_project_members pm
        join public.team_works_organization_members m on m.id = pm.organization_member_id
        where pm.project_id = project_id and m.user_id = (select auth.uid()) and pm.project_role = 'client'
      ))
    )
  )
);
create policy team_works_resources_insert on public.team_works_project_resources for insert to authenticated
with check (exists (select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id)));
create policy team_works_resources_update on public.team_works_project_resources for update to authenticated
using (exists (select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id)))
with check (exists (select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id)));

create policy team_works_payouts_select on public.team_works_project_payouts for select to authenticated
using (
  exists (select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id))
  or payee_member_id in (select m.id from public.team_works_organization_members m where m.user_id = (select auth.uid()) and m.status = 'active')
);
create policy team_works_payouts_insert on public.team_works_project_payouts for insert to authenticated
with check (
  exists (select 1 from public.team_works_projects p where p.id = project_id and p.payouts_enabled and private.team_works_is_org_staff(p.organization_id))
  and exists (select 1 from public.team_works_project_members pm where pm.project_id = project_id and pm.organization_member_id = payee_member_id and pm.project_role = 'worker')
);
create policy team_works_payouts_update on public.team_works_project_payouts for update to authenticated
using (exists (select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id)))
with check (
  exists (select 1 from public.team_works_projects p where p.id = project_id and p.payouts_enabled and private.team_works_is_org_staff(p.organization_id))
  and exists (select 1 from public.team_works_project_members pm where pm.project_id = project_id and pm.organization_member_id = payee_member_id and pm.project_role = 'worker')
);

create policy team_works_invoices_select on public.team_works_project_invoices for select to authenticated
using (
  exists (select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id))
  or billed_member_id in (select m.id from public.team_works_organization_members m where m.user_id = (select auth.uid()) and m.status = 'active')
);
create policy team_works_invoices_insert on public.team_works_project_invoices for insert to authenticated
with check (
  exists (select 1 from public.team_works_projects p where p.id = project_id and p.invoices_enabled and private.team_works_is_org_staff(p.organization_id))
  and exists (select 1 from public.team_works_project_members pm where pm.project_id = project_id and pm.organization_member_id = billed_member_id and pm.project_role = 'client')
);
create policy team_works_invoices_update on public.team_works_project_invoices for update to authenticated
using (exists (select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id)))
with check (
  exists (select 1 from public.team_works_projects p where p.id = project_id and p.invoices_enabled and private.team_works_is_org_staff(p.organization_id))
  and exists (select 1 from public.team_works_project_members pm where pm.project_id = project_id and pm.organization_member_id = billed_member_id and pm.project_role = 'client')
);

comment on table public.team_works_project_resources is 'Private Team Works resources. audience narrows visibility after project membership is authorized.';
comment on table public.team_works_project_payouts is 'Task-linked worker reward records; visible only to organization staff and the payee.';
comment on table public.team_works_project_invoices is 'Task-linked client invoice records; visible only to organization staff and the billed member.';

notify pgrst, 'reload schema';
