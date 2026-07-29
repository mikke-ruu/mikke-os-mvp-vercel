-- Team Works: 納品型プロジェクトの「納期」と、工程ごとの「標準日数」を追加。
-- 納期から逆算して各工程のsubmit_due_on/due_onを自動配置できるようにする。
-- 既存列はそのまま・追加のみ・nullable(既存行はNULLのまま)なので安全。

alter table public.team_works_projects
  add column if not exists delivery_due_on date;

comment on column public.team_works_projects.delivery_due_on is
  '納品型(style=''delivery'')プロジェクトの納期。工程の期日を逆算配置する起点として使用。';

alter table public.team_works_project_tasks
  add column if not exists standard_days integer
    check (standard_days is null or standard_days > 0);

comment on column public.team_works_project_tasks.standard_days is
  'この工程に要する標準日数。納期からの逆算配置(自動でsubmit_due_on/due_onを埋める)に使用。';

notify pgrst, 'reload schema';
