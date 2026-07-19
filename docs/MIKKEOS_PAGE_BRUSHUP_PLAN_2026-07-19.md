# Page Builder ブラッシュアップ計画（2026-07-19）

作成: Claude (Fable) — 設計判断担当
実装: Sonnetサブエージェント（PB-B番号で依頼・1波=1エージェント）
背景: ユーザーFB「HP作成サービスとしてオシャレじゃない／テンプレのイメージが湧かない／
ネイビーが重い／フォントの自由度が低い／プレビューが横スクロール／本ページプレビューと
リンクチェックが欲しい」。目標は **使いやすい・見やすい・オシャレ**。

## 0. Pageの立ち位置（ユーザー確認済み・2026-07-19）

STUDIO/BASE/Jimdoを使った経験からの要求:
「AIだけだと編集が面倒で指定箇所に手が届かない。ノーコード編集の分かりやすさと
AIの速さを兼任するのがmikke Page」。→ ブラッシュアップは"手で触る側"の品質を上げる。

## 1. 設計判断（Fable確定）

```text
D1. 配色とフォントを分離する。現在の4プリセット（gothic/soft/serif/modern）は
    「配色＋フォント＋幅＋ボタン」の癒着セット。これを
    「カラーパレット（10種）」×「フォント（日本語×欧文の自由組合せ）」に分ける。
    既存presetIdは後方互換のため残す（読み込み時のフォールバック）。

D2. ユーザーサイトのテーマ色はhex直値でよい（ユーザーコンテンツであり、
    --mikke-*トークン規則はOSのUI側だけに適用。既存themeも既にhexを保存している）。
    エディタ・ダッシュボードのUI（OS側）は引き続き--mikke-*のみ。

D3. Google Fontsを実際に読み込む仕組みを入れる。現状はfont-family文字列を
    指定するだけで読み込みがなく、端末次第で豆腐/代替表示になっている。
    使用中フォントのcss2 <link>を動的に注入する（display=swap）。

D4. フォントは「日本語フォント」「欧文フォント（任意）」の2軸選択。
    欧文を選ぶとfont-familyチェーンの先頭に入り、英字だけ欧文フォント・
    日本語はJPフォントで描画される（CSSフォールバックの標準挙動を利用）。
    サイト全体の既定に加えて、ブロックごとの上書き（style.jpFontId/latinFontId）を追加。

D5. プレビューは「自動（幅に合わせる）」を既定にする。コンテナ幅をResizeObserverで
    測り、scale = 枠幅/デバイス幅 を自動適用。手動倍率は残すが既定は自動。
    横スクロールは発生させない。

D6. サイト全体プレビュー（本ページプレビュー）を専用ルートで追加:
    /apps/page/[siteId]/preview（AuthGate必須）。
    サイトヘッダー（サイト名＋ページナビ）付きで全ページを切替表示。
    ページ内のリンクで slug が一致するものはプレビュー内遷移させる。

D7. リンクチェック機能をプレビューに併設。全ブロックのhref/urlを走査し、
    「空リンク」「#のみのダミー」「存在しないページslug」「http(s)形式でない外部URL」
    を一覧表示（fetchはしない・形式と内部整合のみ）。クリックで該当ページ編集へ。

D8. テンプレートカードは灰色スケルトンをやめ、実テンプレートのブロックを
    PageRendererで縮小レンダリングした実物ミニプレビューにする。
    写真はチャットン生成のバンドル画像（public/page-templates/）を使う。
    画像が届くまでは淡いグラデーションのプレースホルダーで先行実装。

D9. Pageダッシュボードのネイビーベタ塗りヒーローをやめ、白ベース＋
    やわらかいグラデーション（既存トークンのsoft系）＋実物プレビューの
    見せ場に置き換える。ネイビーは文字色・小さなアクセントに格下げ。

D10. テンプレ内の初期画像スロットにもバンドル写真を割り当てる
     （ユーザーが差し替えるまでの仮画像。Mikke Mediaは使わない＝
     ユーザーの容量を消費させない。バンドル画像はアプリ資産扱い）。
```

