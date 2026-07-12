# mikkeOS MarketNote SPEC Gap

Created: 2026-07-12
Scope: P2-b preparation only. This document compares `MARKETNOTE_IMPLEMENTATION_SPEC_00` through `10` with the current implementation.

No implementation work is included here. Do not use this document as priority order; Fable will decide priority before P2-b starts.

## Current Implementation Snapshot

Checked implementation areas:

- `app/marketnote/page.tsx`
- `app/marketnote/[id]/page.tsx`
- `app/marketnote/new/page.tsx`
- `app/marketnote/finance/page.tsx`
- `app/settings/page.tsx`
- `app/settings/check-templates/page.tsx`
- `app/settings/finance-categories/page.tsx`
- `app/settings/payment-methods/page.tsx`
- `app/settings/reminders/page.tsx`
- `lib/marketnote.ts`
- `lib/check-templates.ts`
- `lib/finance-categories.ts`
- `lib/payment-methods.ts`
- `lib/reminders.ts`

Current MarketNote has the core app routes, event creation, event detail editing, event-linked finance editing, and settings helpers. It is not yet a complete match for the SPEC_00-10 set. The largest gaps are the home calendar experience, text encoding cleanup, notification execution, photo/album handling, and first-class status/date columns.

## Gap Table

| SPEC | Area | Status | Effort | Notes |
|---|---|---:|---:|---|
| 00 | Shared D-style visual direction | Partial | Medium | P2-a moved MarketNote pages onto `MikkeAppShell` and tokens. Some app-local form/card markup remains, and settings pages are not part of P2-a visual unification. |
| 00 | App-first branding / Story and DESK not overexposed | Partial | Small | MarketNote routes no longer foreground mikkeOS. Login entry was adjusted to MarketNote. Settings still contains broader OS/DESK/Story language and should be reviewed in a later settings pass. |
| 00 | Shared data model across event, payment, finance, reflection, photos | Partial | Large | Events, checks, finance, and reflections exist. Photos are UI-only or absent, and date/time details are stored in `private_note` rather than first-class columns. |
| 00 | Bottom navigation model | Partial | Medium | `MikkeAppShell` provides current OS navigation. MarketNote's original icon-only bottom nav spec is superseded by the OS shell direction. |
| 00 | Profile edited in Story, MarketNote display-only | Not implemented | Small | MarketNote currently does not show profile in-app. Settings profile exists globally, not MarketNote-specific. |
| 01 | Home monthly calendar | Not implemented | Large | Current `/marketnote` is a list view. No month grid, date cell summaries, selected-date card, or multi-event badge. |
| 01 | Upcoming/pre-event and completed-event calendar display switch | Not implemented | Large | Current list filters out completed/cancelled. Completed event calendar presentation and result-first cards are missing. |
| 01 | Selected date card and add-on-selected-date flow | Not implemented | Medium | `/marketnote/new?startDate=...` is supported, but there is no calendar date picker entry on the home screen. |
| 01 | Home lower support area: due tasks / next events / unrecorded finished events | Not implemented | Medium | No home support panels beyond the list and empty state. |
| 01 | Calendar settings connection | Not implemented | Medium | Settings page has calendar-display concept, but MarketNote home does not consume it. |
| 02 | List screen header, tabs, sort row, list cards | Implemented | Small | `/marketnote` is closer to SPEC_02 than SPEC_01. It has two tabs, sort text, add action, event cards, status/payment chips, and progress bar. |
| 02 | List excludes finished events by default | Implemented | Small | Current filtering excludes `completed` and `cancelled`. |
| 02 | Finished-event filter/card treatment | Not implemented | Medium | No future finished-event filter or completed card display. |
| 02 | Payment status derived from checks and finance | Partial | Medium | List derives payment from check items only. Detail and finance use financial records more fully. |
| 02 | Filter icon behavior | Not implemented | Small | Filter icon is visible but has no filter UI. SPEC says unimplemented filter affordances should not look active. |
| 03 | Add event basic required fields | Implemented | Small | Event title and start date are required. |
| 03 | Add event from `startDate` query | Implemented | Small | `startDate` prefills start/end date. |
| 03 | Multi-day event MVP via `private_note` | Implemented | Medium | Multi-day flag and end date are saved in `private_note`. |
| 03 | Status options including applied | Partial | Medium | UI has planned/applied/preparing, but `createMarketEvent` persists applied as planned because DB type only supports planned/preparing in the create path. |
| 03 | Time and venue optional accordion fields | Implemented | Small | Time and venue accordions exist and save to event/private note. |
| 03 | Payment info and disabled multiple-payment add | Implemented | Small | Single payment row exists; `+ payment` is visually disabled. |
| 03 | Check template connection to add page | Implemented | Small | Active local check template items load into new event and are saved as `market_check_items`. |
| 03 | Due-date rules applied to check items | Not implemented | Medium | Template due rules exist in settings data but are not applied to persisted check item due dates. |
| 04 | Detail summary-first layout | Implemented | Small | Summary card is primary. Status and quick checks are visible there. |
| 04 | Collapsed edit group for basic/venue/payment/check edits | Implemented | Small | `各項目編集` style grouped edit area exists. |
| 04 | Status changes centralized in summary card | Partial | Small | Summary card status menu exists. Edit group still includes other data, not a separate status field. |
| 04 | Payment status/method/amount edit | Implemented | Small | Detail updates payment expense record through `saveEventPaymentRecord`. |
| 04 | Check item toggle and add custom check | Implemented | Small | Summary and edit areas allow toggling/adding checks. |
| 04 | Finance memo and link to finance page | Implemented | Small | Totals display and link to `/marketnote/finance?eventId=...` exist. |
| 04 | Reflection field | Partial | Medium | One visible reflection textarea is present, but the underlying `saveReflection` supports separate good/next values. The UI currently uses one freeform visible field. |
| 04 | Photos | Not implemented | Medium | Photo area is visual only. No upload, display, storage, or max-five handling. |
| 04 | Map link | Not implemented | Small | SPEC marks map link as future work. |
| 05 | Finance route and eventId focus | Implemented | Small | `/marketnote/finance` and `?eventId=` are supported. |
| 05 | Month summary | Implemented | Small | Monthly revenue/expense/profit summary exists. |
| 05 | Event finance cards and one open card editing | Implemented | Small | Event cards open inline with revenue/expense draft sections. |
| 05 | Add/update/delete finance rows | Implemented | Medium | Uses existing `market_financial_records`; updates by persisted id and inserts new rows. Delete exists in finance UI. |
| 05 | Save rules to avoid duplicate rows | Implemented | Small | Drafts hydrate from records and persisted rows update by id. |
| 05 | Category candidates from settings | Implemented | Small | Finance page loads local category settings and uses active category names. |
| 05 | Free input categories | Partial | Small | Existing unknown category is preserved as hidden option. New free typing is not supported in the current select UI. |
| 05 | Payment-linked expense chip | Implemented | Small | Finance drafts show a small payment-linked chip for detected payment rows. |
| 05 | Receipts/photos, DESK aggregation, CSV, lock/history | Not implemented | Large | Marked future in SPEC; not currently present. |
| 06 | Settings top route | Implemented | Medium | `/settings` exists with profile, MarketNote settings, integration rows, home app row, and logout concepts. |
| 06 | App switcher / hamburger | Partial | Medium | OS direction now uses `MikkeOwnerMenu` in `MikkeAppShell`; legacy MarketNote switcher is superseded. `/settings` itself has not been fully moved to the newer visual standard. |
| 06 | Calendar display setting | Partial | Medium | Settings UI exists conceptually, but MarketNote home does not consume it. |
| 06 | Story / DESK connection cards | Partial | Small | Cards/links exist, but there is no real connection setting logic. |
| 06 | PWA home screen add | Partial | Small | Visual row exists; no real PWA install flow. |
| 06 | Logout | Implemented | Small | Global auth shell/settings include logout paths. |
| 07 | Check template settings route | Implemented | Small | `/settings/check-templates` exists. |
| 07 | Add/edit/hide/restore/default/save template items | Implemented | Medium | Local template management exists through `lib/check-templates.ts`. |
| 07 | Due rule selection in settings | Implemented | Small | Due rule data and labels exist. |
| 07 | Add page consumes active template items | Implemented | Small | New event loads active check titles and persists them. |
| 07 | Detail page consumes settings templates | Not implemented | Medium | Detail page can add custom checks, but does not apply templates to existing events. |
| 07 | Home due-task list from due rules | Not implemented | Medium | No home due-task list or due-date based ordering. |
| 07 | Multiple templates / event-type template switching | Not implemented | Medium | SPEC marks as future. |
| 08 | Finance category settings route | Implemented | Small | `/settings/finance-categories` exists. |
| 08 | Revenue/expense category split | Implemented | Small | Local settings split by type. |
| 08 | Add/edit/hide/restore/favorite/reorder/save | Implemented | Medium | These operations exist in the settings page/local library. |
| 08 | Finance page consumes active categories | Implemented | Small | Finance page loads active category names. |
| 08 | Delete/usage count/DB save/DESK unification | Not implemented | Large | Marked future. |
| 09 | Payment methods settings route | Implemented | Small | `/settings/payment-methods` exists. |
| 09 | Add/edit/hide/restore/favorite/reorder/save | Implemented | Medium | These operations exist in the settings page/local library. |
| 09 | New/detail consume payment methods | Implemented | Small | New and detail pages load saved payment method names. |
| 09 | Finance page consumes payment methods | Not implemented | Small | Finance records currently focus on categories/amounts; payment method is only carried in memo for linked payment rows. |
| 09 | Used-method detection / DB save / DESK unification | Not implemented | Large | Marked future. |
| 10 | Reminder settings route | Implemented | Small | `/settings/reminders` exists with local settings. |
| 10 | Enable/disable, target, timing, time selection | Implemented | Medium | Local state and save/reset exist in `lib/reminders.ts`. |
| 10 | Actual notifications/reminder execution | Not implemented | Large | No notification scheduling, push, email, or runtime reminder processing. |
| 10 | Integration with check due dates and event dates | Not implemented | Medium | Settings are stored but not connected to MarketNote event/check workflows. |

