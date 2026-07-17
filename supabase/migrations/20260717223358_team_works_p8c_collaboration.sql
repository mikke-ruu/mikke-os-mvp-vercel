-- Team Works P8-c: authenticated member invitations and collaboration records.
-- Invitation acceptance is enforced by a private SECURITY DEFINER predicate;
-- no service-role credential or public privileged RPC is exposed to browsers.

create table public.team_works_member_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.team_works_organizations(id) on delete restrict,
  project_id uuid,
  email text not null check (position('@' in email) > 1),
  role text not null check (role in ('manager', 'client_user', 'worker')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  accepted_by_user_id uuid references auth.users(id) on delete restrict,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_works_member_invites_project_org_fkey
    foreign key (project_id, organization_id)
    references public.team_works_projects(id, organization_id)
    on delete restrict
);

alter table public.team_works_organization_members
  add column invite_id uuid unique references public.team_works_member_invites(id) on delete restrict;

create table public.team_works_project_forms (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.team_works_projects(id) on delete restrict,
  task_id uuid,
  source_local_id text,
  name text not null,
  input_actor text not null check (input_actor in ('admin', 'client', 'worker')),
  required boolean not null default false,
  client_visible boolean not null default false,
  editable_after_submit boolean not null default false,
  fields jsonb not null default '[]'::jsonb check (jsonb_typeof(fields) = 'array'),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, source_local_id),
  unique (id, project_id),
  constraint team_works_project_forms_task_fkey
    foreign key (task_id, project_id)
    references public.team_works_project_tasks(id, project_id)
    on delete restrict
);

create table public.team_works_form_submissions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.team_works_projects(id) on delete restrict,
  form_id uuid not null,
  submitted_by_member_id uuid not null,
  source_local_id text,
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'revision_requested', 'approved')),
  review_memo text not null default '',
  reviewed_by_member_id uuid,
  approved_by_member_id uuid,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (form_id, submitted_by_member_id),
  unique (project_id, source_local_id),
  constraint team_works_form_submissions_form_fkey
    foreign key (form_id, project_id)
    references public.team_works_project_forms(id, project_id)
    on delete restrict,
  constraint team_works_form_submissions_submitter_fkey
    foreign key (project_id, submitted_by_member_id)
    references public.team_works_project_members(project_id, organization_member_id)
    on delete restrict,
  constraint team_works_form_submissions_reviewer_fkey
    foreign key (project_id, reviewed_by_member_id)
    references public.team_works_project_members(project_id, organization_member_id)
    on delete restrict,
  constraint team_works_form_submissions_approver_fkey
    foreign key (project_id, approved_by_member_id)
    references public.team_works_project_members(project_id, organization_member_id)
    on delete restrict
);

create table public.team_works_project_deliverables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.team_works_projects(id) on delete restrict,
  task_id uuid not null,
  source_local_id text,
  title text not null,
  deliverable_type text not null check (deliverable_type in ('url', 'file_placeholder', 'note')),
  url text not null default '',
  version integer not null default 1 check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'internal_review', 'client_review', 'revision_requested', 'approved', 'delivered')),
  submitted_by_member_id uuid,
  reviewed_by_member_id uuid,
  client_visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, source_local_id),
  unique (id, project_id),
  constraint team_works_project_deliverables_task_fkey
    foreign key (task_id, project_id)
    references public.team_works_project_tasks(id, project_id)
    on delete restrict,
  constraint team_works_project_deliverables_submitter_fkey
    foreign key (project_id, submitted_by_member_id)
    references public.team_works_project_members(project_id, organization_member_id)
    on delete restrict,
  constraint team_works_project_deliverables_reviewer_fkey
    foreign key (project_id, reviewed_by_member_id)
    references public.team_works_project_members(project_id, organization_member_id)
    on delete restrict
);

create table public.team_works_project_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.team_works_projects(id) on delete restrict,
  task_id uuid,
  deliverable_id uuid,
  author_member_id uuid not null,
  source_local_id text,
  audience text not null check (audience in ('internal', 'client')),
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, source_local_id),
  constraint team_works_project_comments_task_fkey
    foreign key (task_id, project_id)
    references public.team_works_project_tasks(id, project_id)
    on delete restrict,
  constraint team_works_project_comments_deliverable_fkey
    foreign key (deliverable_id, project_id)
    references public.team_works_project_deliverables(id, project_id)
    on delete restrict,
  constraint team_works_project_comments_author_fkey
    foreign key (project_id, author_member_id)
    references public.team_works_project_members(project_id, organization_member_id)
    on delete restrict
);