## 2. カラーパレット（10種・ユーザーサイト用）

パレットは background / text / primary / accent の4色。名前は日本語。

```text
p01 しろがさね   bg #ffffff text #2a2e35 primary #3b4252 accent #e08a5a（既定）
p02 きなり       bg #faf6f0 text #4a3f38 primary #b0674a accent #d99c73
p03 らて         bg #f8f4ee text #443c34 primary #8a6f57 accent #c2a382
p04 せーじ       bg #f6f8f4 text #35413a primary #5f7a68 accent #a3b899
p05 みずいろ     bg #f4f7fa text #313b47 primary #5b7c99 accent #9db8cf
p06 もーゔ       bg #f9f6fb text #3f3646 primary #7d6493 accent #b79fc7
p07 さくら       bg #fdf6f6 text #4a3a3c primary #b96a76 accent #e3aab2
p08 はちみつ     bg #fdfaf1 text #45402f primary #c19a3f accent #e4c568
p09 しんりょく   bg #f4f6f4 text #2c3a31 primary #34523f accent #c99b5f
p10 よる         bg #16181d text #f2f3f5 primary #e9e4da accent #d99c73（ダーク）
```

カスタム（4色を個別指定）は既存のtheme編集があれば温存、なければ今回は作らない。

## 3. フォントカタログ（Google Fonts）

```text
日本語（jpFonts）:
  noto-sans     Noto Sans JP        定番ゴシック
  noto-serif    Noto Serif JP       明朝
  zen-kaku      Zen Kaku Gothic New やわらかゴシック
  zen-old       Zen Old Mincho      クラシック明朝
  zen-maru      Zen Maru Gothic     丸ゴシック
  mplus-round   M PLUS Rounded 1c   ポップ丸ゴ
  shippori      Shippori Mincho     上品明朝
  biz-ud        BIZ UDPGothic       読みやすさ重視

欧文（latinFonts・任意）:
  none          なし（日本語フォントに任せる）
  inter         Inter               モダンサンセリフ
  montserrat    Montserrat          幾何学サンセリフ
  poppins       Poppins             丸みサンセリフ
  playfair      Playfair Display    高級セリフ
  cormorant     Cormorant Garamond  細身クラシック
  dm-serif      DM Serif Display    大見出し向けセリフ
  josefin       Josefin Sans        細身レトロモダン
  caveat        Caveat              手書き風
```

サイトテーマ: 見出し(jp+latin)・本文(jp+latin)の4選択。
ブロック上書き: PageBlockStyleに jpFontId / latinFontId（optional）を追加
（そのブロックの見出し・本文の両方に適用。細分化はしない＝UIを重くしない）。
フォントローダー: 使用中フォントidを集めてcss2の<link>を1本生成するコンポーネント
（lib/page/fonts.ts + components/page/PageFontLoader.tsx）。

## 4. 実装タスク（PB-B番号）

### Wave 1（Sonnetサブエージェント・今回）

