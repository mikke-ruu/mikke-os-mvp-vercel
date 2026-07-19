# Academy ブラッシュアップ計画（2026-07-20）

作成: Claude (Fable) — 設計判断担当
実装: Sonnetサブエージェント（AC-B番号で依頼。Pageと同方式）
背景: あゆみが実際に認定講座構築（CACM）を運用しながら触った上でのFB14件。
認定講座構築を早く回したい優先度に合わせ、ここから着手する。

## 0. 全体の方向性

Pageの時と同じく「使いやすい・見やすい・オシャレ」を目指す。加えて今回は
Academy固有の論点として、**Pageで作ったブロックビルダーの資産を横展開できないか**
という視点が要望に何度も出てきた（LP・講師ページ・フロントの3箇所）。

## 1. Wave A（機械的・低リスク・すぐ着手可）

```text
AC-1 モバイル下部ナビをAcademy専用に
  現状: components/academy/AcademyShell.tsx のモバイル下部ナビが
  OS共通フッター（Academy/Manager/Apps）になっている。
  修正: 単体アプリとして使う人が大半という前提で、下部ナビをAcademy自身の
  主要機能（ダッシュボード/講座管理/講師管理/申込管理 等、既存タブの中で
  優先度が高いもの4〜5個）に差し替える。OS共通ナビへの導線はハンバーガー
  メニュー側に残す。

AC-2 PC表示を左サイドバー化
  現状: HonbuShell/KoushiShellの横スクロールタブ（PC表示でもスクロール式）。
  修正: PC（md以上）では左サイドバー固定リスト表示に変更。モバイルは
  現状の横スクロールタブのままでよい（AC-1のモバイル下部ナビと役割分担：
  下部ナビ=最重要4-5個、横スクロールタブ=全項目）。

AC-3 タブのハイライトバグ修正
  講師ページ編集画面(instructor-page)を開いているのに「講座管理」タブが
  active表示（赤）になっている。アクティブ判定ロジック（pathnameの前方一致
  範囲）を修正。

AC-4 余白・情報密度の調整
  ダッシュボード等がスマホ表示をそのまま引き伸ばしたように間延びして見える。
  PC表示時はカードのグリッド密度を上げる、統計カードの周りに補助情報
  （グラフ・最近の活動リストの拡張等）を足す、又は最大幅を絞ってレイアウトを
  締める、のいずれかで対応（Page Wave1のダッシュボード刷新と同じ発想）。

AC-5 本部側・講師編集画面に写真＋自由記述を追加
  講師詳細編集（本部側）で写真が入れられない。MikkeMediaPicker
  （components/media/MikkeMediaPicker.tsx・sourceApp="academy"）を使って
  講師写真欄を追加。自由記述欄（bio）も追加。
```

## 2. Wave B（Mikke Media移行・既存MM-3/MM-4計画と統合）

既に `docs/MIKKEOS_MEDIA_FOUNDATION_AND_HTML_POLICY_2026-07-19.md` にMM-3/MM-4として
記録済みの内容。Academy着手のこのタイミングでまとめて実施する。

```text
MM-3: CourseForm.tsx の「メイン画像URL」／front/page.tsx の「メイン画像URL」を
      MikkeMediaPickerへ置換
MM-4: courses/[id]/lp/page.tsx・courses/[id]/instructor-page/page.tsx の
      画像ブロックをMikkeMediaPickerへ置換
```

## 3. Wave C（LP・講師ページ・フロントのブロックビルド強化）

**Page式ブロックビルダーの簡易版をAcademyへ横展開する。** ただしPageほど自由な
積み上げ式にはしない（Academyは講座構築という決まった目的があるため）。