create index team_works_invites_org_status_idx on public.team_works_member_invites(organization_id, status, expires_at);
create index team_works_invites_project_idx on public.team_works_member_invites(project_id);
create index team_works_forms_task_project_idx on public.team_works_project_forms(task_id, project_id);
create index team_works_submissions_project_form_idx on public.team_works_form_submissions(project_id, form_id);
create index team_works_submissions_submitter_project_idx on public.team_works_form_submissions(submitted_by_member_id, project_id);
create index team_works_deliverables_task_project_idx on public.team_works_project_deliverables(task_id, project_id);
create index team_works_deliverables_submitter_project_idx on public.team_works_project_deliverables(submitted_by_member_id, project_id);
create index team_works_deliverables_reviewer_project_idx on public.team_works_project_deliverables(reviewed_by_member_id, project_id);
create index team_works_comments_task_project_idx on public.team_works_project_comments(task_id, project_id);
create index team_works_comments_deliverable_project_idx on public.team_works_project_comments(deliverable_id, project_id);
create index team_works_comments_author_project_idx on public.team_works_project_comments(author_member_id, project_id);

create or replace function private.team_works_current_project_member_id(target_project_id uuid)
returns uuid language sql stable security definer set search_path = ''
as $$
  select pm.organization_member_id
  from public.team_works_project_members pm
  join public.team_works_organization_members m on m.id = pm.organization_member_id
  where pm.project_id = target_project_id and m.user_id = (select auth.uid()) and m.status = 'active'
  limit 1;
$$;

create or replace function private.team_works_current_project_role(target_project_id uuid)
returns text language sql stable security definer set search_path = ''
as $$
  select pm.project_role
  from public.team_works_project_members pm
  join public.team_works_organization_members m on m.id = pm.organization_member_id
  where pm.project_id = target_project_id and m.user_id = (select auth.uid()) and m.status = 'active'
  limit 1;
$$;

create or replace function private.team_works_is_project_staff(target_project_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.team_works_projects p
    join public.team_works_organizations o on o.id = p.organization_id
    where p.id = target_project_id and o.owner_user_id = (select auth.uid())
  ) or exists (
    select 1 from public.team_works_project_members pm
    join public.team_works_organization_members m on m.id = pm.organization_member_id
    where pm.project_id = target_project_id and m.user_id = (select auth.uid())
      and m.status = 'active' and pm.project_role in ('owner', 'manager')
  );
$$;

create or replace function private.team_works_can_accept_invite(
  target_invite_id uuid,
  target_organization_id uuid,
  target_user_id uuid,
  target_role text
)
returns boolean language sql stable security definer set search_path = ''
as $$
  select target_user_id = (select auth.uid()) and exists (
    select 1
    from public.team_works_member_invites i
    join auth.users u on u.id = target_user_id
    where i.id = target_invite_id
      and i.organization_id = target_organization_id
      and i.role = target_role
      and i.status = 'pending'
      and i.expires_at > now()
      and lower(i.email) = lower(u.email)
  );
$$;

create or replace function private.team_works_mark_invite_accepted()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare invite_project_id uuid;
begin
  if new.invite_id is null then return new; end if;
  update public.team_works_member_invites
  set status = 'accepted', accepted_by_user_id = new.user_id, accepted_at = now(), updated_at = now()
  where id = new.invite_id and status = 'pending'
  returning project_id into invite_project_id;
  if invite_project_id is null then return new; end if;
  insert into public.team_works_project_members(project_id, organization_id, organization_member_id, project_role)
  values (
    invite_project_id,
    new.organization_id,
    new.id,
    case new.role when 'client_user' then 'client' else new.role end
  )
  on conflict (project_id, organization_member_id) do update set project_role = excluded.project_role;
  return new;
end;
$$;

revoke all on function private.team_works_current_project_member_id(uuid) from public, anon;
revoke all on function private.team_works_current_project_role(uuid) from public, anon;
revoke all on function private.team_works_is_project_staff(uuid) from public, anon;
revoke all on function private.team_works_can_accept_invite(uuid,uuid,uuid,text) from public, anon;
revoke all on function private.team_works_mark_invite_accepted() from public, anon, authenticated;
grant execute on function private.team_works_current_project_member_id(uuid) to authenticated, service_role;
grant execute on function private.team_works_current_project_role(uuid) to authenticated, service_role;
grant execute on function private.team_works_is_project_staff(uuid) to authenticated, service_role;
grant execute on function private.team_works_can_accept_invite(uuid,uuid,uuid,text) to authenticated, service_role;
grant execute on function private.team_works_mark_invite_accepted() to postgres, service_role;

create trigger team_works_accept_invite_after_member_insert
after insert on public.team_works_organization_members
for each row execute function private.team_works_mark_invite_accepted();

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'team_works_member_invites', 'team_works_project_forms', 'team_works_form_submissions',
    'team_works_project_deliverables', 'team_works_project_comments'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
    execute format('grant select, insert, update on table public.%I to authenticated', table_name);
  end loop;