```text
PB-B1 プレビュー自動フィット
  - PageDocumentEditorのプレビューに「自動」倍率を追加し既定にする。
    ResizeObserverで枠幅を測りtransform scale（またはzoom）を自動計算。
    横スクロールを発生させない。デバイス切替時も自動追従。
PB-B2 サイト全体プレビュー＋リンクチェック
  - app/apps/page/[siteId]/preview ルート新設（AuthGate）。
    サイトヘッダー（サイト名＋表示中ページのナビ）＋PageRenderer全幅表示。
    ページ切替タブ・デバイス切替・「編集に戻る」。
    slug一致リンクはプレビュー内でページ切替（クリックを委譲処理）。
  - リンクチェックパネル: D7の4分類を一覧表示、該当ページ編集画面へのリンク付き。
  - サイト編集画面・ページ編集画面に「サイトを表示」ボタンを追加。
PB-B3 タイポグラフィ刷新
  - lib/page/fonts.ts（カタログ＋チェーン生成＋css2 URL生成）
  - PageFontLoader（使用フォントの<link>注入）
  - PageSiteThemeに headingJpFontId/headingLatinFontId/bodyJpFontId/bodyLatinFontId
    を追加（optional・旧headingFont/bodyFont文字列はフォールバックとして温存）
  - PageBlockStyleに jpFontId/latinFontId 追加＋インスペクタにフォント選択UI
  - デザインパネルを「カラー」「フォント」の2区分に再構成
PB-B4 カラーパレット10種
  - lib/page/palettes.ts（2章の10種）
  - デザインパネルのパレット選択UI（色玉プレビュー付き）
  - 旧4プリセットは「おまかせセット」として残してもよいが、配色とフォントの
    個別変更が主導線になるよう配置
PB-B5 ダッシュボード＋テンプレカードの刷新
  - ヒーローを白ベース＋softグラデーションへ（D9。ネイビーベタ塗り廃止）
  - PageTemplatePreviewを実物ミニプレビュー化（createStarterTemplateの
    ブロックをPageRenderer compactで縮小描画。D8）
  - 「最近のサイト」カードも同方式で先頭ページの実物縮小プレビューに
  - 画像プレースホルダー: public/page-templates/ の画像があれば使い、
    なければ淡グラデーション（画像未着でも成立する実装に）
```

### Wave 2（チャットン写真が届いてから・別途依頼）

```text
PB-B6 バンドル写真の組み込み
  - public/page-templates/ に写真を配置し、テンプレカード・スターター
    テンプレの初期画像スロット・ヒーロー見せ場に割り当てる
```

### 対象外（今回やらない）

```text
- 公開ルート・決済・独自ドメイン・Manager受信箱（従来どおり後続フェーズ）
- HTMLモードの拡張・AI生成の組み込み強化（別計画）
- app/globals.css の変更（AI OFFICEの未コミット差分と混ざるため禁止）
- Mikke Media関連ファイルの変更（MM-1〜4はcodexの担当領域）
```

## 5. 実装上の制約（必読）

```text
- 触ってよい: components/page/ lib/page/ app/apps/page/ public/page-templates/
- 触るの禁止: app/globals.css、ai-office関連全部、app/api/、nintei-koza関連、
  components/media/・lib/media/（Mikke Media本体）、他アプリのlib/画面
- コミットは自分が変更したPage関連ファイルのみをgit addで明示指定
  （作業ツリーにAI OFFICE等の未コミット差分が同居している。git add -A 禁止）
- OS側UI（エディタ・ダッシュボード）の色は--mikke-*トークンのみ。
  ユーザーサイトテーマ側はhex可（D2）
- 検収: npm run lint と npm run build が通ること（Gドライブは遅い・
  タイムアウト長めに）。既存サイトデータ（旧theme）が読み込めること
```

## 6. チャットン用画像プロンプト（ユーザー経由で生成依頼）

生成仕様: 横長16:9（1600×900）、文字なし、明るい自然光、日本の小規模事業の
温度感、WebP保存。ファイル名は指定どおり `public/page-templates/` へ。

→ プロンプト本文はユーザーへのチャット返信に記載（このdocsには要件のみ）。

```text
必要枚数（Wave 2で使用）:
  hero-company.webp    会社・団体テンプレの見せ場
  hero-service.webp    サービステンプレの見せ場
  hero-portfolio.webp  作品・実績テンプレの見せ場
  hero-portal.webp     CMSポータルテンプレの見せ場
  about-1.webp         画像と文章セクション用（正方形寄りでも可）
  gallery-1.webp gallery-2.webp gallery-3.webp  ギャラリー用（正方形1200×1200）
```
