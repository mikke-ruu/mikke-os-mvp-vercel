# Fund F5-e Handoff

作成日: 2026-07-16

対象repo: `G:/Musubiプロジェクト/mikke-os-mvp`

状態: F5-e検収完了・F5-f未着手

## 1. 完了した接続

- owner-private `fund_challenge_records` を完成記録の正本へ接続
- owner-private `fund_app_links` を次アプリへの引継ぎ候補の正本へ接続
- public-safe `fund_public_challenge_records` を公開FundとStoryの読取り口へ接続
- `save_fund_completion` でproject完了、完成記録、次アプリ候補を1 transactionに統合
- 完成Activity LogをDBへ冪等upsert
- 公開Fund詳細でDBの完成記録を表示
- Storyで公開・Story ONの完成記録を表示し、端末内Activity Logと公開pathで重複排除

## 2. owner-private / public境界

- raw完成記録と次アプリ候補はownerだけが読取り・保存可能
- 別authenticated actorはraw行0件、直接更新0件、保存RPC拒否
- anonはraw table権限なし、保存RPC権限なし
- 公開投影にはowner ID、source local ID、次アプリ候補、private Activity Log列を持たせない
- 完成記録がpublicでも親projectがprivate / unlisted / draftなら公開投影0件
- Storyには本文を複製せず、公開Fundの完成記録への入口だけを表示
- 完成Activity Logは常にprivate、非金額、`display_on_story=false`
- 公開完成記録がStory ONの場合だけActivity Logのachievement / summary flagを有効化

## 3. 原子的な完成保存

`public.save_fund_completion(uuid, text, jsonb, text[])` は `security invoker` で実行します。

1. `auth.uid()` とowner profileの一致を確認
2. ownerのprojectをlock
3. projectを `realization / completed` へ更新
4. projectごとに1件の完成記録をinsert / update
5. 選択中の次アプリ候補を `ready`、選択解除分を `cancelled` へ更新
6. triggerで公開専用投影とprivate Activity Logを同期

途中で失敗した場合は全体をrollbackするため、projectだけcompletedになる部分失敗は残りません。

同じprojectを再保存した場合は、完成記録のDB UUID、既存source local ID、Activity Log IDを維持します。

## 4. 次アプリ候補

保存できる候補:

- Order
- Item Studio
- Event
- Session
- Academy
- Community
- Team Works

ここで保存するのは引継ぎ意思だけです。対象アプリのproject、商品、講座、チーム等は自動作成しません。

## 5. 旧localStorageの一回移行

- 対象は `mikke.fund.challenge-records.v1` / `mikke.fund.app-links.v1`
- 現在profileがDB上で所有するproject IDに一致する完成記録だけを移行
- `ready` / `linked` の次アプリ候補だけを選択中候補としてRPCへ渡す
- 別profile・所有未確認project相当のデータは削除せず保全
- 全対象のDB保存成功後だけ `mikke.fund.f5e.migration.v1.<profileId>` markerを保存
- DB読込成功後だけprofile別の完成記録・次アプリcacheを更新

## 6. 実DB

適用済みmigration:

```text
20260716120919_fund_f5_e_completion_records.sql
```

Local / Remote migration履歴は上記versionまで一致しています。

検収時点の実データ:

- `profiles`: 2件
- `fund_projects`: 1件
- `fund_supports`: 1件
- `fund_participations`: 1件
- `fund_challenge_records`: 0件
- `fund_app_links`: 0件
- `fund_public_challenge_records`: 0件
- Fund completion Activity Log: 0件
- F4 / F5 test fixture残件: 0件

実ユーザーはまだ完成保存を行っていないため、新規3表が0件なのは正常です。

## 7. 検収結果

- `fund_f5_e_completion_records.sql` 成功
  - owner保存と再保存の同一性
  - 別actorのowner-private読取り・更新・RPC拒否
  - anonのraw権限・RPC拒否とpublic-safe投影読取り
  - private / public、Story OFF / ON
  - 親projectのprivate化による投影削除とpublic復帰による再作成
  - profile handle変更時の公開path同期
  - 完成Activity Logのprivate / non-financial境界
- `fund_f4_b1_rls.sql` / `fund_f4_b2_rls.sql` / `fund_f5_a_public_content_rls.sql` / `fund_f5_b_owner_content.sql` / `fund_f5_c_activity_updates.sql` / `fund_f5_d_support_management.sql` 回帰成功
- F5-e由来の新しいDatabase Advisor security / performance警告0件
- 既存Fund Advisor項目はsecurity WARN 4件、performance INFO 5件で増加なし
- `npm.cmd run lint` 成功
- `npm.cmd run build` 成功
- 実ブラウザーで `/apps/fund/fund_project_seed_1/complete` を表示
  - 完成記録form表示
  - public / private選択とStory入口表示
  - 7つの次アプリ候補表示
  - console error 0件
  - 保存操作は未実施

参照:

- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Database function security](https://supabase.com/docs/guides/database/functions#security-definer-vs-invoker)
- [Database Advisor](https://supabase.com/docs/guides/database/database-advisors)

## 8. 次の実行手順

F5-e限定commit後、次はF5-fの「運営機能の判断」です。実装を始める前に、次を必要 / 後回し / 不要へ分類します。

1. 通知
2. 通報・問い合わせ
3. CSV出力
4. Webhook
5. 削除・保全期間
6. unlistedの安全なtoken方式

判断後、必要項目だけを個別phaseに分けます。F5-fの判断が終わるまでTeam Works追加計画の実装へ進みません。

## 9. 別作業の保全

Manager / Page / Team Works関連docsの既存未コミット変更はFund commitへ混ぜません。
