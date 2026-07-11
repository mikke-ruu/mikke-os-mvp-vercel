# Mikke Common UI Primitives WP-3

作成日: 2026-07-12

## 目的

WP-3では、Storyの既存マークアップから共通UI部品を切り出しました。

新しい見た目は発明せず、Storyで使っていた角丸、線、余白、文字サイズ、トークン参照をそのまま部品化しています。

## 追加した部品

### `components/mikkeos/MikkeSection.tsx`

Storyのセクション枠です。

- 下線区切り
- `py-5`
- 左に見出し
- 右に小さなアクション

### `components/mikkeos/MikkeListRow.tsx`

一覧行です。

- 白背景
- `--mikke-line` の枠線
- ラベル、タイトル、補助文、右側要素を受け取る
- `href` がある場合だけリンク行になる

### `components/mikkeos/MikkeStatusBadge.tsx`

ステータス表示です。

- success / primary / muted の最小トーン
- Storyの受付中・公開中バッジとプロフィールステータスから切り出し

### `components/mikkeos/MikkeActionCard.tsx`

依頼・リンクのアクションカードです。

- Storyのリンクカードの見た目を維持
- アイコン、タイトル、補助文を受け取る
- `href` がある場合だけリンクになる

### `components/mikkeos/MikkeEmptyState.tsx`

空表示です。

- Storyと同じ小さな角丸、点線枠、やわらかい背景
- 今後、作品・口コミ・公開イベントなどが空の時に使う

## 適用範囲

今回の適用は `components/mikkeos/StoryProfile.tsx` です。

- 作品、口コミ、依頼・リンク、公開中の講座・イベントのセクションを `MikkeSection` へ移行
- 依頼・リンクを `MikkeActionCard` へ移行
- 公開中の講座・イベントを `MikkeListRow` と `MikkeStatusBadge` へ移行
- プロフィールステータスを `MikkeStatusBadge` へ移行
- 空表示用に `MikkeEmptyState` を追加

## 触っていないもの

- DB migration
- Supabase本接続
- RLS
- 保存処理
- Activity Log変換

## 次

次の `/apps` 適用やP1 Team Works統一では、ここで切り出した部品を優先して使います。
