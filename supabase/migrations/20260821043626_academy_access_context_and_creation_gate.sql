-- Keep Academy selection separate from portal mode, and require an explicit
-- entitlement before a signed-in user can create a paid headquarters.

create table if not exists public.academy_headquarters_creation_entitlements (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  source text not null,
  status text not null default 'active',
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  consumed_at timestamptz,
  headquarters_id uuid references public.academy_headquarters(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academy_hq_creation_entitlement_source_check
    check (source in ('contract', 'invitation', 'legacy', 'admin')),
  constraint academy_hq_creation_entitlement_status_check
    check (status in ('active', 'consumed', 'revoked', 'expired')),
  constraint academy_hq_creation_entitlement_period_check
    check (valid_until is null or valid_until > valid_from),
  constraint academy_hq_creation_entitlement_consumption_check
    check (
      (status = 'consumed' and consumed_at is not null and headquarters_id is not null)
      or (status <> 'consumed' and consumed_at is null and headquarters_id is null)
    )
);

create index if not exists academy_hq_creation_entitlement_owner_status_idx
  on public.academy_headquarters_creation_entitlements(owner_user_id, status, valid_from, valid_until);

alter table public.academy_headquarters_creation_entitlements enable row level security;

revoke all on table public.academy_headquarters_creation_entitlements from public, anon, authenticated;
grant select on table public.academy_headquarters_creation_entitlements to authenticated;
grant all on table public.academy_headquarters_creation_entitlements to service_role;

drop policy if exists "academy_hq_creation_entitlement_self_select"
  on public.academy_headquarters_creation_entitlements;
create policy "academy_hq_creation_entitlement_self_select"
on public.academy_headquarters_creation_entitlements
for select
to authenticated
using (owner_user_id = (select auth.uid()));

create or replace function private.academy_has_headquarters_creation_entitlement(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.academy_headquarters_creation_entitlements entitlement
    where entitlement.owner_user_id = p_user_id
      and entitlement.status = 'active'
      and entitlement.valid_from <= now()
      and (entitlement.valid_until is null or entitlement.valid_until > now())
  );
$$;

revoke all on function private.academy_has_headquarters_creation_entitlement(uuid)
  from public, anon, authenticated;

create or replace function public.academy_can_create_headquarters()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.academy_has_headquarters_creation_entitlement((select auth.uid())),
    false
  );
$$;

create or replace function public.academy_create_headquarters(p_name text)
returns public.academy_headquarters
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_profile public.profiles%rowtype;
  v_entitlement public.academy_headquarters_creation_entitlements%rowtype;
  v_headquarters public.academy_headquarters%rowtype;
  v_headquarters_id uuid := gen_random_uuid();
  v_handle_base text;
begin
  if v_actor is null then
    raise exception 'academy_headquarters_forbidden';
  end if;
  if nullif(trim(p_name), '') is null or char_length(trim(p_name)) > 100 then
    raise exception 'academy_headquarters_invalid_name';
  end if;

  select profile.* into v_profile
  from public.profiles profile
  where profile.user_id = v_actor
  limit 1;

  if v_profile.id is null then
    raise exception 'academy_profile_not_available';
  end if;

  select entitlement.* into v_entitlement
  from public.academy_headquarters_creation_entitlements entitlement
  where entitlement.owner_user_id = v_actor
    and entitlement.status = 'active'
    and entitlement.valid_from <= now()
    and (entitlement.valid_until is null or entitlement.valid_until > now())
  order by entitlement.valid_until nulls last, entitlement.created_at
  for update skip locked
  limit 1;

  if v_entitlement.id is null then
    raise exception 'academy_headquarters_entitlement_required';
  end if;

  v_handle_base := left(
    trim(both '-' from regexp_replace(lower(v_profile.handle), '[^a-z0-9_-]+', '-', 'g')),
    17
  );
  if v_handle_base = '' then
    v_handle_base := 'academy';
  end if;

  insert into public.academy_headquarters (
    id,
    owner_user_id,
    owner_profile_id,
    name,
    handle,
    plan
  ) values (
    v_headquarters_id,
    v_actor,
    v_profile.id,
    trim(p_name),
    left(v_handle_base || '-academy-' || left(replace(v_headquarters_id::text, '-', ''), 6), 30),
    'small'
  )
  returning * into v_headquarters;

  update public.academy_headquarters_creation_entitlements
  set status = 'consumed',
      consumed_at = now(),
      headquarters_id = v_headquarters.id,
      updated_at = now()
  where id = v_entitlement.id;

  return v_headquarters;
