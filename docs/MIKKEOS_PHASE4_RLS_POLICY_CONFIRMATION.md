# mikkeOS Phase 4 RLS Policy Confirmation

作成日: 2026-07-06

このメモは、Supabase Dashboardで確認された `activity_logs` のRLS policyと、Supabase本保存へ進む前のadapter安全方針を整理するものです。

今回の作業では、Supabase本DB、RLS、policy、constraint、既存MarketNote保存処理は変更しません。
また、insert / update / delete は実行しません。

## 1. Dashboardで確認済みのRLS

### users can insert own activity logs

`WITH CHECK`:

```sql
auth.uid() = user_id
AND exists (
  select 1 from profiles
  where profiles.id = activity_logs.profile_id
  and profiles.user_id = auth.uid()
)
```

自分の `user_id` と、自分の `profile_id` に紐づくActivity Logだけ追加可能です。
これは、mikkeOSの `user_id = Authユーザー`、`profile_id = profiles.id` の設計と合っています。

### users can read own activity logs

`USING`:

```sql
auth.uid() = user_id
```

ログイン中のユーザーは、自分のActivity Logだけ読み取り可能です。

### public story activity logs are readable

`USING`:

```sql
visibility = 'public'
AND display_on_story = true
```

Story公開対象のActivity Logは外部から読み取り可能です。

## 2. RLS上の重要な注意点

public Story policyは、`visibility` と `display_on_story` だけで公開判定します。

そのため、保存時にStoryへ出したくないログを、以下の組み合わせにしないことが重要です。

```text
visibility = public
display_on_story = true
```

特に以下は、adapter payload側で必ず非公開またはStory対象外にします。

- 売上
- 経費
- 支払い
- 未入金
- 顧客名を含むログ
- 内部メモ
- 依頼詳細
- その他、外部公開すると違和感がある事務ログ

## 3. default任せにしない項目

DB定義上、`display_on_story` と `counts_toward_summary` はdefault trueです。

本保存へ進む場合、adapter payloadでは以下を必ず明示します。

| DB列 | 方針 |
| --- | --- |
| `visibility` | 公開してよい活動だけ `public`。金額・事務・内部ログは `private` |
| `display_on_story` | Storyに出してよい活動だけ `true` |
| `display_in_timeline` | Storyに出してよい活動だけ `true` |
| `display_as_achievement` | Storyに出してよい活動だけ `true` |
| `counts_toward_summary` | OS HomeやStoryで活動実績数に含めるものだけ `true` |
| `has_financial_value` | DESKに集計する金額ログだけ `true` |
| `transaction_type` | `income` はDB保存時に `revenue` へ変換 |

## 4. adapter側の安全方針

`toSupabaseActivityLogInsert()` では、今後本保存ONにした場合の公開事故を避けるため、以下の方針にします。

| 条件 | 保存payload |
| --- | --- |
| 金額ログ | `visibility: private` / `display_on_story: false` / `counts_toward_summary: false` |
| 売上・経費・支払い系イベント | `visibility: private` / `display_on_story: false` / `counts_toward_summary: false` |
| 公開実績としてよい活動 | `visibility` と `storyEnabled` をpayloadへ明示 |
| 活動実績数に含める活動 | `shouldCountTowardSummary(log)` の結果をpayloadへ明示 |

これにより、DB defaultがtrueでも、adapter payload側で公開・非公開を明示できます。

## 5. まだ未確認のRLS

次に可能であれば、Dashboardで以下を確認します。

- update policyの `USING`
- update policyの `WITH CHECK`
- delete policyの `USING`
- public Story policyに金額ログや内部ログを除外する追加条件がないか

ただし、本保存テスト前の最低限の確認として、以下は確認済みです。

- insert own
- own select
- public Story select

## 6. まだしないこと

- Supabase本DBの変更
- RLS / policy / constraint の変更
- insert / update / delete
- `types/database.ts` の変更
- `app/marketnote/**` の変更
- `lib/activity-log.ts` の変更
- `lib/marketnote.ts` の変更
