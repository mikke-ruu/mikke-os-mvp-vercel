# 初回公開制度の共通課金台帳への接続候補

専用worktreeからのローカル候補です。本番DB、Stripe、実利用者、cron、policy activationは変更していません。

## 発生元を分ける設計

`subscriptions`に`origin_kind`を追加しました。既存Checkoutは従来のattempt FKを維持します。新制度は明示enrollmentのHQ FKを使い、排他制約で両方またはどちらもない状態を拒否します。Setupを支払済みCheckoutとして登録せず、初回standalone invoiceの検証証拠を別のimmutable台帳へ保存します。既存creation entitlementを新たに発行しません。

`academy_first_publication_paid_bridge(event_key,lease_token,result)`が初回proof、subscription、既存outbox_finishを同じtransactionで処理します。既存runtimeのowner→HQ→enrollment→outboxロックを使い、失敗は全部rollbackします。同じ結果の再送は成功、異なる結果は競合です。invoice_create、subscription_create、subscription_holdの保存済みprovider IDと本人のverified setupを照合します。dispatch_enabledとverified receipt watermarkの既存ゲートは残しています。

resultの正確なキーは `outcome, provider_invoice_id, provider_subscription_id, provider_customer_id, amount_yen, plan_key, paid_at, period_end, provider_result_hash` です。初回金額は公開時の固定額、期間は実支払成功から既存JST月加算関数で1か月とします。provider APIの再取得・署名検証は呼出側の責任です。DBへブラウザの結果を直接渡してはいけません。

## 読み取りと継続

- `academy_first_publication_subscription_context(sub_id)`は`kind=academy_first_publication|legacy|unknown`を返します。新制度はHQ、owner、customer/subscription、初回invoice、initial_amount_yen、plan_key、paid_at、current_period_start/end、status、cancel_at_period_end、policy_versionを含みます。
- `academy_first_publication_invoice_context(invoice_id)`は初回invoiceを識別します。初回保存前は`academy_first_publication_pending`とowner/HQ/customer/initial_amount/policy/event_keyを返します。不明を0件や無契約へ変換しません。
- 共通resource selector、status、portal、access windowから新sourceを読めます。paid_windowsは既存finishとの互換用として残りますが、bridge後の利用権は共通subscriptionから読みます。
- 旧sourceと新sourceが同じHQへ併存する場合は選択を拒否します。既存者の自動移行や再契約をこの候補では行いません。

## 更新料金とworker契約

`academy_first_publication_renewal_quote(sub_id,period_start)`は既存月末snapshotの`charge_price_yen`を保存したimmutableなquoteを返します。戻り値は`price_id`（証跡UUID）、`snapshot_id`、`amount_yen`、`plan_key`、`period_start`、`period_end`です。現在人数から独自再計算しません。21/51人到達時の通知据置ルールは既存snapshot計算のままです。初回固定金額・planは更新しません。

サービス専用worker RPC:

- `academy_first_publication_renewal_claim(p_worker_id,p_lease_seconds=60)` → nullまたは`event_key,lease_token,kind,provider_subscription_id,provider_customer_id,headquarters_id,period_start,period_end`。
- `academy_first_publication_renewal_dispatch_check(event_key,lease_token)` → `allowed,reason`。
- `academy_first_publication_renewal_checkpoint(event_key,lease_token,step,provider_id=null)` → 永続operation_key、provider_id、started_at、blocked。stepはprice_update / invoice_select / line_update / finalize / pay。未知の外部結果が23時間を超えたら再作成を止めます。
- `academy_first_publication_renewal_finish(event_key,lease_token,result)` → finished / already_finished / attention。price_readyはquoteのprice_id必須。paidはinvoice ID、amount、period_start/end、paid_atを保存します。price_id/snapshot_id追加も許容します。

renew_price完了で期限時のrenew_payを作ります。実請求の権利更新は専用の検証済みevent RPCに分離しています。webhookが先着した場合も同じinvoice/amount/periodならworkerの完了再送を受け付けます。providerではsubscriptionを`keep_as_draft`でholdし、quote不足でも旧金額が自動請求されないことが必須です。このSQLはproviderのhold状態を実測しません。

