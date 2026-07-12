# mikkeOS Item Studio Spec Extract

作成日: 2026-07-13
対象: BP-3-a（仕様抽出）。旧item-studio_2の仕様をItem Studio MVP向けに抽出する。item-studio_2本体は変更しない。

一次資料:

- `G:\Musubiプロジェクト\item-studio_2\CLAUDE.md`
- `G:\Musubiプロジェクト\item-studio_2\引き継ぎ書_ITEM-STUDIO_v2.md`
- `G:\Musubiプロジェクト\item-studio_2\item-studio.html`（データ構造確認のみ。全3159行は読まず、
  デモアイテムのオブジェクト定義箇所だけ確認）

マスタープラン境界（`MIKKEOS_APP_PORTFOLIO_MASTER_PLAN_2026-07-12.md` 4.3章に従う）:

- OS内Item Studio MVP = 商品台帳（作品・在庫・出品先・販売記録）を主役にする。
- 写真補正はMVPに入れない。当面は item-studio_2 への外部リンクで済ませる。
- Storyの「作品」タブの供給源はItem Studioにする。Story側に別の作品登録を作らない（二重管理禁止）。

## 1. プロダクトの役割

item-studio_2は「写真補正（Canvas API）＋AI自動入力（Claude API）＋BASE/minne自動出品（OAuth・API連携）」という、本番運用中の高機能出品自動化ツール。

対してmikkeOS内Item Studioは、この機能群を再現しない。**在庫台帳**として、作品・商品の登録、出品先の状態管理、販売記録を軽く扱う場所にする。写真の見栄え補正やAPI連携が必要な人は、既存のitem-studio_2をそのまま使い続ける。

## 2. 引き継ぐもの

```text
- 品番（sku）による管理という考え方（連番。カテゴリprefixなし）
- 商品の基本項目（商品名・カテゴリ・カラー・素材・状態・価格・仕入原価）
- 出品先ごとの状態管理という発想（channels配列: どこに・どの状態で出しているか）
- ハンドメイド／古着どちらにも対応できる汎用フィールド設計
```

## 3. 捨てるもの・持ち込まないもの

```text
- 写真補正（明るさ・コントラスト・鮮やかさスライダー、Canvas圧縮）
- AI自動入力（Claude Vision API連携）
- BASE OAuth2連携・自動出品・画像自動アップロード
- minne用ワンタップコピー機能
- BASE/Supabase Storage/Vercel API等の外部認証情報
  （item-studio_2のclient_secret等はmikkeOS側に一切書かない・参照しない）
- 単一HTML構造・item-studio-state-v1 のlocalStorageキー設計
- 洋服/パーツの2モード切り替えUI（MVPでは1つの汎用フォームにまとめる）
```

## 4. 画面構成（Item Studio MVP）

Item Studioは「本人が自分の在庫を管理する」内部ツールであり、Order/Eventと異なり公開LP・外部申込者は存在しない。そのため公開側の画面は持たない。

```text
/apps/item-studio              ダッシュボード（商品一覧・写真グリッド）
/item-studio/new               商品登録
/item-studio/[id]              商品詳細（写真・価格・在庫・出品先・販売記録を1画面に集約）
```

3画面構成（Order/Eventの7画面より小さい。公開面がないため）。

写真補正が必要な場合の導線: 商品詳細ページに「写真をきれいにする（item-studio_2を開く）」という外部リンクを1つ置く。リンク先はitem-studio_2のGitHub Pages URL（https://joesstylea-svg.github.io/item-studio/）。

## 5. データ項目

### 商品（item-studio_2の"item"を大幅簡略化）

| 項目 | 用途 | 備考 |
|---|---|---|
| id | 識別子 | |
| sku | 品番 | 連番。設定不要（自動採番）。item-studio_2とは独立した採番。 |
| title | 商品名 | 必須 |
| category | カテゴリ | 自由入力（ワンピース、アクセサリー等） |
| color | カラー | |
| material | 素材 | |
| condition | 状態 | 中古品向け。ハンドメイド新品は空でよい |
| price | 販売価格 | |
| cost | 仕入・材料原価 | 任意 |
| stock | 在庫数 | 数値。1点物は1 |
| description | 説明文 | |
| photoUrl | 写真URL | MVPでは外部URL貼り付けのみ（アップロード機能は持たない） |
| published | Storyへの公開可否 | Storyの作品タブへ出すかどうかのフラグ |
| createdAt / updatedAt | 監査用 | |

### 出品先（item-studio_2の"channels"を簡略化）

| 項目 | 用途 | 備考 |
|---|---|---|
| id | 識別子 | |
| itemId | 商品関連 | |
| channelName | 出品先名 | 自由入力（BASE、メルカリ、minne、Instagram等） |
| status | 状態 | not_listed / listed / sold |
| url | 出品ページURL | 任意 |
| memo | メモ | |

### 販売記録（新設。item-studio_2にはない概念だが、DESK連携のために必要）

| 項目 | 用途 | 備考 |
|---|---|---|
| id | 識別子 | |
| itemId | 商品関連 | |
| channelName | どこで売れたか | |
| soldPrice | 販売価格 | |
| soldAt | 販売日 | |
| memo | メモ | |

## 6. 状態遷移

### 出品先ステータス

```text
not_listed -> listed -> sold
listed -> not_listed（出品取り下げ）
```

在庫管理自体は数値の増減のみで、複雑なワークフローは持たない。

## 7. Activity Logマッピング候補（設計候補のみ・BP-3-bでは実装しない）

| Item Studio操作 | Story | DESK | 可視性 | 備考 |
|---|---:|---:|---|---|
| 作品登録・出品 | 候補 | No | published時のみpublic | 作品ポートフォリオの供給源 |
| 販売記録 | No | Yes | 強制private | 金額・仕入原価はDESK対象 |

## 8. Fable Sign-off（2026-07-13 承認）

この仕様抽出をBP-3-bの正典として承認する。

```text
- 3画面構成（4章）で確定。公開LP・申込フォームは持たない（内部台帳のため不要）。
- 写真補正・AI自動入力・BASE/minne連携はmikkeOS側に一切実装しない。
  必要な場合はitem-studio_2への外部リンクのみ置く。
- 保存はlocalStorage（Event/Orderと同じ activity-client-store方式）。
- 管理画面（全3画面）にAuthGate必須（Order実装時に確立した徹底ルールを継続）。
- Activity Log書き込みはBP-3-bでは実装しない。adapter接続フェーズで別途。
- item-studio_2本体・BASE認証情報・Supabase Storage設定には一切触れない。
- 色はStory基準トークンのみ。item-studio_2のオレンジ/ブルー配色は持ち込まない。
```
