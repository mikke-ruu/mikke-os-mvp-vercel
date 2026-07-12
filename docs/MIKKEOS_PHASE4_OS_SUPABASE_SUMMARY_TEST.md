# mikkeOS Phase 4 OS Supabase Summary Test

作成日: 2026-07-08

このメモは、`/os` に追加したSupabase OSサマリーテスト枠の実装範囲を記録するものです。

通常の `/os` 表示はまだlocalStorage / mockベースです。今回追加した枠は、Supabaseの `activity_logs` からOS Home用のサマリーを作れるか確認するための別枠です。

## 1. 実装範囲

追加:

- `components/mikkeos/SupabaseOsSummaryTest.tsx`
- `app/os/page.tsx` へのテスト枠差し込み

変更しない:

- `/os` の通常表示
- localStorage / mock 表示導線
- `/story` / `/desk` / `/log` の通常表示
- 各ミニ画面の一斉Supabase保存
- Order / Team Works / MarketNote本体
- RLS / policy / constraint
- DBマイグレーション

## 2. 読み取り条件

ログイン済みユーザーのSupabase sessionを確認してから、`activity_logs` を読み取ります。

未ログイン時は `activity_logs` へselectせず、以下を表示します。

```text
Supabase OS summary test needs a logged-in user.
```

## 3. 共通判定

以下の共通関数を使います。

- `isStoryVisibleLog`
- `isDeskCountedLog`
- `isSummaryCountedLog`
- `splitActivityLogsByDestination`

## 4. 表示項目

テスト枠では以下を表示します。

- Supabase総ログ数
- Story対象件数
- DESK対象件数
- 活動実績対象件数
- 売上合計
- 経費合計
- 差引
- 最近のActivity Log 5件

最近のActivity Log 5件では以下を表示します。

- `title`
- `source_service`
- `category`
- `visibility`
- `amount`
- `transaction_type`
- Story対象か
- DESK対象か
- 活動実績対象か
- `occurred_at`
- `created_at`

## 5. 集計ルール

Story対象:

```text
visibility = public
display_on_story = true
```

DESK対象:

```text
has_financial_value = true
amount is not null
transaction_type = revenue or expense
```

活動実績対象:

```text
counts_toward_summary = true
```

金額集計:

```text
transaction_type = revenue -> 売上に加算
transaction_type = expense -> 経費に加算
差引 = 売上合計 - 経費合計
```

## 6. 確認したい判定

Item Studioの作品登録ログ:

```text
Story対象
DESK非対象
活動実績対象
```

Item Studioの販売記録ログ:

```text
Story非対象
DESK対象
活動実績非対象
```

## 7. 判定

- `/os` 画面側に、Supabase OSサマリーテスト枠を追加した。
- Story / DESK / 活動実績の判定は共通関数を使う。
- 通常の `/os` 表示はまだSupabaseへ切り替えていない。

## 8. 2026-07-08 browser test result

ログイン済みのin-app browserで、`/os` のSupabase OSサマリーテスト枠を確認しました。

画面上の結果:

| check | result |
| --- | --- |
| `/os` 通常表示 | 維持 |
| `Supabase OSサマリーテスト` 枠表示 | OK |
| Supabase総ログ数 | 63件 |
| Story対象件数 | 12件 |
| DESK対象件数 | 27件 |
| 活動実績対象件数 | 13件 |
| 売上合計 | ￥513,800 |
| 経費合計 | ￥33,750 |
| 差引 | ￥480,050 |

最近のActivity Log 5件に、Item Studioのテストログが含まれることを確認しました。

### 作品登録ログ

| field | value |
| --- | --- |
| title | ガラスアクセサリーを商品登録 |
| `source_service` | `item_studio` |
| `category` | `product` |
| `visibility` | `public` |
| `amount` | `null` |
| `transaction_type` | `none` |
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
| `amount` | `4800` |
| `transaction_type` | `revenue` |
| Story | 非対象 |
| DESK | 対象 |
| 活動実績 | 非対象 |

判定:

- Supabase上の `activity_logs` から、OS Home用の総数・分類件数・金額サマリーを作れる。
- 作品登録ログはStory対象、DESK非対象、活動実績対象として表示される。
- 販売記録ログはStory非対象、DESK対象、活動実績非対象として表示される。
- 通常の `/os` 表示はlocalStorage / mockベースのまま維持している。
