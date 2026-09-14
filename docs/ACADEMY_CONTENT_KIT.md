# Academy共通コンテンツ編集セット

## 採用範囲

2026-09-13、Media室が固定した `mikke-os-mvp-media-writing-20260912` / `codex/media-writing-20260912` の未コミット共通ファイルをレビューして専用worktreeへ明示的に取り込んだ。origin/master由来とは扱わない。

- UI: MikkeRichWriting、MikkeLayoutFields、MikkeInsertMenu、MikkeContentRenderer、MikkeContentEditor、MikkeBlockFieldsの6ファイル。
- lib: types.ts、rich-text.ts、blocks.js、blocks.d.ts、academy-adapter.tsの5ファイル。
- 共通側の修正は末尾挿入メニューへのallowedTypes伝播のみ。Media室にも連絡済み。
- Media保存、コメント、役割切替、MikkeContentLibrary、local-libraryは採用しない。

本部ホームページ編集と講座紹介はLpBlocksEditor経由、復習ページと講師マニュアルはAcademyContentEditor経由。同じ共通入力部品を使う。公開HP/公開講座と権限付きポータルは既存PageBlocksから共通表示部品へ接続する。

## 保存契約

Academyの既存JSON配列を維持する。新編集後の各表示ブロックは `contentVersion: 1` と `content: MikkeContentBlock` を持ち、旧表示用フィールドも残す。共通形式へ型キャストして済ませず、`lib/academy/content-adapter.ts` で明示的に往復変換する。旧ページを開く・プレビューするだけでは保存や移行をしない。

- 旧8種類、画像リンク、キャプションを読み込む。
- 装飾、文字リンク、配置、列数、引用、箇条書き、区切り、安定したIDを共通payloadに保存する。
- 復習/講師ページのvideoとlinksは旧typeも維持する。LPの新種類には旧クライアント向けの文章投影を残す。
- materials-listは共通配列へ変換しない。元の配列中の位置に保持し、共通挿入メニューからは追加できない。
- 表示ブロックへ受講者、所有者、教材、権利の情報をコピーしない。
- 未対応のcontentVersionは旧フィールドで表示する。古いクライアントで再保存すると新装飾を失う可能性があるため、公開前に全表示/編集クライアントとJSON取得経路の互換検証が必要。

## ホスト側の責任

画像は既存AcademyImageUploader（sourceApp=academy）を使用する。既存URLの取得方式・所有確認・保存先は変更しない。限定PDFと教材は従来の権限付き経路を維持する。共通rendererの動画/リンクはAcademyの安全な外部リンク表示を使用し、任意iframeやHTMLを実行しない。

EditorPreviewはローカル入力だけを表示し、保存APIを呼ばない。既存の保存ボタンと公開状態を維持する。**独立した公開スナップショット保存機能を新設したわけではない**。既存の公開済みページを保存すると閲覧側へ反映される従来仕様は変更しない。

## 検証と別ゲート

`node scripts/academy-content-kit-test.cjs`: 旧8種、原本非変更、双方向JSON、文字装飾、画像配置、教材分離、安全リンク、共通表示。

`node scripts/academy-editor-preview-test.cjs`: 従来画像リンク・プレビュー互換。

DB/RLS/Storage/課金変更なし。本番データの自動移行なし。本番反映なし。実ログインでの保存→再読込、DBのJSON往復、実画像アップロード、公開ページとの差分、モバイルSafari、全体buildは別途確認する。
