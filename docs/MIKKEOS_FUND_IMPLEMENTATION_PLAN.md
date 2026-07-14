# Fund Implementation Plan

作成日: 2026-07-14

対象repo: `G:/Musubiプロジェクト/mikke-os-mvp`

状態: F2実装完了・F3着手前で停止

## 1. このdocsの役割

このdocsは、`G:/Musubiプロジェクト/Mikke OS/MikkeOS Fund 正式構想書.md` を、現在のmikkeOS共通仕様と一本の実行ラインへ落とし込んだ実装計画です。

仕様の優先順位は次のとおりです。

1. Fundの事業・体験思想: `MikkeOS Fund 正式構想書.md`
2. Fundのrepo実装範囲・順番・型・ルート: このdocs
3. OS共通UI・公開ブランド・Activity Log: 既存のmikkeOS共通docs
4. `FUND_APP_CONCEPT.md`: 初期構想の履歴資料。新規実装の正典にはしない

正式構想書の全機能を「初回MVP」として一括実装しません。現在のOrder派生構造とlocalStorage MVP方針を使い、壊れにくい単位へ分割します。

## 2. FundのOS内での位置

```text
Story
  その人を知り、信用や過去の活動を見る
       ↓
Fund
  これから実現したい挑戦を公開し、最初の応援者・顧客を集める
       ↓
Order / Item Studio / Event / Session / Academy / Community / Team Works
  成立した挑戦を実行する
       ↓
Activity Log
  公開・金額・個人情報を分離して活動を記録する
       ↓
Story
  完成した挑戦を新しい信用として案内する
```

Fundはクラウドファンディング案件の検索ポータルではありません。実行者本人がStory、SNS、LINE、URL、QRコードから直接案内する個人プロジェクトページです。

Fundは独立アプリですが、内部実装はOrderの次の3分離を継承します。

```text
Order menu        -> Fund project + support plan
Order application -> Fund support record
Order status      -> Fund campaign / payment / fulfillment status
```

ただし、Orderの型やlocalStorageキーを直接共有しません。Fundには構想・募集・実現、目標、公開範囲、活動報告、提供状態、表示同意があるため、`lib/fund/` に専用型とstoreを置きます。再利用するのは画面構造、入力パターン、状態表示、共通部品です。

## 3. 固定するプロダクト方針

- 表側の主役は `Fund`。`Mikke Fund` や `MikkeOS Fund` を画面名にしない。
- 公開フッターは必要な場合だけ小さく `Fund by mikke`。
- 他人のFund一覧、検索、ランキング、レコメンドを作らない。
- Mikkeは支援金や売上金を預からない。
- Mikke内決済、Stripe Connect、資金分配、自動返金を作らない。
- 初期版は利用者本人の外部決済URL・外部申込URLへつなぐ。
- `投資`、`出資`、`配当`、`利回り`、`金融商品`、`売上分配`をユーザー向け文言に使わない。
- 基本文言は `応援`、`先行購入`、`先行申込`、`参加予約`、`協賛`、`興味登録`、`応援プラン`。
- Fund終了後のプロジェクト記録は `STORY化` ではなく `挑戦の軌跡` と呼ぶ。
- 挑戦の軌跡はFund内データ。Storyには要約とリンクだけを置く。
- StoryにFundだけの巨大な専用セクションを作らない。他アプリ入口と同じ型で表示する。
- 金額、応援者名、応援コメント、応援実績は初期非公開。本人の明示操作なしにStoryへ出さない。
- カード番号、銀行情報、決済情報、配送先はFundへ保存しない。
- F1〜F3のlocalStorage版は同一ブラウザ内のUI・導線検証用。別端末へURLを渡して閲覧できる本当の公開ページはF5の本接続後に成立する。

## 4. 初期データ構造

実装場所:

```text
lib/fund/types.ts
lib/fund/store.ts
```

localStorageキー:

```text
mikke.fund.projects.v1
mikke.fund.plans.v1
mikke.fund.supports.v1
mikke.fund.updates.v1
mikke.fund.challenge-records.v1
mikke.fund.app-links.v1
```

すべての主要レコードに安定した `id`、`createdAt`、`updatedAt` を持たせます。将来のSupabase列名へ寄せすぎず、変換可能なcamelCase型で実装します。

### 4.1 FundProject

最低限の項目:

```text
id
ownerProfileId
profileSlug
slug
title
shortDescription
description
projectType
campaignType
stage
status
visibility
coverImageUrl
goalType
goalValue
displayAmount
startAt
endAt
externalPaymentUrl
externalApplicationUrl
whyNow
audience
useOfSupport
schedule
riskNotes
cancellationPolicy
contactNote
publishedAt
completedAt
archivedAt
createdAt
updatedAt
```

初期のenum:

```text
projectType:
  product | course | event | session | community | place | activity | other

campaignType:
  preorder | early_application | reservation | sponsorship | support | interest

stage:
  concept | campaign | realization

status:
  draft | interest_open | ready | open | goal_reached | closed |
  in_progress | delivering | completed | postponed | cancelled | archived

visibility:
  private | unlisted | public

goalType:
  amount | supporters | reservations | participants | vendors | sponsors
```

`passcode`、Community限定、Academy限定、過去応援者限定は初期型へ入れず、将来拡張にします。

### 4.2 FundPlan

```text
id
projectId
title
description
imageUrl
planType
price
quantityLimit
perPersonLimit
deliveryDate
externalPaymentUrl
externalApplicationUrl
requiredInformationNote
requiresShipping
status
sortOrder
createdAt
updatedAt
```

```text
planType:
  preorder | application | reservation | sponsorship | support | interest | non_financial

status:
  draft | active | sold_out | closed | hidden
```

### 4.3 FundSupport

初期版は実行者による手動登録です。公開ページ内で個人情報を直接収集するフォームは作りません。

```text
id
projectId
planId
supporterUserId
supporterName
supporterEmail
publicName
isAnonymous
supportType
amount
quantity
paymentStatus
fulfillmentStatus
comment
source
supportedAt
completedAt
cancelledAt
createdAt
updatedAt
```

```text
paymentStatus:
  unknown | pending | confirmed | refunded | cancelled

fulfillmentStatus:
  not_required | waiting | preparing | scheduled | shipped |
  participated | in_service | completed | on_hold | cancelled
```

Fund内で支援額を確認済みとして扱う場合も、表示文言は `実行者確認済み` とします。Mikke公式の決済確認と誤認させません。

### 4.4 FundUpdate / FundChallengeRecord / FundAppLink

`FundUpdate` は活動報告です。初期版の公開範囲は `draft | public` のみとし、応援者限定・プラン限定は後続へ送ります。

`FundChallengeRecord` は完成後の `挑戦の軌跡` です。Fund内に保存し、Storyは要約リンクを参照します。Activity Logだけから自動生成しません。

`FundAppLink` は各アプリへの引き継ぎ予約です。

```text
targetService:
  order | item_studio | event | session | academy | community | team_works

linkStatus:
  suggested | ready | linked | cancelled
```

初期localStorage版では「引き継ぎ先を選ぶ」「リンク予定を記録する」までに留め、他アプリの保存データを自動作成しません。

## 5. 状態遷移

基本経路:

```text
draft
  -> interest_open
  -> ready
  -> open
  -> goal_reached または closed
  -> in_progress
  -> delivering
  -> completed
  -> archived
```

例外経路:

```text
interest_open / open / in_progress / delivering
  -> postponed
  -> 元の進行状態へ戻す、または cancelled

draft / interest_open / ready / open / in_progress / delivering
  -> cancelled
```

ルール:

- `private + draft` が新規作成時の初期値。
- `open` にする前に、実行者情報、連絡方法、外部リンク、提供予定、中止・延期時の対応、注意事項を確認する。
- `goal_reached` は目標到達の表示状態であり、外部決済の正当性をMikkeが保証するものではない。
- `completed` と支援ごとの `fulfillmentStatus` は分ける。
- キャンセル・返金・テスト・重複・無効登録は人数・件数・金額集計から除く。

## 6. ルーティング

管理側はすべて `AuthGate` + `MikkeAppShell` を使います。

| Route | 役割 | 初期パッケージ |
| --- | --- | --- |
| `/apps/fund` | Fundホーム・プロジェクト一覧 | F1 |
| `/apps/fund/new` | 質問形式の新規作成 | F1 |
| `/apps/fund/[id]/edit` | 基本情報・本文・公開設定・応援プラン編集 | F1 |
| `/apps/fund/[id]/preview` | 公開前プレビュー | F1 |
| `/apps/fund/[id]/supporters` | 応援者手動登録・決済確認 | F2 |
| `/apps/fund/[id]/updates` | 活動報告管理 | F2 |
| `/apps/fund/[id]/fulfillment` | 提供状況管理 | F2 |
| `/apps/fund/[id]/complete` | 完成報告・挑戦の軌跡 | F3 |
| `/fund/[profileSlug]` | 本人の受付中・準備中・過去Fund | F1 |
| `/fund/[profileSlug]/[projectSlug]` | 公開プロジェクト詳細 | F1 |

