# Fund F5-d Handoff

作成日: 2026-07-16

対象repo: `G:/Musubiプロジェクト/mikke-os-mvp`

状態: F5-d検収完了・F5-e未着手

## 1. 完了した接続

- `fund_supports` を応援者管理・決済確認・集計区分・提供状況のowner-private正本へ接続
- ownerの応援者一覧と提供状況画面をSupabase読取り・保存へ変更
- `source_local_id` をNOT NULL、1〜160文字、project内uniqueに固定
- 同じproject + source IDの保存はupsertし、既存DB UUID、claim、participationの参照を維持
- `public_name` / `is_anonymous` をowner-private列として追加
- payment / fulfillment / record statusと完了・取消日時の整合をDB triggerで固定
- Mikke ID招待処理からproject / supportのshadow writeを除去し、保存済みDB行だけを参照
- DB保存が成功した後だけprivate Activity Logを更新。失敗時は画面上でエラーを出し、Activity Logを変更しない

## 2. private / public境界

- `fund_supports` の応援者名、メール、公開名候補、匿名希望、管理メモ、金額、決済、提供状態はownerだけが読める
- 応援者本人はraw `fund_supports` を読まず、Mikke ID受取後の `fund_participations` だけを本人同意境界で読む
- anonはraw `fund_supports` と保存RPCを利用できない
- 公開画面へ出るのは既存の匿名化済み進捗集計と、owner・supporter双方の同意条件を満たした `fund_public_participations` だけ
- record invalid、返金・取消、提供取消は公開進捗から除外される

## 3. 旧localStorageの一回移行

- 旧 `mikke.fund.supports.v1` が実在する場合だけ対象とし、空のfallbackは移行しない
- 現在profileが実DB上で所有するprojectの `source_local_id` と一致する支援だけをupsert
- F4で先に作られた同じ支援行がある場合もstable source IDで同じDB UUIDへ統合
- 別profile相当の支援は削除せず保全
- 全件成功後だけ `mikke.fund.f5d.migration.v1.<profileId>` markerを保存
- DB読込成功後だけprofile別 `mikke.fund.owner-supports.v2.<profileId>` cacheを更新

## 4. 実DB

適用済みmigration:

```text
20260716113100_fund_f5_d_support_management.sql
```

Local / Remote migration履歴は上記versionまで一致しています。

検収時点の実データ:

- `fund_supports`: 1件
- `fund_participations` と紐付く支援: 1件
- source ID欠損: 0件
- completion / cancellation timestamp不整合: 0件
- F5-d test fixture残件: 0件

既存のMikke ID受取済み支援はDB UUIDとparticipationの紐付けを維持しています。

## 5. 検収結果

- `fund_f5_d_support_management.sql` 成功
  - ownerは自分の支援だけを読取り・保存可能
  - 別authenticated actorはowner-private支援0件、直接更新0件、保存RPC拒否
  - supporter actorもraw支援0件。受取後は本人のparticipationだけ読取り可能
  - anonはraw支援0件、保存RPC不可、同意済み公開投影だけ読取り可能
  - 同一source ID再保存でDB UUIDを維持
  - payment / fulfillmentの状態変更と完了・取消日時を検収
  - record status変更による公開進捗・公開参加投影の削除と復元を検収
- `fund_f4_b1_rls.sql` / `fund_f4_b2_rls.sql` / `fund_f5_a_public_content_rls.sql` / `fund_f5_b_owner_content.sql` / `fund_f5_c_activity_updates.sql` 回帰成功
- F5-d由来の新しいDatabase Advisor security / performance警告0件
- 既存Fund Advisor項目はF4のsecurity-definer RPC 4件と既存index INFO 5件で増加なし
- `npm.cmd run lint` 成功
- `npm.cmd run build` 成功。build ID: `w52gkH6PogZc0gHr9SkJp`

参照:

- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Database function security](https://supabase.com/docs/guides/database/functions#security-definer-vs-invoker)
- [Database Advisor](https://supabase.com/docs/guides/database/database-advisors)

## 6. F5-e前に残す境界

- challenge record / app link候補はF5-eまでlocalStorage正本
- 完成記録の公開専用投影と完成Activity LogのDB接続はF5-eで扱う
- unlistedはtoken方式を確定するまで公開投影へ出さない
- 通知・通報・CSV・Webhookにはまだ進まない
- Team Works追加計画はFund完了後に組み込む

## 7. 次の実行手順

F5-d限定commit後、次のphaseはF5-eです。

1. `FundChallengeRecord` / `FundAppLink` と現行完成記録画面の項目差分を監査
2. owner-private正本とStory向け公開専用列を分離
3. owner / 別actor / anon、private / publicの否定testを先に作る
4. challenge record / app link候補をDBへ接続し、旧localStorageを本人分だけ一回移行
5. 完成Activity LogをDB保存成功後だけ更新する境界へ接続
6. Advisor、migration履歴、lint / buildを再検収

F5-e完了前にF5-fやTeam Worksへ進みません。

## 8. 別作業の保全

Manager / Page / Team Works関連docsの未コミット変更はFund commitへ混ぜません。
