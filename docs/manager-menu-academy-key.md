# ManagerのAcademy表示設定

本番の制約とreplace RPCがAcademyを許可していなかったため、追加migrationで両方の許可キーだけを拡張する。既存migration、本人の設定行、所有権、料金、他アプリの状態は変更しない。RPCの所有者とACLはCREATE OR REPLACEで維持する。適用はtransaction内で行う。

対象は `20260909084607_manager_menu_academy_key.sql`。本番の既存履歴は `20260826041147_manager_app_menu_preferences` であり、ローカル旧番号との差を履歴再編で修正する作業ではない。

`node scripts/manager-menu-academy-db-check.mjs` で実PostgreSQL17.6の最小Auth fixtureを検査した。既存行/ACLの不変、Academy保存、A/B分離、不正payload、直接table/anon拒否、本人resetは成功。最初の実行は最後のcontainer削除コマンドが60秒でtimeoutしてexit1となったが、後続の正確な名前によるdocker ps -aがexit0/空で、削除実施済みと確認した。cleanupはtimeout時にも残存を検査するよう修正した。この修正後のrunner全体再実行はまだ行っていない。

実Auth、anonymous sign-in JWT、全schema replay、UI操作、本番適用は別ゲート。特に既存RPCのauth.uid()非null条件を通常登録ユーザー限定と読み替えない。このmigrationは既存認証条件を変更しない。