```text
現状の問題:
- 講座LP(courses/[id]/lp)・講師専用ページ(courses/[id]/instructor-page)の
  ブロックエディタは「見出し/文章/画像」の3種類のみ（lib/page/typesのような
  リッチなブロック体系がない）。結果、掲載できる内容が薄く、既存の外部LP
  （CACM本番ページ、あゆみ提示のスクリーンショット8枚目）に比べて簡素に見える。
- フロントページ(academy/front)も同様に単一ヒーロー+講座カード程度で薄い。

方針:
- 講座の基本情報（受講料・時間・キット内容・カリキュラム・FAQ・申込導線）は
  既にCourseForm側の構造化フィールドとして持っている（academy-app記憶より）。
  これは変更しない・壊さない。LP builderは「基本情報だけでは伝えきれない
  補足コンテンツ」を組み立てる場所という位置づけを保つ。
- ブロック種類をPageから一部輸入する: 見出し/文章/画像に加えて
  「画像と文章（2カラム）」「画像グリッド」「CTA」を追加。company/cms/
  html/embed等Page固有の複雑なブロックは持ち込まない（Academyの目的に
  対して過剰）。
- 実装は lib/page/types.ts の型・components/page/PageBlockEditor.tsx の
  UIパターンを参考にしつつ、Academy専用の型（例: AcademyLpBlock拡張）と
  して別実装する（Page側のコードは変更しない・依存させない）。
- フロントページ(academy/front)も同じブロック体系で作り替え、
  「わたしらしい学びで…」のような単一ヒーローだけでなく、複数セクションを
  積み上げられるようにする。

教材・資料タブの扱い（要判断・次回確認）:
- あゆみ要望: 「教材・資料は講師ページに入る内容なので削除、講師ページも
  page式ビルドにしてほしい」。
- 解釈が2通りある: ①ナビの独立タブをやめて講師ページビルダーの中に
  「教材」ブロックとして統合するだけ（データ(academy_materials)は温存）
  ②教材データそのものを講師ページのブロック（画像/ファイルリンク）に
  置き換えて académy_materialsテーブルを使わなくする。
  → ①を推奨（データ構造の破壊的変更を避けつつ要望を満たせる）。次回の
  着手前に一言確認できると安全。
```

## 4. Wave D（申込・決済・キット注文フローの整理）— 実コード確認済み・設計確定

`lib/academy/applications.ts`・`lib/academy/kits.ts`・`lib/academy/lp.ts` を読んだ結果、
想定より土台は良好だった。**大きなスキーマ再設計は不要**、小さな追加2点で要件を満たせる。

### 実コードで判明した現状（誤解していた点の訂正）

```text
- academy_applications には既に honbu_revenue/instructor_revenue の分離、
  intake_source("honbu"|"koushi")、instructor_id が存在する。
- academy_kit_orders は createKitOrder(profile, instructor, input) で
  instructor_id: instructor.id が最初から入る＝「注文者=講師」は
  **既に正しくモデル化されている**。誤解していたのはここではない。
- 実際に欠けているのは2点だけ:
  ① academy_kit_orders に academy_applications への紐づけが無い
    （instructor_idはあるがapplication_idが無い。キット注文が「どの受講者の分か」
    を構造的に持てず、講師がtitleに自由記述するしかない状態）。
  ② 送り先住所を持つ列がどこにも無い（applications・kit_ordersどちらにも無い）。
- ディプロマ用の追加質問は、**既に汎用の仕組みがある**。
  CourseFormの申込項目エディタ（AcademyFormField型・text/textarea/email/tel/
  select/checkbox）で講座ごとにカスタム質問を定義でき、公開申込フォームの
  submitPublicApplication(lib/academy/lp.ts)で form_answers(jsonb想定)に
  回答が保存される。→ **コード変更不要**。ディプロマを発行する講座側で
  申込項目エディタから必要な質問（例: 本名・送付先住所・生年月日等）を
  追加するだけで、あゆみ自身が今すぐ設定できる。今回のWave Dでは触らない。
- app/academy/portal/applications/page.tsx 39行目の文言
  「あなたの営業用URLから入った申込（担当申込）の一覧です。
  ステータスの更新は本部が行います。」自体は、
  「本部がステータスを更新する」という部分は現状の設計として正しい
  （講師は閲覧のみ・honbu側で一元管理、というのは意図した設計）。
  問題は「ここからキットを注文する」という導線が無く、文言もそれに触れて
  いないこと。
```

### 実装タスク（AC-D番号）

