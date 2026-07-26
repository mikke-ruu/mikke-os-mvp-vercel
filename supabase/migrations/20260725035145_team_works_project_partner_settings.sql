-- Per-project partner settings preserve historical schedules and messages even
-- when a partner is removed from a project.
create table public.team_works_project_partner_settings (
  project_id uuid not null references public.team_works_projects(id) on delete restrict,
  organization_member_id uuid not null,
  hourly_wage integer check (hourly_wage is null or hourly_wage >= 0),
  status text not null default 'active' check (status in ('active', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, organization_member_id),
  constraint team_works_project_partner_settings_member_fkey
    foreign key (project_id, organization_member_id)
    references public.team_works_project_members(project_id, organization_member_id)
    on delete restrict
);

create index team_works_project_partner_settings_project_status_idx
  on public.team_works_project_partner_settings(project_id, status);

alter table public.team_works_project_partner_settings enable row level security;
alter table public.team_works_project_partner_settings force row level security;
revoke all on table public.team_works_project_partner_settings from public, anon, authenticated;
grant select, insert, update on table public.team_works_project_partner_settings to authenticated;
grant all on table public.team_works_project_partner_settings to service_role;

create policy team_works_project_partner_settings_select
on public.team_works_project_partner_settings for select to authenticated
using (private.team_works_is_project_staff(project_id));

create policy team_works_project_partner_settings_insert
on public.team_works_project_partner_settings for insert to authenticated
with check (private.team_works_is_project_staff(project_id));

create policy team_works_project_partner_settings_update
on public.team_works_project_partner_settings for update to authenticated
using (private.team_works_is_project_staff(project_id))
with check (private.team_works_is_project_staff(project_id));

comment on table public.team_works_project_partner_settings is
  'Project-specific wage and membership state. Removed retains historical records while hiding the partner from current operations.';

notify pgrst, 'reload schema';
