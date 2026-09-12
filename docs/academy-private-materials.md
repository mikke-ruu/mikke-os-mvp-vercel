# Academy限定PDF API契約

候補実装。`ACADEMY_PRIVATE_MATERIALS_ENABLED=true` と候補migrationが揃うまで503。既定off。本番適用・公開設定変更・既存ファイル削除は行わない。

## UIへの契約

- UI統合: `PrivateMaterialFiles` / `PrivateInstructorResourceForm`、`lib/academy/private-material-client.ts`。本番画面は `NEXT_PUBLIC_ACADEMY_PRIVATE_MATERIALS_ENABLED=true` が必要で既定off。開発用サンプルではUIのみ表示し、client側で送信/取得を拒否する。
- API既定offと画面既定offは別。画面フラグだけを有効にしない。実Storage E2E/保持運用/DB適用/API有効化を確認してから同時に展開する。
- `AcademyMaterial.url` はnullable、`delivery_mode` は旧データ互換でoptional。private_fileの表示では外部アンカーを作らない。削除APIがないためprivate親の削除操作も表示しない。
- 講師用は同一編集画面で下書き親を作成し、そのIDへアップロード。通信結果不明時に自動で親/ファイルを再作成しない。受講生用は復習ページ保存で得たIDを使用する。
- ダウンロード済みの端末ファイルは回収不可。画面UI接続のテスト成功を実Storage E2E成功と扱わない。

- 型: `lib/academy/private-material-contract.ts`。既存 `types/database.ts` はAcademy室で更新する。
- `audience=learner` の `parentId` は保存済み `academy_learner_pages.id`。
- `audience=instructor` の `parentId` は保存済み `academy_materials.id`。
- 全APIは `Authorization: Bearer <access_token>`。POSTは同一originのブラウザから送る。Cookieのみの認証やURLへのtoken埋め込みは不可。
- エラーは `{error: 日本語文字列}`。401=再ログイン、403=権限/契約、404=閲覧不可または不存在、400=入力、408=送信timeout、413=サイズ超過、503=準備中/一時失敗。エラーにもno-store。

### URLなしの講師資料親

`POST /api/academy/private-materials/instructor-parent`

Content-Typeはapplication/json。

```json
{"courseId":"uuid","title":"講師用資料","requiresActive":true,"isPublished":false}
```

201で `{material:{id,courseId,title,requiresActive,isPublished,deliveryMode:"private_file",url:null}}`。
HQは講座の現物から取得し、user_idは確認済み本人。既存教材RLSと試用/公開guardを通す。owner以外は公開状態で作成できない。受講生用の親は既存ページ保存で作る。

`delivery_mode`を追加し、既存行はexternal_urlのまま。private_fileはPDFかつurl=nullで作成する。既存保持workerが非公開資料に付ける`about:blank#retained-record`だけは互換性のため許容。これは新規作成用ダミーURLではない。UIはmodeも確認し、private_fileで外部リンクを表示しない。

### PDFを追加

`POST /api/academy/private-materials?audience=learner&parentId=<uuid>`

- Content-Type: application/pdf
- X-Academy-Filename: encodeURIComponent(file.name)
- body: Fileそのもの（FormDataではない）
- 201で `{asset:{id,audience,parentId,originalName,byteSize,createdAt}}`

PDFのみ、3MiB（3×1024×1024 bytes）以下。サーバー中継のため初期上限を小さくしている。ヘッダーとEOFの基本形式チェックであり、ウイルス検査済みの保証ではない。添付ダウンロードとして返し、HTMLや埋め込み表示はしない。

親作成後にアップロードが失敗しても親を再作成せず同じidで再試行する。成功済みか不明な通信断では一覧を再取得して確認する。自動再送による重複防止のidempotencyは未実装。

### 一覧と取得

- `GET /api/academy/private-materials?audience=...&parentId=...` → `{assets:[...]}`。readyのみ、新しい順、上限100件。
- `GET /api/academy/private-materials/<assetId>` → PDF attachment。Bearer付きfetchでBlobを取得してダウンロードする。公開URL/署名URLは返さない。取得前後で本人JWTのRLSを確認する。
- Blob/object URLを使ったらUI側でrevokeする。永続キャッシュやService Workerキャッシュに入れない。既にダウンロードした資料は期限後も端末に残り、回収できない。

## 権限境界

- learner: 親復習ページ公開 AND 本人のactive grant AND starts_at<=now AND ends_atが未設定または未来。
- instructor: 独立資料is_published AND 現行の登録・認定条件。requires_active=true時だけ活動状態も必要。renewal_dueは新たな失効日時にしない。
- 本部owner/administrator/course_editor: 自HQ/講座に限る管理操作。
- 新規private assetのアップロードは既存のHQ access mode paidを要求する。読み取りは親公開状態と既存の受講/講師権限に合わせ、本部の契約状態から独自の受講期限を追加しない。既存URL資料の権限/期限や旧教材行は変更しない。
- metadataはJWTで準備。ランダムasset IDからサーバーが保存キーを生成。scopeは変更不可のAPI契約。service keyは確認後のファイル転送とready/failedの更新だけに使用。
- private bucketへの利用者の直接操作は全拒否。制限付きポリシーで他の広いStorageポリシーのOR合成も遮断する。利用者が署名URLを発行する抜け道も作らない。
- 後から親非公開・失効・退会した場合は新規取得を拒否。既存授業資料を受講生へ自動開放しない。
- 削除・置換APIはない。FKはrestrictで親の削除による孤立化を防ぐ。失敗ファイルは非公開のまま残す。物理削除/保持期限workerとの統合は別作業であり、本番有効化前の運用確認事項。

## 検証方法と境界

- `node scripts/academy-private-materials-test.mjs`: 実Request/ResponseとモックSupabase transportのAPI/型テスト。
- `npm run lint`、`npm run build`。
- SQLはネットワークなしの使い捨てPostgres17で `scripts/academy-private-materials-db-test.sql`。fixtureと候補migrationを/tmpへ配置して実行。合成データのみ。既存の関数/テーブルは今回使う部分をfixtureで再現したもので、全本番スキーマのコピーではない。
- 実Supabase Auth/Storage HTTPを通したファイル往復、ユーザーUI接続、Safari/PWAは別の未検証gate。DBロールテストをStorage E2E完了とは扱わない。
- 本番DB適用、deploy、フラグONは未実施。既存保持workerと新ファイルの物理保持方針、実Storage E2Eを確認してから有効化する。

公式資料: [Storage権限](https://supabase.com/docs/guides/storage/security/access-control)、[非公開ファイルの取得](https://supabase.com/docs/guides/storage/serving/downloads)。