`/apps/fund` は現在の `AppMiniPage` を置き換えます。公開側は `MikkeAppShell` を出さず、Fund名・実行者・写真を主役にした専用の軽い公開シェルを使います。フッターだけ `Fund by mikke` を許可します。

F1ではプロフィール本接続を行わないため、seedの `profileSlug` を使用します。公開ルートは同一ブラウザのlocalStorageを読むプレビューです。画面上で共有URLを表示しても「現在はこの端末での確認用」と明示し、外部へ共有可能だと誤認させません。

## 7. UI部品方針

再利用する共通部品:

- `MikkeAppShell`
- `MikkeOwnerMenu`
- `MikkeSection`
- `MikkeListRow`
- `MikkeStatusBadge`
- `MikkeActionCard`
- `MikkeEmptyState`
- `AuthGate`
- `--mikke-*` tokens

Orderから参考にするもの:

- 管理ホームの情報密度
- 公開ページと管理ページの分離
- 作成・編集フォームの入力パターン
- 申込一覧の展開行
- localStorage storeの更新イベント方式

Fund固有部品として追加してよいもの:

```text
FundProgressSummary
  目標単位、現在値、達成率、終了日を表示

FundPlanList / FundPlanEditor
  応援プランの表示・編集

FundTimeline
  活動報告と挑戦の軌跡の時系列表示

FundExternalAction
  外部申込・外部決済であることを明示するCTA
```

新しいデザインシステムやFund専用サイドバーは作りません。Fund固有部品も既存トークンと8px以下の基本カード角丸方針に従います。

## 8. Activity LogとStoryの境界

source service:

```text
fund
```

重複防止:

```text
source_service + source_record_id + activity_type
```

初期変換候補:

| Fund操作 | activity_type | Story | DESK | 初期公開 |
| --- | --- | --- | --- | --- |
| プロジェクト公開 | `fund_project_published` | 本人選択の素材候補 | いいえ | private / limited |
| 目標達成 | `fund_goal_reached` | 本人選択の実績候補 | いいえ | private / limited |
| 応援受付 | `fund_support_recorded` | 応援者・金額は出さない | 金額確認済みなら候補 | private |
| 支払い確認 | `fund_payment_confirmed` | いいえ | revenue候補 | private固定 |
| 提供完了 | `fund_fulfillment_completed` | 集計値のみ候補 | いいえ | private / limited |
| 挑戦完了 | `fund_project_completed` | 挑戦の軌跡リンク候補 | いいえ | private / limited |
| 応援者本人の参加記録 | `fund_participation_recorded` | 本人と実行者の同意後のみ | いいえ | private初期 |

F1・F2ではFund内のlocalStorage保存だけを行います。Activity Logへの実書き込みはF3で別コミットにし、既存adapterを変更する前に変換表をセルフレビューします。

Story初期表示:

- 他アプリ入口と同じ小さな行またはリンクカード。
- プロジェクト名、短い説明、状態、本人が許可した人数だけ。
- Fundの本文、活動報告、応援プランをStoryへ複製しない。
- 金額は初期非表示。
- 応援者側Story連携はF4以降。F3では実行者側の入口だけ。

## 9. 実装パッケージ

各パッケージを別コミットにし、完了ごとに止めて報告します。

### F0: 仕様固定・一本化

このdocs作成、マスタープラン更新、Activity Log変換候補更新。

コード変更なし。

### F1: Fund core localStorage MVP

目的: 実行者がFundを作り、同一ブラウザ上の公開URLで完成形と導線を検証できる。

実装範囲:

- `lib/fund/types.ts` / `store.ts`
- `/apps/fund`
- `/apps/fund/new`
- `/apps/fund/[id]/edit`
- `/apps/fund/[id]/preview`
- `/fund/[profileSlug]`
- `/fund/[profileSlug]/[projectSlug]`
- 単一目標
- 応援プラン
- 外部申込・決済リンク
- `private | unlisted | public`
- draft / publish / stop / closeの基本操作
- 公開ページのStoryリンク