end;
$$;

-- The public table API must no longer create paid headquarters directly.
drop policy if exists "hq insert own" on public.academy_headquarters;
revoke insert on table public.academy_headquarters from anon, authenticated;

-- Preserve the legacy RPC for existing callers, but stop discarding all but
-- the first authorized headquarters.
create or replace function public.academy_get_my_manageable_headquarters()
returns setof public.academy_headquarters
language sql
stable
security definer
set search_path = ''
as $$
  select h.*
  from public.academy_headquarters h
  where private.academy_headquarters_role(h.id, (select auth.uid())) is not null
  order by h.created_at;
$$;

create or replace function public.academy_list_my_contexts()
returns table (
  academy_id uuid,
  academy_name text,
  academy_handle text,
  roles text[],
  portals text[],
  capabilities text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  with actor as (
    select (select auth.uid()) as user_id
  ), context_roles as (
    select headquarters.id as academy_id, 'owner'::text as role
    from public.academy_headquarters headquarters
    cross join actor
    where headquarters.owner_user_id = actor.user_id

    union

    select member.headquarters_id, member.role
    from public.academy_headquarters_members member
    join public.profiles profile on profile.id = member.member_profile_id
    cross join actor
    where profile.user_id = actor.user_id
      and member.status = 'active'

    union

    select instructor.headquarters_id, 'instructor'::text
    from public.academy_instructors instructor
    cross join actor
    where instructor.user_id = actor.user_id
      and instructor.registration_status = 'registered'
      and instructor.is_active = true
  ), grouped as (
    select
      context_roles.academy_id,
      array_agg(context_roles.role order by context_roles.role) as roles,
      bool_or(context_roles.role = 'owner') as is_owner,
      bool_or(context_roles.role = 'administrator') as is_administrator,
      bool_or(context_roles.role = 'course_editor') as is_course_editor,
      bool_or(context_roles.role = 'instructor') as is_instructor
    from context_roles
    group by context_roles.academy_id
  )
  select
    headquarters.id,
    headquarters.name,
    headquarters.handle,
    grouped.roles,
    array_remove(array[
      case when grouped.is_owner or grouped.is_administrator or grouped.is_course_editor then 'manage' end,
      case when grouped.is_instructor then 'teach' end
    ], null),
    array_remove(array[
      case when grouped.is_owner or grouped.is_administrator or grouped.is_course_editor then 'academy:headquarters:view' end,
      case when grouped.is_owner or grouped.is_administrator then 'academy:headquarters:manage' end,
      case when grouped.is_owner then 'academy:members:manage' end,
      case when grouped.is_owner or grouped.is_administrator or grouped.is_course_editor then 'academy:courses:manage' end,
      case when grouped.is_owner or grouped.is_administrator then 'academy:instructors:manage' end,
      case when grouped.is_owner or grouped.is_administrator then 'academy:applications:manage' end,
      case when grouped.is_owner or grouped.is_administrator then 'academy:settings:manage' end,
      case when grouped.is_instructor then 'academy:instructor_portal:view' end
    ], null)
  from grouped
  join public.academy_headquarters headquarters on headquarters.id = grouped.academy_id
  order by headquarters.created_at, headquarters.id;
$$;

revoke all on function public.academy_can_create_headquarters() from public, anon;
revoke all on function public.academy_create_headquarters(text) from public, anon;
revoke all on function public.academy_list_my_contexts() from public, anon;
revoke all on function public.academy_get_my_manageable_headquarters() from public, anon;

grant execute on function public.academy_can_create_headquarters() to authenticated;
grant execute on function public.academy_create_headquarters(text) to authenticated;
grant execute on function public.academy_list_my_contexts() to authenticated;
grant execute on function public.academy_get_my_manageable_headquarters() to authenticated;
