# mikkeOS Phase 4 counts_toward_summary Rules

作成日: 2026-07-05

このメモは、Supabase本保存へ切り替える前に `counts_toward_summary` の扱いを固定するための整理です。
本番DB、RLS、既存MarketNote保存処理は変更していません。

## 1. 方針

`counts_toward_summary` は、「StoryやOS Homeの活動実績として数えるかどうか」のフラグとして扱う。

一律trueにはしない。

trueにするもの:

- 出店した
- イベントを主催した
- 講座を開催した
- 受注した
- 納品した
- 作品を販売した
- セッションを実施した
- 認定完了した
- 外部に見せても活動実績として意味があるもの

falseにするもの:

- 支払い方法変更
- 下書き作成
- 準備チェック
- メモ更新
- 表示設定変更
- 内部的な状態変更
- キャンセル処理
- 非公開の事務ログ
- 活動実績として数えると違和感があるもの

## 2. 実DB定義確認に必要な情報

実Supabaseの `activity_logs` 定義は、現時点では未確認です。
確認には以下のいずれかが必要です。

| 必要なもの | 用途 |
| --- | --- |
| Supabase MCPで対象projectのSQL実行権限 | `information_schema` / `pg_constraint` / `pg_policies` の読み取り |
| 有効なSupabase anon key | RESTでテーブル読み取りが可能か確認 |
| 必要に応じたservice role key | 管理者向けの読み取り確認。ブラウザや公開コードには置かない |
| 対象project id | MCP / CLI / Dashboardで対象を間違えないため |
| Dashboard閲覧権限 | Table Editor、SQL Editor、RLS policy確認 |

今回確認できなかった理由:

- MCP: テーブル一覧・SQL実行ともに権限なし。
- REST: `.env.local` の公開キーでは `401 Invalid API key`。

## 3. Supabase側で確認すべき項目

| 確認項目 | 見る理由 |
| --- | --- |
| `activity_logs` の列一覧 | adapter payloadと一致するか確認 |
| NOT NULL / default | adapterが不要な値まで送っていないか確認 |
| `category` check制約 | 日本語カテゴリやappKeyをそのまま入れないため |
| `transaction_type` check制約 | `income` ではなく `revenue` が必要なため |
| 金額制約 | `has_financial_value` / `amount` / `transaction_type` の組み合わせ確認 |
| unique制約 | `profile_id, source_service, source_record_id` が維持されているか確認 |
| RLS select policy | 自分のActivity Logと公開Storyログの読み取り条件確認 |
| RLS insert policy | `user_id` と `profile_id` の所有関係確認 |
| RLS update policy | `USING` と `WITH CHECK` の両方があるか確認 |
| 既存MarketNote行 | `source_service = marketnote` で保存済みか確認 |

## 4. 初期ルール案

### true候補

| appKey | eventType | 理由 |
| --- | --- | --- |
| `market_note` | `market_event_completed` | 出店した実績 |
| `event` | `event_created` | イベント主催の実績 |
| `event` | `event_hosted` | イベント開催の実績 |
| `academy` | `academy_course_created` | 講座開催の実績 |
| `academy` | `academy_certification_completed` | 認定完了の実績 |
| `order` | `order_received` | 受注実績 |
| `order` | `order_delivered` | 納品実績 |
| `item_studio` | `item_sold` | 作品販売実績 |
| `session` | `session_completed` | セッション実施実績 |

### false候補

| appKey | eventType | 理由 |
| --- | --- | --- |
| `market_note` | `market_event_prepared` | 準備チェック |
| `market_note` | `market_sales_recorded` | 非公開の事務・売上ログ |
| `market_note` | `market_expense_recorded` | 非公開の事務・経費ログ |
| `event` | `event_expense_recorded` | 非公開の事務・経費ログ |
| `community` | `community_fee_recorded` | 非公開の事務・会費ログ |
| `community` | `community_post_created` | 投稿は活動実績として数えすぎる可能性がある |
| 共通 | `payment_method_updated` | 設定変更 |
| 共通 | `draft_created` | 下書き |
| 共通 | `memo_updated` | メモ更新 |
| 共通 | `display_setting_updated` | 表示設定変更 |
| 共通 | `status_changed` | 内部状態変更 |
| 共通 | `cancelled` | キャンセル処理 |

## 5. UnifiedActivityLogへの反映

`UnifiedActivityLog` には `countsTowardSummary?: boolean` を任意フィールドとして追加した。

理由:

- 各アプリが「活動実績として数えるか」を明示できる。
- 既存モックやlocalStorageデータには影響しない。
- 明示値がない場合はadapter側の初期ルールで判定できる。

## 6. Adapterでの決め方

`toSupabaseActivityLogInsert()` は `counts_toward_summary` を以下の順で決める。

1. `log.countsTowardSummary` がbooleanなら、その値を使う。
2. false候補の `eventType` ならfalse。
3. true候補の `eventType` ならtrue。
4. `visibility !== public` または `storyEnabled === false` ならfalse。
5. `community` は初期値false。
6. それ以外は、`deskEnabled` または `amountType !== none` の場合だけtrue。

このルールにより、売上・経費などの非公開事務ログを活動実績数へ混ぜない。

## 7. 本保存前チェックリスト

- [ ] 実Supabaseの `activity_logs` 定義を確認する。
- [ ] 実DBの `counts_toward_summary` defaultを確認する。
- [ ] 既存MarketNote保存済みログの `counts_toward_summary` 値を確認する。
- [ ] `market_sales_recorded` を活動数に入れない方針で問題ないか確認する。
- [ ] `academy_course_created` は売上ログでも活動実績として数えてよいか確認する。
- [ ] `community_post_created` を将来trueにする条件が必要か確認する。
- [ ] UI上の「今月の活動数」が `counts_toward_summary` を使う設計に寄せられるか確認する。
- [ ] Story公開数と活動数を混同しない表示にする。
- [ ] adapter payload比較テストを追加する。
- [ ] 本保存ON/OFFの切り替えフラグを用意する。

## 8. まだ触らないもの

- Supabase本DB
- RLS / policy / constraint
- `app/marketnote/**`
- `lib/activity-log.ts`
- `lib/marketnote.ts`
- `types/database.ts`

