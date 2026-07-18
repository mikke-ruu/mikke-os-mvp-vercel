# MIKKEOS Page PG-0 受け入れ条件

作成日: 2026-07-18
対象: N3 / Page PG-0

## 結論

PG-0では、Pageを「既存アプリの活動を束ねて外部へ見せるレイヤー」として登録できる最小土台だけを作る。

編集画面・公開画面・他者掲載依頼・決済・ドメイン・フォーム送信は作らない。

## PG-0で作るもの

```text
lib/page/types.ts
lib/page/store.ts
lib/page/demo.ts
lib/mikkeos/types.ts の AppKey に page を追加
lib/mikkeos/apps.ts に Page 定義を追加
```

管理画面ルートは、PG-0では作らない。`/apps/page` 以降の画面はPG-1で着手する。

## Pageが保存してよいもの

```text
Pageサイト情報
Page内のページ情報
ブロック構成
CMSブロックの参照設定
公開設定の下書き
```

## Pageが保存してはいけないもの

```text
Story / Item Studio / Event / Academy / Session の活動データ本体
売上・原価・内部メモ
他者データのコピー
掲載依頼の承認結果
決済情報
独自ドメイン契約情報
```

## デモデータ

PG-0では、業種ノウハウを含まない汎用サンプルを1件だけ用意する。

```text
例: サンプル団体
ページ: ホーム / 会社概要
ブロック: 見出し / 文章 / 画像 / ボタン / 区切り
```

MarketNote向け、Academy向け、セレクトショップ向けなど、特定業種に偏ったseedは作らない。

## 型の最小条件

PG-0の型は、PG-1以降で増やしやすい形にする。

```text
PageSite
PageDocument
PageBlock
PageBlockType
PageCmsBlock
PageCmsSource
PagePublicationDraft
```

フォーム、決済、他者掲載依頼、公開URL、独自ドメインは型だけでも前倒ししない。

## storeの最小条件

localStorageで完結させる。

```text
保存キー: mikke.page.v1
読み込み
保存
初期seed
サイト一覧取得
サイト単体取得
```

PG-0では編集UIがないため、複雑な更新関数は作らない。PG-1で画面に合わせて足す。

## アプリ登録の条件

Pageをアプリ一覧に出せる状態にする。

```text
AppKey に "page" を追加
apps.ts に Page を追加
status は planned
入口は /apps/page
説明文は「会社・団体・ブランドのページを作る」方向
```

PageはStoryの上位互換として説明しない。Storyは個人の名刺、Pageは団体・ブランド・事業のホームページとして分ける。

## 禁止事項

```text
既存アプリの保存処理を変更しない
既存アプリの画面を変更しない
CMS selectors をまだ作り込まない
AuthGate付きのPage管理画面をまだ作らない
外部公開ルートを作らない
Supabase / RLS / migration を触らない
Manager受信箱と接続しない
Team Works報酬・販売委託と接続しない
AI OFFICEには触れない
```

## 検収条件

```text
npm.cmd run lint が通る
npm.cmd run build が通る、または既存 .next / AI OFFICE 作業中差分が原因なら理由を記録する
Pageの型とstoreが他アプリに書き込まない
AppKey追加で既存アプリの型エラーが出ない
PageのデモがlocalStorage単体で読める
PG-1以降へ残す範囲がdocs上で明確
```

## PG-0完了後に進めること

PG-0が通ったら、PG-1で初めて `/apps/page` 配下の管理画面を作る。

PG-1では、AuthGate必須のPage一覧・新規作成・サイト編集・ページ編集・OS内プレビューへ進む。
