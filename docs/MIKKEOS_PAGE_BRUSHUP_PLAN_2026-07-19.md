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

## 7. Wave 3 バックログ（2026-07-19 実地テストFB・未着手）

Wave 1/2実装後、ユーザーが実際に触った上でのフィードバック。次回Fableが設計を
確定してから着手する（現時点では記録のみ・実装しない）。

```text
PB-B7 プレビューの手動ズームで内容が見えない（バグ扱い）
  PageDeviceFrame（mode="content"）は zoomMode の値に関わらず常に
  overflow:hidden。zoomMode="auto"は必ず収まるよう計算されるので問題ないが、
  手動指定（特に100%）でデバイス幅が枠より広い場合、はみ出た部分が
  スクロールもできず単純に見えなくなる（以前の「横スクロールが面倒」を
  Wave1で解消した際に、スクロールごと奪ってしまった）。
  対応方針（案）: zoomMode !== "auto" の時は overflow-x: auto にする。

PB-B8 下書き未保存の内容がサイト全体プレビューに出ない／プレビューの
  「戻る」が元の編集ページでなく一覧に飛ぶ
  PageSitePreviewは保存済みstoreを読むため、エディタ側の未保存state
  （blocks等）は反映されない。プレビューを開く動線・「戻る」の遷移先を
  含めて再設計が必要（保存を促す／未保存プレビューを別経路で見せる／
  「戻る」に遷移元のsiteId+pageIdを持たせる、等の選択肢がある）。

PB-B9 フォームブロックが1種類しか置けない
  現状は「お問い合わせ」用の固定フォーム枠が1つのみ。用途ごとに複数
  設置したい・項目をカスタムしたいという要望。フォーム送信の実処理は
  既存計画通りSupabase本接続フェーズ送りだが、ブロックとしての複数設置・
  項目編集は先出しで検討可能。

PB-B10 カラムブロックで画像のみの時に余白が固定でつく
  columns block内の各カードは常に p-5 padding。title/text/eyebrowが
  全て空（画像だけ入れたい）場合でも余白が残る。テキスト要素が全て
  空の時はpaddingを詰める、または画像のみカードの専用レイアウトを用意する。

PB-B11 サイト自体のヘッダーナビが存在しない（2026-07-19 ユーザー回答で判明・設計確定）
  意図確認の結果、「公開するサイト自体のヘッダーナビ」を指すと判明。
  調査した結果、これは配置変更要望ではなく機能の欠落だった:
  PageSitePreviewの上部にある「ページ切替」タブ（PageSitePreview.tsx
  78-89行）はOS内プレビューツールのUI装飾であり、PageRenderer が実際に
  出力するブロック列（＝将来PG-3で公開される中身）には他ページへの
  ナビが一切含まれない。複数ページのサイトを作っても、訪問者はページ間を
  移動する手段がない状態だった。

  設計（Fable確定・積み上げ式の既存哲学に合わせる）:
  - 新ブロック種別 "nav" を追加。既存の見出し/文章/ボタン等と同じ
    「積み上げるブロックの1つ」として扱う（サイト全体の自動ヘッダー化はしない）。
  - v1の中身はシンプルに: サイトの全ページ（site.documents）を順番に
    横並びのリンク行として自動列挙する。個別リンクの手動編集・除外設定は
    v1では作らない（後で拡張可）。
  - 位置は「ブロックをどこに置くか」で決まる（既存のブロック並び替え
    ↑↓operationsをそのまま使う）＝「メニューの場所を変えたい」は
    ブロック移動という既存機能で自然に満たされる。新しい配置システムは作らない。
  - スタイルは既存のPageBlockStyle（背景色/余白/角丸/文字揃え/アニメーション）
    をそのまま使う。専用のスタイル系は作らない。
  - 実装が必要な箇所:
    lib/page/types.ts に PageNavBlock 追加（type:"nav"）。
    PageRenderer が nav ブロックをレンダリングするには、そのサイトの
    documents一覧（id/title/slug）が必要 → PageRenderer props に
    任意の `sitePages?: {id:string; title:string; slug:string}[]` を追加
    （呼び出し元: PageDocumentEditor/PageSitePreviewは実データを渡す、
    PageTemplatePreview等の装飾プレビューは省略可＝空配列扱い）。
    パーツ追加パネル（BuilderSidebar）に「メニュー」を追加。
    現在表示中のページはハイライト、リンクは decorative時はspan化
    （PageRenderer.tsxのbutton/columns/cms同様のパターンを踏襲）。

PB-B12 CMSブロックの絞り込み設定がエディタUIに見当たらない
  docs/MIKKEOS_PAGE_IMPLEMENTATION_PLAN.md PG-2は「セレクト/フィルタ」
  完了と記載されているが、実際の編集画面でCMSブロックのfilters
  （おすすめ/今月/認定のみ等）を触るUIが見当たらないとの指摘。
  実装済みで見つけにくいだけか、docsの記載が先行していたのかを
  次回まず確認する。
```

## 8. Wave 3 実装結果（2026-07-20・Sonnet実装完了）

