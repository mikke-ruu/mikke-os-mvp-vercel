-- Team Works R1 advisor follow-up: cover every composite foreign key added in
-- 20260724060000_team_works_r1_operations_foundation.sql in its declared column order
-- (matches the remediation style of 20260717155738_team_works_p8a_foreign_key_indexes.sql).

create index team_works_participants_group_project_idx
  on public.team_works_participants (group_id, project_id);

create index team_works_op_sessions_project_partner_idx
  on public.team_works_op_sessions (project_id, partner_member_id);
create index team_works_op_sessions_rule_project_idx
  on public.team_works_op_sessions (generated_from_rule_id, project_id);

create index team_works_session_roster_session_project_idx
  on public.team_works_session_roster (session_id, project_id);
create index team_works_session_roster_participant_project_idx
  on public.team_works_session_roster (participant_id, project_id);

create index team_works_holidays_project_org_idx
  on public.team_works_holidays (project_id, organization_id);
