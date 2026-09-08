# 初公開制度の決済接続境界

`adapter.ts` はサーバー専用の依存注入adapter。既存の契約処理やUIからは未接続。本番の新制度や実課金が完成した状態ではない。

## 呼び出し契約

- `prepare(enrollmentId)` は支払方法準備だけを行う。契約権限、同意、見積もり、本人利用履歴をサーバーで検証して保存した新制度Enrollmentのみ渡す。クライアント入力からEnrollmentを組み立てない。
- `synchronize(enrollmentId)` は公開transactionが保存した初回公開時刻と168時間後の期限を読む。公開失敗や下書き化を時計の起点にしない。
- `reconcileVerifiedNotification(enrollmentId)` は署名検証とprovider IDの永続対応検索を済ませた入口から呼ぶ。通知の状態や時刻を信用せずproviderの現在値を読む。
- Repositoryは公開処理、取消受付、決済workerと同じHQ単位の永続直列化を提供する。`save` は確実に永続化し、外部処理失敗で取消受付を巻き戻さない。actor認証とHQ権限はこの内側のserver repositoryで再検査する。長時間外部I/O中にロックを持つ実装はタイムアウト設計が必要。
- Policyは料金そのものを決めず、承認記録、適用資格規則、価格規則、期限同時刻の取消条件を要求する。fixtureの値は本番承認ではない。未設定は拒否する。

## 重要な未接続部分

本番Repository、SetupIntent provider、非課金予約provider、最初の請求dispatch、実通知の入口は未実装。`ensureHeld` は自動請求を絶対に行わない契約であり、Stripe Subscriptionへそのまま置換しない。取消受付と初回請求の直列化、実際の支払成功時からの有料期間、期限超過の利用権、公開失敗後の支払方法保存方針を確定してから接続する。Provider操作の冪等性はproviderの24時間キー保持だけに依存せず永続操作台帳で保証する。

既存 `lib/billing/platform/stripe.ts` のcheckoutはsubscriptionの即時申込を扱う。新制度の支払方法準備や初回起算へ流用していない。既存trial/paid/internal grantへ呼び出すと新制度検査で拒否する。解約後に遅れて支払済みが届く場合はreviewにし、返金や請求取消を自動実行しない。

## SetupIntent HTTP transportとcoreへの接続

`stripe-setup.ts` は注入fetchによるSetupIntent作成/GET検証を実装する。createは未準備を返し、本人による支払方法登録の後、verifyCompletedがcustomer、HQ、owner、quote、mode、scheme、succeededを確認する。実Stripe呼出しはしていない。署名済み通知または認証済みownerの確認route、永続attempt台帳、client secretを当人だけへ渡すUIは未接続。core `paymentPreparation()` にはverifyCompletedの証明をサーバー保存して渡せる。

core `RecordState` の headquartersId/firstPublishedAt/paymentPreparationId/cancellationAcceptedAt はadapterの hqId/publishedAt/preparedId/cancellationReceivedAtへ対応する。追加で安定enrollment ID、customer/price ID、初回見積もり期限、provider ID/状態を永続管理する必要がある。coreのoutbox keyを永続処理台帳で重複排除してsynchronizeを呼ぶ。core phase=trialing とadapter status=heldは同義ではない。heldだけで本番の課金準備完了を表示しない。coreのowner→HQロック順と同じrepository実装が必要。

Stripe transportのensureHeldとdispatchFirstChargeは未対応エラーで停止する。期限時の自動請求や取消優先を保証しないままSubscriptionを作成しない。上記「SetupIntent provider未実装」は全体接続の意味で、HTTP部分のみ今回追加した。

## 一次資料確認（2026-09-08）

- [Stripe Setup Intents](https://docs.stripe.com/payments/setup-intents): 支払方法保存と支払いを区別。
- [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests): 同一キーは同一結果を返すが24時間以降のキー削除に注意。
- [Stripe webhooks](https://docs.stripe.com/webhooks): 署名検証、重複、順不同、現在リソース再取得を考慮。
- [Stripe subscription trials](https://docs.stripe.com/billing/subscriptions/trials): trial終了で請求書生成が進むため、期限同時刻のアプリ取消優先をtrial_end設定だけで保証したとは扱わない。

`node scripts/academy-first-publication-billing-check.mjs` はfake repository/providerのみを使う。課金実行、DB/RLS、実Stripe、実Auth、本番公開の証拠にはならない。
