# mikkeOS UI Docs Index

更新日: 2026-07-18

mikkeOSのUI方針は、以下のdocsを参照します。

**新しいセッション・別モデルはまず `docs/MIKKEOS_NEXT_PHASE_PLAN_2026-07-18.md` と `docs/MIKKEOS_SESSION_HANDOFF_2026-07-14.md` を読む。** 全体の現在地・体制・次のアクションがまとまっている。

## 2026-07-18 追加（次フェーズ計画）

### `docs/MIKKEOS_NEXT_PHASE_PLAN_2026-07-18.md`

Manager M1E時点の監査結果と、次の実行計画（N0〜N4）。

- Managerの体験方針は「入口は個々のアプリ、Managerは横断参照・次にやること・控えめなアプリ提案」。
- `/` やlogin後を単純に `/manager` へ変える案は撤回済み。
- N0: docs / 認定講座admin / AI OFFICEを分離コミットして整地。
- N1: Manager M1正式検収。
- N2: Manager M2（残アプリアダプタ、旧ルート処遇、ナビ再設計、文脈案内、受信箱）。
- N3: Page PG-0〜PG-2。
- N4: セレクトショップ着手条件の調査・解消。

## 2026-07-16 追加（セレクトショップ／提携モデル）

### `docs/MIKKEOS_SELECT_SHOP_MODEL.md`

Page所有事業者が提携店舗の商品・サービスを掲載し、販売・発送・報酬まで回すモデル
（Fable設計・複数アプリ横断のため独立docs）。セレクトショップ／占い／ワークショップ／
商店街が同一構造で回る。

- **Team Worksのラベル替えで成立**（clients→お客様、workers→提携店舗、payouts→報酬）。新アプリを作らない。
- **販売は確認型**（在庫確認→確定→決済）。オーバーセルを業務プロセスで回避し、実装も軽くなる。
- 在庫切れの自動掲載停止は「参照型＝コピーしない」原則の効果で実装不要。
- 提携条件は「提示→承認」の一方向。Manager受信箱で掲載依頼＋販売委託を1つの承認に統合。
- レビューは2設問式（商品→提供店舗のStory／店舗→Page所有者のStory）。星は付けない。
- **着手条件: worker portalのアクセス制御をRLSで担保**（発送先＝個人情報。既知debtを格上げ）。
  やり方はFund F5-aのRLS否定testと同じパターン。
- 成長ループ（提携店舗が無料で参加→仕事体験→Storyが育つ→自分もPageを持つ）が戦略的価値。
- **決定: 招かれたworker（提携店舗）は無料**（料金正典1.5章「オーナー1人課金」原則）。
- 未決: 上乗せ時のブランド価格保護／レビュー公開可否／即時決済の要否／受け皿の一本化。

## 2026-07-16 追加（収益化・料金の正典）

### `docs/MIKKEOS_MONETIZATION_AND_PRICING.md`

散在していた料金方針（原典 `Mikke OS/アオイ回答_収益化提携成長方針_2026-06-19.md`
＋各アプリ構想書＋2026-07-16確定）を1枚に集約。

- **関与しない原則**: mikkeは場所・ツールを提供するだけ。利用事業者の事業運営に一切関与しない。全部任意。
- お金は2層のみ: ①mikke利用料（唯一の収益）／②利用事業者のお金（mikkeは関与しない・手数料0%）。
  旧「③マッチング手数料層」は2026-07-16に解消（Partners/Connectはmikkeが1事業者としてPageで作るもの）。
- ティア: 個人Free/Plus ＋ 団体は**アプリごとに個別課金**（1ヶ月無料トライアル・請求は1本化可）。
- 課金軸は「誰を巻き込むか」。個人が1人で使う分（MarketNote→ログ→Story→DESKの1周）は無料。
- Academy: 他アプリと同じ位置づけ。初期設定料金+月会費・トライアルなし（教科書は必須ではない）。
- **成約手数料機能はPageの有料機能**として全事業者へ提供（Plus案件・条件=事業者のStripe契約）。
  Pageで広告業・紹介業ができる＝他HPシステムとの差別化・離脱低減。実装方法は未決。
