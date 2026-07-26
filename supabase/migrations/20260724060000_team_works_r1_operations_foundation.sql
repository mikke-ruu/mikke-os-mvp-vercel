-- Team Works R1: "operations" project style (recurring school/partner work) alongside the
-- existing "delivery" style. Adds groups/participants/manuals/schedule/roster/holidays,
-- all project-scoped and RLS-gated the same way P8-a scoped tasks/resources/payouts/invoices.
-- Browser users archive; hard delete is intentionally withheld (matches every other Team Works table).

alter table public.team_works_projects
  add column style text not null default 'delivery' check (style in ('operations', 'delivery')),
  add column contract_started_on date,
  add column contract_ended_on date;

create table public.team_works_groups (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.team_works_projects(id) on delete restrict,
  source_local_id text,
  name text not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, source_local_id),
  unique (id, project_id)
);

create table public.team_works_participants (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.team_works_projects(id) on delete restrict,
  group_id uuid,
  source_local_id text,
  name text not null,
  level text,
  cautions text,
  memo text,
  current_manual_no integer not null default 1 check (current_manual_no >= 1),
  status text not null default 'active' check (status in ('active', 'paused', 'graduated', 'archived')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, source_local_id),
  unique (id, project_id),
  constraint team_works_participants_group_fkey
    foreign key (group_id, project_id)
    references public.team_works_groups(id, project_id)
    on delete restrict
);

create table public.team_works_manuals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.team_works_projects(id) on delete restrict,
  -- 共通テンプレ管理テーブルは未実装のためFKなし（将来のテンプレ複製元への参照。R2以降で接続）。
  source_template_manual_id uuid,
  no integer not null check (no >= 1),
  title text not null,
  material_type text not null default 'none' check (material_type in ('none', 'link', 'file')),
  material_url text,
  questions jsonb not null default '[]'::jsonb,
  expressions jsonb not null default '[]'::jsonb,
  cautions text,
  status text not null default 'active' check (status in ('active', 'archived')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, no),
  unique (id, project_id),
  constraint team_works_manuals_material_check check (
    (material_type = 'none' and material_url is null)
    or (material_type in ('link', 'file') and material_url is not null)
  )
);

create table public.team_works_schedule_rules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.team_works_projects(id) on delete restrict,
  partner_member_id uuid,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  duration_min integer not null check (duration_min > 0),
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, project_id),
  constraint team_works_schedule_rules_partner_fkey
    foreign key (project_id, partner_member_id)
    references public.team_works_project_members(project_id, organization_member_id)
    on delete restrict
);

create table public.team_works_op_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.team_works_projects(id) on delete restrict,
  generated_from_rule_id uuid,
  partner_member_id uuid,
  session_date date not null,
  start_time time not null,
  duration_min integer not null check (duration_min > 0),
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, project_id),
  unique (project_id, session_date, start_time, partner_member_id),
  constraint team_works_op_sessions_partner_fkey
    foreign key (project_id, partner_member_id)
    references public.team_works_project_members(project_id, organization_member_id)
    on delete restrict,
  constraint team_works_op_sessions_rule_fkey
    foreign key (generated_from_rule_id, project_id)
    references public.team_works_schedule_rules(id, project_id)
    on delete restrict
);

