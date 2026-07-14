# mikkeOS UI Docs Index

更新日: 2026-07-14

mikkeOSのUI方針は、以下のdocsを参照します。

## 2026-07-14 追加（Fund正式構想の一本化）

### `docs/MIKKEOS_FUND_IMPLEMENTATION_PLAN.md`

`G:/Musubiプロジェクト/Mikke OS/MikkeOS Fund 正式構想書.md` を、現在のOrder派生構造、MikkeAppShell、共通部品、Activity Log安全規約へ落とし込んだFund実装計画。

- Fundは個人プロジェクトページ。検索ポータルにしない。
- Mikkeは資金を預からず、初期版は外部申込・外部決済リンク方式。
- Orderの構造とUIパターンを再利用するが、型とlocalStorageキーはFund専用に分離。
- F1 core MVP -> F2運用管理 -> F3挑戦の軌跡・OS連携 -> F4応援者同意 -> F5本接続の順。
- 旧 `FUND_APP_CONCEPT.md` は履歴資料へ変更。
- Fundの「ヒアリング前・仕様未確定」条件は解除。F3完了、F4設計準備完了、F4-a承認待ち。

### Fund F1 / F2 / F3実装

F1 core localStorage MVP、F2運用管理、F3挑戦の軌跡・OS連携が完了。管理8route、公開2route、完成報告、Storyの小さなFund入口、local Activity Log変換、他アプリへの引き継ぎ候補まで実装。F4（応援者アカウント・双方同意）は設計準備完了、F4-a承認待ち。

### `docs/MIKKEOS_FUND_F4_IDENTITY_AND_CONSENT_PLAN.md`

F4の本人同定・招待受取・双方同意・公開解除・限定公開伝播防止を設計。owner-private / shared-safe / public-safeを分離し、メール一致だけの自動紐づけや金額公開を禁止した。F4-aはDB変更なしの実DB読み取り確認とschemaレビュー、F4-b以降は別承認とする。

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

BP-3（Item Studio）・BP-4（Session）も完了。Fundは2026-07-14に仕様固定とF3、F4設計準備まで完了し、F4-a承認待ち。Communityは前提条件待ち。

- `docs/MIKKEOS_ITEM_STUDIO_SPEC_EXTRACT.md`: item-studio_2から台帳機能のみ抽出。写真補正・BASE連携は外部リンクに委譲。
- Session: Order派生のため専用spec-extractドキュメントなし（マスタープラン4.4章に準拠）。

Fundは正式構想・実装計画・F1〜F3とF4設計準備が完成し、F4-a承認待ち。CommunityはAcademy会員モデルが確定するまで着手を保留。

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
1. Fund F4-a: 実DBの読み取り確認とschemaレビュー（DB変更なし・承認待ち）
2. Fund F4-b以降: migration / RLS / 招待・同意実装（F4-a検収後に別承認）
3. Community: Academy会員モデル確定後に仕様化
4. Event portal / MarketNote連携: 既存後続計画の優先順位判断待ち
```
