
-- Academy headquarters collaboration without tenant or sample-data seeding.
-- Apply only after 20260815044544_academy_class_scheduling_and_instructor_requests.sql.

alter table public.academy_headquarters
  add column if not exists next_instructor_number integer null;

alter table public.academy_headquarters
  drop constraint if exists academy_headquarters_next_instructor_number_check,
  add constraint academy_headquarters_next_instructor_number_check
    check (next_instructor_number is null or next_instructor_number > 0);

create table if not exists public.academy_headquarters_settings (
  headquarters_id uuid primary key references public.academy_headquarters(id) on delete cascade,
  feature_flags jsonb not null default '{}'::jsonb check (jsonb_typeof(feature_flags) = 'object'),
  updated_by_user_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academy_headquarters_members (
  id uuid primary key default gen_random_uuid(),
  headquarters_id uuid not null references public.academy_headquarters(id) on delete cascade,
  member_profile_id uuid not null references public.profiles(id) on delete restrict,
  role text not null check (role in ('administrator', 'course_editor')),
  status text not null default 'active' check (status in ('active', 'stopped')),
  invited_by_user_id uuid not null references auth.users(id) on delete restrict,
  accepted_at timestamptz not null default now(),
  stopped_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (headquarters_id, member_profile_id)
);

create table if not exists public.academy_headquarters_invitations (
  id uuid primary key default gen_random_uuid(),
  headquarters_id uuid not null references public.academy_headquarters(id) on delete cascade,
  target_profile_id uuid not null references public.profiles(id) on delete restrict,
  role text not null check (role in ('administrator', 'course_editor')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  invited_by_user_id uuid not null references auth.users(id) on delete restrict,
  responded_at timestamptz null,
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (headquarters_id, target_profile_id)
);

create index if not exists academy_hq_members_profile_idx
  on public.academy_headquarters_members(member_profile_id, status);
create index if not exists academy_hq_invitations_target_idx
  on public.academy_headquarters_invitations(target_profile_id, status);
create index if not exists academy_hq_settings_updated_by_idx
  on public.academy_headquarters_settings(updated_by_user_id);
create index if not exists academy_hq_members_invited_by_idx
  on public.academy_headquarters_members(invited_by_user_id);
create index if not exists academy_hq_invitations_invited_by_idx
  on public.academy_headquarters_invitations(invited_by_user_id);

alter table public.academy_headquarters_settings enable row level security;
alter table public.academy_headquarters_members enable row level security;
alter table public.academy_headquarters_invitations enable row level security;

revoke all on table public.academy_headquarters_settings from public, anon, authenticated;
revoke all on table public.academy_headquarters_members from public, anon, authenticated;
revoke all on table public.academy_headquarters_invitations from public, anon, authenticated;
grant select, insert, update on table public.academy_headquarters_settings to authenticated;
grant select on table public.academy_headquarters_members to authenticated;
grant select on table public.academy_headquarters_invitations to authenticated;

create or replace function private.academy_headquarters_role(
  p_headquarters_id uuid,
  p_user_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1
      from public.academy_headquarters h
      where h.id = p_headquarters_id
        and h.owner_user_id = p_user_id
    ) then 'owner'
    else (
      select m.role
      from public.academy_headquarters_members m
      join public.profiles p on p.id = m.member_profile_id
      where m.headquarters_id = p_headquarters_id
        and p.user_id = p_user_id
        and m.status = 'active'
      limit 1
    )
  end;
$$;

revoke all on function private.academy_headquarters_role(uuid, uuid) from public, anon;
grant execute on function private.academy_headquarters_role(uuid, uuid) to authenticated;

create or replace function private.academy_can_manage_headquarters(p_headquarters_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.academy_headquarters_role(p_headquarters_id, (select auth.uid()))
      in ('owner', 'administrator'),
    false
  );
$$;

create or replace function private.academy_can_edit_courses(p_headquarters_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.academy_headquarters_role(p_headquarters_id, (select auth.uid()))
      in ('owner', 'administrator', 'course_editor'),
    false
  );
$$;

revoke all on function private.academy_can_manage_headquarters(uuid) from public, anon;
revoke all on function private.academy_can_edit_courses(uuid) from public, anon;
grant execute on function private.academy_can_manage_headquarters(uuid) to authenticated;
grant execute on function private.academy_can_edit_courses(uuid) to authenticated;

create or replace function public.academy_update_headquarters_profile(
  p_headquarters_id uuid,
  p_patch jsonb
)
returns public.academy_headquarters
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_headquarters public.academy_headquarters%rowtype;
begin
  if (select auth.uid()) is null
    or not private.academy_can_manage_headquarters(p_headquarters_id) then
    raise exception 'academy_headquarters_forbidden';
  end if;
  if jsonb_typeof(coalesce(p_patch, '{}'::jsonb)) <> 'object' then
    raise exception 'academy_headquarters_invalid_patch';
  end if;

  update public.academy_headquarters h
  set name = case when p_patch ? 'name' then coalesce(nullif(trim(p_patch ->> 'name'), ''), h.name) else h.name end,
      tagline = case when p_patch ? 'tagline' then nullif(trim(p_patch ->> 'tagline'), '') else h.tagline end,
      front_message = case when p_patch ? 'front_message' then nullif(trim(p_patch ->> 'front_message'), '') else h.front_message end,
      hero_image_url = case when p_patch ? 'hero_image_url' then nullif(trim(p_patch ->> 'hero_image_url'), '') else h.hero_image_url end,
      logo_url = case when p_patch ? 'logo_url' then nullif(trim(p_patch ->> 'logo_url'), '') else h.logo_url end,
      contact_email = case when p_patch ? 'contact_email' then nullif(trim(p_patch ->> 'contact_email'), '') else h.contact_email end,
      default_payment_note = case when p_patch ? 'default_payment_note' then nullif(trim(p_patch ->> 'default_payment_note'), '') else h.default_payment_note end,
      main_color = case when p_patch ? 'main_color' then nullif(trim(p_patch ->> 'main_color'), '') else h.main_color end,
      renewal_period_months = case when p_patch ? 'renewal_period_months' then (p_patch ->> 'renewal_period_months')::integer else h.renewal_period_months end,
      next_instructor_number = case when p_patch ? 'next_instructor_number' then (p_patch ->> 'next_instructor_number')::integer else h.next_instructor_number end,
      front_blocks = case when p_patch ? 'front_blocks' then coalesce(p_patch -> 'front_blocks', '[]'::jsonb) else h.front_blocks end,
      updated_at = now()
  where h.id = p_headquarters_id
  returning * into v_headquarters;

  if v_headquarters.id is null then
    raise exception 'academy_headquarters_not_found';
  end if;
  return v_headquarters;
end;
$$;

revoke all on function public.academy_update_headquarters_profile(uuid, jsonb) from public, anon;
grant execute on function public.academy_update_headquarters_profile(uuid, jsonb) to authenticated;

create policy "academy_hq_settings_manager_all"
on public.academy_headquarters_settings
for all to authenticated
using (private.academy_can_manage_headquarters(headquarters_id))
with check (
  private.academy_can_manage_headquarters(headquarters_id)
  and updated_by_user_id = (select auth.uid())
);

create policy "academy_hq_members_manager_select"
on public.academy_headquarters_members
for select to authenticated
using (
  private.academy_can_manage_headquarters(headquarters_id)
  or exists (
    select 1 from public.profiles p
    where p.id = member_profile_id and p.user_id = (select auth.uid())
  )
);

create policy "academy_hq_invitations_participant_select"
on public.academy_headquarters_invitations
for select to authenticated
using (
  private.academy_can_manage_headquarters(headquarters_id)
  or exists (
    select 1 from public.profiles p
    where p.id = target_profile_id and p.user_id = (select auth.uid())
  )
);

create policy "academy_headquarters_member_select"
on public.academy_headquarters
for select to authenticated
using (private.academy_headquarters_role(id, (select auth.uid())) is not null);

create or replace function private.academy_guard_headquarters_ownership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_user_id is distinct from old.owner_user_id
    or new.owner_profile_id is distinct from old.owner_profile_id then
    raise exception 'academy_headquarters_ownership_is_immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists academy_guard_headquarters_ownership
  on public.academy_headquarters;
create trigger academy_guard_headquarters_ownership
before update on public.academy_headquarters
for each row execute function private.academy_guard_headquarters_ownership();

create policy "academy_courses_collaborator_select"
on public.academy_courses
for select to authenticated
using (private.academy_can_edit_courses(headquarters_id));

create policy "academy_courses_collaborator_insert"
on public.academy_courses
for insert to authenticated
with check (
  private.academy_can_edit_courses(headquarters_id)
  and user_id = (select auth.uid())
);

create policy "academy_courses_collaborator_update"
on public.academy_courses
for update to authenticated
using (private.academy_can_edit_courses(headquarters_id))
with check (private.academy_can_edit_courses(headquarters_id));

create or replace function private.academy_guard_course_collaboration()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_role text := private.academy_headquarters_role(old.headquarters_id, (select auth.uid()));
begin
  if new.headquarters_id is distinct from old.headquarters_id
    or new.user_id is distinct from old.user_id then
    raise exception 'academy_course_identity_is_immutable';
  end if;
  if new.is_published is distinct from old.is_published and v_role <> 'owner' then
    raise exception 'academy_course_publish_owner_required';
  end if;
  return new;
end;
$$;

drop trigger if exists academy_guard_course_collaboration on public.academy_courses;
create trigger academy_guard_course_collaboration
before update on public.academy_courses
for each row execute function private.academy_guard_course_collaboration();

create policy "academy_materials_collaborator_select"
on public.academy_materials
for select to authenticated
using (private.academy_can_edit_courses(headquarters_id));

create policy "academy_materials_collaborator_insert"
on public.academy_materials
for insert to authenticated
with check (
  private.academy_can_edit_courses(headquarters_id)
  and user_id = (select auth.uid())
  and exists (
    select 1
    from public.academy_courses course
    where course.id = academy_materials.course_id
      and course.headquarters_id = academy_materials.headquarters_id
  )
  and (
    not is_published
    or private.academy_headquarters_role(headquarters_id, (select auth.uid())) = 'owner'
  )
);

create policy "academy_materials_collaborator_update"
on public.academy_materials
for update to authenticated
using (private.academy_can_edit_courses(headquarters_id))
with check (private.academy_can_edit_courses(headquarters_id));

create or replace function private.academy_guard_material_collaboration()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_role text := private.academy_headquarters_role(old.headquarters_id, (select auth.uid()));
begin
  if new.headquarters_id is distinct from old.headquarters_id
    or new.course_id is distinct from old.course_id
    or new.user_id is distinct from old.user_id then
    raise exception 'academy_material_identity_is_immutable';
  end if;
  if new.is_published is distinct from old.is_published and v_role <> 'owner' then
    raise exception 'academy_material_publish_owner_required';
  end if;
  return new;
end;
$$;

drop trigger if exists academy_guard_material_collaboration on public.academy_materials;
create trigger academy_guard_material_collaboration
before update on public.academy_materials
for each row execute function private.academy_guard_material_collaboration();

create policy "academy_instructor_pages_collaborator_select"
on public.academy_instructor_pages
for select to authenticated
using (private.academy_can_edit_courses(headquarters_id));

create policy "academy_instructor_pages_collaborator_insert"
on public.academy_instructor_pages
for insert to authenticated
with check (
  private.academy_can_edit_courses(headquarters_id)
  and user_id = (select auth.uid())
  and exists (
    select 1
    from public.academy_courses course
    where course.id = academy_instructor_pages.course_id
      and course.headquarters_id = academy_instructor_pages.headquarters_id
  )
);

create policy "academy_instructor_pages_collaborator_update"
on public.academy_instructor_pages
for update to authenticated
using (private.academy_can_edit_courses(headquarters_id))
with check (private.academy_can_edit_courses(headquarters_id));

create or replace function private.academy_guard_instructor_page_collaboration()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.headquarters_id is distinct from old.headquarters_id
    or new.course_id is distinct from old.course_id
    or new.user_id is distinct from old.user_id then
    raise exception 'academy_instructor_page_identity_is_immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists academy_guard_instructor_page_collaboration
  on public.academy_instructor_pages;
create trigger academy_guard_instructor_page_collaboration
before update on public.academy_instructor_pages
for each row execute function private.academy_guard_instructor_page_collaboration();

create policy "academy_classes_collaborator_select"
on public.academy_classes
for select to authenticated
using (private.academy_can_edit_courses(headquarters_id));

create policy "academy_instructors_collaborator_select"
on public.academy_instructors
for select to authenticated
using (private.academy_can_edit_courses(headquarters_id));

create policy "academy_class_requests_administrator_select"
on public.academy_class_instructor_requests
for select to authenticated
using (private.academy_can_manage_headquarters(headquarters_id));

create or replace function public.academy_request_class_instructor(
  p_headquarters_id uuid,
  p_class_id uuid,
  p_instructor_id uuid,
  p_request_note text default null,
  p_respond_by timestamptz default null
)
returns public.academy_class_instructor_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_request public.academy_class_instructor_requests%rowtype;
begin
  if v_actor is null or not private.academy_can_manage_headquarters(p_headquarters_id) then
    raise exception 'academy_class_instructor_request_forbidden';
  end if;
  if not private.academy_class_instructor_request_scope_valid(
    p_headquarters_id,
    p_class_id,
    p_instructor_id
  ) then
    raise exception 'academy_class_instructor_request_scope_invalid';
  end if;

  insert into public.academy_class_instructor_requests (
    headquarters_id,
    class_id,
    instructor_id,
    status,
    request_note,
    response_note,
    respond_by,
    requested_by_user_id,
    requested_at,
    responded_at,
    updated_at
  ) values (
    p_headquarters_id,
    p_class_id,
    p_instructor_id,
    'requested',
    nullif(trim(p_request_note), ''),
    null,
    p_respond_by,
    v_actor,
    now(),
    null,
    now()
  )
  returning * into v_request;

  return v_request;
end;
$$;

create or replace function public.academy_cancel_class_instructor_request(
  p_request_id uuid
)
returns public.academy_class_instructor_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_request public.academy_class_instructor_requests%rowtype;
begin
  if v_actor_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_request
  from public.academy_class_instructor_requests
  where id = p_request_id
  for update;

  if v_request.id is null then
    raise exception 'Instructor request not found';
  end if;

  if not private.academy_can_manage_headquarters(v_request.headquarters_id) then
    raise exception 'Permission denied';
  end if;

  if v_request.status <> 'requested' then
    return v_request;
  end if;

  update public.academy_class_instructor_requests
  set status = 'cancelled',
      responded_at = now(),
      updated_at = now()
  where id = v_request.id
  returning * into v_request;

  return v_request;
end;
$$;

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
  order by h.created_at
  limit 1;
$$;

create or replace function public.academy_get_my_headquarters_role(p_headquarters_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select private.academy_headquarters_role(p_headquarters_id, (select auth.uid()));
$$;

create or replace function public.academy_invite_headquarters_member(
  p_headquarters_id uuid,
  p_mikke_id text,
  p_role text
)
returns public.academy_headquarters_invitations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_target public.profiles%rowtype;
  v_invitation public.academy_headquarters_invitations%rowtype;
begin
  if v_actor is null or not private.academy_can_manage_headquarters(p_headquarters_id) then
    raise exception 'academy_headquarters_forbidden';
  end if;
  if p_role not in ('administrator', 'course_editor') then
    raise exception 'academy_headquarters_invalid_role';
  end if;

  select p.* into v_target
  from public.profiles p
  where lower(p.handle) = lower(trim(p_mikke_id))
  limit 1;

  if v_target.id is null then
    raise exception 'academy_headquarters_member_not_found';
  end if;
  if v_target.user_id = v_actor then
    raise exception 'academy_headquarters_cannot_invite_self';
  end if;
  if exists (
    select 1
    from public.academy_headquarters_members member
    where member.headquarters_id = p_headquarters_id
      and member.member_profile_id = v_target.id
      and member.status = 'active'
  ) then
    raise exception 'academy_headquarters_member_already_active';
  end if;

  insert into public.academy_headquarters_invitations (
    headquarters_id,
    target_profile_id,
    role,
    status,
    invited_by_user_id,
    responded_at,
    expires_at,
    updated_at
  )
  values (
    p_headquarters_id,
    v_target.id,
    p_role,
    'pending',
    v_actor,
    null,
    now() + interval '14 days',
    now()
  )
  on conflict (headquarters_id, target_profile_id)
  do update set
    role = excluded.role,
    status = 'pending',
    invited_by_user_id = excluded.invited_by_user_id,
    responded_at = null,
    expires_at = excluded.expires_at,
    updated_at = now()
  returning * into v_invitation;

  return v_invitation;
end;
$$;

create or replace function public.academy_respond_headquarters_invitation(
  p_invitation_id uuid,
  p_response text
)
returns public.academy_headquarters_invitations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_invitation public.academy_headquarters_invitations%rowtype;
begin
  if v_actor is null or p_response not in ('accepted', 'declined') then
    raise exception 'academy_headquarters_invalid_response';
  end if;

  select i.* into v_invitation
  from public.academy_headquarters_invitations i
  join public.profiles p on p.id = i.target_profile_id
  where i.id = p_invitation_id
    and p.user_id = v_actor
    and i.status = 'pending'
    and i.expires_at > now()
  for update of i;

  if v_invitation.id is null then
    raise exception 'academy_headquarters_invitation_not_available';
  end if;

  if p_response = 'accepted' and exists (
    select 1
    from public.academy_headquarters_members member
    where member.headquarters_id = v_invitation.headquarters_id
      and member.member_profile_id = v_invitation.target_profile_id
      and member.status = 'active'
  ) then
    raise exception 'academy_headquarters_member_already_active';
  end if;

  update public.academy_headquarters_invitations
  set status = p_response, responded_at = now(), updated_at = now()
  where id = v_invitation.id
  returning * into v_invitation;

  if p_response = 'accepted' then
    insert into public.academy_headquarters_members (
      headquarters_id,
      member_profile_id,
      role,
      status,
      invited_by_user_id,
      accepted_at,
      stopped_at,
      updated_at
    )
    values (
      v_invitation.headquarters_id,
      v_invitation.target_profile_id,
      v_invitation.role,
      'active',
      v_invitation.invited_by_user_id,
      now(),
      null,
      now()
    )
    on conflict (headquarters_id, member_profile_id)
    do update set
      role = excluded.role,
      status = 'active',
      invited_by_user_id = excluded.invited_by_user_id,
      accepted_at = now(),
      stopped_at = null,
      updated_at = now();
  end if;

  return v_invitation;
end;
$$;

create or replace function public.academy_stop_headquarters_member(p_member_id uuid)
returns public.academy_headquarters_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_role text;
  v_member public.academy_headquarters_members%rowtype;
begin
  select * into v_member
  from public.academy_headquarters_members
  where id = p_member_id
  for update;

  v_actor_role := private.academy_headquarters_role(v_member.headquarters_id, v_actor);
  if v_member.id is null or v_actor_role not in ('owner', 'administrator') then
    raise exception 'academy_headquarters_forbidden';
  end if;
  if v_actor_role = 'administrator' and v_member.role = 'administrator' then
    raise exception 'academy_headquarters_owner_required';
  end if;

  update public.academy_headquarters_members
  set status = 'stopped', stopped_at = now(), updated_at = now()
  where id = p_member_id
  returning * into v_member;

  update public.academy_headquarters_invitations
  set status = 'cancelled', responded_at = now(), updated_at = now()
  where headquarters_id = v_member.headquarters_id
    and target_profile_id = v_member.member_profile_id
    and status = 'pending';

  return v_member;
end;
$$;

revoke all on function public.academy_get_my_manageable_headquarters() from public, anon;
revoke all on function public.academy_get_my_headquarters_role(uuid) from public, anon;
revoke all on function public.academy_request_class_instructor(uuid, uuid, uuid, text, timestamptz) from public, anon;
revoke all on function public.academy_cancel_class_instructor_request(uuid) from public, anon;
revoke all on function public.academy_invite_headquarters_member(uuid, text, text) from public, anon;
revoke all on function public.academy_respond_headquarters_invitation(uuid, text) from public, anon;
revoke all on function public.academy_stop_headquarters_member(uuid) from public, anon;
grant execute on function public.academy_get_my_manageable_headquarters() to authenticated;
grant execute on function public.academy_get_my_headquarters_role(uuid) to authenticated;
grant execute on function public.academy_request_class_instructor(uuid, uuid, uuid, text, timestamptz) to authenticated;
grant execute on function public.academy_cancel_class_instructor_request(uuid) to authenticated;
grant execute on function public.academy_invite_headquarters_member(uuid, text, text) to authenticated;
grant execute on function public.academy_respond_headquarters_invitation(uuid, text) to authenticated;
grant execute on function public.academy_stop_headquarters_member(uuid) to authenticated;