- 独自ドメインは持ち込み式（mikkeは取得・解約しない）。製品紹介HPはPageで構築（ドッグフーディング）。
- 解約は自由・引き止めない。mikkeが用意するのはアナウンスと動線のみ。
- アップセルはManager M2の文脈案内に相乗り（課金壁・ポップアップは作らない）。
- Stripe契約済み（OJAS）。①課金レール確保。②をmikke経由にはしない。
- 未決: 成約手数料機能の実装方法／具体的金額（触ってから）／解約アナウンスの具体設計。
- 課金機能の実装は各アプリのSupabase本接続フェーズ＋ドッグフーディング後。このdocsはポリシー確定のみ。

## 2026-07-15 動線監査（Fable実施）

アプリのラインナップはこれ以上増やさないことをユーザーが確定。全docsと実装コードの
動線整合を監査し、結果を `MIKKEOS_MANAGER_INTEGRATION_PLAN.md` へ反映済み:

- 2.1章追記: ルート / のリダイレクト（app/page.tsx）もloginと合わせて扱う
  （※当初の「両方を/managerへ変更」案は2026-07-18に撤回。入口はアプリファースト）
- 2.4章新設: 旧ルート /home・/marketnote の残置を凍結、処遇はM2で判断
- 2.5章新設: Manager受信箱（Page掲載依頼の承認/辞退）の設計席。実装はF4基盤後・PG-4と同時
- M2追記: ボトムナビ痩身（使っているアプリだけ見せる）をOS枠置き換えと同時判断

監査結論: データ動線（アプリ→Activity Log→Story/DESK、アプリ→derive-on-read→
Manager/Page）は全docsで一貫。依存順序 Fund F4 → Manager → Page PG-4 も正しい。

## 2026-07-15 追加（Page 新規アプリ構想）

### `docs/MIKKEOS_PAGE_IMPLEMENTATION_PLAN.md`

`Mikke OS/Page 正式構想書.md` を一本化ラインへ落とし込んだ計画（Fable設計・PG-0〜PG-5）。

- Page = 団体・ブランド・企業のホームページ。Storyの上位互換ではない（Story=個人名刺、Page=団体HP）。
- 核はCMSブロック: 各アプリをコピーせず参照（derive-on-read）。既存selectorsの再利用で建つ。
- 難易度が2層: 自組織CMS（localStorage・依存なし）は先、他者掲載依頼はFund F4基盤＋Manager受信箱依存、独自ドメイン公開はSupabase本接続で最終。
- ユーザー確定: 独自ドメイン対応を最終ゴールに含める／急がない・最適順／codex一本化中のためキュー最後尾・並行させない。

## 2026-07-15 追加（Team Worksプロジェクト管理拡張）

### `docs/MIKKEOS_TEAM_WORKS_PROJECTS_PLAN.md`

`Mikke OS/Team Works 新構想.md`＋`Team Works 追加機能ブリーフ.md` を一本化ラインへ落とし込んだ計画（Fable設計・TW-P0〜P7）。

- 継続業務モード（既存）はそのまま、プロジェクトモードを新規ファイルで追加。
- **ユーザー確定: ジェネレーター案。業種テンプレはrepo同梱しない**（業務フロー露出回避）。質問→工程生成が主。
- 既存の1902行TeamWorksScreen.tsxへ直接足さない。FeatureSettingsにenable系フラグ追加（デフォルトOFF）。
- 実装は1機能=1実装者。codexはFund進行中のため手が空いた実装者へ渡すキュー項目。

## 2026-07-14 追加（Manager統合計画）

### `docs/MIKKEOS_MANAGER_INTEGRATION_PLAN.md`

