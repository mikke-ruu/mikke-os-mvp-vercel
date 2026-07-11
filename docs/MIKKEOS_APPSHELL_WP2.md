# MikkeAppShell WP-2

作成日: 2026-07-12

## 目的

WP-2では、ユーザー向け画面で各アプリ名を主役にし、`mikkeOS` を前面に出しすぎないための共通シェルを追加しました。

`OsShell` は削除せず、画面ごとに段階移行します。

## 追加した部品

### `components/mikkeos/MikkeAppShell.tsx`

- `appName` を必須にし、画面の主役をアプリ名にする。
- `brandLabel` の既定値として `mikkeOS` を使わない。
- PC上部ナビとモバイル下部ナビから `Log` を外す。
- 右上に `MikkeOwnerMenu` を開くメニューボタンを置く。
- フッターに小さく `{appName} by mikke` を表示できる。
- モバイル下部ナビは `OS / Story / DESK / Apps / 現在のアプリ` の5項目にする。

### `components/mikkeos/MikkeOwnerMenu.tsx`

- `appName`、編集項目、使っているアプリ、他のアプリ、つなげられるアプリをprops化。
- `Log` はグローバルナビではなく、OwnerMenu内の管理項目として扱う。
- メニューは画面を押し下げず、右側から重ねて開く。
- Story既存メニューは今回は置き換えず、見た目と挙動を維持する。

## 適用範囲

今回の適用第1号は `/apps` と `/apps/*` の入口です。

- `/apps`
- `/apps/academy`
- `/apps/community`
- `/apps/event`
- `/apps/item-studio`
- `/apps/market-note`
- `/apps/order`
- `/apps/session`
- `/apps/team-works`

Team WorksはP1で本格統一するため、今回は共通シェル化と前面の `MIKKEOS` 表示除去に絞りました。既存の業務メニューや内部CSSはP1でまとめて整理します。

## 色とブランド

- `/apps` と `AppCard`、`AppMiniPage` の直書き色は `--mikke-*` トークンへ寄せました。
- Team Works内の大量の既存色はP1対象として残しました。
- `/apps` 系の共通ナビから `Log` は外れています。
- `Log` への導線は `MikkeOwnerMenu` 内に置きます。

## 触っていないもの

- DB migration
- Supabase本接続
- RLS
- 保存処理
- Story公開面の見た目
- `OsShell` の削除

## 次

WP-3で、`MikkeSection` / `MikkeListRow` / `MikkeStatusBadge` / `MikkeActionCard` / `MikkeEmptyState` をStoryの既存マークアップから切り出します。
