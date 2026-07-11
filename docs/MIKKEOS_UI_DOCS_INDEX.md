# mikkeOS UI Docs Index

更新日: 2026-07-12

mikkeOSのUI方針は、以下のdocsを参照します。

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
1. WP-3: Story既存マークアップから共通UI部品を切り出す
2. /apps配下の残り詳細画面を共通UIへ寄せる
3. P1: Team Works統一前の現状確認
4. P2: MarketNote完成へ進む
```
