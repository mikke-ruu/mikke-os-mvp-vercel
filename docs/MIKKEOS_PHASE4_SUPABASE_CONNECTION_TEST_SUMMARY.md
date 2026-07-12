# mikkeOS Phase 4 Supabase Connection Test Summary

作成日: 2026-07-08

このメモは、mikkeOS Phase 4で実施したSupabase `activity_logs` 接続テストの完了状態をまとめるものです。

重要: Phase 4ではテスト枠による保存・読み取り・分類確認までを行いました。通常表示や通常保存のSupabase本接続はまだ有効化していません。

## 1. Phase 4で確認できたこと

確認済み:

- Item StudioからSupabase `activity_logs` へ保存できる。
- `/log` の別枠テストからSupabase `activity_logs` を読み取れる。
- SupabaseログをStory / DESK / 活動実績に分類できる。
- Story / DESK / 活動実績の分類条件を共通関数化できた。
- `/story` の別枠テストでStory対象ログだけを表示できる。
- `/desk` の別枠テストでDESK対象ログだけを抽出・集計できる。
- `/os` の別枠テストでOS Home用サマリーを生成できる。

最終確認済みのOSサマリー:

| item | value |
| --- | --- |
| Supabase総ログ数 | 63件 |
| Story対象 | 12件 |
| DESK対象 | 27件 |
| 活動実績対象 | 13件 |
| 売上合計 | ￥513,800 |
| 経費合計 | ￥33,750 |
| 差引 | ￥480,050 |

## 2. 追加・変更した主なファイル

### Item Studio保存テスト関連

- `components/mikkeos/AppMiniPage.tsx`
- `lib/mikkeos/item-studio-supabase-test.ts`
- `docs/MIKKEOS_PHASE4_ITEM_STUDIO_SUPABASE_TEST_MODE.md`

確認した保存テスト:

- 作品登録ログ
- 販売記録ログ

### `/log` 読み取りテスト関連

- `app/log/page.tsx`
- `components/mikkeos/SupabaseLogReadTest.tsx`
- `docs/MIKKEOS_PHASE4_LOG_SUPABASE_READ_TEST.md`

確認したこと:

- Supabase `activity_logs` の読み取り
- Story / DESK / 活動実績の分類
- Item Studio 2パターンの出し分け

### Story読み取りテスト関連

- `app/story/page.tsx`
- `components/mikkeos/SupabaseStoryReadTest.tsx`
- `docs/MIKKEOS_PHASE4_STORY_SUPABASE_READ_TEST.md`

確認したこと:

- Story対象ログだけを抽出表示
- 販売ログがStory対象に混ざらないこと

### DESK読み取りテスト関連

- `app/desk/page.tsx`
- `components/mikkeos/SupabaseDeskReadTest.tsx`
- `docs/MIKKEOS_PHASE4_DESK_SUPABASE_READ_TEST.md`

確認したこと:

- DESK対象ログだけを抽出
- 売上合計 / 経費合計 / 差引の集計
- 作品登録ログがDESK対象に混ざらないこと

### OSサマリーテスト関連

- `app/os/page.tsx`
- `components/mikkeos/SupabaseOsSummaryTest.tsx`
- `docs/MIKKEOS_PHASE4_OS_SUPABASE_SUMMARY_TEST.md`

確認したこと:

- Supabase総ログ数
- Story / DESK / 活動実績の件数
- 売上合計 / 経費合計 / 差引
- 最近のActivity Log 5件と各分類ラベル

### 共通関数

- `lib/mikkeos/activity-log-filters.ts`

追加した関数:

- `isStoryVisibleLog(log)`
- `isDeskCountedLog(log)`
- `isSummaryCountedLog(log)`
- `splitActivityLogsByDestination(logs)`

### docs関連

主な参照docs:

