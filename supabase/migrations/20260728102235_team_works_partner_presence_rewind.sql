-- Allow assigned partners to correct an accidentally selected lesson state.
-- The existing ownership check remains unchanged; only the accepted states
-- and timestamp reset behavior are expanded.

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
  if p_status not in ('not_started', 'standby', 'in_progress', 'ended') then
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
        when p_status = 'not_started' then null
        when p_status in ('standby', 'in_progress') then coalesce(partner_standby_at, now())
        else partner_standby_at
      end,
      partner_ended_at = case when p_status = 'ended' then now() else null end,
      updated_at = now()
  where id = p_session_id;
end;
$$;

revoke all on function public.team_works_update_partner_presence(uuid, text) from public, anon;
grant execute on function public.team_works_update_partner_presence(uuid, text) to authenticated, service_role;
