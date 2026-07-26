-- Team Works R6: client-side project approval, mirroring the partner offer flow.
--
-- Assigning an activated client to a project now leaves team_works_project_clients
-- at status 'invited' and does NOT yet create a project_members row. The client
-- sees the pending project (title, description, contract period, company) in their
-- portal and approves it; approval creates the project_members(client) row and
-- flips project_clients to 'active', granting full portal access. This is the base
-- for the "project description + terms review + approve -> enter project" flow.
--
-- A free-text project description is added for the client to review at approval.
--
-- Both RPCs are SECURITY DEFINER and strictly scoped to the caller: they match
-- the caller's auth email to an active client directory row, so a client can only
-- see and approve invitations addressed to their own email.

alter table public.team_works_projects
  add column if not exists description text;

create or replace function public.team_works_list_client_pending_projects()
returns table (
  project_id uuid,
  title text,
  description text,
  contract_started_on date,
  contract_ended_on date,
  organization_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.title, p.description, p.contract_started_on, p.contract_ended_on, o.name
  from public.team_works_project_clients pc
  join public.team_works_clients c on c.id = pc.client_id
  join auth.users u on u.id = (select auth.uid())
  join public.team_works_projects p on p.id = pc.project_id
  join public.team_works_organizations o on o.id = p.organization_id
  where pc.status = 'invited'
    and c.status = 'active'
    and lower(c.email) = lower(u.email)
    and p.style = 'operations'
    and p.status = 'active';
$$;

create or replace function public.team_works_approve_client_project(target_project_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  uemail text;
  v_org uuid;
  v_client uuid;
  v_member uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  select lower(email) into uemail from auth.users where id = uid;

  select pc.organization_id, pc.client_id
    into v_org, v_client
  from public.team_works_project_clients pc
  join public.team_works_clients c on c.id = pc.client_id
  where pc.project_id = target_project_id
    and pc.status = 'invited'
    and c.status = 'active'
    and lower(c.email) = uemail
  limit 1;

  if v_org is null then
    raise exception 'no pending invitation for this project';
  end if;

  select id into v_member
  from public.team_works_organization_members
  where organization_id = v_org
    and user_id = uid
    and role = 'client_user'
    and status <> 'archived'
  limit 1;

  if v_member is null then
    raise exception 'client membership is not activated';
  end if;

  insert into public.team_works_project_members
    (project_id, organization_id, organization_member_id, project_role)
  values (target_project_id, v_org, v_member, 'client')
  on conflict (project_id, organization_member_id) do update set project_role = 'client';

  update public.team_works_project_clients
  set status = 'active', updated_at = now()
  where project_id = target_project_id and client_id = v_client;
end;
$$;

revoke all on function public.team_works_list_client_pending_projects() from public, anon;
revoke all on function public.team_works_approve_client_project(uuid) from public, anon;
grant execute on function public.team_works_list_client_pending_projects() to authenticated, service_role;
grant execute on function public.team_works_approve_client_project(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
