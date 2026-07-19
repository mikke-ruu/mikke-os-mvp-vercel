# Mikke Media共通基盤・Page HTML容量方針（2026-07-19）

## 1. この文書の目的

Pageで実装したファイルアップロードを各アプリへ個別コピーせず、mikkeOS全体で再利用できる画像基盤へ統一する。
無料提供を開始しても、利用者の急増によってSupabase容量と通信費が無制限に増えないようにする。

この文書は、Claude Codeを含む次の実装担当が参照する正本とする。

## 2. 決定事項

- 共通名称は `Mikke Media`
- 画像の所有単位はmikkeID。現実装ではログイン中の `auth.uid()` を所有者IDとして使う
- 無料枠はmikkeIDごとに合計100MB
- Page、Story、Event、Order、FUND、Communityなどで、同じ画像を再アップロードせず再利用する
- 通常利用者には画像URLを入力させない
- 画像欄の基本UIは「ファイルを追加」「以前の画像から選ぶ」
- URL入力は、必要なアプリだけ上級者向け項目として残せる
- サイト掲載用画像は公開URLを使う。非公開書類・本人確認資料などはMikke Mediaへ入れず、別のprivate bucketを使う

## 3. 無料枠と画像処理

| 項目 | 現在値 |
| --- | ---: |
| mikkeIDごとの無料枠 | 100MB |
| 選択できる元画像 | JPEG / PNG / WebP |
| 元画像の上限 | 15MB |
| 保存形式 | WebP |
| 保存画像の長辺 | 最大2000px |
| 保存画像の上限 | 3MB |
| ブラウザキャッシュ | 1年 |

画像はブラウザ内で縮小・WebP化してからアップロードし、元の巨大画像は保存しない。
容量予約をDBで行った後だけStorageへの追加を許可する。予約処理はmikkeID単位のトランザクションロックを取り、同時アップロードでも100MB枠を超えにくくする。

## 4. Supabase実装

適用済みマイグレーション:

`supabase/migrations/20260719053654_mikke_media_foundation.sql`

`supabase/migrations/20260719054957_mikke_media_lifecycle.sql`

作成内容:

- 公開Storage bucket `mikke-media`
- `mikke_media_accounts`: プランと容量上限
- `mikke_media_assets`: 画像メタデータ、容量、所有者、状態
- `mikke_media_usages`: 各アプリ・各項目からの参照記録用
- `reserve_mikke_media_asset`: 容量確認とアップロード予約
- `finalize_mikke_media_asset`: Storage実体確認後に利用可能化
- `cancel_mikke_media_reservation`: 失敗した予約の取消
- `get_mikke_media_usage`: 使用量・上限・画像数の取得
- `sync_mikke_media_usages`: Pageなどの利用箇所を画像へ関連付け
- 使用中画像を保護したうえでの削除・復旧・メタデータ整理処理
- 所有者RLSと、予約済みパスだけにアップロードを許可するStorageポリシー

権限を伴う処理は非公開 `private` schemaのSECURITY DEFINER関数へ隔離し、公開RPCはSECURITY INVOKERの薄い窓口とする。private関数内でも `auth.uid()` を必ず検証する。

既存の `page-assets` bucketは削除していない。Pageの新規アップロードは `mikke-media` へ切り替え、過去データ互換用として残す。

## 5. Pageでの実装

主要ファイル:

- `components/media/MikkeMediaPicker.tsx`
- `lib/media/client.ts`
- `lib/media/types.ts`
- `components/page/PageImageUploader.tsx`
- `lib/page/assets.ts`
- `lib/page/types.ts`

Pageの画像、カラム、画像グリッド、スライドショーは共通のMikke Media Pickerを使う。
Picker内で現在の使用量を表示し、保存済み画像を一覧から再選択できる。
Pageを保存すると使用中の画像IDも同期される。使用中画像はライブラリから削除できず、Pageから外して保存した後に削除できる。

## 6. HTMLページの容量・通信

HTML・CSS・JavaScriptの文字列も保存容量を使うが、通常は画像より非常に小さい。
Pageでは合計500KBを上限とする。

次の違いを利用者へ表示する:

- HTML文字列: Pageデータの保存容量を使用する
- 外部サイトの画像・動画・フォント: その外部サイトの通信を使用する
- `mikke-media` の画像URL: Supabase Storageの通信として計上される
- YouTube / Instagram iframe: 各サービスとの通信が発生する
- JavaScriptのAPI通信: 接続先との通信が発生する

base64画像・フォントをHTMLへ直接埋め込むと、HTML自体が巨大化して容量制限を迂回できてしまう。そのためPageでは保存を拒否し、sandbox CSPでも `data:` 画像・フォントを許可しない。HTML内の画像はMikke Mediaまたはhttps URLを使う。

外部HTMLは無料ではあるが無通信ではない。外部サービス側の規約、Cookie、追跡、表示停止の影響も受けるため、埋め込み枠はsandbox iframe内で継続する。

## 7. 他アプリへの移行順

1. PageでMikke Mediaを先行検証
2. Story / Eventの画像URL欄を共通Pickerへ変更
3. Order / FUND / Communityの掲載画像へ変更
4. Item Studio / Academyの公開画像へ変更
5. 各アプリ保存時に、`mikke_media_usages`へ利用箇所を登録
6. 30日ゴミ箱、管理者の容量監視
7. 有料プラン確定後、Standard / Businessの容量を設定

移行時は、既存URLを直ちに消さない。既存URLを表示しながら、差し替え時からMikke Mediaへ保存する段階移行にする。

## 8. 次に必要な機能

- 30日間復元できるゴミ箱（現時点の画面操作は未使用画像の即時完全削除）
- 画像がどのアプリで使われているかの詳細表示
- 80% / 95%到達通知
- 管理者向け総容量・通信量モニター
- 有料プラン変更時の `max_bytes` 更新処理
- PageがDB保存へ移行した時点で、Pageブロックと `mikke_media_usages` を同期

## 9. 今回の除外

- 公開Pageルート
- 他者掲載依頼
- Manager受信箱接続
- 決済・有料プラン契約処理
- 独自ドメイン
- AI OFFICE関連の既存未コミット変更

## 10. Claude Codeへの確認事項

Claude Codeは、この共通基盤が既存のmikkeOS計画と矛盾しないかを確認する。
特に、各アプリが独自bucket・独自アップローダーを増やす計画が残っている場合は、Mikke Media Pickerを使う計画へ修正する。
実装変更を行う場合も、AI OFFICE差分および今回のPage/Mikke Media専用コミットを混ぜない。
