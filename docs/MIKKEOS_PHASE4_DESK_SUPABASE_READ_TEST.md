# mikkeOS Phase 4 DESK Supabase Read Test

作成日: 2026-07-08

このメモは、`/desk` に追加したSupabase DESK読み取りテスト枠の実装範囲を記録するものです。

通常の `/desk` 表示はまだlocalStorage / mockベースです。今回追加した枠は、Supabaseの `activity_logs` からDESK対象ログだけを抽出・集計できるか確認するための別枠です。

## 1. 実装範囲

追加:

- `components/mikkeos/SupabaseDeskReadTest.tsx`
- `app/desk/page.tsx` へのテスト枠差し込み

変更しない:

- `/desk` の通常表示
- localStorage / mock 表示導線
- `/story` / `/os` / `/log` の通常表示
- 各ミニ画面の一斉Supabase保存
- Order / Team Works / MarketNote本体
- RLS / policy / constraint
- DBマイグレーション

## 2. 読み取り条件

ログイン済みユーザーのSupabase sessionを確認してから、`activity_logs` を読み取ります。

未ログイン時は `activity_logs` へselectせず、以下を表示します。

```text
Supabase desk read test needs a logged-in user.
```

## 3. DESK対象判定

DESK対象判定には、共通関数 `isDeskCountedLog(log)` を使います。

条件:

```text
has_financial_value = true
amount is not null
transaction_type = revenue or expense
```

## 4. 集計ルール

```text
transaction_type = revenue -> 売上に加算
transaction_type = expense -> 経費に加算
差引 = 売上合計 - 経費合計
```

## 5. 表示項目

テスト枠では以下を表示します。

- DESK対象件数
- DESK非対象件数
- 売上合計
- 経費合計
- 差引
- `title`
- `source_service`
- `category`
- `amount`
- `transaction_type`
- `payment_status`
- `visibility`
- `display_on_story`
- `counts_toward_summary`
- `has_financial_value`
- `occurred_at`
- `created_at`

## 6. 確認したい判定

Item Studioの販売記録ログはDESK対象として表示・集計される想定です。

```text
source_service: item_studio
category: product
visibility: private
display_on_story: false
counts_toward_summary: false
has_financial_value: true
amount: 4800
transaction_type: revenue
payment_status: paid
```

Item Studioの作品登録ログはDESK非対象として、DESK対象一覧には表示されない想定です。

```text
source_service: item_studio
category: product
visibility: public
display_on_story: true
counts_toward_summary: true
has_financial_value: false
amount: null
transaction_type: none
```

## 7. 判定

- `/desk` 画面側に、Supabase DESK読み取りテスト枠を追加した。
- DESK対象判定は `isDeskCountedLog(log)` に共通化した条件を使う。
- 通常の `/desk` 表示はまだSupabaseへ切り替えていない。

## 8. 2026-07-08 browser test result

ログイン済みのin-app browserで、`/desk` のSupabase DESK読み取りテスト枠を確認しました。

画面上の結果:

| check | result |
| --- | --- |
| `/desk` 通常表示 | 維持 |
| `Supabase DESK読み取りテスト` 枠表示 | OK |
| DESK対象件数 | 11件 |
| DESK非対象件数 | 9件 |
| 売上合計 | ￥225,800 |
| 経費合計 | ￥10,250 |
| 差引 | ￥215,550 |
| Item Studio販売記録ログ | DESK対象として表示 |
| Item Studio作品登録ログ | DESK対象一覧に表示されない |

確認できたDESK対象ログ:

### 販売記録ログ

| field | value |
| --- | --- |
| title | ガラスアクセサリーを販売 |
| `source_service` | `item_studio` |
| `category` | `product` |
| `amount` | `4800` |
| `transaction_type` | `revenue` |
| `payment_status` | `paid` |
| `visibility` | `private` |
| `display_on_story` | `false` |
| `counts_toward_summary` | `false` |
| `has_financial_value` | `true` |

判定:

- `has_financial_value: true`、`amount: 4800`、`transaction_type: revenue` の販売記録ログはDESK対象に出る。
- 販売記録ログは売上合計へ加算される。
- `has_financial_value: false`、`amount: null`、`transaction_type: none` の作品登録ログはDESK対象に出ない。
- 通常の `/desk` 表示はlocalStorage / mockベースのまま維持している。
