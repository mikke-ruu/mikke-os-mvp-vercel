-- Team Works: 納品型プロジェクトの工程に「作業指示」を持たせる。
-- 工程名だけでは担当者が何をどう作ればよいか分からないため、
-- 「何を・目的・どれで・作業順・提出物・完成物」を工程に直接持たせる。
--
-- 既存列はそのまま・追加のみ。テキスト列はnullable、配列列は空配列デフォルト
-- なので既存行はそのまま有効。
-- team_works_project_tasks のINSERT/UPDATEは本部staffのみ(P8-a)なので、
-- RLSポリシーの変更は不要。

alter table public.team_works_project_tasks
  -- 何を作るか(成果物の概要)
  add column if not exists description text,
  -- なぜやるか
  add column if not exists purpose text,
  -- どれで(使うツール・方法)
  add column if not exists method text,
  -- 提出物の具体的な形(例:「スライドファイルまたはCanva共有URL」)。
  -- submission_type(none/form/file/url)が「種別」、こちらは「中身の説明」。
  add column if not exists deliverable_note text,
  -- 作業順。文字列の配列。例: ["時間配分を決める", "スライド構成を作る", ...]
  add column if not exists checklist jsonb not null default '[]'::jsonb
    check (jsonb_typeof(checklist) = 'array'),
  -- 完成物に含まれるもの。文字列の配列。
  add column if not exists outputs jsonb not null default '[]'::jsonb
    check (jsonb_typeof(outputs) = 'array');

comment on column public.team_works_project_tasks.description is
  'この工程で何を作るか(成果物の概要)。';
comment on column public.team_works_project_tasks.purpose is
  'この工程をなぜやるか(目的)。';
comment on column public.team_works_project_tasks.method is
  '使うツール・方法(例:Canva、スライド制作ツール)。';
comment on column public.team_works_project_tasks.deliverable_note is
  '提出物の具体的な形。submission_typeが種別、この列がその中身の説明。';
comment on column public.team_works_project_tasks.checklist is
  '作業順(文字列の配列)。担当者が上から順に進める手順。';
comment on column public.team_works_project_tasks.outputs is
  '完成物に含まれるもの(文字列の配列)。';

notify pgrst, 'reload schema';
