# Fund F5 Supabase Connection Plan

作成日: 2026-07-16

対象repo: `G:/Musubiプロジェクト/mikke-os-mvp`

状態: F5-a検収完了・F5-b未着手

## 1. 目的

F5は、F1〜F3でlocalStorageに作ったFund本文・応援方法・活動報告・提供管理・完成記録を、F4で確立したMikke ID所有境界へ順番に接続する段階です。

最初に「Storyや共有URLから、別端末でも公開Fund本文を読める」状態を作ります。owner管理画面を一度に全面移行せず、公開列とprivate列の境界を各段階で検収します。

## 2. 固定する原則

- `fund_projects` はowner-privateな正本へ拡張する。
- 公開画面はowner-private表を直接読まず、公開専用投影だけを読む。
- 応援者名、メール、コメント、決済、提供状況は公開投影へ入れない。
- planの価格と金額目標・金額進捗はprojectの `display_amount=true` の場合だけ公開投影へ入れる。
- 新しいpublic表はmigration内で明示的にGRANTし、同時にRLSを有効化する。
- owner書き込みはauthenticated + 所有条件を必須にし、service roleをブラウザへ出さない。
- F5-aの保存RPCは `security invoker` とし、既存RLSを迂回しない。
- F4の招待・同意・Story参加投影は壊さず、そのまま再利用する。

## 3. 公開範囲

### public

公開専用投影へ同期し、プロフィール一覧・詳細URL・Storyリンクから読めます。

### private

owner-private表だけに保持し、公開専用投影から除外します。

### unlisted

F5-aでは公開専用投影へ同期しません。単に一覧から隠すだけではData APIから列挙できるため、推測困難tokenまたは署名付き経路の設計を後続で確定してから本接続します。

## 4. データ分離

| 区分 | 正本 | 公開投影 |
| --- | --- | --- |
| Fund本文 | `fund_projects` | `fund_public_projects` |
| 応援方法 | `fund_plans` | `fund_public_plans` |
| 応援者・金額管理 | `fund_supports` | 公開しない。進捗の集計値だけproject投影へ反映 |
| Mikke ID参加 | `fund_participations` | 既存 `fund_public_participations` |
| 活動報告 | F5-cで追加 | F5-cで公開投影を追加 |
| 完成記録 | F5-eで追加 | F5-eで公開投影を追加 |

## 5. 実装順

### F5-a: 公開Fund本文とplan

- `fund_projects` を本文の正本へ拡張
- owner-private `fund_plans` を追加
- `fund_public_projects` / `fund_public_plans` を追加
- public + draft以外だけをtriggerで同期
- plan価格と金額目標・金額進捗は `display_amount` に従ってマスク
- owner保存を原子的に行うsecurity-invoker RPCを追加
- 公開プロフィール一覧と詳細をSupabase優先読みに変更
- localStorageはowner画面の移行用cacheとして残し、同期失敗を画面で明示

### F5-b: owner画面のDB正本化

- `/apps/fund` と編集画面をDBから読む
- localStorage既存データの本人確認付き一回移行
- DB保存成功後だけowner cacheを更新する順序へ変更
- localStorageを正本扱いする分岐を除去

### F5-c: 活動報告

- owner-private `fund_updates` と公開投影
- draft/publicの分離
- 画像URL・本文・公開日時のRLS検収

### F5-d: 提供管理

- 既存 `fund_supports` を管理画面の正本へ接続
- payment / fulfillment / record statusの保存をDB化
- private Activity Log / DESK候補との重複防止

### F5-e: 完成記録

- challenge recordとapp link候補をDB化
- Storyへ出す完成記録を公開専用列へ分離
- 完成Activity LogをDB正本へ接続

### F5-f: 運営機能の判断

- 通知、通報、CSV、Webhook、削除・保全期間
- unlistedのtoken方式
- 必要性を再確認してから個別実装

## 6. F5-a検収条件

```text
1. ownerは自分のfund_projects / fund_plansだけをCRUDできる
2. 他ユーザーとanonはowner-private表を読めない
3. anonはpublic専用投影だけを読める
4. private / unlisted / draftは公開投影0件
5. display_amount=falseではpublic planのpriceがnull、金額目標・金額進捗が0
6. supporter name / email / comment / amount列はpublic表に存在しない
7. support変更後に個人情報を使わずcurrent_valueだけ再集計される
8. 別端末相当のanon画面でFund本文とplanを表示できる
9. migration履歴、RLS否定test、Database Advisor、lint、buildが成功
```

## 7. F5-a完了後も残る境界

- 活動報告と完成記録はF5-c / F5-eまでlocalStorage表示
- owner一覧と編集初期値はF5-bまでlocalStorage cache中心
- unlistedは安全なtoken方式が決まるまで外部共有不可
- 通知・通報・CSV・Webhookにはまだ進まない

## 8. F5-a検収結果

2026-07-16に実DBへ `20260715162110_fund_f5_a_public_project_content.sql` を適用しました。

- owner / 別authenticated actor / anonのRLS否定test成功
- F4-b2のclaim・同意・Story投影回帰test成功
- private / unlisted / draftは公開投影0件
- `display_amount=false` ではplan価格、金額目標、金額進捗を公開投影でマスク
- anon画面でプロフィール一覧・Fund本文・planを実表示
- privateな申込確認事項と非表示価格が画面に出ないことを確認
- 全test fixtureをROLLBACKまたは削除し、残件0件
- F5-a由来の新しいDatabase Advisorセキュリティ警告0件
- lint / build成功

詳細は `MIKKEOS_FUND_F5_A_HANDOFF_2026-07-16.md` を参照します。
