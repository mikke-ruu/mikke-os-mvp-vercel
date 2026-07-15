# Fund F5-a Handoff

作成日: 2026-07-16

対象repo: `G:/Musubiプロジェクト/mikke-os-mvp`

状態: F5-a検収完了・F5-b未着手

## 1. 完了した接続

- `fund_projects` をFund本文のowner-private正本へ拡張
- owner-privateな `fund_plans` を追加
- anonが読める公開専用 `fund_public_projects` / `fund_public_plans` を追加
- public + draft以外だけをtriggerで公開投影へ同期
- owner保存をRLS有効のまま原子的に行うsecurity-invoker RPCを追加
- 作成・編集フォームをDB成功後にlocalStorage cache更新する順序へ変更
- `/fund/[profileSlug]` と詳細routeをSupabase優先読みへ変更
- 移行中の端末データを表示する場合は、他端末未公開であることを明示

## 2. 実DB

適用済みmigration:

```text
20260715162110_fund_f5_a_public_project_content.sql
```

Local / Remote migration履歴は一致しています。既存1件のFundも公開専用投影へbackfill済みです。

公開列には応援者名、メール、コメント、個別金額、申込時の確認事項、配送要否を持たせません。`display_amount=false` の金額Fundでは、plan価格だけでなく金額目標・金額進捗も公開投影上でマスクします。

## 3. 検収結果

- `fund_f5_a_public_content_rls.sql` を実DBで実行し、全fixtureをROLLBACK
- ownerは自分のproject / planを保存・読取可能
- 別authenticated actorはowner-private project / planを0件、他人名義の保存RPCは42501
- anonはowner-private表の権限なし、公開専用表のみ読取可能
- private / unlisted / draftは公開投影0件
- support変更後は個人情報を出さず集計値だけ再同期
- 金額非表示ではplan価格null、金額目標・金額進捗0
- F4の `fund_f4_b2_rls.sql` 回帰testも成功し、claim・同意・Story投影を維持
- Database AdvisorでF5-a由来の新しいsecurity警告0件
- 新規indexの未使用INFOは作成直後のため経過観察
- lint / build成功

## 4. 公開画面確認

実DBへ一時的なpublic project / active planを作成し、匿名相当の公開画面で次を確認しました。

- `/fund/ayumi` の一覧へ表示
- `/fund/ayumi/f5-public-check-20260716` でタイトル、本文、plan、外部申込導線を表示
- privateな申込確認事項は非表示
- `display_amount=false` の5,000円は非表示

検証用project / planは削除し、private / public projection / orphan planがすべて0件であることを確認済みです。

## 5. F5-aで残した境界

- owner一覧と編集初期値はF5-bまでlocalStorage cache中心
- 活動報告はF5-cまでlocalStorage
- 応援・提供管理はF5-dまでlocalStorage中心
- 完成記録・app linkはF5-eまでlocalStorage
- unlistedはtoken方式を確定するまで公開投影へ出さない
- 通知・通報・CSV・Webhookにはまだ進まない

## 6. 次の実行手順

次はF5-bだけを実施します。

1. authenticated owner専用のproject / plan読取adapterを追加
2. DB行から `FundProject` / `FundPlan` への変換を一本化
3. 既存localStorageデータを、本人確認と重複判定付きで一回だけDBへ移行
4. `/apps/fund` と編集routeの初期値をDB正本へ変更
5. localStorageを正本として扱う分岐を除去し、必要なら表示cacheだけ残す
6. owner / 別actor / anon、移行重複、公開投影、lint / buildを再検収

F5-bの完了前にF5-cへ進みません。

## 7. 同時に存在する別作業

Manager / Page / Team Works関連docsの未コミット変更はFundコミットへ混ぜません。Team Works追加計画はFund実装完了後に組み込みます。
