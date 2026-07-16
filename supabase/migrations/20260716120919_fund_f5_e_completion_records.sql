-- Fund F5-e: make completion records and app handoff candidates database-owned,
-- with a separate public-safe completion projection and private Activity Log.

create table public.fund_challenge_records (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.fund_projects(id) on delete cascade,
  source_local_id text not null,
  title text not null,
  summary text not null,
  outcome text not null default '',
  image_url text not null default '',
  visibility text not null default 'private',
  story_enabled boolean not null default false,
  completed_at date not null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fund_challenge_records_source_local_id_length_check
    check (char_length(source_local_id) between 1 and 160),
  constraint fund_challenge_records_title_length_check
    check (char_length(title) between 1 and 160),
  constraint fund_challenge_records_summary_length_check
    check (char_length(summary) between 1 and 5000),
  constraint fund_challenge_records_outcome_length_check
    check (char_length(outcome) <= 5000),
  constraint fund_challenge_records_image_url_check
    check (image_url = '' or (char_length(image_url) <= 2048 and image_url ~ '^https?://')),
  constraint fund_challenge_records_visibility_check
    check (visibility in ('private', 'public')),
  constraint fund_challenge_records_story_visibility_check
    check (not story_enabled or visibility = 'public')
);

create table public.fund_app_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.fund_projects(id) on delete cascade,
  target_service text not null,
  link_status text not null default 'suggested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fund_app_links_project_target_unique unique (project_id, target_service),
  constraint fund_app_links_target_service_check
    check (target_service in ('order', 'item_studio', 'event', 'session', 'academy', 'community', 'team_works')),
  constraint fund_app_links_status_check
    check (link_status in ('suggested', 'ready', 'linked', 'cancelled'))
);

