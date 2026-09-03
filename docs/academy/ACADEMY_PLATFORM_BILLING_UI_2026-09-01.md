# Academy利用料 UI / read adapter v0

## 今回の目標と境界

2026-09-01の明示方針で、招待制1〜3本部pilotを完成条件にする方針は撤回。
メニュー非掲載を保ち、URL→本人登録→契約/決済→利用開始→請求確認/変更/解約を目標にする。
本番の旧gateは承認済みreplacementの反映まで維持する。

- base: origin/master `bc195d657d6bf37146ca2ccf8501db1cac9273cf`（fetch確認）。
- `docs/共通ルール.md`はremote未収録。共有checkout同文書を暫定参照、変更なし。
- 受講料Payment Link/webhookはAcademy月額利用料ではない。構築コース購入代とも分離。
- 既存 `lib/academy/billing.ts`, `pricing.ts`, `trial.ts`, 本部作成gate、HQ契約/test実装、Community-owned pathsは変更しない。

## ローカルslice

`/academy/billing`はdevelopment限定。productionは`notFound()`、force-dynamic。
実データ・決済・メール・DB接続なし。表示確認用state切替は本番に出さない。
既存AcademyShell/AuthGateへ未接続であり、認証済み本番の完成画面ではない。
共通メニュー・ホームページ・既存導線へリンクを追加しない。

- `AcademyPlatformBillingPanel`: 受講料/構築代と別の利用料、契約状態、本部準備、請求予定と月末料金記録を表示。
- 金額nullは「未確定」。人数記録がないとき0名扱いしない。snapshot適用額をinvoiceへ転記しない。
- 構築購入確認、月額契約、本部利用権を分離。paid/creation consumedから本部利用可を推定しない。
- 7日/カード不要/自動課金なし/非公開下書き限定/期限後閲覧のみを既承認として表示。
- 現sliceの申込/請求履歴/支払方法/解約ボタンは常にdisabled。API許可actionがあっても未確認のCheckoutを実行しない。

## 共通課金接続契約

正本は共有 `2026-09-01_platform_billing_ui_contract_v0.md`。共通API/DB/provider/利用権発行は統制所有。
Academy read adapterだけを先行作成し、共通APIのstubは作らない。

`readAcademyPlatformBillingStatus(resourceId, { getAccessToken, fetch }, signal)`:

- 固定相対GET `/api/billing/platform/status?product=academy_platform[&resourceId=UUID]`。
- 呼出ごとに既存認証からtokenを取得。未取得はfetch前に停止。cookie-only受理なし。
- `Authorization: Bearer`、`cache:no-store`、`credentials:omit`、`redirect:error`。
- tokenの独自保存/URL埋込/log出力なし。自動再送なし。
- 呼出元はuser/HQ変更時にAbortし、旧responseを破棄する。本人/HQの最終認可はserver必須。
- v0のversion/product/resourceId/key/state/typeを検査。追加/未知DTOと未知noticeCodeは安全停止。
- 統制shared contracts.ts（2026-09-01読取）の6 noticeCodeを日本語allowlistへ投影。非ready/notice時のaction混在、非canonical日時・planKeyは拒否。
- API未導入404、未知状態、未設定/条件未決、JSON/通信失敗はunavailable。401は再ログイン案内。
- 状態projectionは権限の証拠にならない。`owner`は表示対象の型名であり認証ではない。
- v0は請求金額を持たないためnextInvoiceはnull。本部準備/購入確認/snapshotも別の確認済み情報を統合するまで未確認。

## owner loader（ローカル実装・route未接続）

`platform-billing-loader.ts`と`AcademyPlatformBillingLoader.tsx`を追加。
本人user.id/URLの本部ID/guest/auth/transportごとに独立storeを生成し、render時点で旧scopeの表示を使わない。
認証eventでは同期で表示を破棄・Abortし、Auth callback外で再取得。毎回getSessionの本人ID/anonymousを照合してBearerを渡す。
getSessionはtoken取得用であり認可の証拠にはしない。実APIのgetUser/所有照合が必要。
世代番号、Abort、15秒timeout、disposeにより古い/遅いresponseを捨てる。profileや購入情報、独自storageは使わない。
Supabase公式onAuthStateChange: https://supabase.com/docs/reference/javascript/auth-onauthstatechange
changelog.mdはweb content-type失敗・shell接続不可のため取得未了。SDK変更/更新なし、既存getSession/onAuthStateChange形状のみ使用。
現時点のfixture pageと本番routeには未接続。fake auth/fetchでのみ検証し、実token/DB/課金通信はしていない。

## 次に必要な接続（未実装）

1. 統制の正式shared decoder・認証/請求権限付きstatusと合わせる。
2. 実装したloaderを既存AuthGateの内側へ接続（user.id、既存supabase.auth）。最終共有APIとの結合は別gate。
3. owner用snapshotを明示HQで取得し、charge_month/適用額と次回invoiceをserver照合。
4. 今回/次回金額・日付・規約同意を含む最終申込確認契約。price/quantity/owner/returnURLはserver固定。
5. Checkout/Portalは統制server発行URLのみ。戻りqueryからpaidや作成権を付けない。
6. 新HQは確認済み支払/権利→本人createで原子消費。既存trial→paidと構築購入適格性を混同しない。

月末snapshotには21/51段差の猶予がある。実人数をそのままStripe quantityに入れるだけでは適用額と不一致になり得る。
統制で請求日/猶予/通知/再試行/解約返金/失敗時利用保持を確定後、snapshot照合と冪等provider処理を実装する。
既存承認価格を変更しない。初回人数・初回開始日・新規本部数・購入claimはユーザー条件確認が必要。

## 検査コマンド

`node scripts/academy-platform-billing-ui-check.mjs`: DTO負試験、SSR表示、購入/月額/作成権の分離、GET偽transport/tokenなし/HTTP失敗/Abort、production guard。
`node scripts/academy-billing-snapshot-check.mjs`: 既存人数料金契約の回帰。
`npm run lint` / `npm run build`: 型・production build。

SQL/実JWT/Stripe/請求/本人本番E2Eはこの検査に含まれない。DB変更・push・PR・deploy・一般掲載は別承認。
