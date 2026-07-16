# Fund F5-c Handoff

作成日: 2026-07-16

対象repo: `G:/Musubiプロジェクト/mikke-os-mvp`

状態: F5-c検収完了・F5-d未着手

## 1. 完了した接続

- `fund_updates` を活動報告のowner-private正本として追加
- `fund_public_updates` を公開専用投影として追加
- ownerの活動報告一覧・新規保存・draft/public切替をSupabaseへ接続
- owner previewはDB上のdraftを含め、公開詳細は公開投影だけを読む
- 公開projectがprivate / unlisted / draftになった場合は活動報告投影も削除し、再公開時はpublic報告だけを復元
- service roleはブラウザへ出さず、保存RPCは `security invoker` + owner RLSを利用

## 2. draft / public境界

- draftは `published_at=null` かつ公開投影0件
- publicへ切り替えるとDB triggerが公開日時を確定
- draftへ戻すと公開日時をnullへ戻し、公開投影を削除
- public報告でも親projectが公開専用投影に存在しない場合は外部公開しない
- 公開投影へ出す列はtitle / body / image URL / published / created / updated日時だけ
- `source_local_id`、owner情報、応援者・申込・決済情報は公開表に置かない

## 3. 旧localStorageの一回移行

- 旧 `mikke.fund.updates.v1` が実在する場合だけ対象とし、seed fallbackは使わない
- 現在profileが実DB上で所有するprojectの `source_local_id` と一致する報告だけを移行
- DBに同じproject ID + update IDがある場合はskipし、既存DB行を上書きしない
- 別profile相当の旧報告は削除せず保全
- 全件成功後だけ `mikke.fund.f5c.migration.v1.<profileId>` markerを保存
- DB保存成功後だけprofile別 `mikke.fund.owner-updates.v2.<profileId>` cacheを更新

## 4. 実DB

適用済みmigration:

```text
20260716105132_fund_f5_c_activity_updates.sql
```

Local / Remote migration履歴は上記versionまで一致しています。

検収時点の実データは `fund_updates` 0件、`fund_public_updates` 0件です。F5-c SQL testのproject / update fixtureはすべてROLLBACKされ、残件0件です。旧端末報告がある場合は、そのownerが更新後の画面を最初に開いたときに本人分だけ移行されます。

## 5. 検収結果

- `fund_f5_c_activity_updates.sql` 成功
  - ownerは自分の報告だけを読取り・保存可能
  - 別authenticated actorはowner-private報告0件、保存・直接insertは拒否
  - anonはowner-private表を直接読めず、公開投影だけ読取り可能
  - draft / public、親project private / public、無効画像URLを検収
- `fund_f4_b1_rls.sql` / `fund_f4_b2_rls.sql` / `fund_f5_a_public_content_rls.sql` / `fund_f5_b_owner_content.sql` 回帰成功
- `fund_updates` / `fund_public_updates` はRLS enabled + forced
- F5-c由来の新しいDatabase Advisor security / performance警告0件
- 既存Fund Advisor項目はF4のsecurity-definer RPC 4件と既存index INFO 5件で増加なし
- `npm.cmd run lint` 成功
- `npm.cmd run build` 成功。build ID: `HMS2o0jsrVuxSnbpGrkWb`

参照:

- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Database function security](https://supabase.com/docs/guides/database/functions#security-definer-vs-invoker)
- [Database Advisor](https://supabase.com/docs/guides/database/database-advisors)

## 6. F5-d前に残す境界

- support / payment / fulfillmentのowner管理はF5-dまでlocalStorage中心
- challenge record / app linkはF5-eまでlocalStorage
- unlistedはtoken方式を確定するまで公開投影へ出さない
- 通知・通報・CSV・Webhookにはまだ進まない
- Team Works追加計画はFund完了後に組み込む

## 7. 次の実行手順

F5-c限定commit後、次のphaseはF5-dです。

1. 既存 `fund_supports` とownerの応援者・提供管理画面の項目差分を監査
2. payment / fulfillment / record statusの保存境界を固定
3. 支援者本人、owner、別actor、anonのRLS否定testを先に作る
4. owner画面をDB正本へ接続し、既存public進捗集計の回帰を検収
5. private Activity Log / DESK候補との二重記録を避ける方針を確定
6. Advisor、migration履歴、lint / buildを再検収

F5-d完了前にF5-eへ進みません。

## 8. 別作業の保全

Manager / Page / Team Works関連docsの未コミット変更はFund commitへ混ぜません。
