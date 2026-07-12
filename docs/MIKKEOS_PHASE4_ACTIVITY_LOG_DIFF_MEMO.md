# mikkeOS Phase 4 Activity Log 差分確認メモ

作成日: 2026-07-05

このメモは、Phase 4でSupabase本保存へ切り替える前の確認資料です。
現時点では、各ミニ画面、OS Home、Log、Story、DESKはlocalStorageベースのままにします。

## 1. 既存保存処理の確認

既存のActivity Log保存は `lib/activity-log.ts` の `createActivityLog()` が担当しています。

現在送っている項目:

| 入力または固定値 | activity_logs |
| --- | --- |
| `input.userId` | `user_id` |
| `input.profileId` | `profile_id` |
| `input.activityType` | `activity_type` |
| 固定値 `event` | `category` |
| 固定値 `marketnote` | `source_service` |
| `input.sourceRecordId` | `source_record_id` |
| `input.occurredAt ?? now` | `occurred_at` |
| `input.title` | `title` |
| `input.description ?? null` | `description` |
| `input.visibility ?? private` | `visibility` |
| 固定値 `completed` | `status` |
| `input.displayOnStory ?? false` | `display_on_story` |
| `input.displayInTimeline ?? false` | `display_in_timeline` |
| `input.displayAsAchievement ?? false` | `display_as_achievement` |
| `input.countsTowardSummary ?? false` | `counts_toward_summary` |
| `input.hasFinancialValue ?? false` | `has_financial_value` |
| 金額ありなら `input.amount ?? 0`、なしなら `null` | `amount` |
| 金額ありなら `input.transactionType ?? revenue`、なしなら `none` | `transaction_type` |
| 金額ありなら `input.paymentStatus ?? paid`、なしなら `not_required` | `payment_status` |

保存は `activity_logs.upsert()` で、衝突キーは `profile_id,source_service,source_record_id` です。

## 2. 既存DB項目

`types/database.ts` と `Mikke_OS_Core_MVP_supabase.sql` 上の `activity_logs` は以下の構成です。

必須扱い:

| 項目 | 内容 |
| --- | --- |
| `user_id` | Supabase Authのユーザー |
| `profile_id` | Mikke IDとしてのプロフィール |
| `activity_type` | 活動種別 |
| `category` | `consultation` / `production` / `product` / `event` / `workshop` / `review` / `profile` / `other` |
| `source_service` | 発生元アプリ |
| `occurred_at` | 活動日時 |
| `title` | 表示タイトル |
| `visibility` | `public` / `private` / `limited` |
| `status` | `draft` / `confirmed` / `completed` / `cancelled` |
| `display_on_story` | Story表示対象 |
| `display_in_timeline` | タイムライン表示対象 |
| `display_as_achievement` | 実績扱い |
| `counts_toward_summary` | 集計対象 |
| `has_financial_value` | 金額を持つか |
| `transaction_type` | `revenue` / `expense` / `none` |
| `payment_status` | `unpaid` / `paid` / `not_required` |

任意またはnullable:

| 項目 | 内容 |
| --- | --- |
| `id` | DB側で自動採番 |
| `source_record_id` | 発生元レコードID。重複防止に使う |
| `description` | 補足文 |
| `amount` | 金額。金額なしの場合は `null` |
| `created_at` | DB側で自動 |
| `updated_at` | DB側で自動 |

制約上、`has_financial_value = false` の場合は `amount = null` かつ `transaction_type = none` にする必要があります。
`has_financial_value = true` の場合は `amount` が必須で、`transaction_type` は `revenue` または `expense` です。

## 3. UnifiedActivityLogとの差分

| UnifiedActivityLog | DBとの差分 |
| --- | --- |
| `id` | localStorage用ID。Supabase保存ではDBの `id` と混ぜない |
| `profileId` | DBでは `profile_id`。本保存時は実プロフィールIDが必要 |
| `appKey` | DBでは `source_service`。ただしMarketNoteは既存値 `marketnote` を維持する |
| `eventType` | DBでは `activity_type` |
| `amountType` | DBでは `transaction_type`。`income` はDB上の `revenue` に変換する |
| `storyEnabled` | DBでは `display_on_story`、必要に応じて `display_in_timeline` / `display_as_achievement` にも反映 |
| `deskEnabled` | DBでは `has_financial_value` と `transaction_type` / `amount` に反映 |
| `metadata.category` | DBの `category` 制約に合う値だけ採用する |
| `metadata.paymentStatus` | DBでは `payment_status` |
| `createdAt` | Supabase保存では基本的にDBの `created_at` に任せる |

## 4. 変換方針

`lib/mikkeos/activity-adapter.ts` に以下を用意しました。

| 関数 | 役割 |
| --- | --- |
| `toSupabaseActivityLogInsert()` | `UnifiedActivityLog` を `activity_logs` insert/upsert用payloadへ変換 |
| `toSupabaseSourceService()` | `appKey` をDB保存用 `source_service` へ変換 |
| `toSupabaseActivityCategory()` | DB制約に合う `category` へ変換 |

