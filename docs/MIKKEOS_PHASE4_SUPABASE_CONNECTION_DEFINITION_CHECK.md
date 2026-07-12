# mikkeOS Phase 4 Supabase Connection and Definition Check

作成日: 2026-07-05

このメモは、Supabase本保存へ切り替える前に、現在の接続情報と `activity_logs` 実定義確認の状況を整理するものです。
この確認では、Supabaseへの insert / update / delete、RLS / policy / constraint の変更、既存MarketNote保存処理の変更は行っていません。

更新: 2026-07-05

Dashboardから取得した同一project refのanon keyへ差し替えたあと、読み取り専用RESTの `activity_logs` 確認は成功しました。

## 1. Supabase接続情報確認メモ

`.env.local` に以下が設定されていることは確認済みです。

| 項目 | 確認結果 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | あり |
| URLのhost | `nttqpprkqbynxyldbnjs.supabase.co` |
| URLから読めるproject ref | `nttqpprkqbynxyldbnjs` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | あり |
| anon key形式 | JWT形式 |
| anon key role | `anon` |
| anon key内のproject ref | `nttqpprkqbynxyldbnjs` |
| URL refとkey refの一致 | 一致 |

キー本体は記録していません。

## 2. 接続先プロジェクト確認

現時点でローカルから確実に確認できた接続先は、URL上のproject ref `nttqpprkqbynxyldbnjs` です。

ただし、これがSupabase Dashboard上の表示名 `mikke-os-dev` と一致しているかは、ローカルからは表示名を直接確認できません。
Dashboard側で以下を確認してください。

| 確認項目 | 見る場所 |
| --- | --- |
| Project name | Supabase DashboardのProject Settings |
| Project ref | Supabase DashboardのProject Settings / General |
| API URL | Project Settings / API |
| anon public key | Project Settings / API |

`mikke-os-dev` のAPI URLが `https://nttqpprkqbynxyldbnjs.supabase.co` であれば、今回の `.env.local` は接続先として整合しています。

## 3. 401原因メモ

修正前の読み取り専用REST確認では、以下が再現していました。

| 確認 | 結果 |
| --- | --- |
| `activity_logs?select=*&limit=0` | `401 Invalid API key` |
| `activity_logs?select=*&limit=1` | `401 Invalid API key` |

原因は、`.env.local` のSupabase URLとanon keyが別プロジェクトを指していたことです。

| 比較対象 | 値 |
| --- | --- |
| URL側project ref | `nttqpprkqbynxyldbnjs` |
| anon key内project ref | `nttqpprkqbyldbnjs` |

この不一致があるため、REST APIはキーを正しいAPIキーとして扱えず、`Invalid API key` になっている可能性が高いです。

修正後の確認:

| 確認 | 結果 |
| --- | --- |
| URL側project ref | `nttqpprkqbynxyldbnjs` |
| anon key内project ref | `nttqpprkqbynxyldbnjs` |
| `activity_logs?select=*&limit=0` | `206` / 0件取得 |
| `activity_logs?select=*&limit=1` | `206` / 1件取得 |

補足:

- RLSで行が見えない場合は通常、`200 []` や権限エラーになります。
- 修正前はテーブルアクセス以前にAPIキー検証で止まっていたため、RLS以前の問題でした。
- 修正後は読み取り専用SELECTが通っているため、anon keyとしては有効です。

## 4. `activity_logs` 実定義確認メモ

今回試した実DB定義確認は以下です。

| 方法 | 結果 |
| --- | --- |
| Supabase MCP `_list_tables` | 権限なし |
| Supabase MCP `_execute_sql` でinformation_schema参照 | 権限なし |
| REST OpenAPI `/rest/v1/` | anon keyでは不可。`Only the service_role API key can be used for this endpoint.` |
| REST `activity_logs?select=*&limit=0` | 成功。`206` / 0件 |
| REST `activity_logs?select=*&limit=1` | 成功。`206` / 1件 |

結論:

現時点で、実Supabaseの `activity_logs` は存在し、anon keyで読み取り専用SELECTできることを確認しました。
また、1件取得した行の列名は `types/database.ts` と一致しています。

ただし、REST SELECTだけでは列型、nullable、default、check制約、unique制約、RLS policyの詳細は確認できません。
そのため、型・制約レベルの実定義確認はDashboardまたはMCP権限が必要です。

実DBから確認できた列名:

