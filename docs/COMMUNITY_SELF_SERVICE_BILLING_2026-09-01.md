# Community URL経由契約 — ローカル第1スライス

## 方針・所有

- 2026-09-01ユーザー決定：メニュー非掲載のまま、URLから本人登録→契約/決済→Community作成→請求/変更/解約までを目標とする。旧招待制pilotを完成条件にしない。
- ベース：fetch済み `origin/master@bc195d657d6bf37146ca2ccf8501db1cac9273cf`。
- 専用worktree：`G:/Musubiプロジェクト/mikke-os-mvp-community-self-service-20260901`、branch `agent/community-self-service-20260901`。
- Community正本 `93325c5` とPR #40 `ba9f4d7` は変更せず保持。PR40は9/1時点Draft/open/未merge。
- 共通課金API/DB/provider/利用権発行は統制室所有。Community側からstubや別決済を作らない。
- 参加者会費、Academy指定Room claim、manual/subscription/external権利、返金台帳は非対象。

## 正本と再利用

料金承認は `AI_Employee_StarterKit/06_Outputs/Consultation_Logs/2026-08-25_academy_completion_plan_live_chat_and_application_claim.md` の8/26訂正と、同 `2026-08-26_mikkeos_pricing_inventory_and_academy_trial_audit.md`。PR40の料金値を再利用し、旧UI・migrationはcherry-pickしていない。

| プラン | 税込料金 | 人数上限 |
|---|---:|---:|
| 30日間お試し | 0円 | 10名 |
| Starter | 月2,980円 | 50名 |
| Standard | 月4,980円 | 200名 |
| Pro | 月9,800円 | 1,000名 |
| Enterprise | 個別見積 | 1,001名以上 |

不明なプランをTrialへfallbackしない。料金表は表示用で、請求額・請求日はserverが確定する。未取得を0円と表示しない。

## 実装ファイル

- `app/community/start/page.tsx` — URL入口、料金比較/契約状態。決済成功queryから状態を作らない。
- `app/community/platform-billing/page.tsx` — UUID対象の契約確認。不正resourceIdはfetch前に停止。両routeはnoindex/nofollow、メニュー追加なし。
- `components/community/CommunityPlatformBilling.tsx` — 契約状態/期間/解約予約、未取得表示、プラン選択、請求管理、準備中表示。
- `lib/community/platform-plans.ts` — 承認済み表示カタログ。
- `lib/community/platform-billing.ts` — 共通v0の厳密decoderとBearer adapter。
- `scripts/community-platform-billing-check.mjs` — 実関数・SSRを使うfixture-only試験。実token/DB/provider通信禁止。
- 本ドキュメント。

## 共通接続契約

正本：`AI_Employee_StarterKit/06_Outputs/Consultation_Logs/2026-09-01_platform_billing_ui_contract_v0.md` および統制室9/1 Bearer transport追補。

- GET `/api/billing/platform/status?product=community_platform[&resourceId=UUID]`
- POST `/api/billing/platform/portal` は `{product, resourceId, requestId}` のみ。
- `getAccessToken` と `fetch` を注入可能。毎呼出token取得、tokenなしfetch0、`credentials: omit` / `redirect: error` / `cache: no-store`。
- 認証serverがJWT本人・anonymous拒否・請求権限を再検証する。ブラウザのsessionはBearer運搬にだけ使用。
- tokenはURL/log/DTO/独自storageに保存しない。server生成のHTTPS転送先も許可hostのみ。
- 同時click抑止。手動再試行は同一resource/requestIdを維持。自動再送なし。
- DTOのversion/product/resource/状態/キーが違えば停止。404/非JSON/通信失敗を利用権へ変換しない。

## このスライスで意図して接続しないもの

1. Checkout：v0に今回/次回金額・日付・版付き最終同意契約がない。allowedActionsにcheckoutが来ても無効、POST処理なし。
2. お試し開始：開始方法・期限後機能・endpoint確定前につき無効。30日終了後の自動課金/自動有料移行なしはユーザー承認済み（下記追補）。Enterpriseも決済しない。
3. Community作成：`creation.available` の表示は可能だが、旧 `/community/create` は契約権利の原子消費guardがまだないためリンクも有効化しない。UI無効化はbackend防御の代わりではない。
4. Portalの変更/解約設定：API接続・商用条件・人数制約の承認は統制側別ゲート。画面だけで変更/解約成功を表示しない。

## 検証

- `node scripts/community-platform-billing-check.mjs`：85件成功、実通信0。
- `npm run lint`：全体tsc成功。独立worktreeにlockfileどおり依存関係を導入、package/lockfile変更なし。
- Next devで `/community/start` HTTP 200。320/390/1280幅のDOM content widthはviewportと一致（scrollbar除外305/375/1265px）、横overflowなし。
- 実ブラウザでStarter→Standard選択表示、決済ボタン無効を確認。
- ローカルenvはコピーしていない。認証/契約未接続の安全なエラー表示で確認し、個人データは使用しない。
- Gドライブslow filesystemと既存root metadataのthemeColor警告あり。production build、本人ログイン、実共通API、DB/provider試験は未実施。
- Next dev生成の未追跡AGENTS.md/CLAUDE.mdは担当変更に混入させない。

