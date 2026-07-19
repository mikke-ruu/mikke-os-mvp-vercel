# Page Builder 実装進捗（2026-07-19）

## 目的

Pageを、mikkeOSのCMSをmikkeIDで接続できるだけでなく、会社・店舗・活動サイトを直感的に構築できるホームページ作成アプリへ拡張する。
Connect / Partnersは専用機能として作らず、PageのテンプレートとCMSブロックを組み合わせて、あゆみが構築・運営できることを検証する。

## 今回実装した範囲

- サイト開始テンプレート: 白紙、会社・店舗、サービス、ポートフォリオ、Connect / Partners
- セクションテンプレート: メイン画像、画像と文章、会社概要、特徴グリッド、CTA、CMS
- ブロック: 見出し、文章、画像、ボタン、フォーム表示、区切り、会社概要、2・3カラム、画像グリッド、スライドショー、CMS、外部埋め込み、自由HTML
- サイトデザイン: 配色、見出し・本文フォント、表示幅、ボタン形状
- ブロックデザイン: 背景色、文字色、文字揃え、余白、角丸、簡単な表示アニメーション
- PC・タブレット・スマートフォンのプレビュー
- ブロックの追加、並べ替え、複製、非表示、削除、元に戻す、やり直す
- AI生成HTMLを一式表示するページモード
- CMS参照元: Story、Item Studio、Event、Academy、Session、Order、FUND、Community

CMSは参照元アプリのデータを選び、表示するための仕組みである。Page側へ元データを複製したり、Connect / Partners専用の保存・管理機能を作ったりしない。

## 画像保存

- Supabase Storageに公開バケット `page-assets` を作成
- JPEG / PNG / WebP、1ファイル10MB以下だけを受付
- 保存前に長辺2400px以内、WebP品質0.86へ変換
- 保存パスは `<mikkeID>/<siteId>/<年月>/<一意ID>.webp`
- 認証ユーザーは、自分のmikkeID配下だけを追加・更新・削除可能
- Pageデータには画像本体を入れず、公開URL、保存パス、ファイル名、サイズ、縦横寸法だけを保存
- 画像と外部表示は遅延読み込み

2026-07-19の追加決定により、Page専用画像保存からmikkeOS共通の `Mikke Media` へ移行した。新規画像は `mikke-media` bucketへ保存し、無料枠はmikkeIDごと100MBとする。保存済み画像をPage内および将来の他アプリから再利用できる。

詳細は `docs/MIKKEOS_MEDIA_FOUNDATION_AND_HTML_POLICY_2026-07-19.md` を参照する。

初期DB変更は `supabase/migrations/20260719044459_page_builder_assets.sql`、共通メディア移行は `supabase/migrations/20260719053654_mikke_media_foundation.sql`、使用箇所同期と安全な削除は `supabase/migrations/20260719054957_mikke_media_lifecycle.sql` に記録し、接続中のSupabaseプロジェクトにも適用済み。

## 安全性

- 外部埋め込みと自由HTMLはsandbox iframeでPage編集画面から隔離
- AI HTMLはCSPを付け、スクリプトは利用者が明示的に許可した場合だけ実行
- YouTubeはプライバシー強化URLへ変換
- Instagram投稿・リールURLは埋め込みURLへ正規化
- `prefers-reduced-motion` により、端末側で動きを減らす設定を尊重

## 今回作らないもの

- 公開ルートと一般公開処理
- 他者掲載依頼
- Manager受信箱接続
- 問い合わせフォームの実送信
- 決済
- 独自ドメイン
- Connect / Partners専用アプリまたは専用管理画面

## 検収

- Page編集画面で3ペイン編集、各ブロック、CMS参照元、AI HTMLモードを画面確認
- 新規サイト画面で開始テンプレートとテーマ選択を確認
- Supabase Storageのバケットと所有者制限ポリシーを確認
- lint、production build、Page専用コミットまでを完了条件とする
