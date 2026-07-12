# Mikke OS Team Works Integration Plan

作成日: 2026-07-07

Team WorksはMikke OSに追加予定の新アプリです。初期テンプレートは「日本語会話トレーニング運営」ですが、内部構造は日本語会話専用に固定せず、小規模チーム運営SaaSとして汎用化します。

## 守る境界

- 既存Mikke OS本体のActivity Log保存先は変更しない
- DESK / STORYの読み取り元は変更しない
- Order / Studioの既存導線や保存先は変更しない
- Team Works単体の画面、型、仮データ、ルート構成から開始する

## 初期ルート

- `/apps/team-works`
- `/apps/team-works/dashboard`
- `/apps/team-works/clients`
- `/apps/team-works/participants`
- `/apps/team-works/sessions`
- `/apps/team-works/workers`
- `/apps/team-works/assignments`
- `/apps/team-works/guides`
- `/apps/team-works/reports`
- `/apps/team-works/payouts`
- `/apps/team-works/invoices`
- `/apps/team-works/portal/client`
- `/apps/team-works/portal/worker`

## 初期表示ラベル

| 内部名 | 日本語会話テンプレート表示 |
| --- | --- |
| clients | 学校 |
| client_users | 学校担当者 |
| participants | 生徒 |
| services | 日本語会話授業 |
| sessions | 授業スケジュール |
| workers | 会話パートナー |
| assignments | シフト割当 |
| attendance_records | 出席簿 |
| reports | 授業報告 |
| guide_templates | 会話マニュアル |
| payouts | パートナー報酬 |
| invoices | 学校請求 |

## 内部構造の前提

- `organization_id`でデータを分離する
- `role`で owner / manager / client_user / worker を分ける
- `template`で業種・業務パターンを切り替える
- `label_settings`で表示名を変更できる
- `feature_settings`で機能ON/OFFを切り替える
- `source_service`は将来 `team_works` に統一する

## 汎用テーブル候補

- organizations
- organization_members
- roles
- clients
- client_users
- participants
- services
- sessions
- workers
- assignments
- attendance_records
- reports
- guide_templates
- payouts
- invoices
- template_settings
- label_settings
- feature_settings

## 連携方針

Team Worksは将来、Order / Studioから受けた案件や予約をチーム運営へ流す場所になります。DESKへは売上・報酬・利益、STORYへは活動実績、Activity Logへは `team_works` の活動として接続できる構造にします。

ただし初期実装では、既存のActivity Log / DESK / STORY / Order / Studioの保存先や読み取り元は変更せず、Team Works側の仮データと画面だけを作ります。
