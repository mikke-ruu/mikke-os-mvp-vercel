-- Team Works W2: one project-default Zoom meeting with per-session overrides.
-- Future sessions using the project default receive a snapshot of that default.
-- Past sessions are never rewritten when the project default changes.

alter table public.team_works_projects
  add column if not exists zoom_url text,
  add column if not exists zoom_meeting_id text,
  add column if not exists zoom_passcode text;

alter table public.team_works_op_sessions
  add column if not exists zoom_url text,
  add column if not exists zoom_meeting_id text,
  add column if not exists zoom_passcode text,
  add column if not exists zoom_uses_project_default boolean not null default true;

comment on column public.team_works_projects.zoom_url is
  'Default Zoom join URL for future sessions in this project.';
comment on column public.team_works_op_sessions.zoom_uses_project_default is
  'True when this session follows the project Zoom defaults; false for a per-session override.';

create or replace function private.team_works_snapshot_session_zoom()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.zoom_uses_project_default then
    select p.zoom_url, p.zoom_meeting_id, p.zoom_passcode
      into new.zoom_url, new.zoom_meeting_id, new.zoom_passcode
    from public.team_works_projects p
    where p.id = new.project_id;
  end if;
  return new;
end;
$$;

drop trigger if exists team_works_snapshot_session_zoom
  on public.team_works_op_sessions;
create trigger team_works_snapshot_session_zoom
before insert or update of zoom_uses_project_default
on public.team_works_op_sessions
for each row
execute function private.team_works_snapshot_session_zoom();

create or replace function public.team_works_update_project_zoom(
  p_project_id uuid,
  p_zoom_url text,
  p_zoom_meeting_id text,
  p_zoom_passcode text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_zoom_url text := nullif(btrim(p_zoom_url), '');
  v_zoom_meeting_id text := nullif(btrim(p_zoom_meeting_id), '');
  v_zoom_passcode text := nullif(btrim(p_zoom_passcode), '');
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select p.organization_id
    into v_organization_id
  from public.team_works_projects p
  where p.id = p_project_id
    and p.style = 'operations';

  if v_organization_id is null
     or not private.team_works_is_org_staff(v_organization_id) then
    raise exception 'Not authorized to update project Zoom settings';
  end if;

  update public.team_works_projects
  set zoom_url = v_zoom_url,
      zoom_meeting_id = v_zoom_meeting_id,
      zoom_passcode = v_zoom_passcode,
      updated_at = now()
  where id = p_project_id;

  update public.team_works_op_sessions
  set zoom_url = v_zoom_url,
      zoom_meeting_id = v_zoom_meeting_id,
      zoom_passcode = v_zoom_passcode,
      updated_at = now()
  where project_id = p_project_id
    and session_date >= current_date
    and zoom_uses_project_default;
end;
$$;

create or replace function public.team_works_update_session_zoom(
  p_session_id uuid,
  p_use_project_default boolean,
  p_zoom_url text default null,
  p_zoom_meeting_id text default null,
  p_zoom_passcode text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
  v_organization_id uuid;
  v_partner_member_id uuid;
  v_session_date date;
  v_worker_member_id uuid;
  v_zoom_url text := nullif(btrim(p_zoom_url), '');
  v_zoom_meeting_id text := nullif(btrim(p_zoom_meeting_id), '');
  v_zoom_passcode text := nullif(btrim(p_zoom_passcode), '');
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select s.project_id, p.organization_id, s.partner_member_id, s.session_date
    into v_project_id, v_organization_id, v_partner_member_id, v_session_date
  from public.team_works_op_sessions s
  join public.team_works_projects p on p.id = s.project_id
  where s.id = p_session_id
    and p.style = 'operations';

  if v_project_id is null then
    raise exception 'Session not found';
  end if;
  if v_session_date < current_date then
    raise exception 'Past session Zoom settings cannot be changed';
  end if;

  v_worker_member_id :=
    private.team_works_project_member_id_for(v_project_id, 'worker');

  if not private.team_works_is_org_staff(v_organization_id)
     and (v_worker_member_id is null or v_partner_member_id <> v_worker_member_id) then
    raise exception 'Not authorized to update this session Zoom setting';
  end if;

  if coalesce(p_use_project_default, false) then
    select p.zoom_url, p.zoom_meeting_id, p.zoom_passcode
      into v_zoom_url, v_zoom_meeting_id, v_zoom_passcode
    from public.team_works_projects p
    where p.id = v_project_id;
  end if;

  update public.team_works_op_sessions
  set zoom_url = v_zoom_url,
      zoom_meeting_id = v_zoom_meeting_id,
      zoom_passcode = v_zoom_passcode,
      zoom_uses_project_default = coalesce(p_use_project_default, false),
      updated_at = now()
  where id = p_session_id;
end;
$$;

revoke all on function public.team_works_update_project_zoom(uuid, text, text, text) from public, anon;
revoke all on function public.team_works_update_session_zoom(uuid, boolean, text, text, text) from public, anon;
grant execute on function public.team_works_update_project_zoom(uuid, text, text, text) to authenticated;
grant execute on function public.team_works_update_session_zoom(uuid, boolean, text, text, text) to authenticated;

notify pgrst, 'reload schema';
