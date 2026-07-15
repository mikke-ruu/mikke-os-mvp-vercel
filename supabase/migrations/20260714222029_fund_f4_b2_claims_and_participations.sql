-- Fund F4-b2: private support claims, consent-bound participations, and a
-- minimal public projection. Fund UI remains localStorage-backed until F4-c.

create schema if not exists private;

create table public.fund_support_claims (
  id uuid primary key default extensions.gen_random_uuid(),
  support_id uuid not null references public.fund_supports(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_by_user_id uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),

  constraint fund_support_claims_token_hash_format_check
    check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint fund_support_claims_expires_after_created_check
    check (expires_at > created_at),
  constraint fund_support_claims_acceptance_pair_check
    check (
      (accepted_by_user_id is null and accepted_at is null)
      or (accepted_by_user_id is not null and accepted_at is not null)
    )
);

create unique index fund_support_claims_one_active_per_support_idx
  on public.fund_support_claims (support_id)
  where accepted_at is null and revoked_at is null;

create index fund_support_claims_support_id_idx
  on public.fund_support_claims (support_id);

create table public.fund_participations (
  id uuid primary key default extensions.gen_random_uuid(),
  project_id uuid not null references public.fund_projects(id) on delete cascade,
  support_id uuid not null unique references public.fund_supports(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  supporter_user_id uuid not null references auth.users(id) on delete cascade,
  supporter_profile_id uuid not null,
  owner_consent_status text not null default 'granted',
  supporter_consent_status text not null default 'pending',
  public_name text,
  display_mode text not null default 'hidden',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fund_participations_supporter_profile_fkey
    foreign key (supporter_profile_id, supporter_user_id)
    references public.profiles(id, user_id)
    on delete cascade,
  constraint fund_participations_owner_consent_status_check
    check (owner_consent_status in ('pending', 'granted', 'revoked')),
  constraint fund_participations_supporter_consent_status_check
    check (supporter_consent_status in ('pending', 'granted', 'revoked')),
  constraint fund_participations_display_mode_check
    check (display_mode in ('hidden', 'public_name', 'anonymous')),
  constraint fund_participations_public_name_length_check
    check (public_name is null or char_length(public_name) <= 80)
);

create index fund_participations_project_id_idx
  on public.fund_participations (project_id);

create index fund_participations_owner_user_id_idx
  on public.fund_participations (owner_user_id);

create index fund_participations_supporter_user_id_idx
  on public.fund_participations (supporter_user_id);

create table public.fund_public_participations (
  participation_id uuid primary key
    references public.fund_participations(id) on delete cascade,
  project_id uuid not null references public.fund_projects(id) on delete cascade,
  supporter_profile_id uuid references public.profiles(id) on delete set null,
  display_name text not null,
  is_anonymous boolean not null,
  public_fund_path text not null,
  published_at timestamptz not null default now(),

  constraint fund_public_participations_display_name_length_check
    check (char_length(display_name) between 1 and 80),
  constraint fund_public_participations_path_format_check
    check (public_fund_path ~ '^/fund/[a-z0-9][a-z0-9-]{0,79}/[a-z0-9][a-z0-9-]{0,79}$')
);

create index fund_public_participations_project_id_idx
  on public.fund_public_participations (project_id);

-- This function is intentionally private and is called only from the limited
-- RPCs and trusted triggers below. It materializes no private support fields.
create or replace function private.sync_fund_public_participation(
  p_participation_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_participation public.fund_participations%rowtype;
  v_project public.fund_projects%rowtype;
  v_support public.fund_supports%rowtype;
  v_owner_handle text;
  v_display_name text;
begin
  select * into v_participation
  from public.fund_participations
  where id = p_participation_id;

  if not found then
    delete from public.fund_public_participations
    where participation_id = p_participation_id;
    return;
  end if;

  select * into v_project
  from public.fund_projects
  where id = v_participation.project_id;

  select * into v_support
  from public.fund_supports
  where id = v_participation.support_id;

  select handle into v_owner_handle
  from public.profiles
  where id = v_project.owner_profile_id;

  if v_project.visibility <> 'public'
    or v_support.record_status <> 'valid'
    or v_participation.owner_consent_status <> 'granted'
    or v_participation.supporter_consent_status <> 'granted'
    or v_participation.display_mode = 'hidden'
    or v_owner_handle is null then
    delete from public.fund_public_participations
    where participation_id = p_participation_id;
    return;
  end if;

  v_display_name := case
    when v_participation.display_mode = 'anonymous' then '匿名の応援者'
    else coalesce(nullif(btrim(v_participation.public_name), ''), '応援者')
  end;

  insert into public.fund_public_participations (
    participation_id,
    project_id,
    supporter_profile_id,
    display_name,
    is_anonymous,
    public_fund_path,
    published_at
  ) values (
    v_participation.id,
    v_participation.project_id,
    case when v_participation.display_mode = 'anonymous' then null else v_participation.supporter_profile_id end,
    v_display_name,
    v_participation.display_mode = 'anonymous',
    '/fund/' || v_owner_handle || '/' || v_project.slug,
    now()
  )
  on conflict (participation_id) do update set
    project_id = excluded.project_id,
    supporter_profile_id = excluded.supporter_profile_id,
    display_name = excluded.display_name,
    is_anonymous = excluded.is_anonymous,
    public_fund_path = excluded.public_fund_path,
    published_at = excluded.published_at;
end;
$$;

create or replace function private.sync_fund_public_participation_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_participation_id uuid;
begin
  if tg_table_name = 'fund_participations' then
    perform private.sync_fund_public_participation(new.id);
  elsif tg_table_name = 'fund_projects' then
    for v_participation_id in
      select id from public.fund_participations where project_id = new.id
    loop
      perform private.sync_fund_public_participation(v_participation_id);
    end loop;
  elsif tg_table_name = 'fund_supports' then
    for v_participation_id in
      select id from public.fund_participations where support_id = new.id
    loop
      perform private.sync_fund_public_participation(v_participation_id);
    end loop;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_fund_public_participation(uuid) from public, anon, authenticated;
revoke all on function private.sync_fund_public_participation_trigger() from public, anon, authenticated;

drop trigger if exists sync_fund_public_participation_after_change on public.fund_participations;
create trigger sync_fund_public_participation_after_change
after insert or update of owner_consent_status, supporter_consent_status, public_name, display_mode
on public.fund_participations
for each row execute function private.sync_fund_public_participation_trigger();

drop trigger if exists sync_fund_public_participation_after_project_visibility_change on public.fund_projects;
create trigger sync_fund_public_participation_after_project_visibility_change
after update of visibility on public.fund_projects
for each row execute function private.sync_fund_public_participation_trigger();

drop trigger if exists sync_fund_public_participation_after_support_validity_change on public.fund_supports;
create trigger sync_fund_public_participation_after_support_validity_change
after update of record_status on public.fund_supports
for each row execute function private.sync_fund_public_participation_trigger();

drop trigger if exists set_fund_participations_updated_at on public.fund_participations;
create trigger set_fund_participations_updated_at
before update on public.fund_participations
for each row execute function public.set_fund_updated_at();

alter table public.fund_support_claims enable row level security;
alter table public.fund_support_claims force row level security;
alter table public.fund_participations enable row level security;
alter table public.fund_participations force row level security;
alter table public.fund_public_participations enable row level security;
alter table public.fund_public_participations force row level security;

revoke all on table public.fund_support_claims from public, anon, authenticated;
revoke all on table public.fund_participations from public, anon, authenticated;
revoke all on table public.fund_public_participations from public, anon, authenticated;
grant select on table public.fund_support_claims to authenticated;
grant select on table public.fund_participations to authenticated;
grant select on table public.fund_public_participations to anon, authenticated;
grant all on table public.fund_support_claims, public.fund_participations, public.fund_public_participations to service_role;

create policy "fund_support_claims_select_own_project"
on public.fund_support_claims
for select to authenticated
using (
  exists (
    select 1
    from public.fund_supports
    join public.fund_projects on fund_projects.id = fund_supports.project_id
    where fund_supports.id = fund_support_claims.support_id
      and fund_projects.owner_user_id = (select auth.uid())
  )
);

create policy "fund_participations_select_owner_or_supporter"
on public.fund_participations
for select to authenticated
using (
  owner_user_id = (select auth.uid())
  or supporter_user_id = (select auth.uid())
);

create policy "fund_public_participations_select_published"
on public.fund_public_participations
for select to anon, authenticated
using (true);

create or replace function public.create_fund_support_claim(
  p_support_id uuid,
  p_expires_at timestamptz
)
returns table (claim_id uuid, invite_token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_token text;
  v_token_hash text;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '30 days' then
    raise exception 'claim expiry must be between now and 30 days' using errcode = '22023';
  end if;

  perform 1
  from public.fund_supports
  join public.fund_projects on fund_projects.id = fund_supports.project_id
  where fund_supports.id = p_support_id
    and fund_supports.record_status = 'valid'
    and fund_projects.owner_user_id = v_actor
  for update of fund_supports;

  if not found then
    raise exception 'support record not found' using errcode = '42501';
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  insert into public.fund_support_claims (support_id, token_hash, expires_at)
  values (p_support_id, v_token_hash, p_expires_at)
  returning id, v_token, fund_support_claims.expires_at
  into claim_id, invite_token, expires_at;

  return next;
exception
  when unique_violation then
    raise exception 'an active claim already exists for this support record' using errcode = '23505';
end;
$$;

create or replace function public.revoke_fund_support_claim(p_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  update public.fund_support_claims
  set revoked_at = now()
  where id = p_claim_id
    and accepted_at is null
    and revoked_at is null
    and exists (
      select 1
      from public.fund_supports
      join public.fund_projects on fund_projects.id = fund_supports.project_id
      where fund_supports.id = fund_support_claims.support_id
        and fund_projects.owner_user_id = v_actor
    );

  if not found then
    raise exception 'active claim not found' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.accept_fund_support_claim(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_claim public.fund_support_claims%rowtype;
  v_support public.fund_supports%rowtype;
  v_project public.fund_projects%rowtype;
  v_profile_id uuid;
  v_participation_id uuid;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid claim token' using errcode = '22023';
  end if;

  select * into v_claim
  from public.fund_support_claims
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  for update;

  if not found
    or v_claim.revoked_at is not null
    or v_claim.accepted_at is not null
    or v_claim.expires_at <= now() then
    raise exception 'claim token is unavailable' using errcode = '42501';
  end if;

  select * into v_support
  from public.fund_supports
  where id = v_claim.support_id
  for update;

  select * into v_project
  from public.fund_projects
  where id = v_support.project_id;

  if v_support.record_status <> 'valid' then
    raise exception 'support record is unavailable' using errcode = '42501';
  end if;

  select id into v_profile_id
  from public.profiles
  where user_id = v_actor
  limit 1;

  if v_profile_id is null then
    raise exception 'a Mikke profile is required before accepting a claim' using errcode = '42501';
  end if;

  insert into public.fund_participations (
    project_id,
    support_id,
    owner_user_id,
    supporter_user_id,
    supporter_profile_id,
    owner_consent_status,
    supporter_consent_status,
    display_mode
  ) values (
    v_project.id,
    v_support.id,
    v_project.owner_user_id,
    v_actor,
    v_profile_id,
    'granted',
    'pending',
    'hidden'
  ) returning id into v_participation_id;

  update public.fund_support_claims
  set accepted_by_user_id = v_actor,
      accepted_at = now()
  where id = v_claim.id;

  return v_participation_id;
end;
$$;

create or replace function public.update_fund_participation_consent(
  p_participation_id uuid,
  p_owner_consent_status text default null,
  p_supporter_consent_status text default null,
  p_public_name text default null,
  p_display_mode text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_participation public.fund_participations%rowtype;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_participation
  from public.fund_participations
  where id = p_participation_id
  for update;

  if not found then
    raise exception 'participation not found' using errcode = '42501';
  end if;

  if v_participation.owner_user_id = v_actor then
    if p_owner_consent_status is null
      or p_supporter_consent_status is not null
      or p_public_name is not null
      or p_display_mode is not null
      or p_owner_consent_status not in ('pending', 'granted', 'revoked') then
      raise exception 'owner may update only owner consent' using errcode = '42501';
    end if;

    update public.fund_participations
    set owner_consent_status = p_owner_consent_status
    where id = v_participation.id;
  elsif v_participation.supporter_user_id = v_actor then
    if p_owner_consent_status is not null
      or (p_supporter_consent_status is null and p_public_name is null and p_display_mode is null)
      or (p_supporter_consent_status is not null and p_supporter_consent_status not in ('pending', 'granted', 'revoked'))
      or (p_display_mode is not null and p_display_mode not in ('hidden', 'public_name', 'anonymous'))
      or (p_public_name is not null and char_length(p_public_name) > 80) then
      raise exception 'supporter request contains an unavailable field' using errcode = '42501';
    end if;

    update public.fund_participations
    set supporter_consent_status = coalesce(p_supporter_consent_status, supporter_consent_status),
        public_name = coalesce(p_public_name, public_name),
        display_mode = coalesce(p_display_mode, display_mode)
    where id = v_participation.id;
  else
    raise exception 'participation not found' using errcode = '42501';
  end if;

  return v_participation.id;
end;
$$;

revoke all on function public.create_fund_support_claim(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.revoke_fund_support_claim(uuid) from public, anon, authenticated;
revoke all on function public.accept_fund_support_claim(text) from public, anon, authenticated;
revoke all on function public.update_fund_participation_consent(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_fund_support_claim(uuid, timestamptz) to authenticated;
grant execute on function public.revoke_fund_support_claim(uuid) to authenticated;
grant execute on function public.accept_fund_support_claim(text) to authenticated;
grant execute on function public.update_fund_participation_consent(uuid, text, text, text, text) to authenticated;
grant execute on function public.create_fund_support_claim(uuid, timestamptz) to service_role;
grant execute on function public.revoke_fund_support_claim(uuid) to service_role;
grant execute on function public.accept_fund_support_claim(text) to service_role;
grant execute on function public.update_fund_participation_consent(uuid, text, text, text, text) to service_role;

comment on table public.fund_support_claims is
  'Private hashed Fund claim tokens. Raw tokens are returned once by the claim RPC and never stored.';
comment on table public.fund_participations is
  'Owner/supporter shared consent record. Mutations are restricted to consent RPCs.';
comment on table public.fund_public_participations is
  'Public-safe Fund participation projection. Excludes supporter contact data, support amounts, and comments.';