変換ルール:

| UnifiedActivityLog | activity_logs |
| --- | --- |
| `amountType: income` | `transaction_type: revenue` |
| `amountType: expense` | `transaction_type: expense` |
| `amountType: none` | `transaction_type: none` |
| `storyEnabled: true` | `display_on_story: true` |
| `storyEnabled: false` | `display_on_story: false` |
| `deskEnabled && amountType !== none && amountあり` | `has_financial_value: true` |
| それ以外 | `has_financial_value: false` |
| `appKey: market_note` | `source_service: marketnote` |
| その他の `appKey` | 原則そのまま `source_service` |

## 5. 既存MarketNote保存との対応

現在MarketNoteからActivity Logを作る箇所:

| MarketNote操作 | activity_type | Story | DESK |
| --- | --- | --- | --- |
| 出店予定を追加 | `market_event_added` | 表示する | 集計しない |
| チェック項目を更新 | `market_event_prepared` | 表示しない | 集計しない |
| 売上を記録 | `market_sales_recorded` | 表示しない | 売上として集計 |
| 経費を記録 | `market_expense_recorded` | 表示しない | 経費として集計 |
| 振り返りを記録 | `market_reflection_created` | 公開文がある場合のみ表示 | 集計しない |
| 出店完了 | `market_event_completed` | 表示する | 集計しない |

現時点では `lib/activity-log.ts` が `source_service: marketnote` と `category: event` を固定しています。
将来adapterへ寄せる場合も、MarketNoteだけは `source_service: marketnote` を維持します。
ここを `market_note` に変えると、既存行との重複や `onConflict` の不一致が起きる可能性があります。

## 6. RLS / profile_id / user_id

本保存時に必要な前提:

| 項目 | 方針 |
| --- | --- |
| `user_id` | Supabase Authの `auth.uid()` と一致させる |
| `profile_id` | `profiles.id`。かつ `profiles.user_id = auth.uid()` のプロフィールであること |
| insert/update | `user_id` と `profile_id` の所有関係を両方確認する |
| public Story | `visibility = public` かつ `display_on_story = true` のみ外部表示 |
| DESK | 本人のログだけを読む |

RLSでは、単にログイン済みかどうかではなく、`activity_logs.user_id = auth.uid()` と `profiles.user_id = auth.uid()` の両方を守る必要があります。

## 7. Adapter実装上の注意点

- 本保存へ切り替えるまでは、UIの読み書きはlocalStorageのままにする。
- Supabase adapterは最初からUIへ直結せず、読み取り専用またはテスト用関数で確認する。
- `source_service` は重複防止キーに含まれるため、命名変更は慎重に扱う。
- `category` はDB制約があるため、自由入力や日本語カテゴリをそのまま入れない。
- `has_financial_value` と `amount` / `transaction_type` の組み合わせはDB制約に合わせる。
- Story表示とDESK集計は別フラグとして扱う。
- 既存MarketNoteの詳細テーブルはActivity Logへ吸収しない。Activity Logには活動の事実だけを残す。

## 8. 本保存前チェックリスト

- [ ] 実Supabaseの `activity_logs` スキーマがSQLファイルと一致しているか確認する。
- [ ] `activity_logs_source_record_unique` が現在も `profile_id, source_service, source_record_id` か確認する。
- [ ] `category` の許容値が現在も同じか確認する。
- [ ] `transaction_type` が `revenue` / `expense` / `none` のままか確認する。
- [ ] RLSで insert / update / select が本人行に限定されているか確認する。
- [ ] MarketNote既存行の `source_service` が `marketnote` で保存されているか確認する。
- [ ] `market_note` と `marketnote` の二重保存が起きないことをテストする。
- [ ] まず1操作だけadapter経由にして、従来payloadと新payloadを比較する。
- [ ] localStorage版へ戻せるフラグまたは分岐を残す。
- [ ] Story / DESK / Log / OS Homeの件数と金額が保存切り替え前後で一致するか確認する。

## 9. まだ触らない方がよいファイル

本保存へ進む前は、以下を大きく変更しない方が安全です。

- `app/marketnote/**`
- `lib/marketnote.ts`
- `lib/activity-log.ts`
- `types/database.ts`
- `lib/supabase/client.ts`
- `G:/Musubiプロジェクト/Mikke OS/*.sql`
- Supabase本番側のRLS / policy / constraint

## 10. 次に実装する場合の安全な手順

1. Supabase実DBの `activity_logs` 定義を読み取り専用で確認する。
2. `toSupabaseActivityLogInsert()` の出力を、既存 `createActivityLog()` のpayloadと比較するテストを追加する。
3. MarketNote用の `UnifiedActivityLog` 変換関数を作る。
4. まだ保存先は変えず、既存保存payloadと新payloadを並べて確認する。
5. 1つの操作だけadapter経由保存に切り替える。
6. `onConflict` により重複しないことを確認する。
7. `/log` `/story` `/desk` の読み取りをSupabaseへ寄せる前に、localStorage fallbackを残す。
8. 全アプリミニ画面は最後に接続する。