```text
AC-D1: スキーマ追加（要SQL投入・あゆみが実行）
  academy_kit_orders に以下を追加:
    application_id uuid null references academy_applications(id)
    shipping_address text null
  （既存行はnullのままで問題ない。破壊的変更ではない）

AC-D2: 講師ポータルのキット注文フローを「申込から選ぶ」形に変更
  app/academy/portal/kits/page.tsx の発注フォームを、自由記述titleではなく
  「自分が担当した申込（自分のinstructor_idが付いたacademy_applications）」
  から選択する形に変更。選択すると:
    - course_id・受講者名（表示用）が自動セット
    - 送り先セレクタ（受講者へ／自分（講師）へ／その他=自由入力）を出し、
      shipping_addressへ保存。もしその申込のform_answersに住所らしき
      回答があれば初期値として提示してよい（キー名の厳密突合は不要、
      「参考情報として表示するだけ」でよい＝壊れにくい実装にする）。
    - lib/academy/kits.ts の createKitOrder に application_id/shipping_address
      を渡せるよう引数拡張。

AC-D3: 本部側キット注文一覧・申込詳細に相互リンクを追加
  app/academy/kits/page.tsx（本部キット一覧）: application_idがある注文には
  「申込を見る」リンクを追加。
  app/academy/applications/[id]/page.tsx（本部申込詳細）: その申込に紐づく
  キット注文があれば表示（無ければ「まだキット注文はありません」）。

AC-D4: portal/applications/page.tsxの文言修正＋キット注文導線追加
  39行目の文言を実態に合わせて修正（例:「あなたの営業用URLから入った申込の
  一覧です。ステータスの更新は本部が行います。受講に必要なキットは、
  ここから注文してください。」）。各行に「キットを注文する」ボタンを追加し、
  押すとAC-D2のフォームへ該当applicationを渡した状態で遷移する。

AC-D5: 申込ステータスのインライン変更
  app/academy/applications/page.tsx（本部・申込一覧）の各行にステータスの
  <select>を直接置き、詳細画面へ遷移せずに更新できるようにする
  （lib/academy/applications.ts の updateApplication を流用）。

AC-D6: 外部決済リンクへの事前入力（可能な範囲で・必須ではない）
  申込完了画面から外部決済URLへ遷移する際、対応していれば
  ?prefilled_email=... 等のクエリパラメータを付与する（Stripe Payment Links
  はprefilled_emailに対応）。決済サービス側の対応可否はまちまちなので、
  「付けられる時だけ付ける」努力目標とし、無条件の前提にしない。
```

対象外（今回やらない）:

```text
- キット注文フォームでのform_answers自動転記の完全一致マッチング
  （キー名規約が定まっていないため、参考表示までに留める）
- 決済ステータスの外部サービスとの自動同期（Webhook等）は本接続フェーズ送り
```

## 5. Academyの位置づけの再確認（あゆみ発言・訂正なし）

```text
- 講師ポータルの「復習」ページ = 講師専用ページの閲覧画面（既存理解と一致・
  変更不要）。
```

## 6. 追加提案（Fableより）

```text
- 講座が複数になった時のための検索・絞り込みは今は不要だが、ダッシュボードの
  「講座管理」一覧がカード1枚だけの現状デザインのままだと数十件になった時に
  厳しくなる。Wave A/Cのタイミングで一覧をテーブル/グリッド切替できる
  余地だけ作っておくと後が楽（今回は作り込まない、レイアウトの逃げ道だけ
  意識する）。
- Wave Cでブロック種類を増やす際、Mikke Media側の使用量トラッキング
  （sync_mikke_media_usages）にAcademyのLP/講師ページ/フロントの各画像を
  必ず登録する（既存Mikke Media方針の徹底。忘れるとゴミ箱機能実装時に
  「実は使用中」の画像を誤って消せてしまう）。
- Wave D着手前に、キット注文の「送り先」を選ぶ主体（本部が固定で決めるのか、
  講師が申込ごとに選ぶのか）を実データモデルと合わせて1つだけ確認できると
  設計が速い（次回冒頭でまとめて確認する）。
```

## 7. 実行順序（推奨）

```text
Wave A → Wave B（MM-3/4と同時） → Wave C → Wave D
```

Wave A/Bは依存なし・すぐ着手可。Wave Cは中規模（新ブロック型追加）。
Wave Dは業務フロー再設計のため、次回セッション冒頭でのデータモデル確認と
1点の確認事項（送り先の決め方）を経てから着手する。
