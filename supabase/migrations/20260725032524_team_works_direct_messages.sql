-- Direct conversations use the established project-comment stream.  A null
-- recipient remains a project-wide announcement for backwards compatibility.
alter table public.team_works_project_comments
  add column recipient_member_id uuid;

alter table public.team_works_project_comments
  add constraint team_works_project_comments_recipient_fkey
  foreign key (project_id, recipient_member_id)
  references public.team_works_project_members(project_id, organization_member_id)
  on delete restrict;

create index team_works_comments_project_recipient_created_idx
  on public.team_works_project_comments(project_id, recipient_member_id, created_at desc)
  where recipient_member_id is not null;

drop policy if exists team_works_comments_select on public.team_works_project_comments;
create policy team_works_comments_select on public.team_works_project_comments for select to authenticated
using (
  private.team_works_is_project_staff(project_id)
  or (
    private.team_works_current_project_role(project_id) = 'worker'
    and (
      recipient_member_id is null
      or recipient_member_id = private.team_works_current_project_member_id(project_id)
      or author_member_id = private.team_works_current_project_member_id(project_id)
    )
  )
  or (
    private.team_works_current_project_role(project_id) = 'client'
    and audience = 'client'
    and (
      recipient_member_id is null
      or recipient_member_id = private.team_works_current_project_member_id(project_id)
      or author_member_id = private.team_works_current_project_member_id(project_id)
    )
  )
);

comment on column public.team_works_project_comments.recipient_member_id is
  'Direct message recipient. Null means a project-wide announcement visible under the audience rules.';

notify pgrst, 'reload schema';