## Cross-Cutting Gaps

| Gap | Status | Effort | Notes |
|---|---:|---:|---|
| Japanese text encoding cleanup | Partial | Medium | Several current files display mojibake text in source/output. Build still passes, but visible copy should be restored before final completion. |
| First-class event status model | Partial | Large | Current DB/types constrain status. `applied`, future `considering/confirmed/finished/canceled`, and clean labels need a schema/type decision later. Do not change DB in P2-b unless separately approved. |
| First-class start/end/time fields | Partial | Large | MVP uses `private_note` for `end_date`, multi-day, start/end/meet/pack-up times. Real columns are future. |
| Activity Log / Story / DESK conversion | Partial | Large | `lib/marketnote.ts` writes activity logs for some operations, but P2-b should not broaden Supabase/Activity Log behavior without a separate adapter decision. |
| Photo handling | Not implemented | Large | Event detail photo UI is placeholder. Storage, max five photos, album/story behavior are absent. |
| Settings visual unification | Partial | Medium | Settings pages are functional, but not yet fully aligned with the newer Story/Mikke primitives visual system. |

## Recommended Waiting State

This document is intentionally not an implementation plan. Suggested priority questions for Fable:

1. Should P2-b first fix text encoding and inactive affordances before adding features?
2. Should the missing home calendar be the main P2-b feature, or should it be deferred behind settings/text cleanup?
3. Should reminder execution remain out of scope until a real notification channel is selected?
4. Should photo support wait for the broader Event/Mikkeruu photo and album decisions?
5. Should status/date column gaps remain `private_note` MVP behavior until a DB phase is explicitly opened?

