-- Team Works: 組織ごとの表示ラベル設定。
-- nullable・DEFAULTなし。既存行(アリサ含む)は全てnullのままとなり、
-- アプリ側はnullを「現行のアリサ配色の文言」として扱うため、
-- 既存組織の表示は一切変わらない。新規組織のみ、作成経路のアプリコードが
-- 明示的に一般用デフォルト値を書き込む(このmigrationはカラム追加のみ)。
alter table public.team_works_organizations
  add column if not exists label_settings jsonb;

comment on column public.team_works_organizations.label_settings is
  'ワーカー/クライアント等の表示名オーバーライド。nullは「デフォルト(既存組織の現行文言)を使う」の意味。キーはlib/team-works-labels.tsのTeamWorksLabelsを参照。';
