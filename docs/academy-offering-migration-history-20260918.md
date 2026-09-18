# 募集リニューアルのmigration履歴

2026-09-18に本番適用を担当した統制担当から、Supabaseに記録されたversionの共有を受けた。CLIで生成した検証用versionから、実際のremote historyへファイル名とテスト参照を合わせている。SQLの処理内容は変更していない。

| CLI生成・事前検証version | 適用済みremote version | 内容 |
| --- | --- | --- |
| 20260918043218 | 20260918050803 | academy_offerings_and_manual_entitlements |
| 20260918044306 | 20260918050806 | academy_instructor_offering_pages |
| 20260918044449 | 20260918050808 | academy_offering_staged_purchases |

事前検証では上記3本を順番にBEGIN内で実行し、隔離したテスト用Authユーザー・本部・講座だけを作成した。申込・入金確認・段階支払・修了後の期限付き教材権限・RLSを検証してROLLBACKし、新tableとfixtureの残留がないことを確認した。既存顧客行は変更していない。

ローカル回帰テストは `scripts/academy-offering-db-check.mjs` と `scripts/academy-instructor-offering-db-check.mjs`。本番schema検証SQL `scripts/academy-offering-remote-rollback.sql` は単体実行せず、必ず全体をBEGIN/ROLLBACKで囲む。適用済み環境ではmigration DDLを再実行しない。