| 実DB列 |
| --- |
| `id` |
| `user_id` |
| `profile_id` |
| `activity_type` |
| `category` |
| `source_service` |
| `source_record_id` |
| `occurred_at` |
| `title` |
| `description` |
| `visibility` |
| `status` |
| `display_on_story` |
| `display_in_timeline` |
| `display_as_achievement` |
| `counts_toward_summary` |
| `has_financial_value` |
| `amount` |
| `transaction_type` |
| `payment_status` |
| `created_at` |
| `updated_at` |

## 5. 期待定義

`Mikke_OS_Core_MVP_supabase.sql` と `types/database.ts` で期待される `activity_logs` は以下です。

| 列 | 期待型 / 値 | メモ |
| --- | --- | --- |
| `id` | uuid | SQL側で生成 |
| `user_id` | uuid | Authユーザー |
| `profile_id` | uuid | `profiles.id` |
| `activity_type` | text | `activity_event_types.key` と文字列で対応 |
| `category` | text | check制約あり |
| `source_service` | text | 既定値 `manual` |
| `source_record_id` | text | source連携用 |
| `occurred_at` | timestamptz | 既定値 `now()` |
| `title` | text | 必須 |
| `description` | text | 任意 |
| `visibility` | text | `public` / `private` / `limited` |
| `status` | text | `draft` / `confirmed` / `completed` / `cancelled` |
| `display_on_story` | boolean | Story表示 |
| `display_in_timeline` | boolean | Storyタイムライン |
| `display_as_achievement` | boolean | 実績表示 |
| `counts_toward_summary` | boolean | OS HomeやStory上で活動実績数に含めるか |
| `has_financial_value` | boolean | 金額ログか |
| `amount` | numeric(12,2) | 金額ログ時のみ必須 |
| `transaction_type` | text | `revenue` / `expense` / `none` |
| `payment_status` | text | `unpaid` / `paid` / `not_required` |
| `created_at` | timestamptz | SQL側で生成 |
| `updated_at` | timestamptz | SQL側で生成 |

期待される重要制約:

| 制約 | 内容 |
| --- | --- |
| category check | `consultation` / `production` / `product` / `event` / `workshop` / `review` / `profile` / `other` |
| visibility check | `public` / `private` / `limited` |
| status check | `draft` / `confirmed` / `completed` / `cancelled` |
| transaction_type check | `revenue` / `expense` / `none` |
| payment_status check | `unpaid` / `paid` / `not_required` |
| financial amount check | 金額なしは `amount = null` かつ `transaction_type = none`、金額ありは `amount is not null` かつ `revenue` または `expense` |
| unique | `profile_id, source_service, source_record_id` |

## 6. `types/database.ts` との差分表

実DBからは列名のみ確認できたため、ここでは実DB列名、`types/database.ts`、SQL期待定義の差分を整理します。

| 項目 | 実DB列名 | SQL期待定義 | `types/database.ts` | 判定 |
| --- | --- | --- | --- | --- |
| `id` | あり | uuid / SQL生成 | `string` | 列名OK。型はDashboard確認待ち |
| `user_id` | あり | uuid | `string` | 列名OK。型はDashboard確認待ち |
| `profile_id` | あり | uuid | `string` | 列名OK。型はDashboard確認待ち |
| `activity_type` | あり | text | `string` | 列名OK |
| `category` | あり | text + check制約 | `string` | 列名OK。制約は未確認 |
| `source_service` | あり | text | `string` | 列名OK |
| `source_record_id` | あり | text nullable想定 | `string` | 列名OK。nullableは未確認 |
| `occurred_at` | あり | timestamptz | `string` | 列名OK |
| `title` | あり | text | `string` | 列名OK |
| `description` | あり | text nullable | `string | null` | 列名OK |
| `visibility` | あり | check制約 | `"public" | "private" | "limited"` | 列名OK。制約は未確認 |
| `status` | あり | check制約 | `"draft" | "confirmed" | "completed" | "cancelled"` | 列名OK。制約は未確認 |
| `display_on_story` | あり | boolean | `boolean` | 列名OK |
| `display_in_timeline` | あり | boolean | `boolean` | 列名OK |
| `display_as_achievement` | あり | boolean | `boolean` | 列名OK |
| `counts_toward_summary` | あり | boolean | `boolean` | 列名OK |
| `has_financial_value` | あり | boolean | `boolean` | 列名OK |
| `amount` | あり | numeric nullable | `number | null` | 列名OK。型はDashboard確認待ち |
| `transaction_type` | あり | check制約 | `"revenue" | "expense" | "none"` | 列名OK。制約は未確認 |
| `payment_status` | あり | check制約 | `"unpaid" | "paid" | "not_required"` | 列名OK。制約は未確認 |
| `created_at` | あり | timestamptz | `string` | 列名OK |
| `updated_at` | あり | timestamptz | `string` | 列名OK |

