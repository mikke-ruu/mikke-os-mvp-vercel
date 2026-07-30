-- Team Works: 組織・プロジェクトごとの休日設定。
-- 以前は「土日祝はコマ登録不可」が全組織共通のハードコードで、アリサの日本語
-- レッスン業態がそのまま全組織の基準になっていた(lib/team-works-operation-settings.ts参照)。
--
-- nullable・DEFAULTなし。既存行(アリサ含む)は全てnullのままとなり、アプリ側は
-- nullを「現行のルール(土日祝は休み)を使う」の意味として扱うため、既存組織の
-- 挙動・表示は一切変わらない。新規に設定した組織のみ、明示的に値が入る。
--
-- プロジェクト側の列は、校舎・店舗ごとに休みが違う場合の個別上書き用(未設定なら
-- 組織設定に従う)。今回はデータ層のみ用意し、上書きUIは別コミットで足す。
alter table public.team_works_organizations
  add column if not exists operation_settings jsonb;

alter table public.team_works_projects
  add column if not exists operation_settings jsonb;

comment on column public.team_works_organizations.operation_settings is
  '休日設定のデフォルト値。null="土日祝は休み"(現行仕様)。キーはlib/team-works-operation-settings.tsのTeamWorksOperationSettingsを参照。';

comment on column public.team_works_projects.operation_settings is
  'このプロジェクトだけの休日設定の上書き。null=組織設定(operation_settings)に従う。キーは組織側と同じTeamWorksOperationSettings。';