create table public.team_works_session_roster (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  project_id uuid not null,
  participant_id uuid not null,
  order_index integer not null check (order_index >= 1),
  attendance_status text not null default 'scheduled' check (attendance_status in ('scheduled', 'present', 'absent', 'late', 'excused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, participant_id),
  unique (session_id, order_index),
  constraint team_works_session_roster_session_fkey
    foreign key (session_id, project_id)
    references public.team_works_op_sessions(id, project_id)
    on delete restrict,
  constraint team_works_session_roster_participant_fkey
    foreign key (participant_id, project_id)
    references public.team_works_participants(id, project_id)
    on delete restrict
);

-- holidays carry organization_id directly because project_id is nullable (org-wide holiday).
-- Without it, an org-wide row would have no tenant boundary at all.
create table public.team_works_holidays (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.team_works_organizations(id) on delete restrict,
  project_id uuid,
  source_local_id text,
  holiday_date date not null,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, project_id, holiday_date),
  constraint team_works_holidays_project_org_fkey
    foreign key (project_id, organization_id)
    references public.team_works_projects(id, organization_id)
    on delete restrict
);

create index team_works_groups_project_idx on public.team_works_groups(project_id);
create index team_works_participants_project_idx on public.team_works_participants(project_id, group_id);
create index team_works_manuals_project_idx on public.team_works_manuals(project_id, no);
create index team_works_schedule_rules_project_idx on public.team_works_schedule_rules(project_id, partner_member_id);
create index team_works_op_sessions_project_idx on public.team_works_op_sessions(project_id, session_date);
create index team_works_op_sessions_partner_idx on public.team_works_op_sessions(partner_member_id, session_date);
create index team_works_session_roster_session_idx on public.team_works_session_roster(session_id);
create index team_works_session_roster_participant_idx on public.team_works_session_roster(participant_id);
create index team_works_holidays_org_idx on public.team_works_holidays(organization_id, holiday_date);
create index team_works_holidays_project_idx on public.team_works_holidays(project_id, holiday_date);

-- 呼び出し元の project_role（owner/manager/client/worker）を返す。無所属なら null。
create or replace function private.team_works_project_role(target_project_id uuid)
returns text language sql stable security definer set search_path = ''
as $$
  select pm.project_role
  from public.team_works_project_members pm
  join public.team_works_organization_members m on m.id = pm.organization_member_id
  where pm.project_id = target_project_id
    and m.user_id = (select auth.uid()) and m.status = 'active'
  limit 1;
$$;

-- 呼び出し元がそのプロジェクトで持つ organization_member_id。partner_member_id との比較に使う。
create or replace function private.team_works_current_project_member_id(target_project_id uuid)
returns uuid language sql stable security definer set search_path = ''
as $$
  select pm.organization_member_id
  from public.team_works_project_members pm
  join public.team_works_organization_members m on m.id = pm.organization_member_id
  where pm.project_id = target_project_id
    and m.user_id = (select auth.uid()) and m.status = 'active'
  limit 1;
$$;

-- パートナー(worker)が「担当している」参加者id集合＝自分がpartnerのセッションに名簿登録された参加者のみ。
create or replace function private.team_works_ops_assigned_participant_ids(target_project_id uuid)
returns setof uuid language sql stable security definer set search_path = ''
as $$
  select distinct sr.participant_id
  from public.team_works_session_roster sr
  join public.team_works_op_sessions s on s.id = sr.session_id
  where s.project_id = target_project_id
    and s.partner_member_id = private.team_works_current_project_member_id(target_project_id);
$$;

revoke all on function private.team_works_project_role(uuid) from public, anon;
revoke all on function private.team_works_current_project_member_id(uuid) from public, anon;
revoke all on function private.team_works_ops_assigned_participant_ids(uuid) from public, anon;
grant execute on function private.team_works_project_role(uuid) to authenticated, service_role;
grant execute on function private.team_works_current_project_member_id(uuid) to authenticated, service_role;
grant execute on function private.team_works_ops_assigned_participant_ids(uuid) to authenticated, service_role;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'team_works_groups', 'team_works_participants', 'team_works_manuals',
    'team_works_schedule_rules', 'team_works_op_sessions', 'team_works_session_roster',
    'team_works_holidays'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
    execute format('grant select, insert, update on public.%I to authenticated', table_name);
  end loop;
end $$;

-- groups: 構造ラベルのみ（個人情報なし）。プロジェクトメンバー全員が閲覧可、編集は本部のみ。
create policy team_works_groups_select on public.team_works_groups for select to authenticated
using (private.team_works_is_project_member(project_id) or exists (
  select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id)
));
create policy team_works_groups_insert on public.team_works_groups for insert to authenticated
with check (exists (select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id)));
create policy team_works_groups_update on public.team_works_groups for update to authenticated
using (exists (select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id)))
with check (exists (select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id)));

-- participants: 本部=全件。client=自校の全生徒。worker(partner)=自分が担当したセッションに名簿登録された生徒のみ
-- （本部以外は横も何も見えない＝自分の専門のみ、の原則）。
create policy team_works_participants_select on public.team_works_participants for select to authenticated
using (
  exists (select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id))
  or private.team_works_project_role(project_id) = 'client'
  or (
    private.team_works_project_role(project_id) = 'worker'
    and id in (select private.team_works_ops_assigned_participant_ids(project_id))
  )
);
create policy team_works_participants_insert on public.team_works_participants for insert to authenticated
with check (exists (select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id)));
create policy team_works_participants_update on public.team_works_participants for update to authenticated
using (exists (select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id)))
with check (exists (select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id)));

