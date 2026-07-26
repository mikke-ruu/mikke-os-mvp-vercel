-- Cover the composite foreign keys added by the R4 portal request boundary.

create index team_works_ops_reports_session_project_idx
  on public.team_works_ops_session_reports(session_id, project_id);

create index team_works_ops_reports_project_submitter_idx
  on public.team_works_ops_session_reports(project_id, submitted_by_member_id);
