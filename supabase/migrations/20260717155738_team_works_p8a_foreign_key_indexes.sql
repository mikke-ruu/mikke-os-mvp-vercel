-- Team Works P8-a advisor follow-up: cover every composite foreign key in its
-- declared column order. Single-column project lookups use these prefixes too.

create index team_works_projects_client_member_org_idx
  on public.team_works_projects (client_member_id, organization_id);

create index team_works_project_members_project_org_idx
  on public.team_works_project_members (project_id, organization_id);
create index team_works_project_members_member_org_idx
  on public.team_works_project_members (organization_member_id, organization_id);

create index team_works_resources_task_project_idx
  on public.team_works_project_resources (task_id, project_id);

create index team_works_payouts_project_payee_idx
  on public.team_works_project_payouts (project_id, payee_member_id);
create index team_works_payouts_task_project_idx
  on public.team_works_project_payouts (task_id, project_id);

create index team_works_invoices_project_billed_idx
  on public.team_works_project_invoices (project_id, billed_member_id);
create index team_works_invoices_task_project_idx
  on public.team_works_project_invoices (task_id, project_id);
