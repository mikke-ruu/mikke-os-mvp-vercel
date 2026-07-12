# mikkeOS Phase 4 Activity Log Constraints and Policy Check

作成日: 2026-07-06

このメモは、Supabase DashboardのDefinitionで確認できた `activity_logs` の制約と、保存テスト前に残っているupdate / delete policy確認項目を整理するものです。

今回の作業では、Supabase本DB、RLS、policy、constraint、`types/database.ts`、既存MarketNote保存処理は変更しません。
また、insert / update / delete は実行しません。

## 1. Dashboard Definitionで確認済みの制約

### 許可値

| 項目 | 許可値 |
| --- | --- |
| `transaction_type` | `revenue` / `expense` / `none` |
| `category` | `consultation` / `production` / `product` / `event` / `workshop` / `review` / `profile` / `other` |
| `visibility` | `public` / `private` / `limited` |
| `status` | `draft` / `confirmed` / `completed` / `cancelled` |
| `payment_status` | `unpaid` / `paid` / `not_required` |

### 金額制約

| 条件 | 必要な値 |
| --- | --- |
| `has_financial_value = false` | `amount is null` かつ `transaction_type = none` |
| `has_financial_value = true` | `amount is not null` かつ `transaction_type` は `revenue` または `expense` |

### unique制約

| 制約 | 内容 |
| --- | --- |
| unique | `profile_id, source_service, source_record_id` |

### default値

| 項目 | default |
| --- | --- |
| `display_on_story` | `true` |
| `counts_toward_summary` | `true` |

## 2. adapter payload方針への反映

DB defaultでは `display_on_story` と `counts_toward_summary` が `true` です。
そのため、本保存へ進む場合も、adapter payloadではdefault任せにせず必ず明示します。

| 項目 | 方針 |
| --- | --- |
| `display_on_story` | Storyに出してよい活動だけ `true`。金額・支払い・内部ログは `false` |
| `counts_toward_summary` | OS HomeやStory上で活動実績数に含めるものだけ `true` |
| `visibility` | 公開してよい活動だけ `public`。金額・支払い・内部ログは `private` |
| `has_financial_value` | DESKに集計する金額ログだけ `true` |
| `transaction_type` | `income` はDB保存時に `revenue` へ変換 |
| `amount` | 金額ログだけ数値。非金額ログは `null` |

特に以下は、adapter側で必ず安全側へ寄せます。

- 売上ログ
- 経費ログ
- 支払いログ
- 未入金ログ
- 顧客名を含むログ
- 内部メモ
- 依頼詳細
- 非公開の事務ログ

保存payload:

```text
visibility: private
display_on_story: false
counts_toward_summary: false
```

## 3. update / delete policy確認状況

MCPで `pg_policies` の読み取り専用確認を試しましたが、権限不足でした。

```text
MCP error -32600: You do not have permission to perform this action
```

そのため、update / delete policy本文はDashboard目視確認待ちです。

## 4. users can update own activity logs 確認項目

確認したい内容:

- `USING` expression
- `WITH CHECK` expression
- `auth.uid() = user_id` だけか
- `profiles.user_id = auth.uid()` まで見ているか
- update時に `profile_id` のすり替えを防げるか

望ましい形:

```sql
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND exists (
    select 1 from profiles
    where profiles.id = activity_logs.profile_id
    and profiles.user_id = auth.uid()
  )
)
```

判定:

- `WITH CHECK` がない場合、update後の値に対する安全確認が弱くなります。
- `auth.uid() = user_id` だけの場合、`profile_id` を別profileへすり替えられる余地がないか確認が必要です。
- `profiles.id = activity_logs.profile_id` かつ `profiles.user_id = auth.uid()` まで見ていれば、mikkeOSの設計に合っています。

## 5. users can delete own activity logs 確認項目

確認したい内容:

- `USING` expression
- `auth.uid() = user_id` だけか
- `profiles.user_id = auth.uid()` まで見ているか

deleteは `WITH CHECK` を持たないため、最低限 `auth.uid() = user_id` が必要です。

より厳密にするなら、以下のように `profile_id` が自分のprofileに紐づくことまで見る形が安全です。

```sql
USING (
  auth.uid() = user_id
  AND exists (
    select 1 from profiles
    where profiles.id = activity_logs.profile_id
    and profiles.user_id = auth.uid()
  )
)
```

## 6. 保存テストへ進む場合の最初の1件

update / delete policy確認後に保存テストへ進む場合も、最初はテスト用1件だけにします。

| 項目 | 値 |
| --- | --- |
| `visibility` | `private` |
| `display_on_story` | `false` |
| `counts_toward_summary` | `false` |
| `has_financial_value` | `false` |
| `amount` | `null` |
| `transaction_type` | `none` |
| `payment_status` | `not_required` |

この1件は公開Storyにも活動実績数にもDESK集計にも出ない、安全な確認用ログにします。

## 7. まだしないこと

- insert
- update
- delete
- RLS変更
- policy変更
- constraint変更
- `types/database.ts` 変更
- `app/marketnote/**` 変更
- `lib/activity-log.ts` 変更
