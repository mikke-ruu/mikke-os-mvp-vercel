# 初公開制度のDB候補

2026-09-08。base `c8b4812`。CLI v2.105.0 の `migration new academy_first_publication_atomic` でファイル名を生成した。Supabaseには未適用。PGliteの最小fixtureには適用済み。

## ローカルテストの実行

`node supabase/tests/academy_first_publication_pglite.mjs` を実行する。PGlite 0.5.8のモジュールファイルへの絶対パスを環境変数 `ACADEMY_PGLITE_PATH` で指定できる。省略時は `G:/Musubiプロジェクト/.local-tools/academy-db-validation/node_modules/@electric-sql/pglite/dist/index.js` を使用する。依存パッケージを本アプリへ追加しない。DBはインメモリで作成し、成功・失敗にかかわらずfinallyでcloseする。

## 実装した範囲

`public.academy_first_publication_command` は actor を `auth.uid()` から取得し、非匿名の本部owner本人だけに制限する。引数は `p_headquarters_id uuid, p_action text, p_course_id uuid=null, p_quote_id uuid=null, p_confirmed boolean=false, p_terms_revision text=null, p_amount_yen bigint=null`。action は `status, prepare, publish, unpublish, cancel_conversion`。

戻り値はenrollmentのsnake_case JSON。未登録statusだけSQL null。他本部や認証失敗を未登録に変換しない。日時はtimestamptzのJSON文字列。

`academy_first_publication_quote(p_headquarters_id uuid,p_policy_version text)` は同じowner認証で有効policyと既存の現在料金見積RPCを読み、サーバー算定の `id, headquarters_id, owner_user_id, policy_version, terms_revision, amount_yen, instructor_count, issued_at, expires_at` を返す。古いquoteはrevokedにする。payment_verifiedはfalseのままで、quote取得では公開も無料時計も起動しない。公開時には現在人数と価格を再検査する。既存見積RPCが準備中HQのowner roleを認識できるかはDB検証対象。

policyは無seed。private quoteは本人・本部・policy・規約・価格・人数・有効期限・検証済み支払準備へ束縛する。prepareの明示同意とpublishを分離する。公開前は旧利用履歴、既存access、共通billing契約・権利、既存公開を拒否する。新規HQというだけでは適用しない。

owner行→HQ行の順に直列化する。初公開ではcourse更新、168時間の期限、削除不可のowner履歴、同期outboxを同じtransactionで保存する。失敗時は全てrollbackする。再公開は同じ起点を維持する。公開にはprivateなtransaction permitが必要で、ブラウザの直接更新による起点飛ばしを拒否する。下書き化は解約としない。取消は期限同時刻まで受け付け、取消outboxを別キーで作成する。

旧course guardのロジックは新制度へ登録していないHQで維持した。新制度登録行は移行で作成していない。

## 未完了の接続と検証

- Docker/psqlがPATH上にないため、PGlite 0.5.8のインメモリDBで代替検証した。`node supabase/tests/academy_first_publication_pglite.mjs` はexit 0、16チェック成功。実migration適用、SQL権限テスト、quote、未確認proof拒否、prepare、他owner拒否、直接公開拒否、公開失敗のowner履歴/outbox rollback、168時間、二講座再公開時刻固定、取消後編集拒否、unpublish、旧trial拒否を検査した。
- これは最小schema契約fixtureであり本番完全再現ではない。auth.users/auth.uidと依存テーブルは必要列だけ。旧access mode、内部権利判定、見積RPC、価格関数は簡略stub。provider確認はprivate quoteへのテスト用更新。実際の全RLS・Auth・課金除外算定・人数変動・多接続競合・advisorsは未検証。PGliteは単一接続であるため同時公開の合格根拠にはしない。
- 新HQの準備作成経路と新制度のaccess contextは未接続。course guardだけでは受講申込や他のlive operationを許可しない。これを解消せず本番有効化しない。
- 承認されたpolicy投入、trusted payment proof producer、provider outbox worker、初回請求との取消優先、同期期限超過、paid状態への移行は未接続。quote取得RPCは追加済み。
- Quoteは現行人数・除外と価格関数で再算定する。競合を避けるため初期案は講師/課金除外テーブルのSHARE lockを使う。広いロックの負荷とdeadlock retryは隔離DBで検証が必要。全writerを同じHQ lock規約にできたら狭める。
- 公開起点は必要ロック後のserver timeを使用する。取消受付はstatement_timestampを入口で確保し、ロック待機で期限を越えても受付時刻を維持する。ただし未処理取消intentの永続保存と課金worker側のdispatch直列化は未接続。初回課金workerをこのSQLだけで実装しない。
- ownerの変更、policy改訂時の継続、見積もり同意の監査履歴、準備中の解約後再申込は別レビューが必要。
- 新制度のguardは取消/attention/期限後の編集とDELETEを拒否する。非公開化だけは他の内容を同時変更しない場合に許可する。法務の「無料中取消後も元の無料末まで既存公開/編集を維持」という未承認推奨案とは異なる保守的候補であり、正式policyの承認後に整合させる。
- Supabase本番・クラウドbranch・実請求・実招待・Git pushなし。

設計根拠: Supabase公式 Database Functions https://supabase.com/docs/guides/database/functions 。search_path固定、非公開のdefiner本体、invoker wrapper、テーブルRLSと直接権限撤回を適用。changelog.mdはweb fetchのcontent-type制限で取得できず、HTMLのchangelogを確認した。
