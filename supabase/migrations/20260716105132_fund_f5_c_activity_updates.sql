-- Fund F5-c: move activity reports to an owner-private source of truth and
-- expose only published reports for projects already present in the public
-- Fund projection.

create table public.fund_updates (
  id uuid primary key default extensions.gen_random_uuid(),
  project_id uuid not null references public.fund_projects(id) on delete cascade,
  source_local_id text not null,
  title text not null,
  body text not null,
  image_url text not null default '',
  visibility text not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fund_updates_source_local_id_length_check
    check (char_length(source_local_id) between 1 and 160),
  constraint fund_updates_title_length_check
    check (char_length(title) between 1 and 160),
  constraint fund_updates_body_length_check
    check (char_length(body) between 1 and 10000),
  constraint fund_updates_image_url_check
    check (image_url = '' or (char_length(image_url) <= 2048 and image_url ~ '^https?://')),
  constraint fund_updates_visibility_check
    check (visibility in ('draft', 'public')),
  constraint fund_updates_publication_state_check
    check (
      (visibility = 'draft' and published_at is null)
      or (visibility = 'public' and published_at is not null)
    ),
  constraint fund_updates_project_source_local_unique
    unique (project_id, source_local_id)
);

create index fund_updates_project_created_at_idx
  on public.fund_updates (project_id, created_at desc);

alter table public.fund_updates enable row level security;
alter table public.fund_updates force row level security;

revoke all on table public.fund_updates from public, anon, authenticated;
grant select, insert, update, delete on table public.fund_updates to authenticated;
grant all on table public.fund_updates to service_role;

create policy "fund_updates_select_own_project"
on public.fund_updates for select to authenticated
using (
  exists (
    select 1 from public.fund_projects
    where fund_projects.id = fund_updates.project_id
      and fund_projects.owner_user_id = (select auth.uid())
  )
);

create policy "fund_updates_insert_own_project"
on public.fund_updates for insert to authenticated
with check (
  exists (
    select 1 from public.fund_projects
    where fund_projects.id = fund_updates.project_id
      and fund_projects.owner_user_id = (select auth.uid())
  )
);

create policy "fund_updates_update_own_project"
on public.fund_updates for update to authenticated
using (
  exists (
    select 1 from public.fund_projects
    where fund_projects.id = fund_updates.project_id
      and fund_projects.owner_user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.fund_projects
    where fund_projects.id = fund_updates.project_id
      and fund_projects.owner_user_id = (select auth.uid())
  )
);

create policy "fund_updates_delete_own_project"
on public.fund_updates for delete to authenticated
using (
  exists (
    select 1 from public.fund_projects
    where fund_projects.id = fund_updates.project_id
      and fund_projects.owner_user_id = (select auth.uid())
  )
);

