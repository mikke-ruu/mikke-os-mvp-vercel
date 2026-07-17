-- TW-P8C: cover collaboration foreign keys and consolidate member insert RLS.

create index team_works_invites_project_org_idx
  on public.team_works_member_invites(project_id, organization_id);
create index team_works_invites_created_by_idx
  on public.team_works_member_invites(created_by_user_id);
create index team_works_invites_accepted_by_idx
  on public.team_works_member_invites(accepted_by_user_id);

create index team_works_submissions_form_project_idx
  on public.team_works_form_submissions(form_id, project_id);
create index team_works_submissions_project_submitter_idx
  on public.team_works_form_submissions(project_id, submitted_by_member_id);
create index team_works_submissions_project_reviewer_idx
  on public.team_works_form_submissions(project_id, reviewed_by_member_id);
create index team_works_submissions_project_approver_idx
  on public.team_works_form_submissions(project_id, approved_by_member_id);

create index team_works_deliverables_project_submitter_idx
  on public.team_works_project_deliverables(project_id, submitted_by_member_id);
create index team_works_deliverables_project_reviewer_idx
  on public.team_works_project_deliverables(project_id, reviewed_by_member_id);
create index team_works_comments_project_author_idx
  on public.team_works_project_comments(project_id, author_member_id);

drop policy team_works_members_insert on public.team_works_organization_members;
drop policy team_works_members_accept_invite on public.team_works_organization_members;

create policy team_works_members_insert on public.team_works_organization_members
for insert to authenticated
with check (
  private.team_works_can_accept_invite(invite_id, organization_id, user_id, role)
  or (
    private.team_works_is_org_staff(organization_id)
    and (
      role <> 'owner'
      or exists (
        select 1
        from public.team_works_organizations o
        where o.id = organization_id
          and o.owner_user_id = user_id
      )
    )
  )
  or (
    user_id = (select auth.uid())
    and role = 'owner'
    and exists (
      select 1
      from public.team_works_organizations o
      where o.id = organization_id
        and o.owner_user_id = (select auth.uid())
    )
  )
);
