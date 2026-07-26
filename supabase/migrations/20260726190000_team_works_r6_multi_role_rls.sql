-- Team Works R6 P1: multi-role-safe RLS.
--
-- Every role check in Team Works RLS was written against
-- private.team_works_project_role() / team_works_current_project_role() /
-- team_works_current_project_member_id(), all of which pick ONE row with
-- `limit 1` -- an artifact of the original one-role-per-org design. Since
-- 20260726150000_team_works_r6_multi_role_membership.sql let one account
-- hold several ACTIVE roles at once (e.g. worker AND client_user on the same
-- project), `limit 1` became non-deterministic: which role a check saw
-- depended on row order, not on what the caller was actually doing. Concrete
-- symptom: a client whose account also had a leftover active worker row
-- could not write to their own client-only roster, because the participants
-- insert policy requires role='client' and `limit 1` sometimes returned
-- 'worker' instead.
--
-- Fix: every policy that asked "am I role X on this project" now asks
-- "do I HOLD role X" (team_works_has_project_role -- an EXISTS check, so
-- multiple simultaneous roles coexist fine), and every policy that compared
-- a column against "my member id for this project" now asks for "my member
-- id FOR THAT SPECIFIC ROLE" (team_works_project_member_id_for) instead of
-- an arbitrary one of possibly several rows. Author/ownership checks that
-- don't need a specific role (comments, partner offers) use
-- team_works_is_own_project_member_id instead, which accepts any of the
-- caller's own rows on that project.
--
-- The old team_works_project_role / team_works_current_project_role /
-- team_works_current_project_member_id functions are left in place --
-- delivery-style project policies (forms, form_submissions, deliverables,
-- and the p8g/p8h storage policies) still use them and are NOT rewritten
-- here. Delivery-style projects are not part of the Arisa operations launch,
-- and a person holding a role on both a delivery AND an operations project
-- at once is not a case in play yet. Do not add new callers of the old
-- functions; use the ones below instead.

create or replace function private.team_works_has_project_role(target_project_id uuid, target_role text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.team_works_project_members pm
    join public.team_works_organization_members m on m.id = pm.organization_member_id
    where pm.project_id = target_project_id
      and pm.project_role = target_role
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

create or replace function private.team_works_project_member_id_for(target_project_id uuid, target_role text)
returns uuid language sql stable security definer set search_path = ''
as $$
  select pm.organization_member_id
  from public.team_works_project_members pm
  join public.team_works_organization_members m on m.id = pm.organization_member_id
  where pm.project_id = target_project_id
    and pm.project_role = target_role
    and m.user_id = (select auth.uid())
    and m.status = 'active'
  limit 1;
$$;

create or replace function private.team_works_is_own_project_member_id(target_project_id uuid, target_member_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.team_works_project_members pm
    join public.team_works_organization_members m on m.id = pm.organization_member_id
    where pm.project_id = target_project_id
      and pm.organization_member_id = target_member_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

revoke all on function private.team_works_has_project_role(uuid, text) from public, anon;
revoke all on function private.team_works_project_member_id_for(uuid, text) from public, anon;
revoke all on function private.team_works_is_own_project_member_id(uuid, uuid) from public, anon;
grant execute on function private.team_works_has_project_role(uuid, text) to authenticated, service_role;
grant execute on function private.team_works_project_member_id_for(uuid, text) to authenticated, service_role;
grant execute on function private.team_works_is_own_project_member_id(uuid, uuid) to authenticated, service_role;

-- Previously matched sessions whose partner_member_id equalled the caller's
-- single (possibly wrong-role) member id.
create or replace function private.team_works_ops_assigned_participant_ids(target_project_id uuid)
returns setof uuid language sql stable security definer set search_path = ''
as $$
  select distinct sr.participant_id
  from public.team_works_session_roster sr
  join public.team_works_op_sessions s on s.id = sr.session_id
  where s.project_id = target_project_id
    and s.partner_member_id = private.team_works_project_member_id_for(target_project_id, 'worker');
$$;

-- === r1 operations: participants / manuals / schedule_rules / op_sessions / session_roster ===

drop policy if exists team_works_participants_select on public.team_works_participants;
create policy team_works_participants_select on public.team_works_participants for select to authenticated
using (
  exists (select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id))
  or private.team_works_has_project_role(project_id, 'client')
  or (
    private.team_works_has_project_role(project_id, 'worker')
    and id in (select private.team_works_ops_assigned_participant_ids(project_id))
  )
);

drop policy if exists team_works_manuals_select on public.team_works_manuals;
create policy team_works_manuals_select on public.team_works_manuals for select to authenticated
using (
  exists (select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id))
  or private.team_works_has_project_role(project_id, 'worker')
);

