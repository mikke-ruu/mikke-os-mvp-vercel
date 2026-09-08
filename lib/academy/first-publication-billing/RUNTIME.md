# 初公開制度の決済runtime

2026-09-08。既存trial、paid checkout、内部付与を変更せず、新制度へ明示申込したHQだけを対象にする接続候補。実Stripeや顧客DBへの書込み、環境設定、デプロイは実施していない。

## API

全てPOST。利用者APIは同一origin、非匿名getUser、HQ owner、実本文4096 byte以内、JSONの厳密キーを検証する。応答はprivate/no-store。

見積metadataは `setup_reserve.quote` の元quote snake投影から読む。`plan_key/plan_name/discount_description/consent_revision` を必須とし、confirmの `planKey/planName/discountDescription/consentRevision` を含む全12項目が元証跡と一致しなければ成功を返さない。値の推測や定数補完はしない。DB metadata差分 dcdf8e3 と後続 reserve.quote 返却が必要。

- `/academy/api/first-publication/setup`: `{headquartersId,quoteId}` → `{attemptId,setupUrl}`。全IDはUUID。サーバーが固定attempt、専用Stripe customer、hosted Checkout mode=setupを作る。課金subscriptionは作らない。
- `/academy/api/first-publication/setup/confirm`: `{headquartersId,quoteId,attemptId}` → `{paymentPreparationId,verified:true,quote}`。DB保存sessionを再取得し、SetupIntent succeeded、customer、HQ、owner、quote、modeを検証してproofを保存する。quoteは元の見積DTOで、再発行しない。
- 戻り先は `/academy/h/{DB由来HQ}/manage/settings?billing=setup_return&quoteId={DB由来quote}&attemptId={DB由来attempt}`。取消戻りは `setup_cancel`。呼出者からreturn URLを受け取らない。返り先への到着だけで成功と判定しない。
- `/academy/api/first-publication/worker`: scheduler専用Bearer secret、body `{}`。1回に初回outboxを最大1件、なければ更新jobを最大1件処理する。失敗は503であり成功扱いにしない。
- `/academy/api/first-publication/webhook/stripe`: raw HMAC-SHA256署名、5分窓、constant-time比較、実本文262144 byte上限。専用DB source contextとprovider再取得から判断し、初回invoiceとsubscription作成時0円invoiceは更新権利へ変換しない。次月invoiceは月末snapshot見積、price、顧客、subscription、期間を照合して専用subscription_event RPCへ送る。

## 課金処理

支払方法だけでは時計は開始しない。公開transactionが確定した168時間の期限を読む。公開直後synchronize_trialはSetupIntent再確認だけで非課金のtrial_readyを記録する。

start_paidはDBの受付watermarkと取消優先・leaseを通過してから実行する。全provider操作は永続checkpoint、固定idempotency key、lease fencingを持つ。ID不明で23時間を越えたoperationを再POSTしない。外部成功とDB commitは同じtransactionではない。

初回は専用invoiceをauto_advance=false、固定JPY総額、既存pending item・割引・税の自動混入なしで作成する。finalize前に総額を検査し、明示pay後のinvoice.paid_atが有料期間の起点。JSTの1暦月後、月末丸めを期間末にする。

後続subscriptionはその期間末をanchorにし、prorationなしで作る。create時にはcancel_at=期間末を設定し、続くsubscription_holdでpause_collection=keep_as_draftとcancel_at解除を同時適用して再確認する。hold設定に失敗しても翌月自動請求されない。paid finishは新sourceの正規bridgeへ送り、setup sessionを旧paid checkoutの証明に偽装しない。

更新は既存月末snapshotから承認見積を取得する。renew_priceはprorationなしで既存subscription itemのpriceを変更し、currency/quantity/priceを再取得確認する。更新請求も常時keep_as_draftで保持する。renew_payは当期の一意なinvoiceを選び、既発行draftのlineが古ければ未finalizeのlineだけ承認priceへ修正して再取得する。金額・期間・priceが一致しなければfinalize/payしない。確定済invoiceの誤料金は自動修正しない。100件を超えるinvoice一覧や複数候補は運用確認へ止める。

## 必要設定

