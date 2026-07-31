-- Team Works Phase N-4: コマ・週次パターンに「作業内容」欄を追加。
-- 運営型はレッスン前提の作りだったが、業種によっては「何の作業をするか」を
-- 明記したい(あゆみ実機フィードバック 2026-07-31。
-- docs/MIKKEOS_TEAM_WORKS_WORK_WINDOW_PLAN_2026-07-31.md §3 N-4)。
--
-- nullable・DEFAULTなし。既存行(アリサ含む)は全てnullのままとなり、値が無ければ
-- 本部・スタッフ・クライアントのどの画面にも何も表示されないため、既存プロジェクトの
-- 表示・動作は一切変わらない。週次パターン(team_works_schedule_rules)の値は
-- コマ自動生成時にコマ(team_works_op_sessions)側へコピーする。
alter table public.team_works_op_sessions
  add column if not exists work_description text;

alter table public.team_works_schedule_rules
  add column if not exists work_description text;

comment on column public.team_works_op_sessions.work_description is
  'このコマで行う作業内容(任意)。null=未設定=表示なし。';

comment on column public.team_works_schedule_rules.work_description is
  '週次パターンの作業内容(任意)。コマ自動生成時にteam_works_op_sessions.work_descriptionへコピーされる。';
