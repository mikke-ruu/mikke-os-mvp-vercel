-- Team Works: 納品型プロジェクトの工程を「バトンの受け渡し」として
-- 表現できるようにする列を追加。既存列(status/due_on/client_visible等)は
-- そのまま。追加のみ・nullable(既存行はNULLのまま)なので安全。

alter table public.team_works_project_tasks
  -- 誰が作業するか(この工程の主担当ロール)
  add column if not exists owner_role text
    check (owner_role in ('admin', 'worker', 'client')),
  -- 何を提出するか
  add column if not exists submission_type text not null default 'none'
    check (submission_type in ('none', 'form', 'file', 'url')),
  -- 確認フロー(本部の内部確認/クライアント確認をこの工程で要するか)
  add column if not exists needs_internal_review boolean not null default false,
  add column if not exists needs_client_review boolean not null default false,
  -- 担当者が提出する期日。既存due_onは「工程が完了する期日」として使う。
  add column if not exists submit_due_on date,
  -- 実メンバー未確定の工程に置く仮の担当名(例:「ネオン」「カメラマン(未定)」)。
  -- assignee_member_idが決まったら空にして良い。
  add column if not exists assignee_label text;

comment on column public.team_works_project_tasks.owner_role is
  'この工程の主担当ロール。admin=本部, worker=担当メンバー, client=クライアント。';
comment on column public.team_works_project_tasks.submission_type is
  'この工程で提出を要するものの種類。none=提出物なし。';
comment on column public.team_works_project_tasks.submit_due_on is
  '担当者が提出する期日。due_on(工程の完了期日)とは別に持つ。';
comment on column public.team_works_project_tasks.assignee_label is
  '名簿登録・ポータルログインがまだの仮担当者名。実メンバーが決まればassignee_member_idを設定し、この列は使わなくてよい。';
