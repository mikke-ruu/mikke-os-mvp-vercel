-- Team Works R4: narrow write boundaries for operations portals.
-- Partners submit immutable session reports instead of updating canonical
-- participant/roster rows. Clients submit closure requests instead of writing
-- staff-owned holiday rows directly.

create table public.team_works_ops_session_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.team_works_projects(id) on delete restrict,
  session_id uuid not null,
  submitted_by_member_id uuid not null,
  attendance jsonb not null default '[]'::jsonb check (jsonb_typeof(attendance) = 'array'),
  progress jsonb not null default '[]'::jsonb check (jsonb_typeof(progress) = 'array'),
  body text not null default '',
  created_at timestamptz not null default now(),
  unique (session_id, submitted_by_member_id),
  constraint team_works_ops_reports_session_fkey
    foreign key (session_id, project_id)
    references public.team_works_op_sessions(id, project_id)
    on delete restrict,
  constraint team_works_ops_reports_submitter_fkey
    foreign key (project_id, submitted_by_member_id)
    references public.team_works_project_members(project_id, organization_member_id)
    on delete restrict
);

create table public.team_works_client_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.team_works_projects(id) on delete restrict,
  requested_by_member_id uuid not null,
  request_type text not null check (request_type in ('closure')),
  requested_date date not null,
  body text not null default '',
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, requested_by_member_id, request_type, requested_date),
  constraint team_works_client_requests_requester_fkey
    foreign key (project_id, requested_by_member_id)
    references public.team_works_project_members(project_id, organization_member_id)
    on delete restrict
);

create index team_works_ops_reports_project_created_idx
  on public.team_works_ops_session_reports(project_id, created_at desc);
create index team_works_ops_reports_submitter_idx
  on public.team_works_ops_session_reports(submitted_by_member_id, created_at desc);
create index team_works_client_requests_project_status_idx
  on public.team_works_client_requests(project_id, status, requested_date);
create index team_works_client_requests_requester_idx
  on public.team_works_client_requests(requested_by_member_id, created_at desc);

alter table public.team_works_ops_session_reports enable row level security;
alter table public.team_works_ops_session_reports force row level security;
alter table public.team_works_client_requests enable row level security;
alter table public.team_works_client_requests force row level security;

revoke all on table public.team_works_ops_session_reports from public, anon, authenticated;
revoke all on table public.team_works_client_requests from public, anon, authenticated;
grant all on table public.team_works_ops_session_reports to service_role;
grant all on table public.team_works_client_requests to service_role;
grant select, insert on table public.team_works_ops_session_reports to authenticated;
grant select, insert, update on table public.team_works_client_requests to authenticated;

create policy team_works_ops_reports_select
on public.team_works_ops_session_reports for select to authenticated
using (
  exists (
    select 1 from public.team_works_projects p
    where p.id = project_id and private.team_works_is_org_staff(p.organization_id)
  )
  or submitted_by_member_id = private.team_works_current_project_member_id(project_id)
);

create policy team_works_ops_reports_insert
on public.team_works_ops_session_reports for insert to authenticated
with check (
  private.team_works_project_role(project_id) = 'worker'
  and submitted_by_member_id = private.team_works_current_project_member_id(project_id)
  and exists (
    select 1
    from public.team_works_op_sessions s
    where s.id = session_id
      and s.project_id = project_id
      and s.partner_member_id = submitted_by_member_id
      and s.status <> 'cancelled'
  )
);

create policy team_works_client_requests_select
on public.team_works_client_requests for select to authenticated
using (
  exists (
    select 1 from public.team_works_projects p
    where p.id = project_id and private.team_works_is_org_staff(p.organization_id)
  )
  or requested_by_member_id = private.team_works_current_project_member_id(project_id)
);

create policy team_works_client_requests_insert
on public.team_works_client_requests for insert to authenticated
with check (
  private.team_works_project_role(project_id) = 'client'
  and requested_by_member_id = private.team_works_current_project_member_id(project_id)
);

create policy team_works_client_requests_update
on public.team_works_client_requests for update to authenticated
using (
  exists (
    select 1 from public.team_works_projects p
    where p.id = project_id and private.team_works_is_org_staff(p.organization_id)
  )
)
with check (
  exists (
    select 1 from public.team_works_projects p
    where p.id = project_id and private.team_works_is_org_staff(p.organization_id)
  )
);

comment on table public.team_works_ops_session_reports is
  'Immutable partner session reports. Canonical attendance/progress remains staff-owned until a reviewed apply flow is added.';
comment on table public.team_works_client_requests is
  'Client-originated requests such as school closures. Staff reviews before creating canonical holiday rows.';

notify pgrst, 'reload schema';