注意点:

- `source_record_id` はSQLではnullableですが、既存型では `string` です。
- adapterは `source_record_id: log.sourceId` を必ず入れるため、Phase 4 adapter案としては問題ありません。
- 既存MarketNote保存処理も `source_record_id` を入れてupsertする前提なので、重複防止のためにも必須扱いでよいです。
- 実DBの列名は一致しましたが、型・nullable・default・制約はREST SELECTだけでは未確認です。

## 7. adapter payloadとの比較

| UnifiedActivityLog / adapter | DB期待定義 | 判定 |
| --- | --- | --- |
| `appKey: market_note` | `source_service: marketnote` | 既存互換のためadapterで吸収済み |
| その他 `appKey` | `source_service` | 原則そのまま保存 |
| `eventType` | `activity_type` | OK |
| `amountType: income` | `transaction_type: revenue` | adapterで変換済み |
| `amountType: expense` | `transaction_type: expense` | OK |
| `amountType: none` | `transaction_type: none` | OK |
| `storyEnabled` | `display_on_story` / `display_in_timeline` / `display_as_achievement` | OK。ただし将来は3表示の分離余地あり |
| `deskEnabled` + 金額あり | `has_financial_value: true` + `amount` + `transaction_type` | OK |
| `deskEnabled`なし / 金額なし | `has_financial_value: false` + `amount: null` + `transaction_type: none` | OK |
| `shouldCountTowardSummary(log)` | `counts_toward_summary` | 一律trueではなく初期ルールで判定 |
| `metadata.paymentStatus` | `payment_status` | 金額ログのみ反映、なければ `paid` |

## 8. 実DB確認のためにDashboardで見る項目

Dashboardで以下を確認できれば、本保存前の不確実性をかなり減らせます。

| 確認項目 | 理由 |
| --- | --- |
| project nameが `mikke-os-dev` か | 接続先確認 |
| project refが `.env.local` のURLと一致するか | URL確認 |
| anon keyが同じproject refのものか | 401解消 |
| `activity_logs` の列一覧 | adapter payloadと一致するか |
| `source_record_id` のnullable | 型との差分確認 |
| `counts_toward_summary` のdefault | 活動数集計への影響 |
| `transaction_type` check制約 | `income` を入れない確認 |
| `payment_status` check制約 | `pending` などを入れない確認 |
| 金額制約 | `deskEnabled` 変換の安全確認 |
| unique制約 | upsertの `profile_id,source_service,source_record_id` が使えるか |
| RLS policy | `user_id` と `profile_id` の整合 |
| Data API exposure | RESTで読めるか |

## 9. 本保存前チェックリスト更新

- [x] `.env.local` のURLとanon keyを同じSupabaseプロジェクトのものに揃える。
- [ ] Dashboard上で接続先が `mikke-os-dev` か確認する。
- [x] RESTで `activity_logs?select=*&limit=0` が401ではなくなることを確認する。
- [x] RESTで `activity_logs` の実列名を確認する。
- [ ] DashboardまたはMCPで `activity_logs` の型・nullable・default・制約を確認する。
- [ ] `source_record_id` のnullable / not null を実DBで確認する。
- [ ] `counts_toward_summary` のdefaultを実DBで確認する。
- [ ] unique制約が `profile_id, source_service, source_record_id` か確認する。
- [ ] 金額制約がSQL期待定義と一致しているか確認する。
- [ ] `source_service = marketnote` の既存MarketNote行があるか確認する。
- [ ] `user_id` はAuthユーザー、`profile_id` は `profiles.id` から取得する導線を実装前に確認する。
- [ ] RLSで `profiles.user_id = auth.uid()` と `activity_logs.user_id = auth.uid()` の整合を確認する。
- [ ] 本保存ON/OFFを切り替えられるadapter設定を用意する。
- [ ] まず開発環境でread-only確認、その後1件だけテスト保存する手順を別途決める。

