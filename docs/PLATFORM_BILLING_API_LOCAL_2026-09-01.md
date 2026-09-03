# 共通運営課金API：ローカル第一スライス

## 状態

- base: origin/master `bc195d657d6bf37146ca2ccf8501db1cac9273cf`
- branch: `codex/platform-billing-20260901`
- Academy/CommunityのURLから契約して利用開始する共通基盤。メニュー非掲載を維持する。
- APIの認証・入力・所有境界とサーバー見積/同意の純粋検証を実装した。実課金完成ではない。
- 本番DB/Stripe鍵/実請求/push/PR/deployは変更なし。ユーザー回答待ちで止める工程ではない。

## 接続点

- `lib/billing/platform/contracts.ts`: v0の正確な公開型、入力/戻り値検証。
- GET `/api/billing/platform/status?product=academy_platform|community_platform&resourceId=<UUID>`。作成前はresourceId省略。
- POST `/api/billing/platform/checkout`: product/resourceId/planKey/requestIdのみ。v0は最終同意契約を含まないので常に決済を止める。
- POST `/api/billing/platform/portal`: product/resourceId/requestIdのみ。実provider未接続で利用不可。依存注入による偽試験だけ成功経路を検証。
- Bearerのみ。毎リクエストのgetUserで検証。匿名Auth拒否。リソースありは本人ownerをuser-scoped queryで再確認。staff/受講者/会員から契約ownerを推論しない。
- POSTは許可Origin必須、cross-site拒否、JSON 4KiB上限、通信中断と10秒期限を反映。no-store、安全なエラーcodeのみ。
- `PLATFORM_BILLING_API_ENABLED=1`は認証経路の有効化だけ。設定しても実課金や作成権は有効にならない。通常は未設定のままとする。
- dev Originは明示的な`PLATFORM_BILLING_LOCAL_ORIGIN`のみ。Preview Originの自動許可なし。
- 契約台帳未接続なのでstatusはnot_configured/subscription null/creation none/actions空。実paid/ownershipを上書きしない。
- Academy adapterは非null noticeCodeを停止扱いにする現状。安全な準備中表示であり請求成功ではない。共通型導入時に安全code対応を揃える。

## 見積・同意（HTTPへ未接続）

`quote.ts`のvalidatePlatformBillingQuote/Consentは、サーバーが保管/取得した見積と現行承認policyを照合する純粋関数。本人/商品/本部/プラン/申込ID、税込JPY今回・次回総額/日付、販売者、規約類の版、期限、明示同意を確認し、複製してfreezeした結果を返す。

ブラウザから見積全体やexpectedを受けて権威あるものとして使ってはいけない。現在のvalidatorは認証/価格確定/原子的台帳/永続冪等性/Stripe決済/権利付与を実行しない。v0 checkoutへ黙って項目追加せず、最終確認DTOは後続versionとして接続する。

Academy7日お試しとCommunity30日無料終了を有料同意として扱わない。承認済みの自動課金なしを維持。未知料金を0円にしない。0円という既知見積を受けても権利は作らない。

## ローカル検証

- `node scripts/platform-billing-http-check.mjs`: 218 checks成功。偽認証/所有/store/providerのみ（UUID正規化追補を含む）。
- `node scripts/platform-billing-quote-check.mjs`: 73 checks成功。外部通信なし。
- HTTP試験はWeb Request/Responseを関数へ渡す検証で、Nextサーバー/実JWT/本番の成功証拠ではない。
- レビューで見つかったstateのString変換による配列受入を撤去し、型不正15組を回帰試験へ追加。
- Next devの3 routeを実HTTPで確認。status未認証401/未設定503、checkout/portal未認証401、全応答no-store。認証成功や決済成功の実測ではない。検証サーバー停止済み。
- 初回所有10ファイルの空白/競合marker検査成功。全体lintはDB戻り値型を修正後、Next生成typesを公式typegenで再生成してexit 0。後続台帳と合わせた20ファイルの最終webpack production buildもexit0（静的生成対象142ページ、接続不能ローカルURL/fake keyのみ）。実認証・実決済の証明ではない。

## 統制側が続ける作業

1. 全体型/buildとNext runtime検査、正式型の両室接続。
2. 永続的な見積・同意・申込/イベント冪等台帳、既存契約との重複防止、本人限定アクセス。
3. Stripe test modeのCheckout/Portal/署名イベント処理と原子的な作成権消費、既存create迂回防止。
4. 両室UIを本人loaderへ接続し、別本人/失効/再送/逆順/競合を隔離環境で確認。
5. 実請求前に請求日/更新日/解約返金/未払/保持/構築購入権を1案へまとめ本人へ確認。価格/無料終了の承認済み事項は再質問しない。

本番DB/課金設定/実請求/公開反映は別承認。旧共通ルールのorigin/master未収録gapは継続し、本書で正典を書き換えない。
