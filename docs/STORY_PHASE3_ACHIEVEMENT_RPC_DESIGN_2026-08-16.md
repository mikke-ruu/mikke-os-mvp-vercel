# STORY Phase 3 実績スナップショット／RPC設計案

作成: STORY室 / 2026-08-16
状態: **migration/RPCは本番適用・履歴記録・権限確認済み。本人用UIを実装し、Draft PR準備中**

## 基準

- Draft PR作成前の正典master: `8a7d3cc5d70eb9f8da00b26c15056d37d0aae49b`
- STORY専用worktreeを上記 `origin/master` へrebaseし、対象6ファイルとの衝突がないことを確認した。
- `origin/master:docs/共通ルール.md` は未収録のため、共有checkoutの2026-08-14版を暫定参照した。正典配置の修正は統制室の残件。

## 今回作ったもの

- migration設計: `20260816073406_story_achievement_rpc_design.sql`
- STORY所有の公開用スナップショット `story_achievements`
- 公開する集計数字を最大3つ選ぶ `story_achievement_metric_settings`
- MarketNoteから私有draftを作る認証RPC
- STORY側で編集・公開・掲載解除する認証RPC
- 公開カードRPCと、個別行を返さない公開集計RPC

今回、SupabaseへSQLは一度も実行していない。Storage bucket、MarketNote参照ライブラリ、両UIも未実装。

## display_mode の意味

| 値 | 数字 | カード | 保存する個別公開情報 |
|---|---:|---:|---|
| `count_only` | 対象 | なし | なし。予定名・日付・場所・メモ・写真はNULL |
| `card_only` | 対象外 | 対象 | 本人確認済みの実績名・種類名・日付・任意の場所、STORYで入れたメモ・写真 |
| `card_and_count` | 対象 | 対象 | `card_only`と同じ |

旧案の `count_and_card` は使わず、統制室指定の `card_and_count` に統一する。

## metric_key と本人確認

クライアントから `metric_key`、`user_id`、`profile_id`、StoryプロフィールIDを受け取らない。

`story_achievement_stage_from_marketnote` は認証利用者から予定IDだけを受け、DB内で次を確認する。

1. `auth.uid()` のSTORYプロフィールが存在する
2. 予定の `user_id` と `profile_id` が同じ本人である
3. `market_event_types` が予定と同じ本人・プロフィールに属する
4. 同じ `source_record_id` の非公開Activity Logが `source_service = 'marketnote'` かつ `status = 'confirmed'` である
5. Activity Logの `ended_at < (now() at time zone 'Asia/Tokyo')::date` である。当日はまだ候補にしない

確認後、`market_events.event_type_id` を `metric_key` としてDB側で導出する。場所はDBから自動転記せず、本人が掲載を選んで渡した文字列だけをdraftへ入れる。

## draft・公開・掲載解除

- MarketNoteの `+STORY` は必ず `draft` を作る。公開はしない。
- STORY側の公開操作だけが `published` にする。
- MarketNote予定の後編集ではスナップショットを更新しない。
- 掲載解除はDELETEせず `withdrawn` にする。
- 再掲載は同じ `story_profile_id + source_service + source_record_id` の行を再利用する。
- 公開済み内容を再編集するときは一度draftへ戻すため、再確認が終わるまで公開から外れる。公開中の旧版を維持するrevision方式が必要なら、統制レビューで別テーブル方式へ変更する。

## 集計の重複防止

Activity Log集計値と手動+STORY集計値は単純加算しない。

1. 公開中の手動+STORY行がある予定を、Activity Log側の自動候補から除外する
2. `card_only` は手動側にも追加しないため、その予定は数字に入らない
3. `count_only` / `card_and_count` だけを手動側へ加える
4. 最後に `story_profile_id + source_service + source_record_id + metric_key` を一度DISTINCTする
5. DISTINCT後に `metric_key` ごとにCOUNTする

これにより、同じ予定が自動集計と手動+STORYの両方に存在しても1件にしかならない。一度も公開していない `draft` は自動集計候補を妨げない。一度公開した行は `withdrawn` や再編集中になっても、自動集計へ勝手に戻さない。

