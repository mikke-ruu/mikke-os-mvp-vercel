# mikkeOS Phase 4 Supabase Readonly / Payload Check

作成日: 2026-07-05

このメモは、Supabase本保存へ切り替える前の読み取り専用確認とpayload比較です。
この作業では、Supabase本番DB、RLS、既存MarketNote保存処理には変更を加えていません。

## 1. 実Supabase `activity_logs` 定義確認

実DBの定義確認は、以下の2経路で読み取り専用確認を試しました。

| 確認方法 | 結果 | メモ |
| --- | --- | --- |
| Supabase MCP `_list_tables` | 未確認 | `You do not have permission to perform this action` |
| Supabase MCP `_execute_sql` | 未確認 | `information_schema.columns` / `pg_constraint` / `pg_policies` いずれも権限なし |
| REST OpenAPI `/rest/v1/` | 未確認 | `401 Invalid API key` |
| REST `activity_logs?select=*&limit=0` | 未確認 | `401 Invalid API key` |

結論:

- 現在の接続情報では、実Supabaseの `activity_logs` 定義は確認できていません。
- このメモのDB項目・制約は、現時点ではリポジトリ内の `types/database.ts` と `G:/Musubiプロジェクト/Mikke OS/Mikke_OS_Core_MVP_supabase.sql` を根拠にした「期待定義」です。
- 本保存ONの前に、MCP権限または有効なSupabase接続情報で実DB定義を再確認する必要があります。

## 2. 期待される `activity_logs` 定義

ローカルSQLと型定義上の主な項目です。

| 項目 | 期待型 | 必須 | 既定値 / 注意 |
| --- | --- | --- | --- |
| `id` | uuid | DB自動 | `gen_random_uuid()` |
| `user_id` | uuid | 必須 | `auth.users(id)` |
| `profile_id` | uuid | 必須 | `profiles(id)` |
| `activity_type` | text | 必須 | Activity種別 |
| `category` | text | 必須 | 既定値 `other`、許容値あり |
| `source_service` | text | 必須 | 既定値 `manual` |
| `source_record_id` | text | 任意 | 重複防止キーに含まれる |
| `occurred_at` | timestamptz | 必須 | 既定値 `now()` |
| `title` | text | 必須 | 表示タイトル |
| `description` | text | 任意 | 補足 |
| `visibility` | text | 必須 | `public` / `private` / `limited` |
| `status` | text | 必須 | `draft` / `confirmed` / `completed` / `cancelled` |
| `display_on_story` | boolean | 必須 | Story表示 |
| `display_in_timeline` | boolean | 必須 | タイムライン表示 |
| `display_as_achievement` | boolean | 必須 | 実績扱い |
| `counts_toward_summary` | boolean | 必須 | 集計対象 |
| `has_financial_value` | boolean | 必須 | 金額ログか |
| `amount` | numeric | 条件付き | 金額ログなら必須、非金額なら `null` |
| `transaction_type` | text | 必須 | `revenue` / `expense` / `none` |
| `payment_status` | text | 必須 | `unpaid` / `paid` / `not_required` |
| `created_at` | timestamptz | DB自動 | `now()` |
| `updated_at` | timestamptz | DB自動 | trigger更新 |

期待される重複防止:

```text
unique(profile_id, source_service, source_record_id)
```

## 3. 同じサンプルでのpayload比較

比較サンプル:

```text
MarketNoteで「ガラスアクセサリー販売」の売上 12,800円を記録
```

### 既存 `createActivityLog()` 入力

| 入力 | 値 |
| --- | --- |
| `userId` | `user-sample` |
| `profileId` | `profile-sample` |
| `activityType` | `market_sales_recorded` |
| `sourceRecordId` | `market-finance-sample` |
| `title` | `出店売上を記録しました` |
| `description` | `ガラスアクセサリー販売` |
| `occurredAt` | `2026-07-05T00:00:00.000Z` |
| `visibility` | `private` |
| `hasFinancialValue` | `true` |
| `amount` | `12800` |
| `transactionType` | `revenue` |
| `paymentStatus` | `paid` |

