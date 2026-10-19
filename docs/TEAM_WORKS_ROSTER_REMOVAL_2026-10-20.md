# クライアント名簿からの削除

ユーザー依頼により、クライアントポータルで誤登録を名簿から外せる操作を追加。既存の名前・グループ編集は維持する。

## 動作

- 各名簿行の「削除」を押すと、対象名と「登録済みの予定・記録は残る」ことを確認する。
- キャンセルでは更新しない。実行中は削除操作を無効にし、結果またはエラーを表示する。
- 削除は既存のstatus=archived、archived_atを使う。新しい候補一覧から外すが、参加者行とsession_rosterは消さない。完全消去ではない。
- 既存予定の氏名は本部・クライアント双方で解決し続ける。パートナー側は元から割当済み参加者をstatusで除外せず読んでいるため変更不要。
- クライアントの登録済み出席順では「名簿から削除済み」と表示する。必要なら「この回から外す」で選択を外して、出席順を保存する。名簿削除だけで既存予定の参加者を勝手に取り消さない。
- 本部の「〜として表示」やサンプル表示では削除できない。グループの削除は今回の対象外。

## データと権限

削除処理はログイン済みclient_userと対象プロジェクトのclient membershipを確認する。更新条件は参加者IDとproject_idの両方。更新行が0件なら成功扱いしない。

接続先nttqpprkqbynxyldbnjsのスキーマとRLSを読み取り確認。participantsにはarchived状態・archived_atがあり、client用SELECT/UPDATE policyがある。FKはsession_rosterからparticipantsへRESTRICT。今回migration、権限追加、実データ更新は行っていない。認証済み利用者による本番保存のE2Eは別ゲート。

## ローカル検証

```text
node scripts/team-works-roster-removal-test.cjs
node scripts/team-works-roster-ui-test.cjs
node node_modules/typescript/bin/tsc -p tsconfig.team-works-roster-check.json --pretty false
git diff --check
```

処理テスト7項目、イベントハンドラのテスト5項目は成功。実データ・ネットワークを使わない。権限不足、別プロジェクト、0件更新、DBエラー、履歴の保持、キャンセル、確認用表示での禁止を含む。

画面のローカル確認用には `node scripts/team-works-roster-preview.cjs` を使う。localhost:4387だけで待受し、実際のコンポーネントとCSSを使うがデータはメモリ上の架空データ。実DBや認証へ接続しない。ページ再読込で初期状態に戻る。`?readonly`で確認用表示を確認できる。

変更箇所の型確認は終了コード0で成功。git diff --checkも成功。全体lintは長時間終了しなかったため中断した。

実ブラウザでは名簿2名・保存済み出席順の表示と、削除クリック時の対象名・履歴保持の確認ダイアログまで確認。キャンセル操作後に操作ツールのCDPタイムアウトが繰り返され、画面での結果確認と390px/1280pxの実画面確認は未完了。イベントハンドラのテストはブラウザ実測の代わりにはしない。本番反映前に画面操作確認を完了する。

## 作業境界

専用worktree: G:/Musubiプロジェクト/mikke-os-mvp-team-works-roster-20261019。
branch: codex/team-works-roster-removal-20261019。
base: d390e409c4e20abefbddf733273e9279b348c535（origin/master取得済み）。

共有checkoutの既存差分は変更していない。共通ルールはこのorigin/masterにパスが存在せず未確認。既存引き継ぎの範囲とAGENTS、AYUMI VOICE、費用承認ルールに従った。push、merge、デプロイ、本番データ削除は行っていない。
