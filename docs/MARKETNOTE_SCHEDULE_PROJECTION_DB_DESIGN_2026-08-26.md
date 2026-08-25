# MarketNote 予定投影DB/RLS 設計レビュー

日付: 2026-08-26
基準: `origin/master 00b8050e6e03229806159f32683c44f33d7c0e03`

## 今回の範囲

Google Calendarの手動取り込み、および各mikkeOSアプリの予定をMarketNoteへ読み取り表示するための非公開土台だけを作る。

- `market_schedule_source_preferences`: sourceごとの表示ON/OFFと通知ON/OFF
- `market_schedule_projections`: 元アプリを正典とする読み取り専用の予定投影
- MarketNote予定への変換、Activity Log、STORY、共有カレンダー、Google OAuth、課金は対象外

## 本番の読み取り確認

- 対象Supabase project: `mikke-os-dev`（Postgres 17）
- `market_events`: 46件、RLS有効
- `activity_logs`: 199件、RLS有効
- 新しい2テーブルと`set_marketnote_schedule_updated_at()`は本番に存在しない
- `profiles`には`(id, user_id)`複合一意制約がないため、新テーブルは`user_id`を所有正典とし、不要な`profile_id`を持たせない
- `market_events`にはanonのテーブル権限が残る。RLSで現在の行は読めないが、今回のmigrationへ混ぜず別の匿名入口hardening候補とする

## 公開・個人情報境界

- 新テーブルはanonへ権限を与えない
- Supabase匿名ユーザーも`is_anonymous` claimで拒否する
- 本人はsource設定をSELECT/INSERT/UPDATEできる
- 本人は予定投影をSELECTだけでき、INSERT/UPDATE/DELETEはservice roleだけ
- 予定投影にメモ、説明本文、参加者、メール、会議URL、添付、リマインダー、写真、振り返り、収支、支払い、Activity Log、STORY項目を保存しない
- `source_href`は内部相対パスだけ。外部URLやバックスラッシュを拒否する

## 時刻・重複契約

- 時刻予定は`starts_at`/`ends_at`、終日予定は`starts_on`/`ends_on_exclusive`を使い、混在をDB CHECKで拒否
- 終日の終了日はiCalendarのDTENDと同じ排他的日付
- `(user_id, source_service, source_calendar_key, source_record_id, occurrence_key)`で1 occurrence 1行
- series IDだけで繰り返し予定を保存しない
- 取消・取下げは物理削除せずstatusへ保持する
- source表示OFFは投影削除や同期停止を意味しない。通知ON/OFFも別列

## 適用前ゲート

1. 統制レビュー
2. 本番で同名table/functionが存在しないことを再確認
3. `BEGIN` → migration → owner/other/anon/anonymous-user負テスト → `ROLLBACK`
4. Security/Performance Advisor確認
5. 承認された1ファイルだけ本適用（`supabase db push`禁止）
6. `supabase_migrations.schema_migrations`へversion記録

現時点ではmigrationファイル作成のみ。本番・開発DBとも未適用。
