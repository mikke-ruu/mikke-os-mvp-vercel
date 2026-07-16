# Fund F5-f Handoff

作成日: 2026-07-16

対象repo: `G:/Musubiプロジェクト/mikke-os-mvp`

状態: F5-a〜F5-f検収完了・Fund Supabase本接続完了

## 1. F5-fの結論

- 今実装: 削除保全、unlistedのfail-closed
- 後回し: 通知、通報・問い合わせ、CSV
- MVP不要: Webhook
- unlisted機能本体: 安全なtoken設計を実装する将来phaseまで提供しない

詳細な理由と再開条件は `MIKKEOS_FUND_F5_F_OPERATIONS_DECISION_2026-07-16.md` に固定しました。

## 2. 削除保全

ownerのData API hard deleteを次の表で停止しました。

- `fund_projects`
- `fund_supports`
- `fund_updates`
- `fund_challenge_records`
- `fund_app_links`

ownerは削除ではなく、次の状態を使います。

- project: `archived` / `private`
- support: `invalid` / `cancelled` / `refunded`
- update: `draft`
- completion: `private`
- app link: `cancelled`

`fund_plans` はproject保存RPCがplan集合を同一transactionで差し替えるためDELETE権限を維持しています。

service roleによる実削除は残しています。本人削除依頼や法的要請は、owner画面とは別の管理手順で扱います。

## 3. unlisted

- `限定URL（準備中）` と表示してowner formで選択不可
- local fallbackの公開判定を `visibility=public` のみに変更
- DB公開投影も従来どおりpublicだけ
- unlisted保存済みデータはownerだけが読め、公開Fund・Storyへ出ない

将来token方式では、random token、hash保存、期限、失効、再発行、public-safe projection、rate limit、監査を揃えてから提供します。

## 4. 実DB

適用済みmigration:

```text
20260716131053_fund_f5_f_retention_guard.sql
```

Local / Remote migration履歴は上記versionまで一致しています。

検収時点:

- `profiles`: 2件
- `fund_projects`: 1件
- `fund_supports`: 1件
- `fund_participations`: 1件
- protected 5表のauthenticated DELETE grant: 0件
- `fund_plans` の差替え用DELETE grant: 1件
- F5-f fixture残件: 0件

## 5. 検収

- `fund_f5_f_retention_guard.sql` 成功
  - ownerのproject / support / update / completion / app link直接削除を拒否
  - project archive、support invalid、update draft、completion private、app linkを保全
  - unlistedのpublic project投影0件
- F4-b1 / F4-b2 / F5-a / F5-b / F5-c / F5-d / F5-eの全回帰test成功
- F5-f由来の新しいDatabase Advisor security / performance警告0件
- 既存Fund Advisor項目はsecurity WARN 4件、performance INFO 5件で増加なし
- lint成功

## 6. Fund全体の現在地

完了済み:

- Mikke ID ownership / RLS
- 支援claimと本人同意
- Activity LogとStory投影
- 公開Fund本文・plan
- owner DB正本と旧localStorage移行
- 活動報告
- 応援・決済・提供管理
- 完成記録・次アプリ候補
- 削除保全・unlisted fail-closed

Fundの通常MVPフローはここで区切ります。通知・通報・CSV・WebhookはFund未完成扱いにせず、明記した再開条件が満たされたときの運営拡張です。

## 7. 次の工程

ユーザー指定どおり、次はTeam Works追加計画案を既存Team Works計画へ組み込みます。

開始時に確認するもの:

1. 既存未コミット `docs/MIKKEOS_TEAM_WORKS_PROJECTS_PLAN.md`
2. Team Works追加機能ブリーフ
3. Claude Codeが作成した新計画書
4. OS全体のデザイン仕様とStory基準

まず計画の重複・競合・実装順を統合し、Fund commitとは別のTeam Works計画commitにします。実装開始は統合計画を確認してからです。

## 8. 別作業の保全

Manager / Page / Team Works関連docsの既存未コミット変更はFund commitへ混ぜません。
