# mikkeOS Phase 4 Update Policy Confirmation

作成日: 2026-07-06

このメモは、Supabase Dashboardで確認した `activity_logs` のupdate policy本文を記録するものです。

今回の確認では、insert / update / delete、RLS変更、policy変更、constraint変更、`types/database.ts`変更、既存MarketNote保存処理の変更は行いません。

## 1. users can update own activity logs

Dashboardで以下を確認しました。

Policy command:

```text
UPDATE
```

`USING` expression:

```sql
(auth.uid() = user_id)
```

`WITH CHECK` expression:

```sql
((auth.uid() = user_id) AND (EXISTS (
  SELECT 1
  FROM profiles
  WHERE ((profiles.id = activity_logs.profile_id) AND (profiles.user_id = auth.uid()))
)))
```

## 2. 判定

| 確認項目 | 結果 |
| --- | --- |
| `USING` に `auth.uid() = user_id` があるか | あり |
| `WITH CHECK` に `auth.uid() = user_id` があるか | あり |
| `WITH CHECK` で `profiles.id = activity_logs.profile_id` を見ているか | あり |
| `WITH CHECK` で `profiles.user_id = auth.uid()` まで見ているか | あり |
| update時に `user_id` のすり替えを防げるか | 防げる |
| update時に `profile_id` のすり替えを防げるか | 自分のprofile以外へのすり替えは防げる |

このupdate policyは、mikkeOSのActivity Log設計と合っています。

`USING` で更新対象行が自分の `user_id` の行に限定され、`WITH CHECK` で更新後の `user_id` と `profile_id` が自分に紐づく状態か確認されています。
そのため、保存テスト前のupdate policy確認としてはOKです。

## 3. Delete policyの確認状況

`users can delete own activity logs` は、まだDashboard本文未確認です。

次に確認する項目:

- `USING` expression
- `auth.uid() = user_id` があるか
- 可能であれば `profiles.id = activity_logs.profile_id` と `profiles.user_id = auth.uid()` まで見ているか

deleteは `WITH CHECK` を持たないため、最低限 `USING (auth.uid() = user_id)` が必要です。

## 4. 保存テスト前の現在地

保存テスト前に確認済み:

- insert own policy
- own select policy
- public Story select policy
- update own policy
- `activity_logs` check制約
- unique制約
- `display_on_story` / `counts_toward_summary` default true

未確認:

- delete own policy本文

保存テストへ進む場合も、最初の1件は以下の安全ログから始めます。

```text
visibility: private
display_on_story: false
counts_toward_summary: false
has_financial_value: false
amount: null
transaction_type: none
payment_status: not_required
```

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