-- manuals: 運営ノウハウ（教材）。本部＋partner(worker)が閲覧可、client(学校)には出さない。
create policy team_works_manuals_select on public.team_works_manuals for select to authenticated
using (
  exists (select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id))
  or private.team_works_project_role(project_id) = 'worker'
);
create policy team_works_manuals_insert on public.team_works_manuals for insert to authenticated
with check (exists (select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id)));
create policy team_works_manuals_update on public.team_works_manuals for update to authenticated
using (exists (select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id)))
with check (exists (select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id)));

-- schedule_rules / op_sessions: 本部=全件。client=自校の全予定。worker(partner)=自分の担当分のみ。
create policy team_works_schedule_rules_select on public.team_works_schedule_rules for select to authenticated
using (
  exists (select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id))
  or private.team_works_project_role(project_id) = 'client'
  or (private.team_works_project_role(project_id) = 'worker' and partner_member_id = private.team_works_current_project_member_id(project_id))
);
create policy team_works_schedule_rules_insert on public.team_works_schedule_rules for insert to authenticated
with check (exists (select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id)));
create policy team_works_schedule_rules_update on public.team_works_schedule_rules for update to authenticated
using (exists (select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id)))
with check (exists (select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id)));

create policy team_works_op_sessions_select on public.team_works_op_sessions for select to authenticated
using (
  exists (select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id))
  or private.team_works_project_role(project_id) = 'client'
  or (private.team_works_project_role(project_id) = 'worker' and partner_member_id = private.team_works_current_project_member_id(project_id))
);
create policy team_works_op_sessions_insert on public.team_works_op_sessions for insert to authenticated
with check (exists (select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id)));
create policy team_works_op_sessions_update on public.team_works_op_sessions for update to authenticated
using (exists (select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id)))
with check (exists (select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id)));

-- session_roster: 本部=全件。client=自校の全名簿。worker(partner)=自分のセッションの名簿のみ。
create policy team_works_session_roster_select on public.team_works_session_roster for select to authenticated
using (
  exists (select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id))
  or private.team_works_project_role(project_id) = 'client'
  or (
    private.team_works_project_role(project_id) = 'worker'
    and exists (
      select 1 from public.team_works_op_sessions s
      where s.id = session_id and s.partner_member_id = private.team_works_current_project_member_id(project_id)
    )
  )
);
create policy team_works_session_roster_insert on public.team_works_session_roster for insert to authenticated
with check (exists (select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id)));
create policy team_works_session_roster_update on public.team_works_session_roster for update to authenticated
using (exists (select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id)))
with check (exists (select 1 from public.team_works_projects p where p.id = project_id and private.team_works_is_org_staff(p.organization_id)));

-- holidays: project_id null(組織全体)は組織メンバー全員に見せる。project_id ありは、そのプロジェクトのメンバーのみ。
create policy team_works_holidays_select on public.team_works_holidays for select to authenticated
using (
  private.team_works_is_org_staff(organization_id)
  or (project_id is null and private.team_works_current_member_id(organization_id) is not null)
  or (project_id is not null and private.team_works_is_project_member(project_id))
);
create policy team_works_holidays_insert on public.team_works_holidays for insert to authenticated
with check (private.team_works_is_org_staff(organization_id));
create policy team_works_holidays_update on public.team_works_holidays for update to authenticated
using (private.team_works_is_org_staff(organization_id)) with check (private.team_works_is_org_staff(organization_id));

comment on table public.team_works_participants is 'Operations-style project roster (students/trainees). Worker visibility is restricted to participants rostered into their own sessions; client sees their whole project roster; manuals stay staff+worker only.';
comment on table public.team_works_manuals is 'Operations-style per-project curriculum manuals. Not exposed to client_user — treated as internal operating know-how, unlike schedule/roster data.';
comment on table public.team_works_holidays is 'organization_id is required (not just project_id) so an org-wide holiday (project_id null) still carries a tenant boundary.';

notify pgrst, 'reload schema';
