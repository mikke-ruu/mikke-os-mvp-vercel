# 初公開7日制度のサーバー処理

`service.ts` は新制度へ明示申し込みする本部だけのprepare/publish/unpublish/cancel処理。既存のtrial/paid/internal grantを書き換えない。承認済みpolicyをサーバーから注入し、未設定では新しい申込と公開を拒否する。テストpolicyは商品条件の承認ではない。

公開と起点、owner単位の利用履歴、決済同期待ちoutboxを同一transactionにする。外部プロバイダをtransaction内で呼ばない。DB保存前後の失敗を区別し、commit後の下書き化で起点や申込を戻さない。取消はrollout停止後にも利用可能。

## 接続契約と未完了

`rpc-client.ts` は既存の認証済みユーザーclientを注入して `academy_first_publication_command` を1回呼ぶ接続adapter。actorや時計をブラウザから渡さず、戻りDTOの本部・金額・168h・状態を検査する。status成功時のnullだけを未登録とし、エラーでは例外を返す。serviceのcallbackを複数RESTへ分解して実行しない。

- Repository.transactionの本番実装が必要。DBから取得した本人・本部所有者・契約権限・旧制度履歴・料金・支払準備確認を使う。ブラウザのbooleanやactor文字列を認証の根拠にしない。
- ownerとHQの順でロックし、他HQの同一ownerによる無料枠再利用を拒否する。callback例外はcourse/state/outbox/ledgerを全てROLLBACKする。別々のPostgREST更新で代用しない。
- 対象制度のDB migration、既存course/access guardの新制度限定分岐、実API認証、永続outbox workerは未接続。既存setCoursePublishedは差し替えていない。
- 通常の有料期間への接続は決済担当の担当。期限後の公開はこのtrial用serviceでは拒否し、有料accessの経路へ移る。ブラウザへ無条件に成功を返さない。
- 取消受付と課金dispatchは同じ永続scopeで直列化が必要。このcoreから請求は実行しない。
- 未決商条件は法務・統制で集約中。実顧客データや本番DBは使用せず、テストはメモリ上の隔離transactionで実行する。実DBのRLS/同時実行検証と同一視しない。

実行: `node scripts/academy-first-publication-core-check.mjs`。typescriptが別worktreeにある場合は `ACADEMY_TYPESCRIPT_PATH` で既存インストールへの絶対パスを指定できる。