create table public.fund_public_challenge_records (
  challenge_record_id uuid primary key references public.fund_challenge_records(id) on delete cascade,
  project_id uuid not null unique references public.fund_public_projects(project_id) on delete cascade,
  profile_slug text not null,
  project_slug text not null,
  public_fund_path text not null,
  title text not null,
  summary text not null,
  outcome text not null,
  image_url text not null,
  story_enabled boolean not null,
  completed_at date not null,
  published_at timestamptz not null,
  updated_at timestamptz not null,

  constraint fund_public_challenge_records_profile_slug_check
    check (profile_slug ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),
  constraint fund_public_challenge_records_project_slug_check
    check (project_slug ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  constraint fund_public_challenge_records_path_check
    check (public_fund_path ~ '^/fund/[a-z0-9][a-z0-9_-]{0,79}/[a-z0-9][a-z0-9-]{0,79}$'),
  constraint fund_public_challenge_records_title_length_check
    check (char_length(title) between 1 and 160),
  constraint fund_public_challenge_records_summary_length_check
    check (char_length(summary) between 1 and 5000),
  constraint fund_public_challenge_records_outcome_length_check
    check (char_length(outcome) <= 5000),
  constraint fund_public_challenge_records_image_url_check
    check (image_url = '' or (char_length(image_url) <= 2048 and image_url ~ '^https?://'))
);

create or replace function private.prepare_fund_challenge_record()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.source_local_id := btrim(new.source_local_id);
  new.title := btrim(new.title);
  new.summary := btrim(new.summary);
  new.outcome := btrim(coalesce(new.outcome, ''));
  new.image_url := btrim(coalesce(new.image_url, ''));
  new.story_enabled := coalesce(new.story_enabled, false) and new.visibility = 'public';

  if tg_op = 'UPDATE' then
    new.project_id := old.project_id;
    new.source_local_id := old.source_local_id;
    new.created_at := old.created_at;
    new.published_at := case
      when new.visibility = 'public' then coalesce(old.published_at, new.published_at, now())
      else null
    end;
  else
    new.created_at := now();
    new.published_at := case when new.visibility = 'public' then coalesce(new.published_at, now()) else null end;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger prepare_fund_challenge_record_before_write
before insert or update on public.fund_challenge_records
for each row execute function private.prepare_fund_challenge_record();

create trigger set_fund_app_links_updated_at
before update on public.fund_app_links
for each row execute function public.set_fund_updated_at();

alter table public.fund_challenge_records enable row level security;
alter table public.fund_challenge_records force row level security;
alter table public.fund_app_links enable row level security;
alter table public.fund_app_links force row level security;
alter table public.fund_public_challenge_records enable row level security;
alter table public.fund_public_challenge_records force row level security;

create policy "fund_challenge_records_select_owner"
on public.fund_challenge_records for select to authenticated
using (
  exists (
    select 1 from public.fund_projects
    where fund_projects.id = fund_challenge_records.project_id
      and fund_projects.owner_user_id = (select auth.uid())
  )
);

create policy "fund_challenge_records_insert_owner"
on public.fund_challenge_records for insert to authenticated
with check (
  exists (
    select 1 from public.fund_projects
    where fund_projects.id = fund_challenge_records.project_id
      and fund_projects.owner_user_id = (select auth.uid())
  )
);

create policy "fund_challenge_records_update_owner"
on public.fund_challenge_records for update to authenticated
using (
  exists (
    select 1 from public.fund_projects
    where fund_projects.id = fund_challenge_records.project_id
      and fund_projects.owner_user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.fund_projects
    where fund_projects.id = fund_challenge_records.project_id
      and fund_projects.owner_user_id = (select auth.uid())
  )
);

create policy "fund_challenge_records_delete_owner"
on public.fund_challenge_records for delete to authenticated
using (
  exists (
    select 1 from public.fund_projects
    where fund_projects.id = fund_challenge_records.project_id
      and fund_projects.owner_user_id = (select auth.uid())
  )
);

create policy "fund_app_links_select_owner"
on public.fund_app_links for select to authenticated
using (
  exists (
    select 1 from public.fund_projects
    where fund_projects.id = fund_app_links.project_id
      and fund_projects.owner_user_id = (select auth.uid())
  )
);

create policy "fund_app_links_insert_owner"
on public.fund_app_links for insert to authenticated
with check (
  exists (
    select 1 from public.fund_projects
    where fund_projects.id = fund_app_links.project_id
      and fund_projects.owner_user_id = (select auth.uid())
  )
);

create policy "fund_app_links_update_owner"
on public.fund_app_links for update to authenticated
using (
  exists (
    select 1 from public.fund_projects
    where fund_projects.id = fund_app_links.project_id
      and fund_projects.owner_user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.fund_projects
    where fund_projects.id = fund_app_links.project_id
      and fund_projects.owner_user_id = (select auth.uid())
  )
);

create policy "fund_app_links_delete_owner"
on public.fund_app_links for delete to authenticated
using (
  exists (
    select 1 from public.fund_projects
    where fund_projects.id = fund_app_links.project_id
      and fund_projects.owner_user_id = (select auth.uid())
  )
);

create policy "fund_public_challenge_records_select_public"
on public.fund_public_challenge_records for select to anon, authenticated
using (true);

revoke all on table public.fund_challenge_records from public, anon, authenticated;
revoke all on table public.fund_app_links from public, anon, authenticated;
revoke all on table public.fund_public_challenge_records from public, anon, authenticated;
grant select, insert, update, delete on table public.fund_challenge_records to authenticated;
grant select, insert, update, delete on table public.fund_app_links to authenticated;
grant select on table public.fund_public_challenge_records to anon, authenticated;
grant all on table public.fund_challenge_records to service_role;
grant all on table public.fund_app_links to service_role;
grant all on table public.fund_public_challenge_records to service_role;

create or replace function private.sync_fund_completion_outputs(p_challenge_record_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_record public.fund_challenge_records%rowtype;
  v_project public.fund_projects%rowtype;
  v_public_project public.fund_public_projects%rowtype;
  v_has_public_project boolean := false;
  v_story_public boolean := false;
  v_source_record_id text;
begin
  select * into v_record
  from public.fund_challenge_records
  where id = p_challenge_record_id;
  if not found then return; end if;

  select * into v_project
  from public.fund_projects
  where id = v_record.project_id;
  if not found then return; end if;

  select * into v_public_project
  from public.fund_public_projects
  where project_id = v_record.project_id;
  v_has_public_project := found;
  v_story_public := v_has_public_project and v_record.visibility = 'public' and v_record.story_enabled;

  if v_has_public_project and v_record.visibility = 'public' then
    insert into public.fund_public_challenge_records (
      challenge_record_id, project_id, profile_slug, project_slug,
      public_fund_path, title, summary, outcome, image_url,
      story_enabled, completed_at, published_at, updated_at
    ) values (
      v_record.id, v_record.project_id, v_public_project.profile_slug, v_public_project.slug,
      '/fund/' || v_public_project.profile_slug || '/' || v_public_project.slug,
      v_record.title, v_record.summary, v_record.outcome, v_record.image_url,
      v_record.story_enabled, v_record.completed_at, coalesce(v_record.published_at, now()), v_record.updated_at
    )
    on conflict (challenge_record_id) do update set
      project_id = excluded.project_id,
      profile_slug = excluded.profile_slug,
      project_slug = excluded.project_slug,
      public_fund_path = excluded.public_fund_path,
      title = excluded.title,
      summary = excluded.summary,
      outcome = excluded.outcome,
      image_url = excluded.image_url,
      story_enabled = excluded.story_enabled,
      completed_at = excluded.completed_at,
      published_at = excluded.published_at,
      updated_at = excluded.updated_at;
  else
    delete from public.fund_public_challenge_records
    where challenge_record_id = v_record.id;
  end if;

  v_source_record_id := 'completion:' || v_project.source_local_id;
  insert into public.activity_logs (
    user_id, profile_id, activity_type, category, source_service,
    source_record_id, occurred_at, title, description, visibility, status,
    display_on_story, display_in_timeline, display_as_achievement,
    counts_toward_summary, has_financial_value, amount,
    transaction_type, payment_status
  ) values (
    v_project.owner_user_id, v_project.owner_profile_id,
    'fund_project_completed', 'production', 'fund',
    v_source_record_id, v_record.completed_at::timestamp at time zone 'UTC',
    v_record.title, v_record.summary, 'private', 'completed',
    false, true, v_story_public, v_story_public,
    false, null, 'none', 'not_required'
  )
  on conflict (profile_id, source_service, source_record_id) do update set
    user_id = excluded.user_id,
    activity_type = excluded.activity_type,
    category = excluded.category,
    occurred_at = excluded.occurred_at,
    title = excluded.title,
    description = excluded.description,
    visibility = excluded.visibility,
    status = excluded.status,
    display_on_story = excluded.display_on_story,
    display_in_timeline = excluded.display_in_timeline,
    display_as_achievement = excluded.display_as_achievement,
    counts_toward_summary = excluded.counts_toward_summary,
    has_financial_value = excluded.has_financial_value,
    amount = excluded.amount,
    transaction_type = excluded.transaction_type,
    payment_status = excluded.payment_status,
    updated_at = now();
end;
$$;

create or replace function private.sync_fund_completion_after_record_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.fund_projects%rowtype;
begin
  if tg_op = 'DELETE' then
    select * into v_project from public.fund_projects where id = old.project_id;
    delete from public.fund_public_challenge_records where challenge_record_id = old.id;
    if v_project.id is not null then
      delete from public.activity_logs
      where profile_id = v_project.owner_profile_id
        and source_service = 'fund'
        and source_record_id = 'completion:' || v_project.source_local_id;
    end if;
    return old;
  end if;

  perform private.sync_fund_completion_outputs(new.id);
  return new;
end;
$$;

create or replace function private.sync_fund_completion_after_public_project_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_record_id uuid;
  v_project_id uuid := case when tg_op = 'DELETE' then old.project_id else new.project_id end;
begin
  select id into v_record_id
  from public.fund_challenge_records
  where project_id = v_project_id;
  if v_record_id is not null then
    perform private.sync_fund_completion_outputs(v_record_id);
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.prepare_fund_challenge_record() from public, anon, authenticated, service_role;
revoke all on function private.sync_fund_completion_outputs(uuid) from public, anon, authenticated, service_role;
revoke all on function private.sync_fund_completion_after_record_change() from public, anon, authenticated, service_role;
revoke all on function private.sync_fund_completion_after_public_project_change() from public, anon, authenticated, service_role;

create trigger sync_fund_completion_after_record_change
after insert or update or delete on public.fund_challenge_records
for each row execute function private.sync_fund_completion_after_record_change();

create trigger sync_fund_completion_after_public_project_change
after insert or update or delete on public.fund_public_projects
for each row execute function private.sync_fund_completion_after_public_project_change();

create or replace function public.save_fund_completion(
  p_owner_profile_id uuid,
  p_project_source_local_id text,
  p_record jsonb,
  p_targets text[] default array[]::text[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_project_id uuid;
  v_record_id uuid;
  v_source_local_id text := nullif(btrim(p_record ->> 'id'), '');
  v_title text := nullif(btrim(p_record ->> 'title'), '');
  v_summary text := nullif(btrim(p_record ->> 'summary'), '');
  v_completed_at date := nullif(btrim(p_record ->> 'completedAt'), '')::date;
begin
  if v_actor_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if nullif(btrim(p_project_source_local_id), '') is null
    or v_source_local_id is null
    or v_title is null
    or v_summary is null
    or v_completed_at is null then
    raise exception 'Project id, completion id, title, summary, and completed date are required' using errcode = '22023';
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
    and source_local_id = btrim(p_project_source_local_id)
  for update;
  if v_project_id is null then
    raise exception 'Fund project was not found for the authenticated owner' using errcode = '42501';
  end if;

  update public.fund_projects
  set stage = 'realization',
      status = 'completed',
      completed_at = v_completed_at::timestamp at time zone 'UTC'
  where id = v_project_id;

  select id into v_record_id
  from public.fund_challenge_records
  where project_id = v_project_id;

  if v_record_id is null then
    insert into public.fund_challenge_records (
      project_id, source_local_id, title, summary, outcome, image_url,
      visibility, story_enabled, completed_at
    ) values (
      v_project_id, v_source_local_id, v_title, v_summary,
      coalesce(p_record ->> 'outcome', ''), coalesce(p_record ->> 'imageUrl', ''),
      coalesce(p_record ->> 'visibility', 'private'),
      coalesce((p_record ->> 'storyEnabled')::boolean, false), v_completed_at
    ) returning id into v_record_id;
  else
    update public.fund_challenge_records
    set title = v_title,
        summary = v_summary,
        outcome = coalesce(p_record ->> 'outcome', ''),
        image_url = coalesce(p_record ->> 'imageUrl', ''),
        visibility = coalesce(p_record ->> 'visibility', 'private'),
        story_enabled = coalesce((p_record ->> 'storyEnabled')::boolean, false),
        completed_at = v_completed_at
    where id = v_record_id;
  end if;

  update public.fund_app_links
  set link_status = 'cancelled'
  where project_id = v_project_id
    and not (target_service = any(coalesce(p_targets, array[]::text[])));

  insert into public.fund_app_links (project_id, target_service, link_status)
  select v_project_id, target_service, 'ready'
  from (
    select distinct btrim(value) as target_service
    from unnest(coalesce(p_targets, array[]::text[])) as target(value)
    where nullif(btrim(value), '') is not null
  ) selected_targets
  on conflict (project_id, target_service) do update set link_status = 'ready';

  return v_record_id;
end;
$$;

revoke all on function public.save_fund_completion(uuid, text, jsonb, text[]) from public, anon, authenticated;
grant execute on function public.save_fund_completion(uuid, text, jsonb, text[]) to authenticated, service_role;

comment on table public.fund_challenge_records is
  'Owner-private Fund completion record source of truth.';
comment on table public.fund_app_links is
  'Owner-private candidate handoffs to another Mikke app. No downstream record is created automatically.';
comment on table public.fund_public_challenge_records is
  'Public-safe Fund completion projection. Excludes owner ids, local source ids, app handoff candidates, and private Activity Log fields.';

notify pgrst, 'reload schema';