## Fable Decision（2026-07-12 優先順位確定）

上記5問への回答:

```text
1. YES。文字化けと「押せそうで押せないUI」の解消を最初に行う（Wave 1）。
2. ホームカレンダーがP2-bの主役（Wave 2）。ただし現行データモデルのまま
   （private_note方式維持・DB変更なし）。
3. YES。リマインダー実処理はスコープ外。設定の保存のみ維持。
4. YES。写真はEvent/Mikkeruuの写真・Storage方針が決まるまで見送り
   （Mikkeruuでbase64→Storage移行とegress超過の実績があるため、
   写真は場当たりで実装しない）。
5. YES。DB列追加はしない。ただしSPEC_03の「applied選択がplannedで保存される」
   問題は、UIがユーザーに嘘をつく状態なので、end_dateと同じ
   private_note方式で実ステータスを保持し表示する（Wave 1で修正）。
```

### P2-b実装ウェーブ（この順で実装。各Wave完了ごとにコミット＋セルフチェック）

```text
Wave 1（品質パス・小〜中）:
  - 文字化けコピーの全復旧（ユーザーに見える文言全て）
  - フィルタアイコン: 機能がないので「押せそうな見た目」を解除（SPEC_02準拠）
  - applied状態のprivate_note保持・表示（上記5）
  - 収支カテゴリの自由入力対応（SPEC_05・小）

Wave 2（主役機能・SPEC_01ホームカレンダー）:
  - 月グリッド・日付セルのイベント表示・選択日カード
  - 選択日からの追加導線（既存 /marketnote/new?startDate= を活用）
  - 開催前/終了後の表示切替
  - ホーム下部サポート欄: 期限つきチェック / 次のイベント / 未記録の終了イベント
  - チェックテンプレの期日ルールを実イベントのチェック項目へ適用
    （SPEC_03の残り・サポート欄の前提）

Wave 3（仕上げ・Wave 2完了後に着手判断）:
  - 終了イベントのフィルタ/カード表現（SPEC_02）
  - カレンダー表示設定の実消費（SPEC_01/06）
  - 支払いステータスのfinance連動強化（SPEC_02）
  - 詳細ページへのテンプレ適用（SPEC_07）

P2-bスコープ外（明示）:
  リマインダー実処理 / 写真 / DB列追加 / CSV・ロック・履歴 /
  PWA実インストール / Story・DESK実接続ロジック / プロフィール表示 /
  振り返りgood/next分割（現状の1欄で可）
  ※設定画面の見た目統一は課題B（OS中心画面統一）側で実施（二重作業禁止）

P2完成の定義: Wave 1 + Wave 2 完了 = 「人に見せて使ってもらえるMarketNote」。
Wave 3はP3（Event）着手前に状況を見て判断。
```
