# MIKKEOS Manager M0 現状確認・設計報告

作成日: 2026-07-18  
対象計画: `docs/MIKKEOS_MANAGER_INTEGRATION_PLAN.md`

## 1. 結論

Manager M1は、現行repoの構造に対して大きな方向修正なしで開始できる。

ただし、Managerは「新しいOSホーム」ではなく、各アプリの予定・タスク・進行を読み取り変換して束ねる個人用管理面として扱う。既存の `/os` と `/log` は削除せず、M1中は拡張せずに残置する。

M1で安全に実装できる範囲は以下。

- `/manager` 配下の認証必須ページを新設する
- Manager専用の個人予定・設定だけをlocalStorageに保存する
- MarketNote / Order / Session / Event / Fund から予定・タスク・進行候補を読み取り変換する
- app側の保存形式や公開面をManagerから直接変更しない
- Activity Logという名称をManagerのユーザー画面には出さない

M1で見送る範囲は以下。

- `/os` と `/log` の最終処遇
- ルート `/` と login後遷移先の `/manager` 化
- BottomNav全体の置き換え
- Google Calendar接続
- Inbox実装
- Supabase上のManager専用テーブル作成
- Nintei / Page / pricing / select-shop 系の未コミット差分

## 2. 既存ルート・ナビの確認

現行repoには、Managerと役割が近い既存画面がある。

| 対象 | 現状 | M1での扱い |
| --- | --- | --- |
| `/os` | OS Homeとして存在し、Activity Logや各アプリへの導線を持つ | 凍結。新機能を追加しない |
| `/log` | Activity Logの内部確認画面として存在 | 内部管理用として残置。Manager UIでは「履歴」として扱う |
| `/` | `app/page.tsx` で `/os` へ遷移 | M1では変更しない |
| login後 | `app/login/page.tsx` で未指定時 `/os` へ遷移 | M1では変更しない。M1完了後に判断 |
| `MikkeOwnerMenu` | 表示設定 / Log / Story / DESK / Apps を表示 | M1でManager入口を先頭に追加する候補 |
| `BottomNav` / `MikkeAppShell` | `/os` と `/log` を含む | M1ではナビ構成を変更しない |

このため、M1の導線追加はまずOwnerMenuだけに限定するのが安全。

## 3. 既存データソースの確認

Managerは、各アプリの保存先を直接支配せず、アプリ側の既存データを読み取り変換する。

| アプリ | 現在の主な保存・取得 | Manager M1で読める候補 | 注意 |
| --- | --- | --- | --- |
| MarketNote | `lib/marketnote.ts` のSupabase関数群 | 出店日、チェック項目、売上/経費、振り返り | 非同期・認証依存。取得失敗時はManager側で空として扱う |
| Order | `lib/order/store.ts` のlocalStorage | 申込、希望納期、ステータス | MVPはlocalStorageのみ。Activity Log接続は後続と明記あり |
| Session | `lib/session/store.ts` のlocalStorage | 予約日、予約ステータス | MVPはlocalStorageのみ。Activity Log接続は後続と明記あり |
| Event | `lib/event/store.ts` のlocalStorage | 開催日、申込ステータス | MVPはlocalStorageのみ。Activity Log接続は後続と明記あり |
| Fund | `lib/fund/store.ts` のlocalStorage + `lib/fund/database.ts` のSupabase保存系 | 終了日、リターン納期、支援対応、進行状況 | ownerProfileId別のv2 localStorageキーがある。DB同期済みでもManagerは読み取り優先 |
| Team Works | `lib/team-works-projects.ts` と `lib/team-works-manager-adapter.ts` | プロジェクト納期、タスク、進行状況 | TW-P8LでManager接続境界は作成済み。ただしManager計画上はM2統合対象 |
| Unified Activity Log | `lib/mikkeos/activity-client-store.ts` のlocalStorage | 履歴候補 | Manager M1では「Activity Log」という用語を表に出さず、履歴面に変換する |

## 4. M1で必要な設計境界

Manager M1は、次の境界を守ると既存アプリへの副作用を抑えられる。

1. Manager専用保存は2種類だけに限定する
   - `mikke.manager.personal-events.v1`
   - `mikke.manager.preferences.v1`
2. 各アプリ由来の予定・タスク・進行はderive-on-readにする
   - Manager側に複製保存しない
   - appKey / sourceType / sourceId / href を持たせ、元画面へ戻れるようにする
3. 個人予定はActivity Log / Story / DESKへ流さない
   - 個人の予定表として閉じる
4. MarketNoteやFundなどSupabase依存のデータ取得は失敗しても画面全体を落とさない
   - M1では「取得できる範囲だけ表示」でよい
5. Manager UIには「Activity Log」という内部語を出さない
   - `/manager/history` は「最近の動き」「履歴」などの表現にする

## 5. M1実装ファイル案

M1は既存アプリに最小限だけ触り、Manager専用ファイルを中心に進める。

```text
lib/manager/
  types.ts
  store.ts
  adapters/
    marketnote.ts
    order.ts
    session.ts
    event.ts
    fund.ts
  collect-manager-items.ts

components/manager/
  ManagerDashboard.tsx
  ManagerCalendarView.tsx
  ManagerTaskList.tsx
  ManagerProgressBoard.tsx
  ManagerHistoryList.tsx
  ManagerSettingsPanel.tsx

app/manager/
  page.tsx
  calendar/page.tsx
  tasks/page.tsx
  progress/page.tsx
  history/page.tsx
  settings/page.tsx
```

既存ファイルでM1中に触る候補は、OwnerMenuへの入口追加に必要な `components/mikkeos/MikkeOwnerMenu.tsx` または `components/mikkeos/MikkeAppShell.tsx` に限定する。

## 6. M1の検収条件

M1完了時は、以下を確認する。

- `/manager` 配下の6画面がすべて認証必須で表示できる
- Manager画面内に「Activity Log」という内部語が出ていない
- 個人予定の追加・編集・削除がManager専用localStorageだけに保存される
- Order / Session / Event / Fund / MarketNote由来の予定・タスク・進行が読み取り表示される
- 元アプリへのリンクがsource情報から辿れる
- app側の保存関数をManagerから直接呼んで更新していない
- `/os` と `/log` の既存画面を壊していない
- lint / build が通る

## 7. 今回コミットに含めないもの

現在の作業ツリーには、Manager以外の差分が残っている。M0では混ぜない。

- Nintei Koza admin関連
  - `app/nintei-koza-admin/`
  - `components/nintei-koza/`
  - `lib/nintei-koza/`
  - `types/database.ts`
  - `app/settings/page.tsx` のNintei導線
- Page / pricing / select-shop 関連docs
  - `docs/MIKKEOS_PAGE_IMPLEMENTATION_PLAN.md`
  - `docs/MIKKEOS_MONETIZATION_AND_PRICING.md`
  - `docs/MIKKEOS_SELECT_SHOP_MODEL.md`
  - `docs/MIKKEOS_SESSION_HANDOFF_2026-07-14.md`
- 既存docsへの混在追記
  - `docs/MIKKEOS_APP_PORTFOLIO_MASTER_PLAN_2026-07-12.md`
  - `docs/MIKKEOS_UI_DOCS_INDEX.md`

これらは別スコープで整理する。

