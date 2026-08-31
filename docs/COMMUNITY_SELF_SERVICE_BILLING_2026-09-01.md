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
2. お試し開始：終了後条件・endpoint確定前につき無効。Enterpriseも決済しない。
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

- 30日無料の開始起点、カード先登録、終了後の明示有料移行/自動課金/停止範囲、再取得防止。
- 初回/次回請求日、解約効力・返金、決済失敗猶予、上限人数の定義、超過/ダウングレード・変更日割り、既存Community移行、Enterprise受付。
- Checkout最終確認DTO/規約の版付き同意、server価格決定、通知の署名/再送/逆順/idempotency。
- 新規作成権の原子消費、既存create経路の迂回防止、本人分離・契約終了後の挙動。
- 有効JWT/anonymous/別owner、API/隔離DB・競合runtime、production build完走。
- 本番DB/Stripe/実請求/顧客送信/PR・公開は具体的差分と検証結果を添え別承認。今回実施なし。

## 正典gap

最新origin/masterに `docs/共通ルール.md` と `MikkeAuthPanel` がない。共有版を暫定読取し、既存 `/login?next=...` を利用、新規ログインUIは作らない。既存ログインにCommunityの見出し/next維持を統合するのは共通担当の確認点。旧§9のStripe初回除外は本日のユーザー指示により今回目標では撤回、正典そのものは編集しない。
