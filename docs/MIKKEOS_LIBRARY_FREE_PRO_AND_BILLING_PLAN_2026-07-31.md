# mikkeOS Library Free / Pro・課金導入計画

作成日: 2026-07-31  
対象: `mikke-os-mvp` / `/apps/library`  
状態: 設計計画。Stripe課金、本番DB変更、利用制限はまだ実施しない。

## 1. 結論

Libraryは、先にログインして実際の仕事で使える状態へ進める。  
Free / Proの境界とStripeを差し込む場所は今決めるが、Stripe接続と課金開始は利用感を確認した後に行う。

料金区分は次の三層で考える。

1. 端末内のお試し利用
2. Freeアカウント
3. Proアカウント

端末内のお試し利用は正式プランではなく、初回体験や未ログイン時の補助導線である。  
通常利用はMikke IDでログインし、FreeでもSupabaseへ安全に同期する。

## 2. Freeでもクラウド同期を持たせる理由

Libraryは原案、定型文、URL、タスク、提出物の構成など、失うと困る個人データを扱う。  
Freeを端末保存だけにすると、端末故障、ブラウザデータ削除、機種変更で全データを失う危険がある。

そのため、複数端末同期そのものをPro限定にはしない。Proは「データを人質にする料金」ではなく、安心、大容量、高度な再利用、作業効率に対する料金とする。

JSON書き出し・読み込みはFree / Proの両方に残す。退会や障害時にも利用者が自分のデータを持ち出せるようにする。

## 3. 推奨するFree / Pro境界

| 項目 | 端末内お試し | Free | Pro |
| --- | --- | --- | --- |
| ログイン | 不要 | 必要 | 必要 |
| 保存先 | 端末のみ | Supabase + 端末キャッシュ | Supabase + 端末キャッシュ |
| スマホ・PC・タブレット同期 | なし | あり | あり |
| テーマ・カード・フォルダ | あり | あり | あり |
| コピー、検索、お気に入り、アーカイブ | あり | あり | あり |
| JSON書き出し・復元 | あり | あり | あり |
| 構成 | 少数 | 基本利用 | 高度な再利用 |
| 自作テンプレート | 少数 | 上限あり | 大容量 |
| 保存容量 | 端末依存 | 適正な上限 | 大容量 |
| 変更履歴・過去版復元 | なし | 最小限またはなし | あり |
| 添付ファイル | なし | 将来少量 | あり |
| 高度な比較・差分表示 | なし | 基本比較 | あり |
| Managerへのタスク表示 | 将来対象外 | 基本連携 | 高度な連携 |
| 他mikkeOSアプリとの作業切り替え | あり | あり | あり |
| 将来の直接受け渡し・自動化 | なし | なし | 候補 |

基本の文章編集、コピー、JSON持ち出し、通常の端末間同期はFreeに残す。  
Pro候補は、履歴、添付、大容量、高度なテンプレート、高度な比較、連携と自動化である。

### 初期上限の扱い

正式な数値は、実際にLibraryを使って1テーマあたりのカード数とデータ量を確認してから決める。  
コードへ直接「Freeは100件」などと書かず、プラン設定として変更可能にする。

初期検討値:

- Free: 通常の個人利用で急に止まらない容量
- Pro: 実質的に容量を意識せず使える範囲
- 上限到達時: 既存データは閲覧・コピー・JSON書き出し可能
- ダウングレード時: データを削除しない。新規追加だけを制限する

## 4. mikkeOS共通の権限設計

既存の `mikke_app_entitlements` は「そのアプリへの入口を持つか」を表す。  
Free / Proや個別機能の判定には流用しない。

分離する概念:

1. App entitlement: Libraryというアプリを使えるか
2. Plan: free / pro / internal
3. Feature entitlement: 履歴、添付、大容量などを使えるか
4. Billing state: Stripe契約と支払いの状態

想定する共通テーブル:

- `mikke_billing_customers`
  - `user_id`
  - `stripe_customer_id`
- `mikke_billing_subscriptions`
  - `user_id`
  - `stripe_subscription_id`
  - `stripe_product_id`
  - `stripe_price_id`
  - `status`
  - `current_period_end`
  - `cancel_at_period_end`
- `mikke_plan_memberships`
  - `user_id`
  - `plan_key`
  - `source` (`free`, `stripe`, `manual`, `internal`)
  - `starts_at`
  - `ends_at`
- `mikke_feature_entitlements`
  - `user_id`
  - `app_key`
  - `feature_key`
  - `source`
  - `starts_at`
  - `ends_at`
- `mikke_billing_webhook_events`
  - StripeイベントID
  - 処理状態
  - 受信日時
  - 再処理に必要な最小情報

利用者本人は自分の契約状態を読むだけにする。契約状態やPro権限の書き換えは、署名検証済みWebhookまたは信頼された管理処理だけが行う。

## 5. Stripeの役割

Stripeは支払いの正本、mikkeOS側はアプリ利用権の正本として扱う。

基本フロー:

