-- Client portal: a client may maintain only their own project's participant
-- roster and the ordered attendance list for each session. Internal manuals,
-- reports, and partner handover notes remain outside this policy surface.

create policy team_works_members_select_project_colleagues
on public.team_works_organization_members
for select to authenticated
using (
  exists (
    select 1
    from public.team_works_project_members pm
    where pm.organization_member_id = team_works_organization_members.id
      and private.team_works_is_project_member(pm.project_id)
  )
);

create policy team_works_participants_client_insert
on public.team_works_participants
for insert to authenticated
with check (private.team_works_project_role(project_id) = 'client');

create policy team_works_participants_client_update
on public.team_works_participants
for update to authenticated
using (private.team_works_project_role(project_id) = 'client')
with check (private.team_works_project_role(project_id) = 'client');

create policy team_works_session_roster_client_insert
on public.team_works_session_roster
for insert to authenticated
with check (private.team_works_project_role(project_id) = 'client');

create policy team_works_session_roster_client_delete
on public.team_works_session_roster
for delete to authenticated
using (private.team_works_project_role(project_id) = 'client');

-- Direct client messages use the established comment stream. A client can
-- only author messages as themselves and only in the client-visible channel.
drop policy if exists team_works_comments_insert on public.team_works_project_comments;
create policy team_works_comments_insert on public.team_works_project_comments
for insert to authenticated
with check (
  author_member_id = private.team_works_current_project_member_id(project_id)
  and (
    private.team_works_is_project_staff(project_id)
    or private.team_works_current_project_role(project_id) = 'worker'
    or (
      private.team_works_current_project_role(project_id) = 'client'
      and audience = 'client'
    )
  )
);

notify pgrst, 'reload schema';
