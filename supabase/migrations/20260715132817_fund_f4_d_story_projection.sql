-- Fund F4-d: expose only the public project title needed for the small Story
-- participation row. All support details and amounts remain private.

alter table public.fund_public_participations
  add column project_title text;

update public.fund_public_participations as public_participation
set project_title = project.title
from public.fund_projects as project
where project.id = public_participation.project_id;

alter table public.fund_public_participations
  alter column project_title set not null;

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
    project_title,
    supporter_profile_id,
    display_name,
    is_anonymous,
    public_fund_path,
    published_at
  ) values (
    v_participation.id,
    v_participation.project_id,
    v_project.title,
    case when v_participation.display_mode = 'anonymous' then null else v_participation.supporter_profile_id end,
    v_display_name,
    v_participation.display_mode = 'anonymous',
    '/fund/' || v_owner_handle || '/' || v_project.slug,
    now()
  )
  on conflict (participation_id) do update set
    project_id = excluded.project_id,
    project_title = excluded.project_title,
    supporter_profile_id = excluded.supporter_profile_id,
    display_name = excluded.display_name,
    is_anonymous = excluded.is_anonymous,
    public_fund_path = excluded.public_fund_path,
    published_at = excluded.published_at;
end;
$$;

revoke all on function private.sync_fund_public_participation(uuid) from public, anon, authenticated;

drop trigger if exists sync_fund_public_participation_after_project_visibility_change on public.fund_projects;
create trigger sync_fund_public_participation_after_project_visibility_change
after update of visibility, title on public.fund_projects
for each row execute function private.sync_fund_public_participation_trigger();

comment on column public.fund_public_participations.project_title is
  'Public Fund title used by Story participation rows; available only while all visibility and consent gates pass.';

notify pgrst, 'reload schema';