## 10. まだ触らないもの

今回も以下は触らない方針を継続します。

- Supabase本DB
- RLS / policy / constraint
- `app/marketnote/**`
- `lib/activity-log.ts`
- `lib/marketnote.ts`
- `types/database.ts`

## 11. 次に進む場合の最小安全手順

1. Supabase Dashboardで接続先が `mikke-os-dev` か確認する。
2. DashboardまたはMCP権限で `activity_logs` の型・nullable・default・制約・RLSを確認する。
3. `types/database.ts` と実DBの差分を更新する。
4. adapterのpayload比較メモを実DB定義に合わせて更新する。
5. 既存 `createActivityLog()` payload と adapter payload の最終比較を更新する。
6. それでも本保存には切り替えず、保存ON/OFFの設計を先に確定する。
## 12. 2026-07-05 Read-only Definition Follow-up

この追記では、Supabase本保存へ切り替える前の追加確認結果を整理します。
今回も insert / update / delete、RLS / policy / constraint の変更、`types/database.ts` の変更、既存MarketNote保存処理の変更は行っていません。

### Supabase実定義確認メモ

| 確認項目 | 結果 |
| --- | --- |
| Dashboard上の表示名 | ローカル/APIからは未確認。Dashboard画面で `mikke-os-dev` か確認が必要 |
| Project ref | `.env.local` のURLとanon key内refは `nttqpprkqbynxyldbnjs` で一致 |
| REST `activity_logs?select=*&limit=0` | 成功 |
| REST `activity_logs?select=*&limit=1` | 成功。列名は `types/database.ts` と一致 |
| MCP `_list_tables` | 権限なし |
| MCP `_execute_sql` | 権限なし |
| REST OpenAPI | anon keyでは不可。service role要求 |

RESTで確認できた列名は以下です。

| 実DB列名 |
| --- |
| `id` |
| `user_id` |
| `profile_id` |
| `activity_type` |
| `category` |
| `source_service` |
| `source_record_id` |
| `occurred_at` |
| `title` |
| `description` |
| `visibility` |
| `status` |
| `display_on_story` |
| `display_in_timeline` |
| `display_as_achievement` |
| `counts_toward_summary` |
| `has_financial_value` |
| `amount` |
| `transaction_type` |
| `payment_status` |
| `created_at` |
| `updated_at` |

REST SELECTだけでは、型、nullable、default、check制約、unique制約、RLS policy本文は確認できません。
ここはDashboardまたはMCP権限での確認待ちです。

### 読み取り専用で見えた実データ

anonで読める公開行10件から、以下の値を確認しました。
これは「現在見えるデータの値」であり、DB制約そのものの確認ではありません。

| 項目 | 見えた値 |
| --- | --- |
| `category` | `consultation` / `event` / `product` / `production` / `review` / `workshop` |
| `transaction_type` | `none` |
| `payment_status` | `not_required` |
| `source_service` | `item_studio` / `manual` / `market_note` / `marketnote` / `order` / `studio` |
| `visibility` | `public` |
| `has_financial_value` | `false` |
| `counts_toward_summary` | `true` |

重要な注意点:

- `source_service` には、すでに `marketnote` 以外も入っています。
- 実データ上、`market_note` と `marketnote` が混在しています。
- adapterでは `market_note` を `marketnote` に寄せていますが、本保存前に既存DB内の混在をどう扱うか決める必要があります。
- anonで見えている行は公開行に偏るため、金額ログの `transaction_type = revenue / expense` はまだ実データとして未確認です。

### activity_logs制約確認表

以下は `Mikke_OS_Core_MVP_supabase.sql` に基づく期待定義です。
実DBの制約本文は未確認です。

| 制約 | 期待内容 | 実確認状況 |
| --- | --- | --- |
| `activity_logs_category_check` | `consultation` / `production` / `product` / `event` / `workshop` / `review` / `profile` / `other` | 未確認。見えた実データは範囲内 |
| `activity_logs_visibility_check` | `public` / `private` / `limited` | 未確認。見えた実データは `public` |
| `activity_logs_status_check` | `draft` / `confirmed` / `completed` / `cancelled` | 未確認 |
| `activity_logs_transaction_type_check` | `revenue` / `expense` / `none` | 未確認。見えた実データは `none` |
| `activity_logs_payment_status_check` | `unpaid` / `paid` / `not_required` | 未確認。見えた実データは `not_required` |
| `activity_logs_amount_required_when_financial` | 金額なしは `amount = null` かつ `transaction_type = none`、金額ありは `amount is not null` かつ `revenue` または `expense` | 未確認 |
| `activity_logs_source_record_unique` | `profile_id, source_service, source_record_id` | 未確認 |

