-- Team Works: 納品型プロジェクトの新ジェネレーター用。
-- ①タスクの並び順(position)を追加(due_onが無い段階でも順序を保持するため)。
-- ②組織ごとの編集可能な「仕事テンプレート」を保存するテーブルを新設。

alter table public.team_works_project_tasks
  add column if not exists position integer;

comment on column public.team_works_project_tasks.position is
  '作業の並び順。期日が未設定の段階でも表示順を保持するために使用。';

create table if not exists public.team_works_project_step_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.team_works_organizations(id) on delete restrict,
  source_local_id text,
  name text not null,
  description text,
  -- 例: [{"title": "ヒアリング・講座整理", "defaultRole": "manager"}, ...]
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, source_local_id)
);

alter table public.team_works_project_step_templates enable row level security;

create policy team_works_step_templates_select on public.team_works_project_step_templates for select to authenticated
using (private.team_works_is_org_staff(organization_id));
create policy team_works_step_templates_insert on public.team_works_project_step_templates for insert to authenticated
with check (private.team_works_is_org_staff(organization_id));
create policy team_works_step_templates_update on public.team_works_project_step_templates for update to authenticated
using (private.team_works_is_org_staff(organization_id)) with check (private.team_works_is_org_staff(organization_id));