一度でも本人が公開した行は `published_at is not null` を明示overrideの記録として保持する。取り下げ中や再編集中もActivity Log側の自動集計へ戻さず、本人の公開判断を上書きしない。

## 公開境界

- `story_achievements` と設定テーブルにはanon/authenticatedの直接テーブル権限を与えない。
- 所有者RPCは `auth.uid()` を毎回確認し、関数ごとにPUBLIC実行権限を剥がしてauthenticatedだけへ許可する。
- 公開カードRPCは公開中のカード列だけを返し、連携元予定IDや `metric_key` を返さない。
- 公開集計RPCは最大3つのラベルと件数だけを返し、Activity Log生行を返さない。
- `count_only` の行はDB制約でも個別公開項目をすべてNULLに固定する。
- 写真pathを保存するSTORY編集RPCは、先頭ディレクトリが `auth.uid()` と一致するものだけを受ける。Storage bucket/RLSは別レビュー対象。

## RPC一覧

| RPC | 呼出元 | 用途 |
|---|---|---|
| `story_achievement_stage_from_marketnote` | MarketNote | 本人予定をDB検証し、私有draftを作成・更新 |
| `story_achievement_get_mine_from_marketnote` | MarketNote | 同じ予定の連携状態確認 |
| `story_achievement_list_mine` | STORY | 本人の連携実績を狭い公開用列だけで一覧取得 |
| `story_achievement_update_draft_mine` | STORY | 公開用カード・メモ・写真・並び順を編集 |
| `story_achievement_publish_mine` | STORY | 本人操作で公開 |
| `story_achievement_withdraw_mine` | STORY | 実績IDだけで本人の掲載を取り下げ |
| `story_achievement_withdraw_from_marketnote` | MarketNote | 削除せず掲載解除 |
| `story_achievement_metric_options_mine` | STORY | 重複排除済みの本人向け種類別件数候補 |
| `story_achievement_metric_settings_save_mine` | STORY | 公開数字を最大3つ保存 |
| `story_public_achievement_cards` | 公開STORY | 公開カードの明示列だけ取得 |
| `story_public_achievement_metrics` | 公開STORY | 最大3つの集計結果だけ取得 |

### MarketNoteが呼ぶ最小契約

MarketNoteが呼ぶのは次の3本だけに限定する。

1. `story_achievement_get_mine_from_marketnote(source_record_id)`
2. `story_achievement_stage_from_marketnote(source_record_id, display_mode, public_title?, public_type_label?, occurred_on?, public_location?)`
3. `story_achievement_withdraw_from_marketnote(source_record_id)`

戻り値も、連携状態とMarketNoteで本人が確認したカード項目だけに限定する。STORYで入力した `public_note`、`public_photo_storage_path`、非公開の `metric_key` はMarketNoteへ返さない。公開操作はSTORY側の `story_achievement_publish_mine` だけが行い、MarketNoteからは呼ばない。

### STORY本人画面の最小契約

- routeは `/story/achievements`。既存 `AuthGate` と `StoryAppShell` の内側に置く。
- `story_achievement_list_mine()` が返すのは `achievement_id`、`display_mode`、`publication_status`、公開用タイトル・種類・日付・場所、`published_at`、`updated_at` だけ。
- `story_achievement_publish_mine(achievement_id)` と `story_achievement_withdraw_mine(achievement_id)` も同じ狭い列だけを返す。
- `story_achievement_update_draft_mine` も同じ狭い戻り値にする。STORY本人UIへも `source_record_id` と `metric_key` は返さない。
- 公開時には、本人所有Activity Logが `source_service = 'marketnote' AND status = 'confirmed' AND ended_at < JST今日` をまだ満たすことを再検証する。
- Activity Log生行・件数、MarketNoteメモ・写真・収支・支払い情報は取得も表示もしない。
- STORYプロフィールが未作成または未公開なら、その状態と外部から見えないことを説明する。
- 公開プロフィール内でのカード配置・集計数字の配置・並び替えはこのPhaseでは実装しない。

## 繰り返し予定のoccurrence契約

現行 `market_events` にはシリーズ／繰り返し列がなく、1行が1予定日を表す。したがってPhase 3では次を必須条件にする。

