-- Team Works: 納品型(delivery)プロジェクトのタスクに期日を追加。
-- 既存のtasksテーブルへの列追加のみ(nullable)。納品型は本番でまだ
-- 使用されていない(projects.style='delivery'の行が存在しない)ため無害。
alter table public.team_works_project_tasks
  add column if not exists due_on date;

comment on column public.team_works_project_tasks.due_on is
  'このタスクの期日。ワーカーの成果物提出・クライアントの提出物・Zoom会議日などをカレンダー表示するために使用。';