```text
料金画面
  -> Stripe Checkout
  -> 支払い・契約
  -> 署名検証済みWebhook
  -> mikkeOSの契約状態を更新
  -> plan / feature entitlementを更新
  -> LibraryがPro機能を開放
```

契約変更・カード変更・解約はStripe Customer Portalを利用し、mikkeOS内に複雑な請求管理画面を最初から作らない。

重要事項:

- ブラウザからPro権限を直接書き換えない
- Checkoutの戻りURLだけでPro化しない
- Stripe Webhookの署名を必ず検証する
- Webhookは同じイベントが再送されても安全な冪等処理にする
- StripeイベントIDを保存して二重処理を防ぐ
- `service_role` やStripe secret keyをクライアントへ出さない
- 支払い失敗、解約予約、契約終了を別状態として扱う
- 退会・ダウングレードでLibraryデータを自動削除しない

## 6. 価格の決め方

金額はまだ確定しない。先に実利用で次を測る。

- 1週間・1か月に作るテーマ数
- 1テーマあたりのカード数
- テンプレートの再利用頻度
- 複数端末同期の利用頻度
- 履歴、添付、Manager連携への要望
- Library単体で課金したいか、mikkeOS複数アプリセットがよいか

Stripe側の価格IDはコードに直書きしない。環境変数またはDB上の商品設定で管理し、月額・年額や価格改定に対応できるようにする。

将来の販売形態候補:

- Library Pro単体
- mikkeOS Personal ProとしてLibrary、Managerなどをまとめる
- 各業務アプリのProにLibrary Proを含める

最初の検証はLibrary単体で始められる構造にしつつ、共通課金基盤はアプリセットにも対応させる。

## 7. 開発フェーズ

### Phase A: Libraryを実際に使える状態へ

目的: 課金なしで、本人がスマホ・PC・タブレットからログインして使う。

- Library関連コードだけを整理してコミット
- GitHubへpush
- オンライン環境へデプロイ
- Library用Supabase migrationを本番へ適用
- RLSと本人データ分離を確認
- 初回同期、再ログイン、別端末同期を確認
- JSON書き出し・復元を確認
- オフライン・通信失敗時の表示を確認

完了条件:

- 同じMikke IDで3種類の端末から同じLibraryを確認できる
- 他人のLibraryを読めない
- 保存失敗時にも端末側データとJSON退避手段がある

### Phase B: 課金前の共通プラン基盤

目的: StripeなしでもFree / Pro判定を安全に試せるようにする。

- app entitlementとplan / feature entitlementを分離
- 共通のプラン判定関数を作る
- `manual` / `internal` 付与を用意
- Library内に料金案内と現在プラン表示を追加
- 上限到達、ダウングレード、支払い猶予のUIを設計
- 管理者用の手動Pro付与を監査可能な形にする

開発者・運営者のアカウントは `internal` または期限付き `manual` Proにできる。Stripe未接続でも全機能を検証できる。

### Phase C: Stripeテストモード

目的: 実課金せず、契約開始から解約までを通す。

- Stripe Product / Priceをテストモードで作成
- Checkout Session作成処理
- Customer Portal Session作成処理
- Webhook受信処理
- Webhook署名検証
- 契約状態とplan / feature entitlementの同期
- 支払い成功、失敗、更新、解約予約、終了をテスト
- Webhook再送と順不同到着をテスト

完了条件:

- テストカードでPro化できる
- Portalから解約予約できる
- 契約終了後もデータを失わずFree状態へ戻る
- 同一Webhook再送で二重付与されない

### Phase D: Library実利用ベータ

目的: 課金境界を利用実績から調整する。

- Team WorksとAcademyの構想整理に実際に使う
- データ量と利用頻度を計測
- Free上限案を調整
- Pro価値を履歴・添付・再利用・連携から選ぶ
- 料金文言、FAQ、解約時の説明を整える

この段階まではStripeをテストモードのままにできる。

### Phase E: 正式課金

目的: Stripeをライブモードへ切り替える。

- 正式価格を決定
- 特定商取引法表示、利用規約、プライバシー説明を確認
- ライブProduct / Priceを作成
- 本番Webhook endpointとsecretを設定
- 少額の実決済、返金、解約を確認
- 運用手順と問い合わせ対応を用意

## 8. 今回やらないこと

- いきなりStripeライブ決済を開始する
- Libraryだけの独自請求テーブルを作る
- Free利用者のデータを端末内だけに閉じ込める
- ダウングレード時にデータを削除する
- 価格や件数上限をUIコードへ直書きする
- Team Works、Academy、Pageなどへ自動送信する
- Stripeの契約状態をクライアント入力で信用する

## 9. 次の実行順

1. Phase Aを完了し、Libraryを本人がオンラインで使えるようにする
2. 1〜2週間、実際のTeam Works / Academy整理に使う
3. Phase Bで共通plan / feature entitlementを追加する
4. 利用実績からFree上限とPro価値を仮決定する
5. Phase CでStripeテストモードを接続する
6. ベータ確認後に正式価格とライブ課金を判断する

最優先はPhase Aである。  
課金設計は今固定するが、課金実装がLibraryの実用開始を遅らせないように進める。
