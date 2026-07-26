-- A project assignment is an offer until the worker accepts it in the portal.
-- The project-member row remains to preserve historical schedules/messages.
create table public.team_works_project_partner_offers (
  project_id uuid not null references public.team_works_projects(id) on delete restrict,
  organization_member_id uuid not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'removed')),
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (project_id, organization_member_id),
  constraint team_works_project_partner_offers_member_fkey
    foreign key (project_id, organization_member_id)
    references public.team_works_project_members(project_id, organization_member_id)
    on delete restrict
);

create index team_works_project_partner_offers_member_status_idx
  on public.team_works_project_partner_offers(organization_member_id, status, requested_at desc);

alter table public.team_works_project_partner_offers enable row level security;
alter table public.team_works_project_partner_offers force row level security;
revoke all on table public.team_works_project_partner_offers from public, anon, authenticated;
grant select, insert, update on table public.team_works_project_partner_offers to authenticated;
grant all on table public.team_works_project_partner_offers to service_role;

create policy team_works_project_partner_offers_staff_select
on public.team_works_project_partner_offers for select to authenticated
using (private.team_works_is_project_staff(project_id));

create policy team_works_project_partner_offers_worker_select
on public.team_works_project_partner_offers for select to authenticated
using (organization_member_id = private.team_works_current_project_member_id(project_id));

create policy team_works_project_partner_offers_staff_insert
on public.team_works_project_partner_offers for insert to authenticated
with check (private.team_works_is_project_staff(project_id));

create policy team_works_project_partner_offers_staff_update
on public.team_works_project_partner_offers for update to authenticated
using (private.team_works_is_project_staff(project_id))
with check (private.team_works_is_project_staff(project_id));

create policy team_works_project_partner_offers_worker_response
on public.team_works_project_partner_offers for update to authenticated
using (
  organization_member_id = private.team_works_current_project_member_id(project_id)
  and status = 'pending'
)
with check (
  organization_member_id = private.team_works_current_project_member_id(project_id)
  and status in ('accepted', 'declined')
);

comment on table public.team_works_project_partner_offers is
  'Worker-facing project offers. Workers can only read and accept or decline their own pending offer.';

notify pgrst, 'reload schema';