`academy_first_publication_subscription_event(sub_id,result)`の正確なキーは`provider_event_id,provider_result_hash,provider_customer_id,event_kind,projected_status,period_start,period_end,cancel_at_period_end,occurred_at,provider_invoice_id,amount_yen,currency`です。event_kindはinvoice_paid / invoice_failed / subscription_state。state以外のcancel_at_period_endはnullです。invoice_paidは初回invoiceを拒否し、更新quoteとの金額・期間一致を検査します。初回0円invoiceをここへ送ってはいけません。一般のplatform event RPCは新sourceを拒否します。

## 月末snapshot入口

`academy_first_publication_capture_due_snapshots(p_limit=50)`は直近の完了月だけを扱います。明示enrollmentと有効policyのHQを限定列挙し、既存`academy_capture_month_end_billing_snapshot`を呼びます。価格・除外・据置計算を複製していません。既存未登録HQには適用しません。cronやextensionはインストールしません。既存capture内部の`auth.role()`は変更していないため実service JWTでの統合確認が必要です。

## 検証と残件

`node supabase/tests/academy_first_publication_platform_bridge.pglite.mjs`はPGlite 0.5.8で実際の既存billing migrationsと候補を読み込みます。Academyの周辺テーブルとAuthは最小fixtureです。既存subscription契約SQLはBEGIN/ROLLBACKで回帰します。初回proof、取消・watermark拒否、transaction rollback、重複、偽Checkout非生成、権限、契約status/portal、更新snapshot、worker、通知順序、取消、90日のread終了を検証します。

正式`access-client.ts`のdecoderもテストで読み込みます。統合checkoutでは既定の`lib/academy/first-publication/access-client.ts`を使います。このDB専用worktreeでは`ACADEMY_ACCESS_CLIENT_PATH`にcore worktreeの同ファイルを、`ACADEMY_TYPESCRIPT_PATH`に既存TypeScriptモジュールの場所を指定します。clientの複製や緩いテスト用decoderには置き換えません。

共通subscriptionの内部statusは`ended`ですが、公開access DTOの終了phaseは正式client契約の`expired`です。本人権限で公開RPCから読んだ終了後DTOを正式decoderとRPC adapterへ渡す回帰を追加しました。`ended`や未知phaseをclientで許可する変更はしていません。

このDTO修正後の時刻順fresh replayは60 checks PASS、exit 0です。正式client読み込みを含めて終了後readが成功し、未知phaseを拒否することを確認しました。

2026-09-08の最終ローカル実行は55 checks PASS、exit 0でした。既存subscription契約SQL一式はこのうち1つの回帰グループとして数えています。新scheme限定snapshot捕捉と再実行時0件も含みます。

統合時の順序確認として対象13本をファイル名の時刻順にsortし、空のPGliteへ再適用して55 checks PASSを確認しました。順序はatomic 070613 → runtime 084409 → bridge 090249 → delegation 091030です。bridgeの作成時に必要なlock_outboxは084409で定義済みです。subscription_holdは文字列による照合であり、091030によるstep制約追加後に初回支払処理で使います。verified receipt watermarkも091030が既存dispatch_checkを置き換えて実行時に検査します。bridgeのファイル時刻変更は不要です。全本番migrationの再現ではなく、周辺Academy依存を最小fixtureにした対象13本のfresh replayという検証範囲は変わりません。

未完了:

- 実Supabase全schema/RLS/Auth、advisors、多接続での取消受付と請求の競合。
- verified receipt watermarkを安全に生成する入口。本候補もactivationはfalseのままです。
- 実providerの再取得検証、held subscription、月額更新・失敗・取消通知、実cronの接続。
- 新sourceの破壊的匿名化worker。90日の読み取り期限は接続しましたが、旧workerはattempt/entitlement前提のため新sourceを処理できません。新course guardを含む隔離検証なしに匿名化完了とは扱いません。
- 再契約、新ownerへの契約移管、過去月のsnapshot自動補填。

設計根拠はSupabaseの[Database Functions](https://supabase.com/docs/guides/database/functions)です。private definer本体、空search_path、service限定invoker wrapper、直接table権限撤回を適用しました。changelog.mdはcontent-type制限により取得できませんでした。
