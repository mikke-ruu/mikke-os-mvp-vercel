-- Keep the existing primary assignment and its write permissions unchanged.
alter table public.team_works_op_sessions
  add column training_partner_member_id uuid references public.team_works_organization_members(id) on delete set null,
  add constraint team_works_session_training_distinct check (
    training_partner_member_id is null or
    (partner_member_id is not null and training_partner_member_id <> partner_member_id)
  );
create index team_works_sessions_training_idx on public.team_works_op_sessions(training_partner_member_id,session_date)
  where training_partner_member_id is not null;

create function private.team_works_validate_training_partner()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.training_partner_member_id is null then return new; end if;
  if tg_op='UPDATE' and new.training_partner_member_id is not distinct from old.training_partner_member_id
    and new.project_id=old.project_id then return new; end if;
  if not exists (
    select 1 from public.team_works_project_members pm
    join public.team_works_organization_members m on m.id=pm.organization_member_id
    join public.team_works_projects p on p.id=pm.project_id and p.organization_id=m.organization_id
    where pm.project_id=new.project_id and pm.organization_member_id=new.training_partner_member_id
      and pm.project_role='worker' and m.role='worker' and m.status='active'
      and not exists (select 1 from public.team_works_project_partner_settings ps
        where ps.project_id=pm.project_id and ps.organization_member_id=m.id and ps.status='removed')
      and not exists (select 1 from public.team_works_project_partner_offers o
        where o.project_id=pm.project_id and o.organization_member_id=m.id and o.status<>'accepted')
  ) then raise exception '研修担当には、このプロジェクトへの参加を承認したパートナーを選んでください。'; end if;
  return new;
end;
$$;
revoke all on function private.team_works_validate_training_partner() from public, anon;
create trigger team_works_validate_training_partner before insert or update of training_partner_member_id,project_id
on public.team_works_op_sessions for each row execute function private.team_works_validate_training_partner();

create function private.team_works_is_training_partner(target_project_id uuid,target_member_id uuid)
-- Caller-bound predicate keeps staff-only wage/settings rows private.
-- Only a boolean is returned; the function is outside the exposed API schema.
returns boolean language sql stable security definer set search_path='' as $$
  select (select auth.uid()) is not null and target_member_id is not null
    and private.team_works_is_own_project_member_id(target_project_id,target_member_id)
    and private.team_works_has_project_role(target_project_id,'worker')
    and not exists(select 1 from public.team_works_project_partner_settings s
      where s.project_id=target_project_id and s.organization_member_id=target_member_id and s.status='removed')
    and not exists(select 1 from public.team_works_project_partner_offers o
      where o.project_id=target_project_id and o.organization_member_id=target_member_id and o.status<>'accepted');
$$;
revoke all on function private.team_works_is_training_partner(uuid,uuid) from public, anon;
grant execute on function private.team_works_is_training_partner(uuid,uuid) to authenticated;

-- Only SELECT is added. Presence, handoff, Zoom and report writes retain primary checks.
create policy team_works_sessions_training_select on public.team_works_op_sessions
for select to authenticated using (status<>'cancelled' and private.team_works_is_training_partner(project_id,training_partner_member_id));
create policy team_works_roster_training_select on public.team_works_session_roster
for select to authenticated using (exists(select 1 from public.team_works_op_sessions s
  where s.id=session_id and s.project_id=team_works_session_roster.project_id and s.status<>'cancelled'
    and private.team_works_is_training_partner(s.project_id,s.training_partner_member_id)));
create policy team_works_participants_training_select on public.team_works_participants
for select to authenticated using (exists(select 1 from public.team_works_session_roster r
  join public.team_works_op_sessions s on s.id=r.session_id and s.project_id=r.project_id
  where r.participant_id=team_works_participants.id and r.project_id=team_works_participants.project_id
    and s.status<>'cancelled' and private.team_works_is_training_partner(s.project_id,s.training_partner_member_id)));
create policy team_works_reports_training_select on public.team_works_ops_session_reports
for select to authenticated using (exists(select 1 from public.team_works_op_sessions s
  where s.id=session_id and s.project_id=team_works_ops_session_reports.project_id and s.status<>'cancelled'
    and private.team_works_is_training_partner(s.project_id,s.training_partner_member_id)));
-- Qualify the project correlation in the existing primary-only report policy.
alter policy team_works_ops_reports_insert on public.team_works_ops_session_reports
with check (private.team_works_has_project_role(project_id,'worker')
  and submitted_by_member_id=private.team_works_project_member_id_for(project_id,'worker')
  and exists(select 1 from public.team_works_op_sessions s where s.id=session_id
    and s.project_id=team_works_ops_session_reports.project_id
    and s.partner_member_id=submitted_by_member_id and s.status<>'cancelled'));
notify pgrst,'reload schema';
