# 共通課金：見積・同意・申込み台帳のローカル実装

状態: ローカル実装・検証。本番課金完成ではない。

## 今回進めた範囲

- 共通v0 security shellに続き、サーバーが保存した見積に対する明示同意→永続申込み予約→provider結果保存の処理を追加。
- `checkout.ts`: v1の候補requestを検証、本人/対象/現行policyを再確認、成功保存後だけ許可URLを返す。未設定・曖昧な結果・古い見積からpaid権利を作らない。
- `store.ts`: 下記5つのservice-only RPCへのadapter。秘密を保持せず注入transportを用いる。未知envelope、状態、途中abort、rawエラーは安全停止する。
- `20260831180143_platform_billing_checkout_ledger.sql`: CLI生成の新migration。`platform_billing_private`にscopes/quotes/attemptsの3表。RLS、ブラウザ権限なし、service_role直接DML/DELETE/TRUNCATEなし。公開schemaの狭い5関数だけservice_role EXECUTE。

## RPC

1. `platform_billing_quote_save(uuid,jsonb)`
2. `platform_billing_quote_get(uuid,text)`
3. `platform_billing_attempt_reserve(uuid,text,jsonb)`
4. `platform_billing_attempt_mark_ready(uuid,uuid,text,text)`
5. `platform_billing_attempt_mark_uncertain(uuid,uuid)`

サーバーは呼出前に実本人と現在のowner、既存有料契約、現行承認条件・価格を照合する。service-role引数をブラウザ由来ownerとして使わない。既存app table/RPC/paid/trial/会員権利は変更しない。

## 重複・失敗の扱い

- scope→quote→attemptの順でlock。新規対象resource nullも同owner/productの同時申込みを一旦1つに制限する。
- quoteは同内容再送だけ許可、変更不可。requestId再使用で内容が変われば拒否。
- 同じ申込みは同じattempt/key。別requestIdでも同じscopeに未解決attemptがあれば拒否。
- providerへの初回呼出はreserveのcreated=trueだけ。既存prepared/uncertainは確認中とし再createしない。
- provider結果が保存できない時はredirectしない。prepared/uncertainを自動期限削除せず、後続reconciliationで扱う。
- ready再試行はprovider retrieve結果のID/hashを再照合。ready結果の上書き・uncertainへの降格なし。
- provider keyはopaque attempt UUIDを元に作り、本人/メール等を含めない。現段階はcs_testだけ。

## 現在の証拠

- HTTP 218 checks、quote 73 checks、checkout execution 29 checks、store 45 checks: 偽transport/providerで成功。
- 全体lint exit0。最終webpack production buildもexit0（静的生成対象142ページ）。接続不能の127.0.0.1:9とfake keyをprocess envに指定し、実Supabase鍵は使用していない。既知themeColor警告のみ。本番動作の証明ではない。
- 実Postgres17.6の別DBで実store/checkoutコードと接続。quote保存/再保存/get、reserve/mark_ready、再送時create1/retrieve1、quote1/attempt1/ready1、別request同scope拒否、quote改変拒否を確認。決済先は偽物。
- 本番のSupabase/Data API/JWT、Stripe sandboxサービス、Webhook、権利付与の証拠ではない。
- 最終SQL負試験sentinel `platform_billing_checkout_ledger_test_ok` 成功。ROLLBACK後catalog等10分類の差分0、private schema0/auth fixture0。migration SHA256 `8DFC9357A26F364304C522D4335C343FCBB6499AA36E06EA34C03C36183C1A90`。
- 実2接続reserve競合でcreated=true/false各1、同attempt/key、scope/quote/attempt各1。2接続目は先行transactionを待って再利用。
- 検証専用containerは合成2DBごと削除し、該当0件を確認。キャッシュ済みimageと本番は無変更。
- `scripts/platform-billing-isolated-check.mjs`: network none/ports noneの明示Dockerだけ、SQL transaction/rollbackと残存比較用。
- `scripts/platform-billing-runtime-check.mjs`: 同Docker内の別合成DBだけ、実TS→SQL統合試験用。所有者が試験後コンテナ全体を削除する。

## 未完了・次工程

既存owner/既存paid契約の現在値照合と全経路の原子的作成権消費、承認policy/価格registry、実server transport、Stripe test-mode provider、署名イベント台帳/逆順通知/失効、reconciliation、本人画面の最終同意接続は未完了。v1はまだHTTPへmountしない。v0 checkoutはdisabled。

本migrationは本番未適用。scopeを永続1件に制限する準備台帳なので、一般の更新/解約/再開を完成済みと扱わない。未知な価格/日程/規約を作って接続しない。既承認の無料終了後自動課金なしを維持する。

課金条件提案は法務の `2026-09-01_legal_billing_approval_onepager_proposal.md` で未承認のまま管理する。実請求/本番DB/公開は別承認。origin/masterの共通ルール未収録gapは継続。
