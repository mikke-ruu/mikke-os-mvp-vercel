# MediaとSTORY・Page・Academyの任意連携（2026-09-08）

状態: ローカルプロフィールUI。DB、他アプリ実接続、本番公開は未実施。

## MediaからSTORY
- 自己紹介は任意500文字。公開STORYへのリンクは初期OFF。
- mikke-os.com/story/{mikke ID} のHTTPS公開URLのみ。編集URL、認証情報、query/hashは不可。
- 公開リンクを貼ることは本人所有の証明にならない。名前・写真・権限の自動取得はしない。
- ローカルreaderだけに表示。server公開DTOは変更しない。正式接続時は本人の公開STORYをサーバーで解決し選択できる導線へ置換する。

## 他アプリへ記事を掲載する最小契約
- 初期OFF。記事ごとに掲載先を明示選択し、掲載先の管理権限とMediaの掲載権限をサーバーで検証する。
- 内部参照: 掲載先種別・掲載先ID・Media記事ID・承認したversion/revision・承認日時。公開レスポンスにownerや内部IDを含めない。
- 公開カード: title, excerpt, canonicalUrl, 検証済みcover, publishedAt。draftは入力として受けない。
- 読み取り時にMedia公開状態と掲載許可を再検査。非公開化・削除・掲載解除・参照失敗は非表示。古いキャッシュへのfallback不可。
- 記事改訂を他アプリに無条件反映しない。掲載承認versionを固定し、新版掲載は再承認。非公開化は固定版にも優先する。
- 取得不能時に空欄を出せるadapterを設ける。実効的な取り下げを保証するまで公開キャッシュ不可。
- 共通ルール§5に従い最新記事の自動追加なし。本文コピー、Activity Logの生データ参照なし。
- AI、アフィリエイト、課金、STORY以外の人物情報同期は範囲外。

## 担当室確認
- STORY: 公開プロフィールの掲載位置・公開snapshot契約のレビュー依頼済み。
- Page: 選択記事ブロックのadapterレビュー依頼済み。
- Academy: 本部公開ページ app/academy/site/page.tsx のfront_blocksと講座一覧の間を候補。編集はapp/academy/front/page.tsx。front_blocksへの静的コピーは禁止。manageable HQとMedia所有を別々に検証。進行中のAcademyリリースに混ぜず別slice。
- 統制: 上記境界でローカル契約継続可。共有型・DB・公開範囲変更は別レビュー。

## 制限
localStorage試作は認可の正典ではない。今回の設定は他アプリへ送信せず、本番Media routeの404も維持する。共通ルールはorigin/masterにないため既存の共有コピーと統制workflowを暫定参照した。

## 統制追加レビュー
STORY公開面はapp/story/[handle]/page.tsx → components/mikkeos/StoryNameCard.tsx。Pageはlib/page/types.ts、cms-selectors.ts、components/page/PageRenderer.tsx。Page既存の空選択=全候補表示はMediaへ流用せず、空選択=非表示を強制する。STORYのmockProfileを本人確認に使わない。公開画像URL内に内部所有者パスがないことも別途検証する。