- `docs/MIKKEOS_PHASE4_SUPABASE_ADAPTER_PLAN.md`
- `docs/MIKKEOS_PHASE4_ACTIVITY_LOG_CONSTRAINTS_AND_POLICY_CHECK.md`
- `docs/MIKKEOS_PHASE4_RLS_POLICY_CONFIRMATION.md`
- `docs/MIKKEOS_PHASE4_FINANCIAL_AND_PUBLIC_STORY_TESTS.md`
- `docs/MIKKEOS_PHASE4_ITEM_STUDIO_SUPABASE_TEST_MODE.md`
- `docs/MIKKEOS_PHASE4_LOG_SUPABASE_READ_TEST.md`
- `docs/MIKKEOS_PHASE4_STORY_SUPABASE_READ_TEST.md`
- `docs/MIKKEOS_PHASE4_DESK_SUPABASE_READ_TEST.md`
- `docs/MIKKEOS_PHASE4_OS_SUPABASE_SUMMARY_TEST.md`

## 3. 現在の共通判定ルール

Story対象:

```text
visibility = public
display_on_story = true
```

DESK対象:

```text
has_financial_value = true
amount !== null
transaction_type = revenue または expense
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

## 4. Item Studioで確認した2パターン

### 作品登録

保存・読み取り・分類結果:

```text
source_service: item_studio
category: product
visibility: public
display_on_story: true
counts_toward_summary: true
has_financial_value: false
amount: null
transaction_type: none
payment_status: not_required
```

判定:

```text
Story対象
DESK非対象
活動実績対象
```

### 販売記録

保存・読み取り・分類結果:

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

判定:

```text
Story非対象
DESK対象
活動実績非対象
```

## 5. まだ本接続していないもの

未実施:

```text
/os 通常表示のSupabase本接続
/log 通常表示の完全Supabase化
/story 通常表示のSupabase本接続
/desk 通常表示のSupabase本接続
各ミニ画面保存の一斉Supabase化
Order連携
Team Works連携
MarketNote本体連携
RLS / policy / constraint変更
DBマイグレーション
```

Phase 4で追加した各画面のSupabase枠は、すべてテスト用の別枠です。

## 6. 次の判断候補

候補:

```text
A. /os の通常表示をSupabase読み取りへ段階移行する
B. /story の通常表示をSupabase読み取りへ段階移行する
C. /desk の通常表示をSupabase読み取りへ段階移行する
D. まだ本接続せず、MarketNote / Team Worksなど単体アプリ実装を優先する
E. 各アプリごとのActivity Log変換ルール表を先に作る
```

考え方:

- A / B / C は、テスト枠で確認済みの読み取り・分類ロジックを通常表示へ段階移行する案。
- D は、OS読み取り本接続よりも各アプリの実装価値を先に増やす案。
- E は、本接続前にアプリごとの保存payload、Story公開可否、DESK対象可否、活動実績対象可否を整理する案。

## 7. 推奨

現時点では、まだ一気に通常表示や通常保存をSupabase本接続しない方針を推奨します。

推奨する次の流れ:

```text
各アプリごとのActivity Log変換ルール表を作る
↓
優先アプリだけ段階的に本接続する
```

理由:

- Item Studioでは2パターンの保存・読み取り・分類に成功したが、他アプリはまだpayload方針が未整理。
- Story / DESK / 活動実績は同じ `activity_logs` から派生するため、保存時の分類ルールがぶれると後工程の表示に影響する。
- MarketNote、Order、Team Worksなどは金額・公開・活動実績の扱いが異なるため、先に変換ルール表を作る方が安全。
- RLS / policy / constraint / DBマイグレーションはPhase 4では変更せず、現行ルール内で動作確認できている。

次に作るとよいもの:

```text
docs/MIKKEOS_PHASE4_ACTIVITY_LOG_CONVERSION_RULES_BY_APP.md
```

想定する表の列:

```text
app / action / source_service / category / visibility / display_on_story / counts_toward_summary / has_financial_value / amount / transaction_type / payment_status / Story対象 / DESK対象 / 活動実績対象 / 備考
```