### RLS確認メモ

RLS policy本文は未確認です。
ただし、anon keyで公開行10件が読めたため、公開Story向けのselect policyが存在する可能性は高いです。

| 操作 | 期待policy | 実確認状況 |
| --- | --- | --- |
| select public | `visibility = public and display_on_story = true` | anon RESTで公開行が読めた。ただしpolicy本文は未確認 |
| select own | `auth.uid() = user_id` | 未確認 |
| insert own | `auth.uid() = user_id` かつ `profiles.id = activity_logs.profile_id` / `profiles.user_id = auth.uid()` | 未確認 |
| update own | `auth.uid() = user_id` かつ `profiles.id = activity_logs.profile_id` / `profiles.user_id = auth.uid()` | 未確認 |
| delete own | `auth.uid() = user_id` | 未確認 |

本保存前に見るべきRLS観点:

- insert policyに `profiles.user_id = auth.uid()` の確認が入っているか。
- update policyに `USING` と `WITH CHECK` が両方あるか。
- `TO authenticated` だけの広すぎるpolicyになっていないか。
- public Story向けselectが、非公開ログや金額ログを外部公開しない条件になっているか。

### adapter payloadとの最終差分表

| 項目 | adapter案 | 実DB / 期待定義 | 判定 |
| --- | --- | --- | --- |
| 列名 | `SupabaseActivityLogInsert` | RESTで見えた列名と一致 | OK |
| `appKey: market_note` | `source_service: marketnote` へ変換 | 実データには `market_note` と `marketnote` が混在 | 要方針確認 |
| 他アプリの `appKey` | 原則そのまま `source_service` | 実データに `item_studio` / `order` などあり | OK |
| `eventType` | `activity_type` | 列あり | OK |
| `amountType: income` | `transaction_type: revenue` | SQL期待定義は `revenue` / `expense` / `none` | OK。実制約は未確認 |
| `amountType: expense` | `transaction_type: expense` | SQL期待定義と一致 | OK。実制約は未確認 |
| `amountType: none` | `transaction_type: none` | 実データで `none` を確認 | OK |
| `storyEnabled` | `display_on_story` / `display_in_timeline` / `display_as_achievement` | 列あり | OK。ただし将来は3表示を分ける余地あり |
| `deskEnabled` | `has_financial_value` + `amount` + `transaction_type` | 列あり | OK。金額制約は未確認 |
| `countsTowardSummary` | `shouldCountTowardSummary(log)` | 列あり。公開行では `true` を確認 | OK。金額ログの実値は未確認 |

### 本保存前チェックリスト更新

- [x] `.env.local` のURLとanon keyを同一project refに揃える。
- [x] RESTで `activity_logs?select=*&limit=0` が通ることを確認する。
- [x] RESTで `activity_logs?select=*&limit=1` が通ることを確認する。
- [x] RESTで `activity_logs` の列名が `types/database.ts` と一致することを確認する。
- [x] RESTで公開行に `marketnote` 以外の `source_service` が存在することを確認する。
- [ ] Dashboard上の表示名が `mikke-os-dev` か確認する。
- [ ] Dashboardでproject refが `nttqpprkqbynxyldbnjs` か確認する。
- [ ] DashboardまたはMCPで各列の型を確認する。
- [ ] DashboardまたはMCPでnullable / not nullを確認する。
- [ ] DashboardまたはMCPでdefault値を確認する。
- [ ] DashboardまたはMCPでcheck制約を確認する。
- [ ] DashboardまたはMCPでunique制約を確認する。
- [ ] DashboardまたはMCPでRLSが有効か確認する。
- [ ] DashboardまたはMCPでselect / insert / update / delete policy本文を確認する。
- [ ] `profiles.user_id = auth.uid()` を前提にしたinsert/update policyか確認する。
- [ ] `market_note` と `marketnote` の混在を本保存前にどう扱うか決める。
- [ ] 既存MarketNote保存処理を変更する前に、adapter保存ON/OFF設計を確定する。
