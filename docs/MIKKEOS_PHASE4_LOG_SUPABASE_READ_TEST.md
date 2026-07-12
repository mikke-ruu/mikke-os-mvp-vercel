# mikkeOS Phase 4 Log Supabase Read Test

作成日: 2026-07-07

このメモは、`/log` に追加したSupabase読み取りテスト枠の確認結果を記録するものです。

通常の `/log` 表示はまだlocalStorageベースです。今回追加した枠は、ログイン済みユーザーの `activity_logs` をSupabaseから読み取れるか確認するための別枠です。

## 1. 実装範囲

追加:

- `components/mikkeos/SupabaseLogReadTest.tsx`
- `app/log/page.tsx` へのテスト枠差し込み

変更しない:

- `/log` の通常ログ一覧
- localStorage保存/表示導線
- `/os` / `/story` / `/desk` の読み取り元
- 通常保存のSupabase本接続
- 各ミニ画面の一斉Supabase保存
- Order / Team Works / MarketNote本体
- RLS / policy / constraint
- DBマイグレーション

## 2. 読み取り条件

ログイン済みユーザーのSupabase sessionを確認してから、以下を読み取ります。

```text
activity_logs
source_service = item_studio
order by created_at desc
limit 8
```

未ログイン時は `activity_logs` へselectせず、以下を表示します。

```text
Supabase read test needs a logged-in user.
```

## 3. 表示項目

テスト枠では以下を表示します。

- `title`
- `source_service`
- `category`
- `visibility`
- `display_on_story`
- `counts_toward_summary`
- `has_financial_value`
- `amount`
- `transaction_type`
- `payment_status`
- Story対象か
- DESK対象か
- 活動実績対象か
- `occurred_at`
- `created_at`

## 4. 2026-07-07 browser test result

ログイン済みのin-app browserで、`/log` のSupabase読み取りテスト枠を確認しました。

画面上の結果:

| check | result |
| --- | --- |
| `/log` 通常表示 | 維持 |
| `Supabase読み取りテスト` 枠表示 | OK |
| Item Studioログ読み取り | OK |
| 読み取り件数 | 5件 |
| `source_service = item_studio` 表示 | OK |
| `category = product` 表示 | OK |
| `occurred_at` 表示 | OK |
| `created_at` 表示 | OK |

確認できたItem Studioテストログ:

### 作品登録ログ

| field | value |
| --- | --- |
| title | ガラスアクセサリーを商品登録 |
| `source_service` | `item_studio` |
| `category` | `product` |
| `visibility` | `public` |
| `display_on_story` | `true` |
| `counts_toward_summary` | `true` |
| `has_financial_value` | `false` |
| `amount` | `null` |
| `transaction_type` | `none` |
| `payment_status` | `not_required` |
| Story | 対象 |
| DESK | 非対象 |
| 活動実績 | 対象 |

### 販売記録ログ

| field | value |
| --- | --- |
| title | ガラスアクセサリーを販売 |
| `source_service` | `item_studio` |
| `category` | `product` |
| `visibility` | `private` |
| `display_on_story` | `false` |
| `counts_toward_summary` | `false` |
| `has_financial_value` | `true` |
| `amount` | `4800` |
| `transaction_type` | `revenue` |
| `payment_status` | `paid` |
| Story | 非対象 |
| DESK | 対象 |
| 活動実績 | 非対象 |

## 5. 判定

- `/log` からSupabaseの `activity_logs` を読み取れる。
- Item Studioの作品登録ログと販売記録ログを、同じ `source_service = item_studio` の中で出し分けて読める。
- 作品登録ログはStory対象、DESK非対象、活動実績対象として読める。
- 販売記録ログはStory非対象、DESK対象、活動実績非対象として読める。
- 通常の `/log` 表示はlocalStorageのまま維持している。

## 6. 2026-07-07 Story / DESK / 活動実績 抽出条件テスト

`/log` のSupabase読み取りテスト枠に、Story / DESK / 活動実績の抽出結果を確認する別枠を追加しました。

抽出条件:

```text
Story対象:
visibility = public
display_on_story = true

DESK対象:
has_financial_value = true
transaction_type in revenue / expense
amount is not null

活動実績対象:
counts_toward_summary = true
```

ログイン済みのin-app browserで、`source_service = item_studio` の5件を読み取り、以下を確認しました。

| target | count |
| --- | --- |
| Story対象 | 2件 |
| DESK対象 | 3件 |
| 活動実績対象 | 3件 |

Item Studioテストログの判定:

| log | Story | DESK | 活動実績 |
| --- | --- | --- | --- |
| ガラスアクセサリーを商品登録 | 対象 | 非対象 | 対象 |
| ガラスアクセサリーを販売 | 非対象 | 対象 | 非対象 |

確認できたこと:

- `visibility: public` かつ `display_on_story: true` の作品登録ログはStory対象に出る。
- `visibility: private` かつ `display_on_story: false` の販売記録ログはStory対象に出ない。
- `has_financial_value: true`、`amount: 4800`、`transaction_type: revenue` の販売記録ログはDESK対象に出る。
- `has_financial_value: false`、`amount: null`、`transaction_type: none` の作品登録ログはDESK対象に出ない。
- `counts_toward_summary: true` の作品登録ログは活動実績対象に出る。
- `counts_toward_summary: false` の販売記録ログは活動実績対象に出ない。
- 通常の `/log` 表示、`/story`、`/desk`、`/os` の読み取り元は切り替えていない。

## 7. 2026-07-07 抽出条件の共通関数化

Story / DESK / 活動実績の判定条件を、今後 `/story` / `/desk` / `/os` でも使えるように共通関数へ切り出しました。

追加:

- `lib/mikkeos/activity-log-filters.ts`

追加した関数:

- `isStoryVisibleLog(log)`
- `isDeskCountedLog(log)`
- `isSummaryCountedLog(log)`
- `splitActivityLogsByDestination(logs)`

現在の `/log` Supabase読み取りテスト枠は、直接条件を書かずに上記の共通関数を使ってStory / DESK / 活動実績を分類しています。

この変更では、通常の `/log` 表示、`/story`、`/desk`、`/os` の読み取り元はまだ切り替えていません。
