-- Fund F4-b1: establish database-owned Fund projects and owner-private supports.
-- UI persistence remains on localStorage until F4-c. This migration only creates
-- the ownership boundary required by later claim and consent work.

create extension if not exists pgcrypto;

do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'public.profiles is required before Fund F4-b1';
  end if;
end;
$$;

-- The composite key lets Postgres enforce that owner_profile_id belongs to
-- owner_user_id instead of trusting a client-provided pair.
create unique index if not exists profiles_id_user_id_unique_idx
  on public.profiles (id, user_id);

create table if not exists public.fund_projects (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  owner_profile_id uuid not null,
  source_local_id text,
  slug text not null,
  title text not null,
  visibility text not null default 'private',
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fund_projects_owner_profile_fkey
    foreign key (owner_profile_id, owner_user_id)
    references public.profiles(id, user_id)
    on delete cascade,
  constraint fund_projects_slug_format_check
    check (slug ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  constraint fund_projects_visibility_check
    check (visibility in ('private', 'unlisted', 'public')),
  constraint fund_projects_status_check
    check (
      status in (
        'draft',
        'interest_open',
        'ready',
        'open',
        'goal_reached',
        'closed',
        'in_progress',
        'delivering',
        'completed',
        'postponed',
        'cancelled',
        'archived'
      )
    ),
  constraint fund_projects_owner_profile_slug_unique
    unique (owner_profile_id, slug)
);

create index if not exists fund_projects_owner_user_id_idx
  on public.fund_projects (owner_user_id);

create unique index fund_projects_owner_source_local_id_unique_idx
  on public.fund_projects (owner_user_id, source_local_id)
  where source_local_id is not null;

create table if not exists public.fund_supports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.fund_projects(id) on delete cascade,
  source_local_id text,
  plan_source_id text,
  supporter_name text not null,
  supporter_email text,
  comment text,
  support_type text not null default 'support',
  amount numeric(12, 2),
  quantity integer not null default 1,
  payment_status text not null default 'unknown',
  fulfillment_status text not null default 'not_required',
  record_status text not null default 'valid',
  source text not null default 'manual',
  supported_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fund_supports_support_type_check
    check (
      support_type in (
        'preorder',
        'early_application',
        'reservation',
        'sponsorship',
        'support',
        'interest',
        'non_financial'
      )
    ),
  constraint fund_supports_amount_check
    check (amount is null or amount >= 0),
  constraint fund_supports_quantity_check
    check (quantity > 0),
  constraint fund_supports_payment_status_check
    check (payment_status in ('unknown', 'pending', 'confirmed', 'refunded', 'cancelled')),
  constraint fund_supports_fulfillment_status_check
    check (
      fulfillment_status in (
        'not_required',
        'waiting',
        'preparing',
        'scheduled',
        'shipped',
        'participated',
        'in_service',
        'completed',
        'on_hold',
        'cancelled'
      )
    ),
  constraint fund_supports_record_status_check
    check (record_status in ('valid', 'test', 'duplicate', 'invalid'))
);

create index if not exists fund_supports_project_id_idx
  on public.fund_supports (project_id);

create unique index fund_supports_project_source_local_id_unique_idx
  on public.fund_supports (project_id, source_local_id)
  where source_local_id is not null;

create or replace function public.set_fund_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_fund_updated_at() from public, anon, authenticated;
grant execute on function public.set_fund_updated_at() to postgres, service_role;

drop trigger if exists set_fund_projects_updated_at on public.fund_projects;
create trigger set_fund_projects_updated_at
before update on public.fund_projects
for each row execute function public.set_fund_updated_at();

drop trigger if exists set_fund_supports_updated_at on public.fund_supports;
create trigger set_fund_supports_updated_at
before update on public.fund_supports
for each row execute function public.set_fund_updated_at();

alter table public.fund_projects enable row level security;
alter table public.fund_projects force row level security;
alter table public.fund_supports enable row level security;
alter table public.fund_supports force row level security;

revoke all on table public.fund_projects from public, anon;
revoke all on table public.fund_supports from public, anon;
grant select, insert, update, delete on table public.fund_projects to authenticated;
grant select, insert, update, delete on table public.fund_supports to authenticated;
grant all on table public.fund_projects to service_role;
grant all on table public.fund_supports to service_role;

drop policy if exists "fund_projects_select_own" on public.fund_projects;
create policy "fund_projects_select_own"
on public.fund_projects
for select
to authenticated
using ((select auth.uid()) = owner_user_id);

drop policy if exists "fund_projects_insert_own" on public.fund_projects;
create policy "fund_projects_insert_own"
on public.fund_projects
for insert
to authenticated
with check (
  (select auth.uid()) = owner_user_id
  and exists (
    select 1
    from public.profiles
    where profiles.id = fund_projects.owner_profile_id
      and profiles.user_id = (select auth.uid())
  )
);

drop policy if exists "fund_projects_update_own" on public.fund_projects;
create policy "fund_projects_update_own"
on public.fund_projects
for update
to authenticated
using ((select auth.uid()) = owner_user_id)
with check (
  (select auth.uid()) = owner_user_id
  and exists (
    select 1
    from public.profiles
    where profiles.id = fund_projects.owner_profile_id
      and profiles.user_id = (select auth.uid())
  )
);

drop policy if exists "fund_projects_delete_own" on public.fund_projects;
create policy "fund_projects_delete_own"
on public.fund_projects
for delete
to authenticated
using ((select auth.uid()) = owner_user_id);

drop policy if exists "fund_supports_select_own_project" on public.fund_supports;
create policy "fund_supports_select_own_project"
on public.fund_supports
for select
to authenticated
using (
  exists (
    select 1
    from public.fund_projects
    where fund_projects.id = fund_supports.project_id
      and fund_projects.owner_user_id = (select auth.uid())
  )
);

drop policy if exists "fund_supports_insert_own_project" on public.fund_supports;
create policy "fund_supports_insert_own_project"
on public.fund_supports
for insert
to authenticated
with check (
  exists (
    select 1
    from public.fund_projects
    where fund_projects.id = fund_supports.project_id
      and fund_projects.owner_user_id = (select auth.uid())
  )
);

drop policy if exists "fund_supports_update_own_project" on public.fund_supports;
create policy "fund_supports_update_own_project"
on public.fund_supports
for update
to authenticated
using (
  exists (
    select 1
    from public.fund_projects
    where fund_projects.id = fund_supports.project_id
      and fund_projects.owner_user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.fund_projects
    where fund_projects.id = fund_supports.project_id
      and fund_projects.owner_user_id = (select auth.uid())
  )
);

drop policy if exists "fund_supports_delete_own_project" on public.fund_supports;
create policy "fund_supports_delete_own_project"
on public.fund_supports
for delete
to authenticated
using (
  exists (
    select 1
    from public.fund_projects
    where fund_projects.id = fund_supports.project_id
      and fund_projects.owner_user_id = (select auth.uid())
  )
);

comment on table public.fund_projects is
  'Fund owner boundary for F4. Public Fund content is not exposed from this table.';

comment on table public.fund_supports is
  'Owner-private Fund support records. Never expose supporter identity or amount to anon.';

select 'Fund F4-b1 migration applied' as result;
