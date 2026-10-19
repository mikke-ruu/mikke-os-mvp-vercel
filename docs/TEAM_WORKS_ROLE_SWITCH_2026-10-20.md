# 自分の役割の画面切り替え

本人から本部・クライアント・パートナーの切り替えメニューの実装と本番反映まで依頼された。

本部の共通外枠、クライアントの共通外枠、運営型パートナーのトップ画面に「画面を切り替え」を追加。同一ログインの有効な役割が2つ以上ある場合に表示する。owner/managerまたは組織所有者を本部、client_userをクライアント、workerをパートナーとして扱う。パートナーの名称は既存の表示ラベルを使う。リンクは同じドメイン内で遷移する。

他人として表示・サンプル表示の間は「自分の画面へ」と表示。本人が使える役割だけを出し、リンクへasやsample等のパラメーターを引き継がない。現在地を本人の役割と誤表示しない。参加プロジェクトや招待承認の条件、認証・RLSは変更しない。新規登録・自分招待・承認を代行する機能ではない。

既存のuseTeamWorksPortalRolesに本部判定を追加。組織と有効membershipの読み取りのみ。DB schemaや権限の変更なし。役割を新たに登録した場合は画面を再読み込みする。

検証コマンド:

```
node scripts/team-works-role-switch-test.cjs
node node_modules/typescript/bin/tsc -p tsconfig.team-works-role-check.json --pretty false
git diff --check
```

役割8組合せ、ロード中の非表示、確認用表示から本人へのリンク、現ユーザーの有効membership・manager・組織所有者・未知roleをテストする。本番確認結果はConsultation Logに記録。
