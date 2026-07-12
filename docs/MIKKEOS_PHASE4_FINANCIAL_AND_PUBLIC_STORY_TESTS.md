# mikkeOS Phase 4 Financial / Public Story Payload Tests

作成日: 2026-07-06

このメモは、安全ログ1件テスト成功後に行う次の2つのSupabase保存テストを整理するものです。

通常画面の保存先はまだSupabaseへ切り替えません。`/os` / `/log` / `/story` / `/desk` / 各ミニ画面はlocalStorageベースのままです。

## 1. テストscript

既存の安全テストscriptをシナリオ対応にしました。

| scenario | command |
| --- | --- |
| safe private log | `npm.cmd run test:mikkeos:safe-activity-log` |
| private revenue log | `npm.cmd run test:mikkeos:private-revenue-log` |
| public Story log | `npm.cmd run test:mikkeos:public-story-log` |

いずれも `MIKKEOS_TEST_ACCESS_TOKEN` が無い場合はinsert / update / deleteを行わずに停止します。

## 2. token handling

access tokenはローカルPowerShellの一時環境変数としてだけ扱います。

```powershell
$env:MIKKEOS_TEST_ACCESS_TOKEN = "<logged-in access token>"
```

実行後は必ず消します。

```powershell
Remove-Item Env:MIKKEOS_TEST_ACCESS_TOKEN
echo $env:MIKKEOS_TEST_ACCESS_TOKEN
```

禁止:

- chatへ貼らない
- docsへ書かない
- Gitへ入れない
- `.env.local` へ残さない
- screenshotへ映さない

## 3. private revenue log test

目的:

- DBの金額制約を通るか確認する
- DESK対象payloadとして扱えるか確認する
- Story公開対象外のままか確認する
- 活動実績数に入らないか確認する

command:

```powershell
npm.cmd run test:mikkeos:private-revenue-log
```

payload:

| field | value |
| --- | --- |
| `source_service` | `mikkeos_test` |
| `visibility` | `private` |
| `display_on_story` | `false` |
| `counts_toward_summary` | `false` |
| `has_financial_value` | `true` |
| `amount` | `1000` |
| `transaction_type` | `revenue` |
| `payment_status` | `paid` |
| `category` | `other` |
| `status` | `completed` |

expected:

| check | expected |
| --- | --- |
| insert | `ok: true` |
| select | `ok: true` |
| Story visible | `false` |
| public policy readable | `false` |
| DESK counted | `true` |
| summary counted | `false` |

## 4. public Story log test

目的:

- public Story policyの対象になるか確認する
- 金額ログではないことを確認する
- 活動実績数に入ることを確認する
- 公開事故にならないpayload設計か確認する

command:

```powershell
npm.cmd run test:mikkeos:public-story-log
```

payload:

| field | value |
| --- | --- |
| `source_service` | `mikkeos_test` |
| `visibility` | `public` |
| `display_on_story` | `true` |
| `counts_toward_summary` | `true` |
| `has_financial_value` | `false` |
| `amount` | `null` |
| `transaction_type` | `none` |
| `payment_status` | `not_required` |
| `category` | `other` |
| `status` | `completed` |

expected:

| check | expected |
| --- | --- |
| insert | `ok: true` |
| select | `ok: true` |
| Story visible | `true` |
| public policy readable | `true` |
| DESK counted | `false` |
| summary counted | `true` |

## 5. delete policy

通常はテストログを一時的に残して、Dashboard上で確認できるようにします。

削除する場合だけ、以下のように `MIKKEOS_TEST_DELETE=1` を付けます。

```powershell
$env:MIKKEOS_TEST_DELETE = "1"
npm.cmd run test:mikkeos:private-revenue-log
```

注意:

- broad deleteはしない
- `source_service = "mikkeos_test"` と生成された `source_record_id` に限定する
- 既存MarketNoteログは触らない

## 6. まだしないこと