`Mikke OS/Manager機能 正式構想書.md` を一本化実行ラインへ落とし込んだ計画（Fable設計・M0〜M5）。

- Managerはアプリではなく共通機能。予定・進行・履歴のナビゲーション。
- アプリ由来の予定は保存せずderive-on-read。保存は個人予定と表示設定のみ。
- M0（設計報告・docsのみ）は今すぐ依頼可。M1はFund F4承認待ちの間に実施可。
- 既存/osとの矛盾は/os凍結で対応（「M1完了後にloginを/managerへ」案は
  2026-07-18に撤回。入口は個々のアプリ、Managerは横断参照の場所）。
- ボトムナビOS枠の扱いは単純なManager置き換えにせず、M2で再設計。

## 2026-07-14 追加（Fund正式構想の一本化）

### `docs/MIKKEOS_FUND_IMPLEMENTATION_PLAN.md`

`G:/Musubiプロジェクト/Mikke OS/MikkeOS Fund 正式構想書.md` を、現在のOrder派生構造、MikkeAppShell、共通部品、Activity Log安全規約へ落とし込んだFund実装計画。

- Fundは個人プロジェクトページ。検索ポータルにしない。
- Mikkeは資金を預からず、初期版は外部申込・外部決済リンク方式。
- Orderの構造とUIパターンを再利用するが、型とlocalStorageキーはFund専用に分離。
- F1 core MVP -> F2運用管理 -> F3挑戦の軌跡・OS連携 -> F4応援者同意 -> F5本接続の順。
- 旧 `FUND_APP_CONCEPT.md` は履歴資料へ変更。
- Fundの「ヒアリング前・仕様未確定」条件は解除。F3完了、F4-a schemaレビュー完了、F4-b1承認待ち。

### Fund F1 / F2 / F3実装

F1 core localStorage MVP、F2運用管理、F3挑戦の軌跡・OS連携が完了。管理8route、公開2route、完成報告、Storyの小さなFund入口、local Activity Log変換、他アプリへの引き継ぎ候補まで実装。F4-aは実DBの読み取り確認とschemaレビューまで完了し、F4-b1承認待ち。

### `docs/MIKKEOS_FUND_F4_IDENTITY_AND_CONSENT_PLAN.md`

F4の本人同定・招待受取・双方同意・公開解除・限定公開伝播防止を設計。owner-private / shared-safe / public-safeを分離し、メール一致だけの自動紐づけや金額公開を禁止した。F4-aはDB変更なしの実DB読み取り確認とschemaレビュー、F4-b以降は別承認とする。

### `docs/MIKKEOS_FUND_F4_SCHEMA_AND_RLS_REVIEW.md`

F4-aの実DB読み取り結果とschema/RLSレビュー。profilesの公開範囲、Auth設定、Activity Logの公開境界、Fundテーブル未作成を確認。Fund本体がlocalStorageのままではproject所有者をRLSで検証できないため、F4-bを所有基盤のb1と招待・同意のb2へ再編した。DB変更は未実施。

## 2026-07-13 追加（後続フェーズ計画）

### `docs/MIKKEOS_EVENT_PORTAL_AND_MARKETNOTE_LINK_PLAN.md`

EVENTモジュールの後続フェーズ計画（設計のみ・実装未着手）。ユーザー依頼を受けて作成。

- Phase E1: EVENTのSupabase移行（events / event_applicationsテーブル・RLS）
- Phase E2: 都道府県・地域フィールド、公開用主催者ナンバー
  （`profiles.member_number` 再利用が第一候補）
- Phase E3: 申込とmikkeOSアカウントの紐づけ
- Phase E4: イベントポータル（地域・都道府県・主催者ナンバー・開催日で絞り込み）
- Phase E5: MarketNote自動連携（申込confirmed時に出店予定を自動作成）

