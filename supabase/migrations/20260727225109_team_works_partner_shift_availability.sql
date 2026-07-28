-- Team Works operations: monthly availability submitted by partners.
-- Partners can manage only their own worker-row submission.
-- Organization staff can review submissions for scheduling.

create table public.team_works_partner_shift_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.team_works_organizations(id) on delete cascade,
  partner_member_id uuid not null references public.team_works_organization_members(id) on delete cascade,
  target_month date not null,
  desired_days integer not null default 0 check (desired_days between 0 and 31),
  available_dates date[] not null default '{}'::date[],
  note text,
  status text not null default 'submitted'
    check (status in ('draft', 'submitted', 'confirmed', 'returned')),
  submitted_at timestamptz,
  confirmed_at timestamptz,
  confirmed_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner_member_id, target_month),
  check (target_month = date_trunc('month', target_month)::date)
);

create index team_works_partner_shift_submissions_org_month_idx
  on public.team_works_partner_shift_submissions (organization_id, target_month);

alter table public.team_works_partner_shift_submissions enable row level security;

create policy team_works_partner_shift_submissions_select
on public.team_works_partner_shift_submissions
for select to authenticated
using (
  private.team_works_is_org_staff(organization_id)
  or exists (
    select 1
    from public.team_works_organization_members member
    where member.id = partner_member_id
      and member.organization_id = team_works_partner_shift_submissions.organization_id
      and member.user_id = (select auth.uid())
      and member.role = 'worker'
      and member.status = 'active'
  )
);

create policy team_works_partner_shift_submissions_partner_insert
on public.team_works_partner_shift_submissions
for insert to authenticated
with check (
  confirmed_at is null
  and confirmed_by_user_id is null
  and status in ('draft', 'submitted')
  and exists (
    select 1
    from public.team_works_organization_members member
    where member.id = partner_member_id
      and member.organization_id = team_works_partner_shift_submissions.organization_id
      and member.user_id = (select auth.uid())
      and member.role = 'worker'
      and member.status = 'active'
  )
);

create policy team_works_partner_shift_submissions_partner_update
on public.team_works_partner_shift_submissions
for update to authenticated
using (
  exists (
    select 1
    from public.team_works_organization_members member
    where member.id = partner_member_id
      and member.organization_id = team_works_partner_shift_submissions.organization_id
      and member.user_id = (select auth.uid())
      and member.role = 'worker'
      and member.status = 'active'
  )
)
with check (
  confirmed_at is null
  and confirmed_by_user_id is null
  and status in ('draft', 'submitted')
  and exists (
    select 1
    from public.team_works_organization_members member
    where member.id = partner_member_id
      and member.organization_id = team_works_partner_shift_submissions.organization_id
      and member.user_id = (select auth.uid())
      and member.role = 'worker'
      and member.status = 'active'
  )
);

create policy team_works_partner_shift_submissions_staff_update
on public.team_works_partner_shift_submissions
for update to authenticated
using (private.team_works_is_org_staff(organization_id))
with check (private.team_works_is_org_staff(organization_id));

revoke all on table public.team_works_partner_shift_submissions from public, anon, authenticated;
grant select, insert, update on table public.team_works_partner_shift_submissions to authenticated;
grant all on table public.team_works_partner_shift_submissions to service_role;

notify pgrst, 'reload schema';
