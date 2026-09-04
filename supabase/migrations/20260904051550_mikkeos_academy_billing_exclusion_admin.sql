-- @ayumi-only management for Academy instructor headcount exclusions.
-- This does not grant Academy access, create a subscription, cancel Stripe,
-- or change Community billing. It only manages the existing exclusion ledger
-- consumed by Academy billing estimates and month-end snapshots.

create table platform_billing_private.academy_billing_exclusion_admins (
  actor_user_id uuid primary key references auth.users(id) on delete restrict,
  canonical_handle text not null unique check (canonical_handle = 'ayumi'),
  approval_evidence text not null check (length(btrim(approval_evidence)) between 1 and 240),
  created_at timestamptz not null default clock_timestamp()
);

alter table platform_billing_private.academy_billing_exclusion_admins enable row level security;
revoke all on platform_billing_private.academy_billing_exclusion_admins
  from public, anon, authenticated, service_role;

do $seed_admin$
declare
  v_actor uuid;
  v_count integer;
begin
  select count(*), (array_agg(profile.user_id order by profile.user_id))[1]
    into v_count, v_actor
  from public.profiles profile
  join auth.users account on account.id = profile.user_id
  join public.mikkeos_hq_staff_members staff on staff.user_id = profile.user_id
  where lower(profile.handle) = 'ayumi'
    and coalesce(account.is_anonymous, false) = false
    and staff.role = 'owner'
    and staff.is_active;

  if v_count > 1 then
    raise exception using errcode = '55000', message = 'MIKKEOS_BILLING_EXCLUSION_ADMIN_PREFLIGHT';
  end if;

  -- Fresh/isolated databases normally have no users. Keep them migratable but
  -- fail closed until the canonical production @ayumi account exists.
  if v_count = 1 and v_actor is not null then
    insert into platform_billing_private.academy_billing_exclusion_admins (
      actor_user_id, canonical_handle, approval_evidence
    ) values (
      v_actor, 'ayumi', 'Ayumi approval 2026-09-04: only @ayumi may manage billing exclusions'
    );
  end if;
end;
$seed_admin$;

create table platform_billing_private.academy_billing_exclusion_events (
  id bigint generated always as identity primary key,
  exclusion_id uuid not null references public.academy_instructor_billing_exclusions(id) on delete restrict,
  action text not null check (action in ('grant', 'revoke')),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  target_profile_id uuid not null references public.profiles(id) on delete restrict,
  headquarters_id uuid not null references public.academy_headquarters(id) on delete restrict,
  reason text not null check (length(btrim(reason)) between 3 and 160),
  recorded_at timestamptz not null default clock_timestamp()
);

alter table platform_billing_private.academy_billing_exclusion_events enable row level security;
revoke all on platform_billing_private.academy_billing_exclusion_events
  from public, anon, authenticated, service_role;