着手はPhase E1から。既存のPhase4 adapter/RLS方針
（`MIKKEOS_PHASE4_SUPABASE_ADAPTER_PLAN.md` 等）を踏襲する。

## 2026-07-13 追加（続報）

BP-3（Item Studio）・BP-4（Session）も完了。Fundは2026-07-14に仕様固定、F3、F4-a schemaレビューまで完了し、F4-b1承認待ち。Communityは前提条件待ち。

- `docs/MIKKEOS_ITEM_STUDIO_SPEC_EXTRACT.md`: item-studio_2から台帳機能のみ抽出。写真補正・BASE連携は外部リンクに委譲。
- Session: Order派生のため専用spec-extractドキュメントなし（マスタープラン4.4章に準拠）。

Fundは正式構想・実装計画・F1〜F3とF4-a schemaレビューが完成し、F4-b1承認待ち。CommunityはAcademy会員モデルが確定するまで着手を保留。

## 2026-07-13 追加

### `docs/MIKKEOS_EVENT_SPEC_EXTRACT.md` / Event MVP実装

BP-2-b完了。7画面（公開4・管理3）実装済み。localStorage方式、AuthGate必須（初回実装時に抜けを自己発見・修正）。My Pageは第2パス送り。

### `docs/MIKKEOS_ORDER_SPEC_EXTRACT.md` / Order MVP実装

BP-1-a/b完了。旧miracoから「相談から始まる」思想を継承、ベージュ配色・チャット機能・単一HTML構造は不採用。7画面、ステータス4値に圧縮。Session/Fund派生を見越しメニュー・申込・ステータスを分離。

### P2-b Wave 2（MarketNoteホームカレンダー）

SPEC_01準拠の月カレンダー実装済み。開催前/終了後で表示切替、チェックテンプレ期日ルールを実イベントへ適用。

## 2026-07-12 追加

### `docs/MIKKEOS_APPSHELL_WP2.md`

WP-2の実装メモです。

- `MikkeAppShell` の追加
- `MikkeOwnerMenu` の追加
- `/apps` と `/apps/*` 入口の移行
- グローバルナビから `Log` を外す方針
- `Log` をOwnerMenu内へ下げる方針
- `{アプリ名} by mikke` の小さなフッター表示
- Story既存メニューは今回は維持

### `docs/MIKKEOS_PRIMITIVES_WP3.md`

WP-3の実装メモです。

- `MikkeSection`
- `MikkeListRow`
- `MikkeStatusBadge`
- `MikkeActionCard`
- `MikkeEmptyState`
- Story既存マークアップからの切り出し
- 新デザインを発明しない方針

### `docs/MIKKEOS_DESIGN_TOKENS_WP1.md`

Claude/Fable設計レビューのWP-1に対応した、最初のデザイントークン統一メモです。

- Storyを現在の見た目の基準にする
- `app/globals.css` の `--mikke-*` トークン
- `OsShell` / `StoryProfile` の直書き色をトークン参照へ寄せる方針
- WP-2以降の共通部品化への橋渡し

DB / Supabase / RLS / 本番データ設計は対象外です。

## 1. 現在の主要docs

### `docs/MIKKEOS_APP_PORTFOLIO_MASTER_PLAN_2026-07-12.md`

全アプリを1本の実行ラインへ統合するためのマスタープランです。

- 進行順: WP-2 → WP-3 → `/apps`適用 → P1 Team Works → P2 MarketNote → P3 Event → P4 Academy → 後続アプリ
- 例外は本番運用中の `Mikkeruu-codex`
- 進行中アプリの凍結ルール
- 各アプリの構想とActivity Log接続の考え方

### `docs/MIKKEOS_DESIGN_REVIEW_AND_NEXT_PHASE_2026-07-11.md`

全体設計レビューと、WP-1〜WP-7の作業パッケージです。

- デザイン歪みの洗い出し
- WP-1: デザイントークン
- WP-2: `MikkeAppShell` / `MikkeOwnerMenu`
- WP-3: 共通UI部品
- WP-7: 表側ブランド違反の解消