1. 繰り返し予定は、各occurrenceを別の `market_events` 行としてmaterializeする。
2. 各occurrenceは固有で不変のUUIDを持ち、その `market_events.id` を `source_record_id` に使う。
3. シリーズIDや繰り返しルールIDを `source_record_id` に使わない。同じシリーズの全日が1件に潰れるため。
4. Activity LogとSTORY snapshotは、同じoccurrenceに必ず同じ `source_record_id` を使う。
5. 「この回だけ編集」は同じoccurrence UUIDを維持する。日付変更だけで削除・再作成しない。
6. occurrenceを取り消す場合も代替UUIDの取消行を作らない。Activity Log同期後に正典の候補条件を満たさない状態にする。
7. 「この回以降を変更」で将来分を再生成するときも、すでに生成済み・実績化済みのoccurrence UUIDは維持する。
8. 未生成の仮想occurrenceから直接+STORYしない。先に本人所有の実体行を作り、そのUUIDをRPCへ渡す。

DBの一意制約は `story_profile_id + source_service + source_record_id`、Activity Log側は既存の `profile_id + source_service + source_record_id`。これにより同じoccurrenceを何度押してもINSERTではなく同じ行の更新になる。

将来 `recurrence_series_id` を追加しても、これは一覧表示や一括編集用の内部列に限定し、公開RPC・集計キーには含めない。

## ローカル単体テスト境界

- 顧客向けのSTORYルートに固定fixtureやActivity Log件数を表示しない。
- `scripts/story-achievement-contract-test.mjs` の純粋な単体テストだけで、同じoccurrenceがActivity Logと手動+STORYの両方にある例、`card_only`で数字に入れない例、同シリーズの別occurrenceが別件になる例を検証する。
- Manager表示はManager室の所有範囲なので、このbranchでは実装しない。STORY UIや公開RPCへActivity Log生行を出さない。
- 実DB確認が必要な所有権、他人の予定ID、`confirmed`以外、`ended_at`当日・未来日、RLS、匿名実行、Storage pathは単体テストで合格扱いにしない。開発DB負テストで確認する。

## 統制レビューで確認する点

1. 公開中の実績を再編集するとき、再確認まで一時非公開でよいか。旧版公開を維持するならrevision方式へ変える。
2. `withdrawn` 後も一度公開した予定は自動集計へ戻さない契約でよいか。
3. 実績候補の正典条件は `source_service = 'marketnote' AND status = 'confirmed' AND ended_at < (now() at time zone 'Asia/Tokyo')::date`。`occurred_at`やMarketNoteの手動完了状態は使わず、当日はまだ対象にしない。
4. 公開写真用Storage bucket・path規則・削除保持期間。
5. SECURITY DEFINER各関数の署名、EXECUTE権限、search_path、匿名負テスト。
6. 繰り返し予定をMarketNote側で各occurrence行としてmaterializeし、既存occurrence UUIDを一括編集後も維持できるか。

## 統制レビュー反映済み

1. `publish_mine` でも本人所有Activity Logの `confirmed + ended_atがJST今日より前` を再検証する。
2. `explicit_sources` は `published_at is not null` を使い、取り下げ・再編集中に自動集計へ戻さない。
3. 更新はSECURITY DEFINER RPC専用とし、`story_achievements_update_owner` policyを作らない。
4. metric settings保存は対象 `story_profiles` 行を `FOR UPDATE` してからDELETE→INSERTし、同時保存を直列化する。
5. STORY本人UI用RPCは狭い戻り値に統一し、`source_record_id` と `metric_key` を返さない。

## 次の順序

1. STORY migration/RPC設計と本人用UI（完了）
2. 統制室レビューの必須修正反映（完了）
3. 承認されたmigration 1本の本番適用、`schema_migrations`履歴記録、権限確認（完了共有済み）
4. 対象6ファイルだけのDraft PR（現在地）
5. MarketNote室が参照元・呼出引数を最終照合し、`+STORY` UIを接続
6. 未ログイン・他人・当日・未来日・偽ID・重複・掲載解除・同時保存を含むE2E
7. 統制レビュー後にmerge・Vercel公開・認証後画面の実測
