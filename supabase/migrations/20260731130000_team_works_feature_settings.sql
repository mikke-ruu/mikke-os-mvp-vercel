-- Team Works: プロジェクト単位の「機能ON/OFF」設定(Phase L)。
-- 運営型はアリサの日本語レッスン業態に強く寄っており、名簿・出席・シフト・レッスン画面など
-- 使わない業態も多い。プロジェクトごとに機能をON/OFFできるようにする
-- (docs/MIKKEOS_TEAM_WORKS_GENERALIZE_PLAN_2026-07-30.md §4)。
--
-- nullable・DEFAULTなし。既存行(アリサ含む)は全てnullのままとなり、アプリ側は
-- nullを「全機能ON=現行の挙動」として扱うため、既存プロジェクトの表示・動作は
-- 一切変わらない。運営型・納品型でキーが異なるが、列は共用する
-- (lib/team-works-feature-settings.tsのTeamWorksOperationsFeatureSettings /
-- TeamWorksDeliveryFeatureSettingsを参照)。
--
-- RLSは変更しない。これは表示の設定であって権限の設定ではない、という原則を守る
-- (認可は既存のRLSが引き続き独立して適用される)。
alter table public.team_works_projects
  add column if not exists feature_settings jsonb;

comment on column public.team_works_projects.feature_settings is
  '機能ON/OFF設定。null=全機能ON(現行仕様)。運営型/納品型でキーが異なる。lib/team-works-feature-settings.tsを参照。RLSとは独立(表示設定のみ)。';