drop policy if exists team_works_schedule_rules_select on public.team_works_schedule_rules;
create policy team_works_schedule_rules_select on public.team_works_schedule_rules for select to authenticated
using (
  exists (select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id))
  or private.team_works_has_project_role(project_id, 'client')
  or (private.team_works_has_project_role(project_id, 'worker') and partner_member_id = private.team_works_project_member_id_for(project_id, 'worker'))
);

drop policy if exists team_works_op_sessions_select on public.team_works_op_sessions;
create policy team_works_op_sessions_select on public.team_works_op_sessions for select to authenticated
using (
  exists (select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id))
  or private.team_works_has_project_role(project_id, 'client')
  or (private.team_works_has_project_role(project_id, 'worker') and partner_member_id = private.team_works_project_member_id_for(project_id, 'worker'))
);

drop policy if exists team_works_session_roster_select on public.team_works_session_roster;
create policy team_works_session_roster_select on public.team_works_session_roster for select to authenticated
using (
  exists (select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id))
  or private.team_works_has_project_role(project_id, 'client')
  or (
    private.team_works_has_project_role(project_id, 'worker')
    and exists (
      select 1 from public.team_works_op_sessions s
      where s.id = session_id and s.partner_member_id = private.team_works_project_member_id_for(project_id, 'worker')
    )
  )
);

-- client-facing writes on participants / session_roster
-- (originally from 20260726103000_team_works_client_portal_roster_and_messages.sql)
drop policy if exists team_works_participants_client_insert on public.team_works_participants;
create policy team_works_participants_client_insert
on public.team_works_participants
for insert to authenticated
with check (private.team_works_has_project_role(project_id, 'client'));

drop policy if exists team_works_participants_client_update on public.team_works_participants;
create policy team_works_participants_client_update
on public.team_works_participants
for update to authenticated
using (private.team_works_has_project_role(project_id, 'client'))
with check (private.team_works_has_project_role(project_id, 'client'));

drop policy if exists team_works_session_roster_client_insert on public.team_works_session_roster;
create policy team_works_session_roster_client_insert
on public.team_works_session_roster
for insert to authenticated
with check (private.team_works_has_project_role(project_id, 'client'));

drop policy if exists team_works_session_roster_client_delete on public.team_works_session_roster;
create policy team_works_session_roster_client_delete
on public.team_works_session_roster
for delete to authenticated
using (private.team_works_has_project_role(project_id, 'client'));

-- === r4 portal requests: session reports / client closure requests ===

drop policy if exists team_works_ops_reports_select on public.team_works_ops_session_reports;
create policy team_works_ops_reports_select
on public.team_works_ops_session_reports for select to authenticated
using (
  exists (select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id))
  or private.team_works_is_own_project_member_id(project_id, submitted_by_member_id)
);

drop policy if exists team_works_ops_reports_insert on public.team_works_ops_session_reports;
create policy team_works_ops_reports_insert
on public.team_works_ops_session_reports for insert to authenticated
with check (
  private.team_works_has_project_role(project_id, 'worker')
  and submitted_by_member_id = private.team_works_project_member_id_for(project_id, 'worker')
  and exists (
    select 1
    from public.team_works_op_sessions s
    where s.id = session_id
      and s.project_id = project_id
      and s.partner_member_id = submitted_by_member_id
      and s.status <> 'cancelled'
  )
);

drop policy if exists team_works_client_requests_select on public.team_works_client_requests;
create policy team_works_client_requests_select
on public.team_works_client_requests for select to authenticated
using (
  exists (select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id))
  or private.team_works_is_own_project_member_id(project_id, requested_by_member_id)
);

drop policy if exists team_works_client_requests_insert on public.team_works_client_requests;
create policy team_works_client_requests_insert
on public.team_works_client_requests for insert to authenticated
with check (
  private.team_works_has_project_role(project_id, 'client')
  and requested_by_member_id = private.team_works_project_member_id_for(project_id, 'client')
);

-- === comments / direct messages (shared by delivery + operations projects) ===

