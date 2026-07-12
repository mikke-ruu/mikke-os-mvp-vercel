# mikkeOS Phase 4 countsTowardSummary Screen Check

作成日: 2026-07-05

このメモは、Supabase本保存前にプロトタイプ画面側で3つの意味が混ざっていないか確認した記録です。

## 固定する3つの意味

| フラグ | 役割 |
| --- | --- |
| `storyEnabled` | Storyに表示するか |
| `deskEnabled` | DESKに売上・経費などとして集計するか |
| `countsTowardSummary` | OS HomeやStory上で活動実績数として数えるか |

## 画面側の確認結果

| 画面 | 確認内容 | 結果 |
| --- | --- | --- |
| OS Home | 「今月の活動数」を活動実績対象だけにする | `getOsSummary().totalLogs` を `getSummaryLogs()` ベースへ変更 |
| Activity Log | 全ログ件数は全件のまま表示する | `summary.allLogs` を追加してLog画面で使用 |
| Story | 公開活動数は `visibility = public` かつ `storyEnabled = true` | 既存の `getStoryLogs()` で維持 |
| DESK | 売上・経費・利益は `deskEnabled = true` かつ金額あり | 既存の `getDeskLogs()` で維持 |
| Logカード | Story対象 / DESK対象 / 活動実績対象を確認できる | 「活動実績に含める」チップを追加 |

## 追加した共通判定

`lib/mikkeos/activity-summary.ts` を追加し、画面とadapterが同じ判定を使えるようにした。

判定順:

1. `countsTowardSummary` が明示されていればそれを優先。
2. false候補の `eventType` はfalse。
3. true候補の `eventType` はtrue。
4. 非公開またはStory対象外はfalse。
5. `community` は初期値false。
6. それ以外は金額やDESK対象の内容を見て判定。

## 初期ルールでの代表例

| eventType | Story | DESK | 活動実績数 |
| --- | --- | --- | --- |
| `market_event_created` | あり | なし | 含める |
| `market_sales_recorded` | なし | あり | 含めない |
| `market_expense_recorded` | なし | あり | 含めない |
| `order_delivered` | あり | なし | 含める |
| `academy_course_created` | あり | 内容による | 含める |
| `session_completed` | あり | 内容による | 含める |
| `community_post_created` | あり | なし | 初期値では含めない |

## まだ本保存前に見ること

- localStorageに古いログが残っている場合、画面確認前にリセットして件数を見る。
- 売上・経費追加でOS Homeの活動数が増えないこと。
- 納品・講座・セッション追加でOS Homeの活動数が増えること。
- Story公開数と活動実績数は別の数字として扱うこと。
- DESK集計件数と活動実績数も別の数字として扱うこと。