- 通常画面の保存先をSupabaseへ切り替える
- 各ミニ画面を一斉にSupabase保存へ変える
- 既存MarketNote本体を変更する
- `lib/activity-log.ts` を変更する
- RLS / policy / constraint を変更する
- 実ユーザー導線から金額ログを保存する
- 実ユーザー導線からpublic Storyログを保存する
## 7. 2026-07-06 private revenue test result

あゆみさんがローカルPowerShellの一時環境変数に `MIKKEOS_TEST_ACCESS_TOKEN` を設定し、private revenue log testを実行しました。

結果画面で以下を確認済みです。

| item | result |
| --- | --- |
| scenario | `private_revenue` |
| insert | `ok: true` |
| select | `ok: true` |
| `visibility` | `private` |
| `display_on_story` | `false` |
| `counts_toward_summary` | `false` |
| `has_financial_value` | `true` |
| `amount` | `1000` |
| `transaction_type` | `revenue` |
| `payment_status` | `paid` |
| Story public exposure | false |
| DESK aggregation | true |
| summary count | false |

Meaning:

- DB financial constraints accepted the payload.
- RLS accepted the authenticated `user_id` and owned `profile_id` pair.
- The payload is valid as a DESK revenue log.
- The payload is not a Story public log.
- The payload is not counted as an activity achievement.

Token handling:

- The access token was removed from PowerShell after the test.
- `Remove-Item Env:MIKKEOS_TEST_ACCESS_TOKEN` was run.
- The following public Story test did not run because the token had already been removed.
- The red PowerShell message from `Remove-Item` is interpreted as "already removed", not as a failed DB test.

## 8. 2026-07-06 public Story test status

public Story log test was attempted after the access token had already been removed.

Result:

| item | result |
| --- | --- |
| scenario | `public_story` |
| insert | not attempted |
| select | not attempted |
| reason | `MIKKEOS_TEST_ACCESS_TOKEN` was not set |

This is the expected safety behavior. The script did not insert, update, or delete anything without a token.

Next step:

- Re-set `MIKKEOS_TEST_ACCESS_TOKEN` as a temporary PowerShell environment variable.
- Run only `npm.cmd run test:mikkeos:public-story-log`.
- Remove the token immediately after the result is checked.

Still do not:

- switch normal screens to Supabase
- save from mini app screens
- change existing MarketNote
- change `lib/activity-log.ts`
- change RLS / policy / constraint

## 9. 2026-07-07 public Story test result

あゆみさんがローカルPowerShellの一時環境変数に `MIKKEOS_TEST_ACCESS_TOKEN` を設定し、public Story log testを実行しました。

結果画面で以下を確認済みです。

| item | result |
| --- | --- |
| scenario | `public_story` |
| overall result | `ok: true` |
| insert | `ok: true` |
| select | `ok: true` |
| `visibility` | `public` |
| `display_on_story` | `true` |
| `counts_toward_summary` | `true` |
| `has_financial_value` | `false` |
| `amount` | `null` |
| `transaction_type` | `none` |
| Story visible | `true` |
| public policy readable | `true` |
| DESK aggregation | `false` |
| summary count | `true` |

Meaning:

- DB constraints accepted the public, non-financial Story payload.
- RLS accepted the authenticated insert/select path.
- Public Story policy can read this row because `visibility = "public"` and `display_on_story = true`.
- The payload is not a DESK financial row.
- The payload is counted as an activity achievement.
- The payload contains no amount, customer detail, payment detail, or internal memo.

Token handling:

- The access token was removed from the PowerShell environment after the test.
- The token was not written to chat, docs, Git, or `.env.local`.

Current Phase 4 status:

- `safe_private` insert/select: passed.
- `private_revenue` insert/select: passed.
- `public_story` insert/select and public policy read: passed.
- Normal screens still use localStorage.
- Mini app screens are not connected to Supabase saving.
- Existing MarketNote saving remains unchanged.
- `lib/activity-log.ts` remains unchanged.
- RLS / policy / constraint remain unchanged.