既存payload:

| activity_logs | 値 |
| --- | --- |
| `user_id` | `user-sample` |
| `profile_id` | `profile-sample` |
| `activity_type` | `market_sales_recorded` |
| `category` | `event` |
| `source_service` | `marketnote` |
| `source_record_id` | `market-finance-sample` |
| `occurred_at` | `2026-07-05T00:00:00.000Z` |
| `title` | `出店売上を記録しました` |
| `description` | `ガラスアクセサリー販売` |
| `visibility` | `private` |
| `status` | `completed` |
| `display_on_story` | `false` |
| `display_in_timeline` | `false` |
| `display_as_achievement` | `false` |
| `counts_toward_summary` | `false` |
| `has_financial_value` | `true` |
| `amount` | `12800` |
| `transaction_type` | `revenue` |
| `payment_status` | `paid` |

### `toSupabaseActivityLogInsert()` 入力

| UnifiedActivityLog | 値 |
| --- | --- |
| `profileId` | `profile-sample` |
| `appKey` | `market_note` |
| `eventType` | `market_sales_recorded` |
| `title` | `出店売上を記録しました` |
| `description` | `ガラスアクセサリー販売` |
| `occurredAt` | `2026-07-05T00:00:00.000Z` |
| `amount` | `12800` |
| `amountType` | `income` |
| `sourceId` | `market-finance-sample` |
| `visibility` | `private` |
| `storyEnabled` | `false` |
| `deskEnabled` | `true` |
| `metadata.paymentStatus` | `paid` |
| `metadata.category` | `event` |

adapter payload:

| activity_logs | 値 |
| --- | --- |
| `user_id` | `user-sample` |
| `profile_id` | `profile-sample` |
| `activity_type` | `market_sales_recorded` |
| `category` | `event` |
| `source_service` | `marketnote` |
| `source_record_id` | `market-finance-sample` |
| `occurred_at` | `2026-07-05T00:00:00.000Z` |
| `title` | `出店売上を記録しました` |
| `description` | `ガラスアクセサリー販売` |
| `visibility` | `private` |
| `status` | `completed` |
| `display_on_story` | `false` |
| `display_in_timeline` | `false` |
| `display_as_achievement` | `false` |
| `counts_toward_summary` | `false` |
| `has_financial_value` | `true` |
| `amount` | `12800` |
| `transaction_type` | `revenue` |
| `payment_status` | `paid` |

## 4. 比較結果

| 項目 | 既存payload | adapter payload | 判定 |
| --- | --- | --- | --- |
| `activity_type` | `market_sales_recorded` | `market_sales_recorded` | 一致 |
| `category` | `event` | `event` | 一致 |
| `source_service` | `marketnote` | `marketnote` | 一致 |
| `source_record_id` | `market-finance-sample` | `market-finance-sample` | 一致 |
| `amountType` / `transaction_type` | `revenue` | `income` から `revenue` | OK |
| `storyEnabled` / `display_on_story` | `false` | `false` | 一致 |
| `deskEnabled` / `has_financial_value` | `true` | `true` | OK |
| `amount` | `12800` | `12800` | 一致 |
| `payment_status` | `paid` | `paid` | 一致 |
| `counts_toward_summary` | `false` | `false` | 初期ルールで一致 |

要注意点:

- `market_note` と `marketnote` の差分はadapter側で吸収済み。
- `income` と `revenue` の差分もadapter側で吸収済み。
- `counts_toward_summary` は一律trueにせず、活動実績として数えるものだけtrueにする。
- DESK集計の現在の中心は `has_financial_value` / `transaction_type` / `amount` だが、将来OS Homeの活動数やサマリーで `counts_toward_summary` を使うなら影響が出る。

## 5. 制約違反リスク一覧