F1で実装しないもの:

- 応援者個人情報の公開入力フォーム
- 決済
- Activity Log書き込み
- Story画面変更
- 他アプリへのレコード自動作成
- QR画像生成。最初は共有URLとコピー操作まで
- 画像アップロード。URLまたは既存の安全な画像入力方式だけ
- 別端末・別ユーザーへ共有できる本番公開。localStorageでは成立しないためF5へ送る

### F2: 運用管理

目的: 外部で受け付けた応援をFund側で管理し、活動報告と提供完了まで追える。

実装範囲:

- 応援者の手動登録
- 決済確認状態
- キャンセル・返金の除外集計
- 応援者数と応援件数の分離
- 活動報告
- 提供状態
- 公開ページの活動報告
- 集計値の `実行者確認済み` 表示

F2ではカード番号、銀行情報、配送先を保存しません。

### F3: 挑戦の軌跡・OS連携

目的: 完成した挑戦をFund内に残し、Storyと次のアプリへ安全につなぐ。

実装範囲:

- `/apps/fund/[id]/complete`
- `FundChallengeRecord`
- 挑戦の軌跡公開表示
- 実行者側Storyの小さなFund入口
- Activity Log変換・local adapter接続
- `FundAppLink` の提案・リンク状態
- Order / Item Studio / Event / Session / Academy / Team Worksへの入口
- Communityはアプリ本体の会員モデル確定までリンク提案だけ

F3で他アプリのデータを自動複製しません。連携はリンクと引き継ぎ候補データの確認画面までです。

### F4: 応援者アカウント・同意

別途設計承認後に着手します。

- Mikke IDとの紐づけ
- 応援者マイページ
- 応援者本人のStory表示
- 実行者・応援者双方の公開同意
- 匿名・金額非表示・解除
- 限定公開プロジェクトの伝播防止

localStorageだけで本人同定を完成させないため、F4はSupabase/Auth/RLS設計と同時に扱います。

### F5: 本接続・運営機能

別指示があるまで着手禁止です。

- Supabaseテーブル・migration・RLS
- 本人確認、通報、利用停止
- メール通知
- 分析、CSV、アーカイブプラン
- パスコード・会員限定公開
- Webhook
- 将来ポータル

## 10. 共通の禁止事項

- DB migration / Supabase本接続 / RLS / policy / constraint変更
- Stripe Connect、決済代行、資金預かり、分配、自動返金
- Order / Event / Session / Academy等の保存データへの自動書き込み
- Story公開面の大幅な再設計
- 既存Activity Log型の無断変更
- Fund専用の色トークン、独自CSSテーマ、独自ナビの追加
- 旧Orderコードのコピーによる別デザイン化
- 個人情報・金額の自動公開
- Fundポータル、検索、ランキングの先行実装

## 11. パッケージごとの完了条件

`docs/MIKKEOS_ACCEPTANCE_CHECKLIST.md` 1〜5章を使用します。

必須:

```text
npm.cmd run lint
npm.cmd run build
375px / 768px / 1280px
対象routeの公開・管理境界確認
直書きhex色ゼロ
管理routeのAuthGate確認
公開画面でmikkeOS前面表示なし
Fund by mikkeは小さなフッターのみ
保存ロジックとlocalStorageキーの回帰確認
コミット
```

F1追加確認:

- 非公開下書きが公開一覧へ出ない。
- unlistedは本人Fundトップへ出さず、URLでは表示できる。
- 外部URLが未設定なら押せないCTAを出さない。
- `javascript:` 等の危険なURLを許可しない。
- 金額非表示設定が公開画面に反映される。

F2追加確認:

- 同じ人の人数と応援件数を分けて集計する。
- cancelled / refunded / test / duplicate / invalidを集計から除外する。
- メールアドレス、管理メモ、決済状態を公開画面へ出さない。

F3追加確認:

- 金額Activity Logはprivate・Story対象外・実績対象外。
- Story表示は本人選択で、Fund本文を複製しない。
- 連携操作で他アプリの既存データを変更しない。

## 12. Claude Codeへの引き継ぎ開始文

