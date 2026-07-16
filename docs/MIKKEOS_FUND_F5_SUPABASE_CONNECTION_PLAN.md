# Fund F5 Supabase Connection Plan

作成日: 2026-07-16

対象repo: `G:/Musubiプロジェクト/mikke-os-mvp`

状態: F5-d検収完了・F5-e未着手

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
- owner読取りはRLSに加え `owner_profile_id` をqueryで明示し、DB読込失敗時はcacheに退避しない。
- localStorageのproject / plan cacheはprofile別keyに分離し、DB保存成功後だけ更新する。
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
- `source_local_id` をDB UUIDと現行route IDの安定接続keyとして必須化
- 本人判定は現行profile handleと旧 `profileSlug` の一致に限定し、別profileデータは削除・移行せず保全

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

## 7. F5-d完了後も残る境界

- 完成記録はF5-eまでlocalStorage表示
- challenge record / app link候補はF5-eまでlocalStorage正本
- 応援・決済・提供状態はDB正本。private Activity LogはDB保存成功後だけ既存の冪等keyで更新
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

## 9. F5-b検収結果

2026-07-16に実DBへ `20260715165421_fund_f5_b_owner_source_ids.sql` を適用しました。

- owner一覧・編集・preview・応援管理・提供管理・完成記録routeのproject / plan初期値をDB正本化
- DB行→ `FundProject` / `FundPlan` 変換は `source_local_id` を現行route IDとして使う単一adapterへ集約
- 実DBの `fund_projects.source_local_id` をNOT NULL、1〜160文字、owner内uniqueに固定
- 旧データはprofile handle一致時だけ一回移行し、既存source IDはskip、失敗時はmarkerを付けず再実行可能
- owner / 別authenticated actor / anon、同一source IDの2回保存、F4-b1 / F4-b2 / F5-a回帰test成功
- テストfixtureはROLLBACK済み、実DBはproject 1件、source ID欠損・長さ違反0件
- F5-b由来の新しいDatabase Advisor警告0件。既存Fund警告はF4のsecurity-definer RPC 4件とインデックスINFO 5件
- lint / build成功
- 2人目のactorではowner一覧0件、`ayumi`へ切替後は実DBのFund 1件をowner一覧に表示し、RLSの分離と正本読込を実画面で確認

詳細は `MIKKEOS_FUND_F5_B_HANDOFF_2026-07-16.md` を参照します。F5-cは別パッケージとして開始します。

## 10. F5-c検収結果

2026-07-16に実DBへ `20260716105132_fund_f5_c_activity_updates.sql` を適用しました。

- owner-private `fund_updates` とpublic-safe `fund_public_updates` を追加
- draftは公開投影0件、publicは親projectが公開中の場合だけ同期
- 本文、画像URL、公開日時をDB制約とtriggerで正規化し、下書きへ戻すと公開日時と投影を削除
- owner読取り・保存と公開詳細画面をDB正本へ接続
- 旧 `mikke.fund.updates.v1` は、現在profileがDB上で所有するproject IDに一致する報告だけ一回移行
- owner / 別authenticated actor / anon、親projectのprivate/public切替、無効画像URLをSQL testで検収
- F4-b1 / F4-b2 / F5-a / F5-b回帰test成功、全fixtureはROLLBACK済み
- `fund_updates` / `fund_public_updates` はRLS有効かつforce。実DBのF5-c fixture残件0件
- F5-c由来の新しいDatabase Advisor警告0件。既存Fund警告・INFOの増加なし
- Local / Remote migration履歴は `20260716105132` まで一致
- lint / build成功。build ID: `HMS2o0jsrVuxSnbpGrkWb`

詳細は `MIKKEOS_FUND_F5_C_HANDOFF_2026-07-16.md` を参照します。F5-dにはまだ進みません。

## 11. F5-d検収結果

2026-07-16に実DBへ `20260716113100_fund_f5_d_support_management.sql` を適用しました。

- 既存 `fund_supports` を応援者・決済確認・集計区分・提供状況のowner-private正本へ接続
- `source_local_id` を必須かつproject内uniqueにし、同一source IDの再保存ではDB UUIDを維持
- `public_name` / `is_anonymous` をowner-private列として追加し、応援者名・メール・管理メモ・決済・提供状態を公開投影へ出さない境界を維持
- `completed_at` / `cancelled_at` を状態と一致するようtriggerで正規化
- 保存RPCは `security invoker` + owner RLS。service roleはブラウザで不使用
- Mikke ID招待時のproject / support shadow writeを廃止し、保存済みDB行を参照するだけに変更
- private Activity LogはDB保存成功後だけ更新し、失敗時の二重記録を防止
- 旧 `mikke.fund.supports.v1` は、現在profileがDB上で所有するproject IDに一致する支援だけ一回upsertし、別profile相当は削除せず保全
- owner / 支援者actor / 別actor / anon、公開進捗、同一source ID再保存、Mikke ID参加・同意投影をSQL testで検収
- F4-b1 / F4-b2 / F5-a / F5-b / F5-c回帰test成功、全F5-d fixtureはROLLBACK済み
- 実データは支援1件・Mikke ID参加紐付け1件を維持。source ID欠損・日時不整合・fixture残件は0件
- F5-d由来の新しいDatabase Advisor警告0件。既存Fund項目はsecurity WARN 4件・performance INFO 5件で増加なし
- Local / Remote migration履歴は `20260716113100` まで一致
- lint / build成功。build ID: `w52gkH6PogZc0gHr9SkJp`

詳細は `MIKKEOS_FUND_F5_D_HANDOFF_2026-07-16.md` を参照します。F5-eにはまだ進みません。
