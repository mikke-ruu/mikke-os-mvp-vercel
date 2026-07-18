# MIKKEOS Page PG 進捗レポート

作成日: 2026-07-18
対象: N3 / Page PG-0〜

## PG-0: 型・store・登録・デモ

完了。

```text
追加: lib/page/types.ts
追加: lib/page/demo.ts
追加: lib/page/store.ts
更新: lib/mikkeos/types.ts
更新: lib/mikkeos/apps.ts
更新: lib/mikkeos/routes.ts
更新: lib/mikkeos/app-actions.ts
```

実装内容:

```text
Page用AppKeyを追加。
アプリ一覧へPageを planned として登録。
Page用localStorageキー mikke.page.v1 を予約。
PageSite / PageDocument / PageBlock / PageCmsBlock / PagePublicationDraft の最小型を追加。
業種に依存しない「サンプル団体」デモを1件追加。
```

境界:

```text
Page管理画面は未実装。
公開ルートは未実装。
CMS selectorsの読み取り統合は未実装。
他者掲載依頼、Manager受信箱接続、販売委託、決済、独自ドメインは未実装。
既存アプリの保存処理・画面・データ形式は変更なし。
AI OFFICE側の作業中差分には触れていない。
```

検収:

```text
npm.cmd run lint: 成功
npm.cmd run build: 成功（87 static pages）
```

## 次

PG-1で初めて `/apps/page` 配下の管理画面を作る。

```text
/apps/page
/apps/page/new
/apps/page/[siteId]
/apps/page/[siteId]/[pageId]
```

PG-1ではAuthGate必須、積み上げ式ブロック編集、自組織CMSブロック、OS内プレビューまでを対象にする。

## PG-1-a: Page入口・デモ閲覧

完了。

```text
追加: app/apps/page/page.tsx
追加: components/page/PageDashboard.tsx
```

実装内容:

```text
/apps/page をAuthGate配下で追加。
PG-0のlocalStorage storeからPageサイト一覧を読み取り。
サンプル団体のページ数・ブロック数・下書きslugを表示。
公開、編集、他者掲載依頼、決済、フォーム送信は未実装のまま明記。
```

検収:

```text
npm.cmd run lint: 成功
npm.cmd run build: 成功（88 static pages、/apps/page 追加確認）
```

次:

```text
PG-1-b: /apps/page/new とサイト作成
PG-1-c: /apps/page/[siteId] のページ一覧・編集導線
PG-1-d: /apps/page/[siteId]/[pageId] の積み上げ式ブロック編集
```

検収:

```text
npm.cmd run lint: 成功
npm.cmd run build: 成功（89 static pages、/apps/page/[siteId] 追加確認）
```

## PG-1-d: 積み上げ式ブロック編集

完了。

```text
追加: app/apps/page/[siteId]/[pageId]/page.tsx
追加: components/page/PageDocumentEditor.tsx
更新: lib/page/types.ts
更新: lib/page/store.ts
更新: components/page/PageDashboard.tsx
```

実装内容:

```text
見出し、文章、画像、ボタン、フォーム枠、区切りの追加・編集・削除・上下移動を実装。
ページ名・ページslug・ブロック構成を明示保存。
編集画面内にOS内下書きプレビューを追加。
フォーム枠は見た目だけで、送信処理は実装しない。
```

境界:

```text
Studio的な自由配置は作らず、縦方向の積み上げ式だけ。
CMS selectors、外部公開、フォーム送信、他者掲載依頼、Manager受信箱、決済、独自ドメインは未実装。
既存アプリとAI OFFICEの保存処理・作業中差分は変更なし。
```

次:

```text
PG-1-e: 自組織CMSブロックの読み取り接続
```

検収:

```text
npm.cmd run lint: 成功
npm.cmd run build: 成功（90 static pages、/apps/page/[siteId]/[pageId] 追加確認）
```

## PG-1-e: 自組織CMSブロック

完了。