drop policy if exists team_works_comments_select on public.team_works_project_comments;
create policy team_works_comments_select on public.team_works_project_comments for select to authenticated
using (
  private.team_works_is_project_staff(project_id)
  or (
    private.team_works_has_project_role(project_id, 'worker')
    and (
      recipient_member_id is null
      or recipient_member_id = private.team_works_project_member_id_for(project_id, 'worker')
      or author_member_id = private.team_works_project_member_id_for(project_id, 'worker')
    )
  )
  or (
    private.team_works_has_project_role(project_id, 'client')
    and audience = 'client'
    and (
      recipient_member_id is null
      or recipient_member_id = private.team_works_project_member_id_for(project_id, 'client')
      or author_member_id = private.team_works_project_member_id_for(project_id, 'client')
    )
  )
);

drop policy if exists team_works_comments_insert on public.team_works_project_comments;
create policy team_works_comments_insert on public.team_works_project_comments
for insert to authenticated
with check (
  private.team_works_is_own_project_member_id(project_id, author_member_id)
  and (
    private.team_works_is_project_staff(project_id)
    or private.team_works_has_project_role(project_id, 'worker')
    or (private.team_works_has_project_role(project_id, 'client') and audience = 'client')
  )
);

-- === partner offers ===

drop policy if exists team_works_project_partner_offers_worker_select on public.team_works_project_partner_offers;
create policy team_works_project_partner_offers_worker_select
on public.team_works_project_partner_offers for select to authenticated
using (private.team_works_is_own_project_member_id(project_id, organization_member_id));

drop policy if exists team_works_project_partner_offers_worker_response on public.team_works_project_partner_offers;
create policy team_works_project_partner_offers_worker_response
on public.team_works_project_partner_offers for update to authenticated
using (
  private.team_works_is_own_project_member_id(project_id, organization_member_id)
  and status = 'pending'
)
with check (
  private.team_works_is_own_project_member_id(project_id, organization_member_id)
  and status in ('accepted', 'declined')
);

-- === activation lookup: find an already-active directory member by email ===
--
-- addOperationsPartnerToProject / addOperationsClientToProject decide whether
-- someone is "already activated" by looking for an ACCEPTED row in
-- team_works_member_invites. That only ever matches people who went through
-- the old email-link invite flow. Since 20260726160000's fixed-URL
-- self-activation, a person can become an active organization member with NO
-- invite row at all -- so assigning that already-active person to a SECOND
-- project fell through to the "not yet activated" branch, which creates a
-- fresh invite nobody will ever open (there is no more invite URL shown in
-- the UI) and the person silently never gets added to the new project.
--
-- This RPC finds an active org member by email directly, regardless of how
-- they got there. Restricted to org staff of the target organization.

create or replace function public.team_works_find_active_member(
  target_organization_id uuid,
  target_role text,
  target_email text
)
returns table(member_id uuid, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.display_name
  from public.team_works_organization_members m
  join auth.users u on u.id = m.user_id
  where m.organization_id = target_organization_id
    and m.role = target_role
    and m.status = 'active'
    and lower(u.email) = lower(target_email)
    and private.team_works_is_org_staff(target_organization_id)
  limit 1;
$$;

revoke all on function public.team_works_find_active_member(uuid, text, text) from public, anon;
grant execute on function public.team_works_find_active_member(uuid, text, text) to authenticated, service_role;

-- === staff member list with resolved email ===
--
-- The 企業設定 (settings) member list previously showed email only for
-- members with an invite_id (resolved via team_works_member_invites.email).
-- Anyone who onboarded through fixed-URL self-activation has no invite row,
-- so their email showed blank -- exactly the members staff most need to
-- identify when cleaning up duplicates. This RPC resolves email via
-- auth.users directly, for any organization the caller is staff of.

create or replace function public.team_works_list_organization_members(target_organization_id uuid)
returns table (id uuid, display_name text, role text, status text, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.display_name, m.role, m.status, u.email
  from public.team_works_organization_members m
  join auth.users u on u.id = m.user_id
  where m.organization_id = target_organization_id
    and m.status <> 'archived'
    and private.team_works_is_org_staff(target_organization_id)
  order by m.display_name;
$$;

revoke all on function public.team_works_list_organization_members(uuid) from public, anon;
grant execute on function public.team_works_list_organization_members(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
