-- Qualify current_manual_no inside the PL/pgSQL UPDATE. The function's
-- RETURNS TABLE output variable has the same name, so the unqualified
-- expression in the original migration was ambiguous at runtime.

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
  select participant.current_manual_no, roster.partner_completed_at
  from public.team_works_participants participant
  join public.team_works_session_roster roster on roster.id = p_roster_id
  where participant.id = target_roster.participant_id;
end;
$$;

revoke all on function public.team_works_save_partner_student_handoff(uuid, text, jsonb, text, boolean)
from public, anon;
grant execute on function public.team_works_save_partner_student_handoff(uuid, text, jsonb, text, boolean)
to authenticated, service_role;