### `docs/MIKKEOS_CLEAN_UI_ROADMAP.md`

mikkeOS全体を、Storyで見えてきたすっきりしたUIへ揃えるための移行計画です。

- Storyを共通UIの基準にする理由
- `/apps`、`/os`、`/log`、`/desk`、各アプリ本体へ広げる順番
- すぐにやらないこと

### `docs/MIKKE_OS_DESIGN_SYSTEM.md`

既存のmikkeOSデザインシステムメモです。

今後は `MIKKEOS_CLEAN_UI_ROADMAP.md` と `MIKKEOS_DESIGN_TOKENS_WP1.md` の方針に合わせ、必要な部分だけ整理します。

### `docs/MIKKEOS_STORY_OWNER_MENU_AND_CUSTOMIZATION.md`

Story右上の本人用メニューと、将来のカスタム項目に関するメモです。

- 持っているアプリへの入口
- 管理画面への入口
- 表示ON/OFF
- 背景色、背景画像、アクセントカラー、文字サイズ、テンプレート
- まだ持っていないアプリの提案

### `docs/MIKKEOS_PUBLIC_BRANDING_POLICY.md`

ユーザー向け画面で `mikkeOS` を前面に出しすぎないための方針メモです。

- 表側では `Story` / `DESK` / `Order` などのアプリ名を主役にする
- `mikkeOS` は裏側の共通基盤・シリーズ名として扱う
- 必要な場合だけ `Story by mikke` のように小さく表示する
- `Activity Log` / `LOG` などの内部用語を通常ユーザーの前面に出さない

### `docs/MIKKEOS_STORY_PROFILE_IMPLEMENTATION_PLAN.md`

Storyを名刺型ミニホームページとして扱うための実装計画です。

- Storyの役割
- プロフィール
- 活動サマリー
- 作品ポートフォリオ
- 口コミ
- リンク
- QRコード
- Storyに出さない情報

## 2. 今後の読み方

UI全体の方向性を見る時:

```text
MIKKEOS_CLEAN_UI_ROADMAP.md
MIKKEOS_DESIGN_REVIEW_AND_NEXT_PHASE_2026-07-11.md
MIKKEOS_APP_PORTFOLIO_MASTER_PLAN_2026-07-12.md
```

Story単体の見せ方を見る時:

```text
MIKKEOS_STORY_PROFILE_IMPLEMENTATION_PLAN.md
MIKKEOS_STORY_OWNER_MENU_AND_CUSTOMIZATION.md
MIKKEOS_PUBLIC_BRANDING_POLICY.md
```

実装済みWPを見る時:

```text
MIKKEOS_DESIGN_TOKENS_WP1.md
MIKKEOS_APPSHELL_WP2.md
MIKKEOS_PRIMITIVES_WP3.md
```

## 3. 次の作業候補

```text
1. N0: 整地
   → docs / 認定講座admin / AI OFFICEを分離コミット。handoffとindexを2026-07-18版へ更新。
2. N1: Manager M1正式検収
   → docs/MIKKEOS_ACCEPTANCE_CHECKLIST.md 1〜5章 + Manager計画7章 + M0レポート6章。
3. N2: Manager M2
   → Team Works / Academy / Item Studioアダプタ、旧ルート処遇、ボトムナビ再設計、文脈案内、受信箱設計。
4. N3: Page PG-0〜PG-2
   → docs/MIKKEOS_PAGE_IMPLEMENTATION_PLAN.md。localStorage・依存なし層から開始。
5. N4: セレクトショップ着手条件の解消
   → worker portalのアクセス制御/RLS担保を調査し、必要ならFund F5-a型の否定テストで補強。
6. Community: Academy会員モデル確定後に仕様化。
7. Event portal / MarketNote連携: 優先順位判断待ち。
```
