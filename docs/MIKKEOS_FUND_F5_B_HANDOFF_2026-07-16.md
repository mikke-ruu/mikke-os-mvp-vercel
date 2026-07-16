# Fund F5-b Handoff

作成日: 2026-07-16

対象repo: `G:/Musubiプロジェクト/mikke-os-mvp`

状態: F5-b検収完了・F5-c未着手

## 1. 完了した接続

- `/apps/fund` とowner側のedit / preview / supporters / updates / fulfillment / complete routeは `fund_projects` / `fund_plans` を正本として読む
- 読取りadapterはRLSに加え `owner_profile_id` で明示filterする
- DB行のUUIDは後続F5-c〜eとの接続を壊さず、`source_local_id` を現行 `FundProject.id` / route IDへ復元する
- project / planのlocalStorageはprofile別v2 keyの表示cacheに変更し、DB失敗時は古いcacheを正本として表示しない
- 作成・編集・完成化はDB成功後だけcacheとActivity Logを更新する
- F5-d前の境界として、進捗の `currentValue` だけは既存support localStorageをprofile別project cacheに重ねる

## 2. 旧localStorageの一回移行

- 実際に `mikke.fund.projects.v1` が存在する場合だけ対象とし、seed fallbackは移行しない
- 現在profileのhandleと旧projectの `profileSlug` が一致するデータだけを本人分として移行する
- DBに同じ `source_local_id` があるprojectはskipし、古いcacheで上書きしない
- 別profileのデータは削除せず保全し、画面へ非技術的な案内を出す
- 全件成功後だけprofile別markerを保存する。部分失敗ではmarkerを付けず、RPCのupsertで再実行可能
- 旧v1 dataはF5-bで削除せず、後続移行の安全材料として残す

## 3. 実DB

適用済みmigration:

```text
20260715165421_fund_f5_b_owner_source_ids.sql
```

`fund_projects.source_local_id` を欠損時backfill、NOT NULL、1〜160文字、owner内uniqueに固定しました。Local / Remote migration履歴は `20260715165421` まで一致しています。

検収後の実データはproject 1件、`source_local_id` 欠損0件、長さ違反0件、F5-b test fixture 0件です。

## 4. 検収結果

- `fund_f5_b_owner_content.sql` でowner / 別authenticated actor / anon、source ID必須条件、同一IDの2回保存後もproject / plan 1件を確認
- `fund_f4_b1_rls.sql` / `fund_f4_b2_rls.sql` / `fund_f5_a_public_content_rls.sql` 回帰test成功
- 全SQL test fixtureはROLLBACK済み
- Database AdvisorでF5-b由来の新規security / performance警告0件
- 既存Fund警告はF4の意図的security-definer RPC 4件、作成直後を含むインデックスINFO 5件で、F5-bの変更対象外
- `npm.cmd run lint` 成功
- `npm.cmd run build` 成功。build ID: `REPlg2DwIHAJByOfGBkF0`

## 5. owner画面確認

2026-07-16に実画面 `http://localhost:3000/apps/fund` で確認しました。

- 2人目のテスト用profile `info_jsparts_43fb` ではFund 0件。他ownerのFundを表示しない
- owner profile `ayumi`へ切り替えると、実DBの「新しい認定講座を一緒につくりたい」を1件表示
- 公開状態、応援進捗、owner管理導線を表示し、DB読込エラーと不要な移行警告なし
- 空表示はデータ消失ではなく、RLSによるprofile所有境界であることを実DB集計と実画面の両方で確認

## 6. F5-b後も残す境界

- 活動報告はF5-cまでlocalStorage
- support / payment / fulfillmentはF5-dまでlocalStorage中心
- challenge record / app linkはF5-eまでlocalStorage
- unlistedはtoken方式を確定するまで公開投影へ出さない
- 通知・通報・CSV・Webhookにはまだ進まない
- Team Works追加計画はFund完了後に組み込む。F5-cより先に実装しない

## 7. 次の実行手順

F5-bのみcommit後、次のphaseはF5-cです。

1. `fund_updates` owner-private正本と公開専用投影の設計を固定
2. draft / public、本文・画像URL・公開日時の境界をmigration化
3. owner / 別actor / anonのRLS否定testを先に作る
4. owner活動報告のDB-first保存と公開画面を接続
5. Database Advisor、migration履歴、lint / buildを再検収

F5-c完了前にF5-dへ進みません。

## 8. 別作業の保全

Manager / Page / Team Works関連docsの未コミット変更はFund commitへ混ぜません。