create function platform_billing_private.require_academy_billing_exclusion_admin(
  p_actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if (select auth.role()) <> 'authenticated'
    or p_actor_user_id is null
    or p_actor_user_id <> (select auth.uid())
    or not exists (
      select 1
      from platform_billing_private.academy_billing_exclusion_admins admin
      join auth.users account on account.id = admin.actor_user_id
      join public.profiles profile on profile.user_id = admin.actor_user_id
      join public.mikkeos_hq_staff_members staff on staff.user_id = admin.actor_user_id
      where admin.actor_user_id = p_actor_user_id
        and admin.canonical_handle = 'ayumi'
        and lower(profile.handle) = 'ayumi'
        and coalesce(account.is_anonymous, false) = false
        and staff.role = 'owner'
        and staff.is_active
    ) then
    raise exception using errcode = '42501', message = 'MIKKEOS_BILLING_EXCLUSION_FORBIDDEN';
  end if;
end;
$$;

create function platform_billing_private.academy_billing_exclusion_write_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operation text := coalesce(current_setting('mikkeos.billing_exclusion_operation', true), '');
begin
  -- Database owners remain able to build rollback-only fixtures. Application
  -- roles, including service_role, must use the audited RPCs below.
  if current_user in ('postgres', 'supabase_admin')
    and v_operation = '' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'TRUNCATE' or tg_op = 'DELETE' then
    raise exception using errcode = '42501', message = 'ACADEMY_BILLING_EXCLUSION_IMMUTABLE';
  end if;

  if tg_op = 'INSERT' then
    if v_operation <> 'grant' then
      raise exception using errcode = '42501', message = 'ACADEMY_BILLING_EXCLUSION_GUARDED_FLOW_REQUIRED';
    end if;
    return new;
  end if;

  if v_operation <> 'revoke'
    or (to_jsonb(new) - 'effective_until') is distinct from (to_jsonb(old) - 'effective_until')
    or new.effective_until is null
    or new.effective_until <= old.effective_from
    or (old.effective_until is not null and new.effective_until > old.effective_until) then
    raise exception using errcode = '42501', message = 'ACADEMY_BILLING_EXCLUSION_IMMUTABLE';
  end if;
  return new;
end;
$$;

create trigger academy_billing_exclusion_write_guard
before insert or update or delete on public.academy_instructor_billing_exclusions
for each row execute function platform_billing_private.academy_billing_exclusion_write_guard();

create trigger academy_billing_exclusion_no_truncate
before truncate on public.academy_instructor_billing_exclusions
for each statement execute function platform_billing_private.academy_billing_exclusion_write_guard();

revoke all on public.academy_instructor_billing_exclusions
  from public, anon, authenticated, service_role;

create function public.mikkeos_academy_billing_exclusion_list(p_actor_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_result jsonb;
begin
  perform platform_billing_private.require_academy_billing_exclusion_admin(p_actor_user_id);

  select jsonb_build_object(
    'version', 1,
    'adminHandle', 'ayumi',
    'headquarters', coalesce((
      select jsonb_agg(jsonb_build_object('id', headquarters.id, 'name', headquarters.name) order by headquarters.name, headquarters.id)
      from public.academy_headquarters headquarters
      where headquarters.is_active
    ), '[]'::jsonb),
    'exclusions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', exclusion.id,
        'headquartersId', exclusion.headquarters_id,
        'headquartersName', headquarters.name,
        'targetHandle', profile.handle,
        'reason', exclusion.reason,
        'effectiveFrom', to_char(exclusion.effective_from at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'effectiveUntil', case when exclusion.effective_until is null then null else to_char(exclusion.effective_until at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
        'active', exclusion.effective_from <= statement_timestamp() and (exclusion.effective_until is null or exclusion.effective_until > statement_timestamp())
      ) order by exclusion.created_at desc, exclusion.id desc)
      from public.academy_instructor_billing_exclusions exclusion
      join public.academy_headquarters headquarters on headquarters.id = exclusion.headquarters_id
      join public.profiles profile on profile.id = exclusion.profile_id
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create function public.mikkeos_academy_billing_exclusion_grant(
  p_actor_user_id uuid,
  p_headquarters_id uuid,
  p_target_handle text,
  p_reason text,
  p_effective_until timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_handle text := lower(trim(regexp_replace(coalesce(p_target_handle, ''), '^@', '')));
  v_profile public.profiles%rowtype;
  v_exclusion public.academy_instructor_billing_exclusions%rowtype;
begin
  perform platform_billing_private.require_academy_billing_exclusion_admin(p_actor_user_id);
  if p_headquarters_id is null
    or v_handle !~ '^[a-z0-9_][a-z0-9_-]{2,29}$'
    or length(btrim(coalesce(p_reason, ''))) not between 3 and 160
    or (p_effective_until is not null and (not isfinite(p_effective_until) or p_effective_until <= v_now)) then
    raise exception using errcode = '22023', message = 'MIKKEOS_BILLING_EXCLUSION_INVALID_INPUT';
  end if;

  perform 1 from public.academy_headquarters headquarters
  where headquarters.id = p_headquarters_id
    and headquarters.is_active
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'MIKKEOS_BILLING_EXCLUSION_HEADQUARTERS_NOT_FOUND';
  end if;

  select profile.* into v_profile
  from public.profiles profile
  join auth.users account on account.id = profile.user_id
  where lower(profile.handle) = v_handle
    and coalesce(account.is_anonymous, false) = false
  for update of profile;
  if v_profile.id is null then
    raise exception using errcode = 'P0002', message = 'MIKKEOS_BILLING_EXCLUSION_ACCOUNT_NOT_FOUND';
  end if;

  select exclusion.* into v_exclusion
  from public.academy_instructor_billing_exclusions exclusion
  where exclusion.headquarters_id = p_headquarters_id
    and exclusion.profile_id = v_profile.id
    and exclusion.effective_from <= v_now
    and (exclusion.effective_until is null or exclusion.effective_until > v_now)
  order by exclusion.created_at desc, exclusion.id desc
  limit 1
  for update;
  if found then
    return jsonb_build_object('created', false, 'id', v_exclusion.id);
  end if;

  perform set_config('mikkeos.billing_exclusion_operation', 'grant', true);
  insert into public.academy_instructor_billing_exclusions (
    headquarters_id, profile_id, reason, effective_from, effective_until
  ) values (
    p_headquarters_id, v_profile.id, btrim(p_reason), v_now, p_effective_until
  ) returning * into v_exclusion;

  insert into platform_billing_private.academy_billing_exclusion_events (
    exclusion_id, action, actor_user_id, target_profile_id, headquarters_id, reason
  ) values (
    v_exclusion.id, 'grant', p_actor_user_id, v_profile.id, p_headquarters_id, btrim(p_reason)
  );
  return jsonb_build_object('created', true, 'id', v_exclusion.id);
end;
$$;

create function public.mikkeos_academy_billing_exclusion_revoke(
  p_actor_user_id uuid,
  p_exclusion_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_exclusion public.academy_instructor_billing_exclusions%rowtype;
begin
  perform platform_billing_private.require_academy_billing_exclusion_admin(p_actor_user_id);
  if p_exclusion_id is null or length(btrim(coalesce(p_reason, ''))) not between 3 and 160 then
    raise exception using errcode = '22023', message = 'MIKKEOS_BILLING_EXCLUSION_INVALID_INPUT';
  end if;

  select exclusion.* into v_exclusion
  from public.academy_instructor_billing_exclusions exclusion
  where exclusion.id = p_exclusion_id
  for update;
  if v_exclusion.id is null then
    raise exception using errcode = 'P0002', message = 'MIKKEOS_BILLING_EXCLUSION_NOT_FOUND';
  end if;
  if v_exclusion.effective_until is not null and v_exclusion.effective_until <= v_now then
    return jsonb_build_object('revoked', false, 'id', v_exclusion.id);
  end if;

  perform set_config('mikkeos.billing_exclusion_operation', 'revoke', true);
  update public.academy_instructor_billing_exclusions exclusion
  set effective_until = greatest(v_now, exclusion.effective_from + interval '1 microsecond')
  where exclusion.id = v_exclusion.id;

  insert into platform_billing_private.academy_billing_exclusion_events (
    exclusion_id, action, actor_user_id, target_profile_id, headquarters_id, reason
  ) values (
    v_exclusion.id, 'revoke', p_actor_user_id, v_exclusion.profile_id, v_exclusion.headquarters_id, btrim(p_reason)
  );
  return jsonb_build_object('revoked', true, 'id', v_exclusion.id);
end;
$$;

revoke all on function platform_billing_private.require_academy_billing_exclusion_admin(uuid)
  from public, anon, authenticated, service_role;
revoke all on function platform_billing_private.academy_billing_exclusion_write_guard()
  from public, anon, authenticated, service_role;
revoke all on function public.mikkeos_academy_billing_exclusion_list(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.mikkeos_academy_billing_exclusion_grant(uuid, uuid, text, text, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.mikkeos_academy_billing_exclusion_revoke(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.mikkeos_academy_billing_exclusion_list(uuid) to authenticated;
grant execute on function public.mikkeos_academy_billing_exclusion_grant(uuid, uuid, text, text, timestamptz) to authenticated;
grant execute on function public.mikkeos_academy_billing_exclusion_revoke(uuid, uuid, text) to authenticated;

notify pgrst, 'reload schema';