## 統制へ集約済みの未決・後続ゲート

- 30日無料の開始起点、カード先登録、期限後に使える機能、再取得防止。終了後は自動課金せず本人の明示有料申込で課金開始する点は承認済みで、未決ではない。
- 初回/次回請求日、解約効力・返金、決済失敗猶予、上限人数の定義、超過/ダウングレード・変更日割り、既存Community移行、Enterprise受付。
- Checkout最終確認DTO/規約の版付き同意、server価格決定、通知の署名/再送/逆順/idempotency。
- 新規作成権の原子消費、既存create経路の迂回防止、本人分離・契約終了後の挙動。
- 有効JWT/anonymous/別owner、API/隔離DB・競合runtime、production build完走。
- 本番DB/Stripe/実請求/顧客送信/PR・公開は具体的差分と検証結果を添え別承認。今回実施なし。

## 正典gap

最新origin/masterに `docs/共通ルール.md` と `MikkeAuthPanel` がない。共有版を暫定読取し、既存 `/login?next=...` を利用、新規ログインUIは作らない。既存ログインにCommunityの見出し/next維持を統合するのは共通担当の確認点。旧§9のStripe初回除外は本日のユーザー指示により今回目標では撤回、正典そのものは編集しない。

## 9/1追補：30日終了時は自動課金しない（承認済み）

- 統制室経由のあゆみさん明示承認により、30日終了で自動請求/自動有料契約移行なし。本人が有料プランを申し込んだ時に課金開始する。
- Community表示/modelへ承認範囲だけを固定。価格・Academy・共通API/DB/providerは変更なし。
- 期限日時を過ぎたtrialingは再確認メッセージのみ。サーバーからの契約state/plan/creationを変更せず、activeや新規作成権を合成しない。
- カード先登録/開始起点/期限後機能/請求日/解約返金保持は引き続き未決。機能停止・データ削除・自動有料移行は追加しない。
- 境界前/境界時/境界後、期限不明、既存有料契約不変、期限後status取得GETのみ、SSR文言の負試験を追加。本番操作なし。
- 追補検証：fixture/SSRテスト94件成功、全体 `npm run lint` exit 0、`git diff --check` 成功。今回の文言追補について実ブラウザ/production buildは再実行していない。

## 9/1追補：本人・resource切替時の旧契約破棄

- 統制の専用worktreeにある共通 `lib/billing/platform/contracts.ts` / `http.ts` を読取照合。共有API/型/providerのコピーやstubは追加しない。
- `lib/community/platform-billing-loader.ts` を新設。再読取・認証変更時は先に旧表示を破棄し、AbortControllerと世代番号で遅延レスポンスを遮断する。通信側がabortを無視しても旧契約を復元しない。
- resourceをReact keyにして変更前の画面状態を再利用しない。Supabase認証イベントを購読し、本人切替/ログアウトで契約・メッセージを破棄。後続のGETは認証callback外へ延期する。
- token取得前と取得直後にabortを検査。token待ち中にログアウトしても古いtokenでfetchを開始しない。unmount時は購読解除・abort・遅延publish拒否。
- Portal応答も認証世代が変わったらredirect/表示更新を無視する。本人に権利を与える判断は引き続きserverだけで行う。
- 追加8件は実loader/adapterと偽transportで検査（resource切替、本人切替、ログアウト、queued読取取消、token待ちabort、事前abort、失敗時破棄、unmount）。既存試験と合わせ102件成功、全体型検査成功。
- Supabase skillの認証境界に従いcallbackを同期化し購読解除を追加。参考: https://supabase.com/docs/reference/javascript/auth-onauthstatechange 。実Auth・DB問い合わせは今回禁止のため偽transportで検証。
- production buildはenvなしで1回のみ実施し結果を別記する。認証情報/DB/Stripe実通信、push/PR/deploy、本番変更は行わない。Checkout/Trial/作成ボタン無効、自動課金なし、通常会員/Academy権利不変を維持。
- build結果: `npm run build -- --webpack` を1回実施。compile成功（3.3分）・build内TypeScript成功（2.5分）後、既存 `/community` と `/academy/classes` 等のprerenderで `Supabase environment variables are missing.`、exit 1。環境不足で未完走であり、本番build成功とは扱わない。envコピー/仮credential追加/再buildは行わない。
- build後の最終差分確認で、同一本人のtoken更新ではPortalの手動retry requestIdを維持するよう補正し、失敗メッセージを再読取で消さないようにした。最終版は102件成功、全体 `npm run lint` exit 0で再検証済み。上記compile結果はこの小補正前の版であり、最終版build成功を意味しない。