| リスク | 起きる条件 | 対応 |
| --- | --- | --- |
| `category` 制約違反 | `metadata.category` に日本語や未許可値を入れる | `toSupabaseActivityCategory()` で許可値へ寄せる |
| `transaction_type` 制約違反 | `income` をそのままDBへ入れる | `income` は `revenue` へ変換 |
| 金額制約違反 | `has_financial_value = true` で `amount = null` | `deskEnabled && amountType !== none && amountあり` の時だけ金額ログにする |
| 非金額制約違反 | `has_financial_value = false` で `transaction_type != none` | 非金額は `amount: null` / `transaction_type: none` |
| 重複保存 | `market_note` と `marketnote` が混在 | MarketNoteは `source_service: marketnote` 固定 |
| upsert更新失敗 | `source_record_id` が空または変わる | 各アプリで安定した `sourceId` を必ず持つ |
| RLS拒否 | `user_id` がAuthユーザーと違う | `supabase.auth.getUser()` の `user.id` を使う |
| RLS拒否 | `profile_id` が本人の `profiles.id` ではない | `profiles.user_id = user.id` で取得したprofileだけ使う |

## 6. RLS確認メモ

Supabase公式ドキュメント上の確認ポイント:

- public schemaのテーブルはRLSを有効にする。
- `auth.uid()` は未ログイン時に `null` になるため、本人行だけに限定するpolicyが必要。
- insertは `WITH CHECK`、updateは `USING` と `WITH CHECK` の両方が重要。
- 認可判断にユーザーが編集できる `user_metadata` を使わない。

mikkeOSで必要な取得経路:

| 必要情報 | 取得元 | 用途 |
| --- | --- | --- |
| `user_id` | `supabase.auth.getUser()` の `user.id` | `activity_logs.user_id` |
| `profile_id` | `profiles` を `user_id` で検索 | `activity_logs.profile_id` |
| `profile.user_id` | `profiles` | RLS上の所有確認 |

本保存時の安全な前提:

```text
activity_logs.user_id = auth.uid()
profiles.id = activity_logs.profile_id
profiles.user_id = auth.uid()
```

## 7. 本保存切り替え前チェックリスト

- [ ] MCPまたは有効なSupabase接続情報で、実DBの `activity_logs` 定義を再確認する。
- [ ] `activity_logs` の `category` 許容値を実DBで確認する。
- [ ] `activity_logs` の金額制約を実DBで確認する。
- [ ] `activity_logs` のunique制約が `profile_id, source_service, source_record_id` であることを実DBで確認する。
- [ ] 実DBのRLS policyに `user_id` と `profile_id` 所有確認が入っているか確認する。
- [ ] `counts_toward_summary` の初期ルールが `eventType` / `appKey` ごとに妥当か確認する。
- [ ] adapter payloadと既存payloadをテストで比較する。
- [ ] まずMarketNoteの1操作だけで二重保存が起きないことを確認する。
- [ ] localStorage fallbackを残したまま、Supabase読み取りを試す。
- [ ] 本保存ON/OFFを切り替えられる状態にしてからUI接続する。

## 8. まだ触らないもの

- `app/marketnote/**`
- `lib/marketnote.ts`
- `lib/activity-log.ts`
- `types/database.ts`
- Supabase本番DB
- RLS / policy / constraint

## 9. 次に実装する場合の最小安全手順

1. 有効なSupabase読み取り権限を用意し、実DB定義を再確認する。
2. `counts_toward_summary` の初期ルールを実データで確認する。
3. `toSupabaseActivityLogInsert()` の比較テストを追加する。
4. MarketNote用の `UnifiedActivityLog` 変換関数を別ファイルに作る。
5. 既存保存処理は残したまま、1操作だけpayload比較ログを確認する。
6. 保存先切り替えフラグを追加する。
7. 1操作だけSupabase adapter保存へ切り替える。
8. `/log` / `/story` / `/desk` / `/os` の表示が保存前後で一致するか確認する。