```text
追加: lib/page/cms-selectors.ts
更新: components/page/PageDocumentEditor.tsx
更新: components/page/PageDashboard.tsx
```

実装内容:

```text
自組織CMSブロックを追加し、Story / Item Studio / Event / Academy / Sessionを選択可能にした。
Item Studio・Event・Sessionは既存のクライアントstoreフックから公開状態のデータだけを読み取る。
Storyはプロフィール参照、Academyは公開かつStory表示対象のActivity Log候補を読み取る。
リスト・カード・注目表示をOS内プレビューへ反映。
原価、内部メモ、申込者情報、予約情報はPage共通表示へ渡さない。
```

境界:

```text
既存アプリへ書き込まず、Pageには参照元と表示方法だけを保存する。
個別選択・詳細フィルタはPG-2へ残す。
外部公開、他者掲載依頼、Manager受信箱、決済、独自ドメインは未実装。
AI OFFICEの保存処理・作業中差分は変更なし。
```

次:

```text
PG-2-a: CMSブロックの選択・フィルタ
```

検収:

```text
npm.cmd run lint: 成功
npm.cmd run build: 成功（90 static pages）
```

## PG-2-a: CMS選択・フィルタ

完了。

```text
更新: lib/page/types.ts
更新: lib/page/cms-selectors.ts
更新: components/page/PageDocumentEditor.tsx
更新: components/page/PageDashboard.tsx
```

実装内容:

```text
CMSブロックごとに表示候補を個別選択可能にした。
未選択時は参照元の公開候補をすべて表示する。
今月のみ、承認済みのみのフィルタを追加。
Pageには候補IDと条件だけを保存し、元データをコピーしない。
```

次:

```text
PG-2-b: Connect / PartnersをPage内CMSコンテンツとして追加
```

検収:

```text
npm.cmd run lint: 成功
npm.cmd run build: 成功（90 static pages）
```

## PG-1-b: Page新規作成

完了。

```text
追加: app/apps/page/new/page.tsx
追加: components/page/PageNewSiteForm.tsx
更新: components/page/PageDashboard.tsx
更新: lib/page/store.ts
```

実装内容:

```text
/apps/page/new をAuthGate配下で追加。
サイト名・説明・下書きslugを入力し、ログイン中プロフィールを所有者としてlocalStorageへ保存。
作成時に空の「ホーム」下書きを1ページ追加。
slugを半角英小文字・数字・ハイフンへ正規化し、既存サイトとの重複を拒否。
Page入口から「新しいPageを作る」導線を追加し、保存後は一覧へ戻る。
```

境界:

```text
保存するのはPageサイト情報・空のホームページ・公開設定の下書きだけ。
外部公開、CMS selectors、他者掲載依頼、Manager受信箱、販売委託、決済、独自ドメインは未実装。
既存アプリとAI OFFICEの保存処理・作業中差分は変更なし。
```

次:

```text
PG-1-c: /apps/page/[siteId] のページ一覧・編集導線
```

検収:

```text
npm.cmd run lint: 成功
npm.cmd run build: 成功（89 static pages、/apps/page/new 追加確認）
```

## PG-1-c: サイト内ページ管理

完了。

```text
追加: app/apps/page/[siteId]/page.tsx
追加: components/page/PageSiteEditor.tsx
更新: components/page/PageDashboard.tsx
更新: lib/page/store.ts
```

実装内容:

```text
/apps/page/[siteId] をAuthGate配下で追加。
サイト内のページ一覧、ページ追加、削除、上下並び替えをlocalStorageで実装。
最低1ページを残し、同一サイト内のページslug重複を拒否。
Page入口からサイト管理、各ページからブロック編集ルートへの導線を追加。
```

境界:

```text
ページの公開、CMS selectors、他者掲載依頼、Manager受信箱、決済、独自ドメインは未実装。
既存アプリとAI OFFICEの保存処理・作業中差分は変更なし。
```

次:

```text
PG-1-d: /apps/page/[siteId]/[pageId] の積み上げ式ブロック編集
```
