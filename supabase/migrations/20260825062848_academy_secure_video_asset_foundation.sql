-- Provider-neutral metadata for Academy's paid secure video delivery option.
-- Video binaries and playback secrets stay outside Postgres. Learner playback
-- will be issued by a later server-only endpoint after checking the course
-- access grant; provider asset IDs are never directly selectable by learners.

create table public.academy_video_assets (
  id uuid primary key default gen_random_uuid(),
  headquarters_id uuid not null references public.academy_headquarters(id) on delete restrict,
  course_id uuid not null references public.academy_courses(id) on delete restrict,
  title text not null,
  provider text not null default 'unconfigured',
  provider_asset_id text,
  status text not null default 'draft',
  duration_seconds integer,
  error_message text,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint academy_video_assets_title_check check (
    char_length(btrim(title)) between 1 and 160
  ),
  constraint academy_video_assets_provider_check check (
    provider in ('unconfigured', 'cloudflare_stream', 'mux')
  ),
  constraint academy_video_assets_status_check check (
    status in ('draft', 'uploading', 'processing', 'ready', 'failed', 'archived')
  ),
  constraint academy_video_assets_duration_check check (
    duration_seconds is null or duration_seconds > 0
  ),
  constraint academy_video_assets_provider_state_check check (
    (
      provider = 'unconfigured'
      and provider_asset_id is null
      and status in ('draft', 'archived')
    )
    or (
      provider <> 'unconfigured'
      and provider_asset_id is not null
      and status <> 'draft'
    )
  ),
  constraint academy_video_assets_archive_state_check check (
    (status = 'archived') = (archived_at is not null)
  )
);

comment on table public.academy_video_assets is
  'Provider-neutral Academy secure video metadata. No binary, playback URL, token, or provider secret is stored here.';
comment on column public.academy_video_assets.provider_asset_id is
  'Opaque provider identifier for server-side use only. Learners must receive short-lived playback tokens from an authenticated server endpoint.';

create unique index academy_video_assets_provider_asset_unique
  on public.academy_video_assets(provider, provider_asset_id)
  where provider_asset_id is not null;
create index academy_video_assets_course_status_idx
  on public.academy_video_assets(course_id, status, created_at desc);
create index academy_video_assets_headquarters_idx
  on public.academy_video_assets(headquarters_id, course_id);

alter table public.academy_video_assets enable row level security;

revoke all on table public.academy_video_assets from public, anon, authenticated;
grant select, insert, update on table public.academy_video_assets to authenticated;
grant all on table public.academy_video_assets to service_role;

create or replace function private.academy_can_manage_course_video(p_headquarters_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.academy_headquarters_role(p_headquarters_id, (select auth.uid()))
    in ('owner', 'administrator', 'course_editor');
$$;

revoke all on function private.academy_can_manage_course_video(uuid)
  from public, anon, authenticated;

create policy "academy video assets manager select"
on public.academy_video_assets
for select
to authenticated
using (private.academy_can_manage_course_video(headquarters_id));

create policy "academy video assets manager insert"
on public.academy_video_assets
for insert
to authenticated
with check (
  private.academy_can_manage_course_video(headquarters_id)
  and created_by_user_id = (select auth.uid())
  and exists (
    select 1
    from public.academy_courses course
    where course.id = academy_video_assets.course_id
      and course.headquarters_id = academy_video_assets.headquarters_id
  )
);

create policy "academy video assets manager update"
on public.academy_video_assets
for update
to authenticated
using (private.academy_can_manage_course_video(headquarters_id))
with check (
  private.academy_can_manage_course_video(headquarters_id)
  and exists (
    select 1
    from public.academy_courses course
    where course.id = academy_video_assets.course_id
      and course.headquarters_id = academy_video_assets.headquarters_id
  )
);

create or replace function private.academy_guard_video_asset_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.headquarters_id is distinct from old.headquarters_id
    or new.course_id is distinct from old.course_id
    or new.created_by_user_id is distinct from old.created_by_user_id
    or new.created_at is distinct from old.created_at then
    raise exception 'academy_video_asset_scope_is_immutable';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.academy_guard_video_asset_update()
  from public, anon, authenticated;

create trigger academy_guard_video_asset_update
before update on public.academy_video_assets
for each row execute function private.academy_guard_video_asset_update();

alter table public.academy_program_steps
  add column video_asset_id uuid references public.academy_video_assets(id) on delete restrict;

alter table public.academy_program_steps
  drop constraint academy_program_steps_step_type_check,
  add constraint academy_program_steps_step_type_check check (
    step_type in (
      'text', 'external_url', 'download', 'live_session', 'submission',
      'test', 'approval', 'completion', 'video'
    )
  ),
  add constraint academy_program_steps_video_asset_check check (
    (step_type = 'video') = (video_asset_id is not null)
  );

create index academy_program_steps_video_asset_idx
  on public.academy_program_steps(video_asset_id)
  where video_asset_id is not null;

create or replace function private.academy_guard_program_step_video_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_program_course_id uuid;
  v_asset_course_id uuid;
begin
  if new.video_asset_id is null then
    return new;
  end if;

  select program.course_id
  into v_program_course_id
  from public.academy_program_sections section
  join public.academy_programs program on program.id = section.program_id
  where section.id = new.section_id;

  select asset.course_id
  into v_asset_course_id
  from public.academy_video_assets asset
  where asset.id = new.video_asset_id
    and asset.status <> 'archived';

  if v_program_course_id is null
    or v_asset_course_id is null
    or v_program_course_id <> v_asset_course_id then
    raise exception 'academy_program_step_video_course_mismatch';
  end if;

  return new;
end;
$$;

revoke all on function private.academy_guard_program_step_video_scope()
  from public, anon, authenticated;

create trigger academy_guard_program_step_video_scope
before insert or update of section_id, video_asset_id, step_type
on public.academy_program_steps
for each row execute function private.academy_guard_program_step_video_scope();
