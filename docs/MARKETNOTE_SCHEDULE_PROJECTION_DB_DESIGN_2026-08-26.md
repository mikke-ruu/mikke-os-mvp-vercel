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
- `display_color`はMarketNote/Manager内だけの表示色とし、Googleへ書き戻さない

## 適用前ゲート

1. 統制レビュー
2. 本番で同名table/functionが存在しないことを再確認
3. `BEGIN` → migration → owner/other/anon/anonymous-user負テスト → `ROLLBACK`
4. Security/Performance Advisor確認
5. 承認された1ファイルだけ本適用（`supabase db push`禁止）
6. `supabase_migrations.schema_migrations`へversion記録

現時点ではmigrationファイル作成のみ。本番・開発DBとも未適用。

## Google手動取り込みRPC（ローカル追加設計）

- ブラウザで解析したうち、本人が選択した予定だけを`marketnote_import_google_calendar_manual`へ渡す
- RPCはログイン済み本人のみ。Supabase匿名ユーザーと`anon`は拒否する
- 生ICS、ファイル名、説明、参加者、メール、会議URL、添付、リマインダーをDBへ送らない
- 受け付けるJSONキーを固定し、未知のキーが1つでもあれば全体を拒否する
- 1回1〜2000件。UID＋RECURRENCE-ID相当の組み合わせをrequest内とDB一意制約の両方で重複防止する
- 再取り込みは同じ予定投影を更新し、MarketNote予定・Activity Log・STORYへは変換しない
- 単発取消と特定できるoccurrenceは`cancelled`として保持する。取消シリーズ全体を安全に特定できない場合は警告して除外する
- batch単位の「元に戻す」は、既存投影を更新した場合の復元履歴が必要なため今回入れない。履歴契約を決めてから別migrationとする

本番トランザクション検証では新規2件→同じ2件の更新、未知キー拒否、Supabase匿名ユーザー拒否、Activity Log件数不変、`anon`実行権限なしを確認し、ROLLBACK後にtable/functionが存在しないことを再確認した。

## 2026-08-26 本適用後の画面接続

- foundationと手動取り込みRPCは本番適用・migration-only PR #70 merge済み。
- 表示ON/OFFと通知ON/OFFに加え、PC/スマホで同じ色を使うため`display_color`追加migrationを別ゲートにする。
- Google由来予定はMarketNoteカレンダーへ読み取り専用カードとして表示し、タイトル・日時・場所をGoogleへ書き戻さない。
- 通知ON/OFFは設定保存だけ先行し、スマホ通知・メール配信が未稼働であることをUIに明記する。