```text
対象repo:
G:/Musubiプロジェクト/mikke-os-mvp

Fundの正典:
1. G:/Musubiプロジェクト/Mikke OS/MikkeOS Fund 正式構想書.md
2. docs/MIKKEOS_FUND_IMPLEMENTATION_PLAN.md

まずF1だけ実装してください。F2以降へ一気に進まないでください。

F1の対象:
- lib/fund/types.ts / store.ts
- /apps/fund
- /apps/fund/new
- /apps/fund/[id]/edit
- /apps/fund/[id]/preview
- /fund/[profileSlug]
- /fund/[profileSlug]/[projectSlug]
- 単一目標、応援プラン、外部申込・決済リンク、公開範囲

制約:
- Orderの構造と共通UIは再利用するが、Order型やstorage keyを共有しない
- AuthGate + MikkeAppShell + --mikke-* tokens
- 公開側はFundが主役、Fund by mikkeは小さなフッターのみ
- DB / Supabase / RLS / migration / 決済 / Story改修は行わない
- 他アプリのデータを自動作成しない

完了後:
- MIKKEOS_ACCEPTANCE_CHECKLIST 1〜5章
- lint / build
- 375 / 768 / 1280px
- コミット
- F1で実装したもの・送ったもの・残したものを報告して停止
```

## 13. F0決定記録

- Fund正式構想の作成により、旧マスタープランの「ヒアリング前で仕様未確定」は解除する。
- 実装開始条件は「この計画の確認」と「F1着手指示」に置き換える。
- Communityの前提条件は変わらない。
- 料金プラン、法務文言、本人確認、本部機能はプロダクト構想として保持するが、F1〜F3のコード範囲には入れない。
- 応援者側Story連携は重要な独自価値だが、同意・本人同定・限定公開制御が必要なためF4へ分離する。

## 14. F1実装記録（2026-07-14）

実装済み:

- Fund専用 `types.ts` / `store.ts` / 外部URL検証
- `/apps/fund` 管理ホーム
- `/apps/fund/new`
- `/apps/fund/[id]/edit`
- `/apps/fund/[id]/preview`
- `/fund/[profileSlug]`
- `/fund/[profileSlug]/[projectSlug]`
- 単一目標、応援プラン、公開範囲、外部申込・決済リンク
- `apps.ts` のFundを `prototype` へ更新

セルフチェック:

```text
1. UI: MikkeAppShell / 共通部品 / --mikke-* tokens、直書きhex色ゼロ
2. 挙動: publicは本人トップと詳細、unlistedは詳細URLのみ、private/draftは公開遮断
3. 安全: 管理4routeはAuthGate、外部URLはhttp/httpsのみ、決済・個人情報保存なし
4. ブランド: 公開面はFundが主役、mikkeOS前面表示なし、Fund by mikkeは小さなfooterのみ
5. 品質: npm.cmd run lint / build成功、公開2画面を375 / 768 / 1280px確認
```

ブラウザ検証補足:

- 公開2画面は3幅で横はみ出しなし。
- `/apps/fund` は未ログイン時に `/login` へ遷移し、認証境界を確認。
- ブラウザにテスト用ログイン情報がないため、管理4画面の認証後スクリーンショットは未実施。型チェック・build・AuthGate配置で確認した。
- F2以降は未着手。

## 15. F2実装記録（2026-07-14）

実装済み:

- `FundSupport` / `FundUpdate` と専用localStorage保存
- `/apps/fund/[id]/supporters` の応援者手動登録・決済確認・集計区分
- `/apps/fund/[id]/updates` の活動報告下書き・公開管理
- `/apps/fund/[id]/fulfillment` の提供状態管理
- 応援者数・応援件数・数量・実行者確認済み金額の分離集計
- refunded / cancelled / test / duplicate / invalid の集計除外
- 公開詳細への公開済み活動報告と集計値注記の反映

セルフチェック:

```text
1. 機械: npm.cmd run lint / build成功、Fund対象の直書きhex色・mikkeOS前面表示ゼロ
2. 挙動: 応援者数と件数を分離し、除外状態は進捗へ加算しない
3. 安全: 管理3routeはAuthGate、公開側へ氏名・メール・管理メモ・決済状態を渡さない
4. ブランド: 公開面はFundが主役、Fund by mikkeは小さなfooterのみ
5. 表示: 公開詳細を375 / 768 / 1280pxで確認し、横はみ出しなし
```

補足:

- ブラウザにテスト用ログイン情報がないため、管理3画面は認証後の目視未実施。未ログイン時にログイン画面で遮断されること、型チェック、build、AuthGate配置で確認した。
- F3の挑戦の軌跡、Story入口、Activity Log、他アプリ連携は未着手。
