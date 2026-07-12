# mikkeOS Phase 4 Story Supabase Read Test

作成日: 2026-07-08

このメモは、`/story` に追加したSupabase Story読み取りテスト枠の実装範囲を記録するものです。

通常の `/story` 表示はまだlocalStorage / mockベースです。今回追加した枠は、Supabaseの `activity_logs` からStory対象ログだけを抽出できるか確認するための別枠です。

## 1. 実装範囲

追加:

- `components/mikkeos/SupabaseStoryReadTest.tsx`
- `app/story/page.tsx` へのテスト枠差し込み

変更しない:

- `/story` の通常表示
- localStorage / mock 表示導線
- `/desk` / `/os` / `/log` の通常表示
- 各ミニ画面の一斉Supabase保存
- Order / Team Works / MarketNote本体
- RLS / policy / constraint
- DBマイグレーション

## 2. 読み取り条件

ログイン済みユーザーのSupabase sessionを確認してから、`activity_logs` を読み取ります。

未ログイン時は `activity_logs` へselectせず、以下を表示します。

```text
Supabase story read test needs a logged-in user.
```

## 3. Story対象判定

Story対象判定には、共通関数 `isStoryVisibleLog(log)` を使います。

条件:

```text
visibility = public
display_on_story = true
```

## 4. 表示項目

テスト枠では以下を表示します。

- Story対象件数
- Story非対象件数
- `title`
- `source_service`
- `category`
- `visibility`
- `display_on_story`
- `counts_toward_summary`
- `has_financial_value`
- `transaction_type`
- `occurred_at`
- `created_at`

## 5. 確認したい判定

Item Studioの作品登録ログはStory対象として表示される想定です。

```text
source_service: item_studio
category: product
visibility: public
display_on_story: true
counts_toward_summary: true
has_financial_value: false
transaction_type: none
```

Item Studioの販売記録ログはStory非対象として、Story対象一覧には表示されない想定です。

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

## 6. 判定

- `/story` 画面側に、Supabase Story読み取りテスト枠を追加した。
- Story対象判定は `isStoryVisibleLog(log)` に共通化した条件を使う。
- 通常の `/story` 表示はまだSupabaseへ切り替えていない。

## 7. 2026-07-08 browser test result

ログイン済みのin-app browserで、`/story` のSupabase Story読み取りテスト枠を確認しました。

画面上の結果:

| check | result |
| --- | --- |
| `/story` 通常表示 | 維持 |
| `Supabase Story読み取りテスト` 枠表示 | OK |
| Story対象件数 | 2件 |
| Story非対象件数 | 10件 |
| Item Studio作品登録ログ | Story対象として表示 |
| Item Studio販売記録ログ | Story対象一覧に表示されない |

確認できたStory対象ログ:

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
| `transaction_type` | `none` |

判定:

- `visibility: public` かつ `display_on_story: true` の作品登録ログはStory対象に出る。
- `visibility: private` かつ `display_on_story: false` の販売記録ログはStory対象に出ない。
- 通常の `/story` 表示はlocalStorage / mockベースのまま維持している。