```text
PB-B7 完了。components/page/PageDeviceFrame.tsx のmode="content"スタイルで、
  zoomMode !== "auto" の時だけ overflowX: "auto" / overflowY: "hidden" を
  追加（autoの時は従来通りoverflow:"hidden"のまま）。

PB-B12 完了。CMSブロックの絞り込みUI（PageBlockEditor.tsx）に「今月のみ」
  「承認済みのみ」と並べて「おすすめのみ」（filters.featuredOnly）の
  Checkboxを追加。既存のPageCmsItem型にfeatured相当のデータ項目が無いため、
  PageRenderer.tsx側の絞り込みロジック（thisMonthOnly/approvedOnlyと同様の
  実データ連動）は今回のスコープ外（値の保存とUIのみ。指示通り「追加するだけ」）。

PB-B10 完了。components/page/PageRenderer.tsx のcolumns block描画で、
  column.eyebrow/title/text/buttonLabelが全て空の時はテキスト用divごと
  描画しないよう変更（画像だけのカードはpadding無しになる）。1つでも
  値があれば従来通りp-5で描画。

PB-B8 完了。
  - PageDocumentEditor.tsx: 「サイトを表示」を<Link>からボタンに変更。
    save()がPromise<boolean>を返すようにし、dirtyな時はまずsave()を
    awaitして成功時のみ/apps/page/[siteId]/preview?page=[slug]へ遷移。
    失敗時はsave()内でmessageにエラーが表示され遷移しない。
  - PageSitePreview.tsx: 「編集に戻る」を<Link>からボタンに変更し、
    window.history.length > 1（try/catchで簡易判定）ならrouter.back()、
    historyが無い場合は/apps/page/[siteId]へrouter.pushするフォールバック。

PB-B9 完了。
  - 事前確認: BuilderSidebarの「フォーム枠」パーツから2個目以降のform
    ブロックを追加できるかを確認。addBlocks/createEmptyPageBlockには
    ブロック種別の重複を防ぐ仕組みが無く、各追加でuniqueなidが発行される
    ため、複数のformブロック追加は元々技術的制限なく可能だった（バグなし）。
  - lib/page/types.ts: PageFormField型（id/label/type/required/options）と
    PageFormBlock.fields?: PageFormField[]を追加。
  - components/page/PageBlockEditor.tsx: createDefaultPageFormFields()を
    新設しエクスポート（お名前=text必須／メールアドレス=email必須／
    お問い合わせ内容=textarea必須の3件）。createEmptyPageBlockの"form"は
    このデフォルトfieldsを持って生成。インスペクタに項目の追加・削除・
    並び替え（↑↓）・ラベル編集・種別選択（text/email/tel/textarea/select）・
    必須トグル・（select時のみ）選択肢テキストエリアを実装
    （columns/companyの配列編集UIパターンを踏襲）。
  - components/page/PageRenderer.tsx: form block描画をダミー1個から
    block.fields（無ければcreateDefaultPageFormFieldsへフォールバック）を
    mapした実際のinput/textarea/select（すべてdisabled）に変更。ラベルと
    必須マーク(*)を表示。既存データ（fieldsが無いブロック）でも例外なく
    デフォルト3件で描画される。

PB-B11 完了。
  - lib/page/types.ts: PageBlockTypeに"nav"、PageNavBlock（追加フィールド
    無し）、PageBlock unionに追加。
  - components/page/PageRenderer.tsx: PageRendererに
    sitePages?: {id,title,slug}[]（既定[]）とactiveDocumentId?: string
    を追加しRenderedBlockまで引き渡し。block.type==="nav"の描画を追加
    （sitePagesを横並びのボタン風リンクとして列挙。activeDocumentIdと
    一致するページをprimary色でハイライト。decorative時はspan、通常時は
    `<a href="/${page.slug}">`。sitePagesが空の時は
    「ページが追加されるとメニューが表示されます。」を表示）。
  - 呼び出し元: PageDocumentEditor.tsx（previewDocument表示部）と
    PageSitePreview.tsx はsite.documentsから{id,title,slug}配列と
    activeDocumentId（document.id / activeDocument.id）を渡すよう更新。
    PageTemplatePreview.tsx・PageDashboard.tsxは変更なし（sitePages省略
    ＝空配列扱いでプレースホルダー文言が出るのみ、decorative装飾プレビュー
    として問題ない）。
  - components/page/PageBlockEditor.tsx: パーツ一覧に「メニュー」
    （type:"nav"、Menuアイコン）を追加。createEmptyPageBlockに"nav"の
    ケースを追加（baseのみ）。インスペクタは説明文のみ
    （「サイトの全ページが自動で並びます。表示位置はブロックの並び替え
    (↑↓)で調整できます。」）、編集項目なし。

検証: npm run lint（tsc --noEmit）成功。npm run build成功
  （/apps/page/[siteId]、/apps/page/[siteId]/[pageId]、
  /apps/page/[siteId]/preview を含む全93ルートを生成）。

既存データ互換: PageFormBlock.fields、PageRenderer.sitePages/
  activeDocumentId、PageCmsBlock.filters.featuredOnlyはすべてoptionalで
  追加し、未指定時のフォールバック（デフォルト3項目／空配列／未定義扱い）
  を実装。旧データを読み込んでも例外は発生しない。

未実装・妥協点:
  - PB-B12のfeaturedOnly絞り込みは、UIとデータ保存のみで実際のCMS表示
    フィルタリングには未接続（PageCmsItem型にfeatured相当のフィールドが
    無いため。指示通り「Checkboxを追加するだけ」のスコープ）。
  - フォームの実送信処理・nav以外のリンク手動編集/除外設定は、計画通り
    後続フェーズ（公開・Supabase本接続フェーズ）送り。
```