既存: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY`（またはSERVICE_ROLE_KEY）, `STRIPE_SECRET_KEY`, `PLATFORM_BILLING_STRIPE_MODE`。

新規: `ACADEMY_FIRST_PUBLICATION_API_ENABLED=1`, `ACADEMY_FIRST_PUBLICATION_APPROVAL_ID`, `ACADEMY_FIRST_PUBLICATION_STRIPE_API_VERSION=2025-02-24.acacia`, `ACADEMY_FIRST_PUBLICATION_SETUP_SUCCESS_URL`, `ACADEMY_FIRST_PUBLICATION_SETUP_CANCEL_URL`, `ACADEMY_FIRST_PUBLICATION_PRICE_IDS_JSON`（small/medium/large→既存承認Stripe price）, `ACADEMY_FIRST_PUBLICATION_WORKER_SECRET`（32文字以上）, `ACADEMY_FIRST_PUBLICATION_WEBHOOK_SECRET`。

両setup URLの設定値は `https://app.mikke-os.com/academy/settings` または正規mikke-os.comの同pathのみ。実際の返り先はHQ付きpathへサーバーで構築する。Stripe API版はline-updateを一次資料とfake HTTPで確認したAcaciaに固定し、任意の未検証版は拒否する。既存priceの新規購入はしない。

ローカルprocessには上記secret設定が無く、共有checkoutの.env.localではpublic Supabase設定名のみ確認した。値は出力していない。統制は別途Vercel本番で既存Stripe/Supabase/platform設定名を確認しているが、新ACADEMY_FIRST_PUBLICATION変数は未設定と報告している。

## DBと運用の未完了ゲート

DB担当の0293841、2a31d75とplatform bridge c4b7a55が必要。初回paidの保存先は `academy_first_publication_paid_bridge`、その他outcomeは `academy_first_publication_outbox_finish`。callback成功の再送でも元quote DTOを返す。全routeの実Auth/実RLS/実DBと実Stripeの結合テストは未実施。

取消受理がdeadline以前でも未commitでworkerから不可視になる競合は未解決。DBはverified receipt watermark無しでstart_paidを拒否する。受理時刻をlock後に置き換えたり、未承認graceを設定して回避しない。ここが解決するまで初回実請求のactivationは禁止。

既存月末snapshot SQLはcapture RPCを定義するがproduction scheduleを作らないことがコメントされている。リポジトリ調査では実scheduler接続を確認できない。専用webhook登録、workerの定期POST、月末snapshot生成schedule、失敗・未処理jobの運用監視、環境設定、policy有効化は統制の本番ゲート。設定不明を稼働済みと扱わない。

## 検証

- `node scripts/academy-first-publication-billing-check.mjs`: 初期adapterの25件。
- `node scripts/academy-first-publication-runtime-check.mjs`: hosted setup/HTTP/初回課金の17件。
- `node scripts/academy-first-publication-webhook-check.mjs`: 署名と再照合の14件。
- `node scripts/academy-first-publication-renewal-check.mjs`: 更新priceとdraft invoice再確認の9件。
- `node scripts/academy-first-publication-quote-check.mjs`: 元quote metadataの不変受け渡しと欠落拒否の12件。

上記はfake HTTP/RPCのみ。所有TSのstrict型検査も行う。実Auth、実Stripe、多接続のDB競合、本番公開の証拠にはならない。

## 一次資料

- [Checkout setup](https://docs.stripe.com/api/checkout/sessions/create)
- [Invoice creation](https://docs.stripe.com/api/invoices/create)
- [Invoice payment](https://docs.stripe.com/api/invoices/pay)
- [Billing cycle anchor](https://docs.stripe.com/billing/subscriptions/billing-cycle)
- [Pause collection](https://docs.stripe.com/billing/subscriptions/pause-payment)
- [Acacia invoice line update](https://docs.stripe.com/api/invoice-line-item/update?api-version=2025-02-24.acacia)
- [Webhook delivery and verification](https://docs.stripe.com/webhooks)
- [Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser)

Supabase changelog.mdはweb toolがcontent-type非対応だったためHTML changelogを読み、現行Auth/RPC実装に該当する変更を確認した。サービスRPCのEXECUTEはDB側でservice_roleだけへ付与する。