create table public.fund_public_updates (
  update_id uuid primary key references public.fund_updates(id) on delete cascade,
  project_id uuid not null references public.fund_public_projects(project_id) on delete cascade,
  title text not null,
  body text not null,
  image_url text not null,
  published_at timestamptz not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index fund_public_updates_project_published_at_idx
  on public.fund_public_updates (project_id, published_at desc);

alter table public.fund_public_updates enable row level security;
alter table public.fund_public_updates force row level security;

revoke all on table public.fund_public_updates from public, anon, authenticated;
grant select on table public.fund_public_updates to anon, authenticated;
grant all on table public.fund_public_updates to service_role;

create policy "fund_public_updates_select_published"
on public.fund_public_updates for select to anon, authenticated
using (true);

create or replace function private.prepare_fund_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.title := btrim(new.title);
  new.body := btrim(new.body);
  new.image_url := btrim(coalesce(new.image_url, ''));

  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.project_id := old.project_id;
    new.source_local_id := old.source_local_id;
    new.created_at := old.created_at;
  end if;

  new.published_at := case
    when new.visibility = 'public' and tg_op = 'UPDATE' and old.visibility = 'public'
      then old.published_at
    when new.visibility = 'public' then now()
    else null
  end;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.prepare_fund_update() from public, anon, authenticated;

create trigger prepare_fund_update_before_write
before insert or update on public.fund_updates
for each row execute function private.prepare_fund_update();

create or replace function private.sync_fund_public_update(p_update_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_update public.fund_updates%rowtype;
begin
  select * into v_update
  from public.fund_updates
  where id = p_update_id;

  if not found
    or v_update.visibility <> 'public'
    or v_update.published_at is null
    or not exists (
      select 1 from public.fund_public_projects
      where project_id = v_update.project_id
    ) then
    delete from public.fund_public_updates where update_id = p_update_id;
    return;
  end if;

  insert into public.fund_public_updates (
    update_id, project_id, title, body, image_url,
    published_at, created_at, updated_at
  ) values (
    v_update.id, v_update.project_id, v_update.title, v_update.body,
    v_update.image_url, v_update.published_at,
    v_update.created_at, v_update.updated_at
  )
  on conflict (update_id) do update set
    project_id = excluded.project_id,
    title = excluded.title,
    body = excluded.body,
    image_url = excluded.image_url,
    published_at = excluded.published_at,
    created_at = excluded.created_at,
    updated_at = excluded.updated_at;
end;
$$;

create or replace function private.sync_fund_public_updates_for_project(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_update_id uuid;
begin
  if not exists (
    select 1 from public.fund_public_projects where project_id = p_project_id
  ) then
    delete from public.fund_public_updates where project_id = p_project_id;
    return;
  end if;

  for v_update_id in
    select id from public.fund_updates where project_id = p_project_id
  loop
    perform private.sync_fund_public_update(v_update_id);
  end loop;
end;
$$;

create or replace function private.sync_fund_public_update_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.sync_fund_public_update(
    case when tg_op = 'DELETE' then old.id else new.id end
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function private.sync_fund_public_updates_after_parent_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
begin
  if tg_table_name = 'fund_projects' then
    perform private.sync_fund_public_updates_for_project(new.id);
  elsif tg_table_name = 'profiles' then
    for v_project_id in
      select id from public.fund_projects where owner_profile_id = new.id
    loop
      perform private.sync_fund_public_updates_for_project(v_project_id);
    end loop;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_fund_public_update(uuid) from public, anon, authenticated;
revoke all on function private.sync_fund_public_updates_for_project(uuid) from public, anon, authenticated;
revoke all on function private.sync_fund_public_update_trigger() from public, anon, authenticated;
revoke all on function private.sync_fund_public_updates_after_parent_change() from public, anon, authenticated;

create trigger sync_fund_public_update_after_change
after insert or update or delete on public.fund_updates
for each row execute function private.sync_fund_public_update_trigger();

-- Trigger names sort after the F5-a project projection triggers, so the parent
-- projection exists (or has been removed) before activity reports are synced.
create trigger sync_fund_public_updates_after_project_change
after insert or update on public.fund_projects
for each row execute function private.sync_fund_public_updates_after_parent_change();

create trigger sync_fund_public_updates_after_owner_handle_change
after update of handle on public.profiles
for each row execute function private.sync_fund_public_updates_after_parent_change();

create or replace function public.save_fund_update(
  p_owner_profile_id uuid,
  p_project_source_local_id text,
  p_update jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_project_id uuid;
  v_update_id uuid;
  v_source_local_id text := nullif(btrim(p_update ->> 'id'), '');
  v_title text := nullif(btrim(p_update ->> 'title'), '');
  v_body text := nullif(btrim(p_update ->> 'body'), '');
begin
  if v_actor_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if nullif(btrim(p_project_source_local_id), '') is null
    or v_source_local_id is null
    or v_title is null
    or v_body is null then
    raise exception 'Project id, update id, title, and body are required' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = p_owner_profile_id and user_id = v_actor_user_id
  ) then
    raise exception 'Owner profile does not belong to the authenticated user' using errcode = '42501';
  end if;

  select id into v_project_id
  from public.fund_projects
  where owner_user_id = v_actor_user_id
    and owner_profile_id = p_owner_profile_id
    and source_local_id = btrim(p_project_source_local_id);

  if v_project_id is null then
    raise exception 'Fund project was not found for the authenticated owner' using errcode = '42501';
  end if;

  select id into v_update_id
  from public.fund_updates
  where project_id = v_project_id and source_local_id = v_source_local_id;

  if v_update_id is null then
    insert into public.fund_updates (
      project_id, source_local_id, title, body, image_url, visibility
    ) values (
      v_project_id, v_source_local_id, v_title, v_body,
      coalesce(p_update ->> 'imageUrl', ''), p_update ->> 'visibility'
    ) returning id into v_update_id;
  else
    update public.fund_updates
    set title = v_title,
        body = v_body,
        image_url = coalesce(p_update ->> 'imageUrl', ''),
        visibility = p_update ->> 'visibility'
    where id = v_update_id;
  end if;

  return v_update_id;
end;
$$;

revoke all on function public.save_fund_update(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.save_fund_update(uuid, text, jsonb) to authenticated, service_role;

do $$
declare
  v_update_id uuid;
begin
  for v_update_id in select id from public.fund_updates
  loop
    perform private.sync_fund_public_update(v_update_id);
  end loop;
end;
$$;

comment on table public.fund_updates is
  'Owner-private Fund activity reports. Public clients must read fund_public_updates instead.';
comment on table public.fund_public_updates is
  'Public-only activity reports for projects already present in fund_public_projects.';

notify pgrst, 'reload schema';
