-- Partner lesson console:
-- - the assigned partner can announce standby / lesson end to headquarters
-- - each roster row keeps a compact assessment and a handoff note
-- - completing a student advances that participant exactly once

alter table public.team_works_op_sessions
  add column if not exists partner_presence_status text not null default 'not_started',
  add column if not exists partner_standby_at timestamptz,
  add column if not exists partner_ended_at timestamptz;

alter table public.team_works_op_sessions
  drop constraint if exists team_works_op_sessions_partner_presence_status_check;

alter table public.team_works_op_sessions
  add constraint team_works_op_sessions_partner_presence_status_check
  check (partner_presence_status in ('not_started', 'standby', 'in_progress', 'ended'));

alter table public.team_works_session_roster
  add column if not exists partner_assessment jsonb not null default '{}'::jsonb,
  add column if not exists handoff_note text,
  add column if not exists partner_completed_at timestamptz;

create or replace function public.team_works_update_partner_presence(
  p_session_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_session public.team_works_op_sessions%rowtype;
  worker_member_id uuid;
begin
  if p_status not in ('standby', 'in_progress', 'ended') then
    raise exception 'Unsupported partner presence status';
  end if;

  select *
    into target_session
  from public.team_works_op_sessions
  where id = p_session_id
    and status <> 'cancelled';

  if target_session.id is null then
    raise exception 'Session not found';
  end if;

  select pm.organization_member_id
    into worker_member_id
  from public.team_works_project_members pm
  join public.team_works_organization_members om
    on om.id = pm.organization_member_id
  where pm.project_id = target_session.project_id
    and pm.project_role = 'worker'
    and om.user_id = (select auth.uid())
    and om.status = 'active'
  limit 1;

  if worker_member_id is null or target_session.partner_member_id is distinct from worker_member_id then
    raise exception 'You are not assigned to this session';
  end if;

  update public.team_works_op_sessions
  set partner_presence_status = p_status,
      partner_standby_at = case
        when p_status in ('standby', 'in_progress') then coalesce(partner_standby_at, now())
        else partner_standby_at
      end,
      partner_ended_at = case when p_status = 'ended' then now() else null end,
      updated_at = now()
  where id = p_session_id;
end;
$$;

create or replace function public.team_works_save_partner_student_handoff(
  p_roster_id uuid,
  p_attendance_status text,
  p_assessment jsonb,
  p_handoff_note text,
  p_complete boolean default false
)
returns table (
  current_manual_no integer,
  completed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_roster public.team_works_session_roster%rowtype;
  target_session public.team_works_op_sessions%rowtype;
  worker_member_id uuid;
  completed_now boolean := false;
begin
  if p_attendance_status not in ('scheduled', 'present', 'absent', 'late', 'excused') then
    raise exception 'Unsupported attendance status';
  end if;

  if p_assessment is null or jsonb_typeof(p_assessment) <> 'object' then
    raise exception 'Assessment must be an object';
  end if;

  if length(coalesce(p_handoff_note, '')) > 4000 then
    raise exception 'Handoff note is too long';
  end if;

  select *
    into target_roster
  from public.team_works_session_roster
  where id = p_roster_id
  for update;

  if target_roster.id is null then
    raise exception 'Roster row not found';
  end if;

  select *
    into target_session
  from public.team_works_op_sessions
  where id = target_roster.session_id
    and status <> 'cancelled';

  select pm.organization_member_id
    into worker_member_id
  from public.team_works_project_members pm
  join public.team_works_organization_members om
    on om.id = pm.organization_member_id
  where pm.project_id = target_roster.project_id
    and pm.project_role = 'worker'
    and om.user_id = (select auth.uid())
    and om.status = 'active'
  limit 1;

  if worker_member_id is null or target_session.partner_member_id is distinct from worker_member_id then
    raise exception 'You are not assigned to this session';
  end if;

  completed_now := p_complete and target_roster.partner_completed_at is null;

  update public.team_works_session_roster
  set attendance_status = p_attendance_status,
      partner_assessment = p_assessment,
      handoff_note = nullif(trim(coalesce(p_handoff_note, '')), ''),
      partner_completed_at = case
        when completed_now then now()
        else partner_completed_at
      end,
      updated_at = now()
  where id = p_roster_id;

  if completed_now then
    update public.team_works_participants as participant
    set current_manual_no = participant.current_manual_no + 1,
        updated_at = now()
    where participant.id = target_roster.participant_id;
  end if;

  return query
  select p.current_manual_no, sr.partner_completed_at
  from public.team_works_participants p
  join public.team_works_session_roster sr on sr.id = p_roster_id
  where p.id = target_roster.participant_id;
end;
$$;

revoke all on function public.team_works_update_partner_presence(uuid, text) from public, anon;
revoke all on function public.team_works_save_partner_student_handoff(uuid, text, jsonb, text, boolean) from public, anon;
grant execute on function public.team_works_update_partner_presence(uuid, text) to authenticated, service_role;
grant execute on function public.team_works_save_partner_student_handoff(uuid, text, jsonb, text, boolean) to authenticated, service_role;
