# mikkeOS Phase 4 Delete Policy Confirmation

作成日: 2026-07-06

このメモは、Supabase Dashboardで確認した `activity_logs` のdelete policy本文を記録するものです。

今回の確認では、insert / update / delete、RLS変更、policy変更、constraint変更、`types/database.ts`変更、既存MarketNote保存処理の変更は行いません。

## 1. users can delete own activity logs

Dashboardで以下を確認しました。

Policy command:

```text
DELETE
```

`USING` expression:

```sql
auth.uid() = user_id
```

## 2. 判定

| 確認項目 | 結果 |
| --- | --- |
| `USING` に `auth.uid() = user_id` があるか | あり |
| ログイン中ユーザーが自分のActivity Logだけ削除できるか | できる |
| 他ユーザーのActivity Log削除を防げるか | 防げる |
| `profiles.user_id = auth.uid()` まで見ているか | なし |

このdelete policyは、最低限の「自分の `user_id` に紐づくActivity Logだけ削除可能」という条件を満たしています。

INSERT / UPDATEでは `profiles.id = activity_logs.profile_id` と `profiles.user_id = auth.uid()` まで確認しているため、作成・更新時の `profile_id` すり替え対策は入っています。
DELETEは既存行に対する削除なので、`auth.uid() = user_id` で削除対象を本人の行に限定する構成です。

## 3. 主要RLS policy確認まとめ

| 操作 | 確認内容 | 判定 |
| --- | --- | --- |
| INSERT | `auth.uid() = user_id` かつ `profiles.id = activity_logs.profile_id` かつ `profiles.user_id = auth.uid()` | OK |
| own SELECT | `auth.uid() = user_id` | OK |
| public Story SELECT | `visibility = 'public'` かつ `display_on_story = true` | OK。adapter側で公開事故を防ぐ必要あり |
| UPDATE USING | `auth.uid() = user_id` | OK |
| UPDATE WITH CHECK | `auth.uid() = user_id` かつ `profiles.id = activity_logs.profile_id` かつ `profiles.user_id = auth.uid()` | OK |
| DELETE | `auth.uid() = user_id` | OK |

RLS構成は、mikkeOSのActivity Log設計と合っています。

## 4. 保存テスト前の現在地

保存テスト前に確認済み:

- insert own policy
- own select policy
- public Story select policy
- update own policy
- delete own policy
- `activity_logs` check制約
- unique制約
- `display_on_story` / `counts_toward_summary` default true
- `market_note` / `marketnote` の正規化方針

保存テストへ進む場合も、最初の1件は以下の安全ログから始めます。

```text
visibility: private
display_on_story: false
counts_toward_summary: false
has_financial_value: false
amount: null
transaction_type: none
payment_status: not_required
status: completed
category: other
source_service: mikkeos_test
source_record_id: test用の一意ID
```

この1件は公開Storyにも活動実績数にもDESK集計にも出ない、安全な確認用ログにします。

## 5. まだしないこと

- insert
- update
- delete
- RLS変更
- policy変更
- constraint変更
- `types/database.ts`変更
- `app/marketnote/**`変更
- `lib/activity-log.ts`変更