end $$;

create policy team_works_members_accept_invite on public.team_works_organization_members for insert to authenticated
with check (private.team_works_can_accept_invite(invite_id, organization_id, user_id, role));

create policy team_works_invites_select on public.team_works_member_invites for select to authenticated
using (private.team_works_is_org_staff(organization_id));
create policy team_works_invites_insert on public.team_works_member_invites for insert to authenticated
with check (private.team_works_is_org_staff(organization_id) and created_by_user_id = (select auth.uid()));
create policy team_works_invites_update on public.team_works_member_invites for update to authenticated
using (private.team_works_is_org_staff(organization_id))
with check (private.team_works_is_org_staff(organization_id));

create policy team_works_forms_select on public.team_works_project_forms for select to authenticated
using (
  private.team_works_is_project_staff(project_id)
  or (private.team_works_current_project_role(project_id) = 'worker' and input_actor = 'worker')
  or (private.team_works_current_project_role(project_id) = 'client' and input_actor = 'client' and client_visible)
);
create policy team_works_forms_insert on public.team_works_project_forms for insert to authenticated
with check (private.team_works_is_project_staff(project_id));
create policy team_works_forms_update on public.team_works_project_forms for update to authenticated
using (private.team_works_is_project_staff(project_id)) with check (private.team_works_is_project_staff(project_id));

create policy team_works_submissions_select on public.team_works_form_submissions for select to authenticated
using (private.team_works_is_project_staff(project_id) or submitted_by_member_id = private.team_works_current_project_member_id(project_id));
create policy team_works_submissions_insert on public.team_works_form_submissions for insert to authenticated
with check (
  submitted_by_member_id = private.team_works_current_project_member_id(project_id)
  and exists (
    select 1 from public.team_works_project_forms f
    where f.id = form_id and f.project_id = project_id
      and f.input_actor = private.team_works_current_project_role(project_id)
  )
);
create policy team_works_submissions_update on public.team_works_form_submissions for update to authenticated
using (
  private.team_works_is_project_staff(project_id)
  or (submitted_by_member_id = private.team_works_current_project_member_id(project_id) and status in ('draft', 'revision_requested'))
)
with check (
  private.team_works_is_project_staff(project_id)
  or (
    submitted_by_member_id = private.team_works_current_project_member_id(project_id)
    and status in ('draft', 'submitted', 'revision_requested')
    and reviewed_by_member_id is null and approved_by_member_id is null
  )
);

create policy team_works_deliverables_select on public.team_works_project_deliverables for select to authenticated
using (
  private.team_works_is_project_staff(project_id)
  or private.team_works_current_project_role(project_id) = 'worker'
  or (private.team_works_current_project_role(project_id) = 'client' and client_visible and status in ('client_review', 'revision_requested', 'approved', 'delivered'))
);
create policy team_works_deliverables_insert on public.team_works_project_deliverables for insert to authenticated
with check (
  private.team_works_is_project_staff(project_id)
  or (
    private.team_works_current_project_role(project_id) = 'worker'
    and exists (
      select 1 from public.team_works_project_tasks t
      where t.id = task_id and t.project_id = project_id
        and t.assignee_member_id = private.team_works_current_project_member_id(project_id)
    )
  )
);
create policy team_works_deliverables_update on public.team_works_project_deliverables for update to authenticated
using (
  private.team_works_is_project_staff(project_id)
  or (private.team_works_current_project_role(project_id) = 'client' and client_visible and status = 'client_review')
)
with check (
  private.team_works_is_project_staff(project_id)
  or (private.team_works_current_project_role(project_id) = 'client' and client_visible and status in ('revision_requested', 'approved'))
);

create policy team_works_comments_select on public.team_works_project_comments for select to authenticated
using (
  private.team_works_is_project_staff(project_id)
  or private.team_works_current_project_role(project_id) = 'worker'
  or (private.team_works_current_project_role(project_id) = 'client' and audience = 'client')
);
create policy team_works_comments_insert on public.team_works_project_comments for insert to authenticated
with check (
  author_member_id = private.team_works_current_project_member_id(project_id)
  and (
    private.team_works_is_project_staff(project_id)
    or private.team_works_current_project_role(project_id) = 'worker'
    or (private.team_works_current_project_role(project_id) = 'client' and audience = 'client')
  )
);

comment on table public.team_works_member_invites is 'Email-bound, expiring Team Works membership invitations. Recipients cannot enumerate invitation rows.';
comment on table public.team_works_form_submissions is 'Actor-owned form answers; staff review and approval are enforced by RLS.';
comment on table public.team_works_project_comments is 'Immutable collaboration comments. Client visibility requires both project membership and client audience.';

notify pgrst, 'reload schema';
