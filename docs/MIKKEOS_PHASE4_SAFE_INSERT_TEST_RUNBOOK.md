# mikkeOS Phase 4 Safe Insert Test Runbook

作成日: 2026-07-06

このメモは、mikkeOS全体の本保存ONへ進む前に、adapter payload相当の安全ログ1件だけをSupabaseへ保存し、読み取り確認するための手順を整理するものです。

通常画面の保存先はまだSupabaseへ切り替えません。
`/os` / `/log` / `/story` / `/desk` / 各ミニ画面はlocalStorageベースの統合プロトタイプのまま維持します。

## 1. 追加したテスト処理

| 項目 | 内容 |
| --- | --- |
| script | `scripts/mikkeos-safe-activity-log-test.mjs` |
| npm command | `npm.cmd run test:mikkeos:safe-activity-log` |
| 必要な認証 | `MIKKEOS_TEST_ACCESS_TOKEN` |
| 削除確認 | `MIKKEOS_TEST_DELETE=1` を付けた時だけ実行 |

`MIKKEOS_TEST_ACCESS_TOKEN` がない場合、scriptはinsert / update / deleteを試さずに停止します。
anon keyだけではRLSの `auth.uid()` が成立しないためです。

## 2. 保存payload

テスト保存するActivity Logは、公開Storyにも活動実績数にもDESKにも出ない安全ログです。

| DB列 | 値 |
| --- | --- |
| `user_id` | access tokenのAuth user id |
| `profile_id` | `profiles.user_id = user.id` で取得したprofile id |
| `activity_type` | `mikkeos_safe_insert_test` |
| `category` | `other` |
| `source_service` | `mikkeos_test` |
| `source_record_id` | `mikkeos-safe-test-<timestamp>-<uuid>` |
| `occurred_at` | 実行時刻 |
| `title` | `mikkeOS safe private insert test` |
| `description` | `Private adapter-path safety test. Not for Story, DESK, or summary.` |
| `visibility` | `private` |
| `status` | `completed` |
| `display_on_story` | `false` |
| `display_in_timeline` | `false` |
| `display_as_achievement` | `false` |
| `counts_toward_summary` | `false` |
| `has_financial_value` | `false` |
| `amount` | `null` |
| `transaction_type` | `none` |
| `payment_status` | `not_required` |

## 3. 実行確認

現時点で実行した確認:

```text
npm.cmd run test:mikkeos:safe-activity-log
```

結果:

```json
{
  "ok": false,
  "skipped": true,
  "reason": "MIKKEOS_TEST_ACCESS_TOKEN is required. No insert/update/delete was attempted."
}
```

つまり、今回の実行ではSupabaseへのinsert / update / deleteは行っていません。

## 4. 保存テスト実行方法

ログイン済みユーザーのaccess tokenを用意できたら、以下で安全ログ1件だけ保存します。

```powershell
$env:MIKKEOS_TEST_ACCESS_TOKEN = "<logged-in access token>"
npm.cmd run test:mikkeos:safe-activity-log
```

削除可否まで同時に確認する場合:

```powershell
$env:MIKKEOS_TEST_ACCESS_TOKEN = "<logged-in access token>"
$env:MIKKEOS_TEST_DELETE = "1"
npm.cmd run test:mikkeos:safe-activity-log
```

注意:

- access tokenはdocsやチャットへ貼らない。
- 実行後はPowerShellを閉じるか、環境変数を消す。
- service role keyは使わない。

## 5. scriptが確認すること

| 確認 | 内容 |
| --- | --- |
| auth user | `supabase.auth.getUser(accessToken)` でAuth userを確認 |
| profile | `profiles.user_id = user.id` でprofileを1件取得 |
| insert | 安全payloadを `activity_logs` へinsert |
| select | 同じ `source_service` / `source_record_id` で読み取り確認 |
| Story非表示 | `visibility !== public` または `display_on_story !== true` |
| DESK非集計 | `has_financial_value = false` / `amount = null` / `transaction_type = none` |
| delete | `MIKKEOS_TEST_DELETE=1` の時だけ削除確認 |

## 6. 期待する結果

保存成功時の期待:

- RLSに弾かれない。
- `user_id` はAuth user idと一致する。
- `profile_id` は本人の `profiles.id` と一致する。
- DB制約に弾かれない。
- 同じ `source_record_id` でselectできる。
- public Story policyでは外部公開されない。
- DESK集計対象外になる。

## 7. 次に本保存へ進む場合の判断メモ

安全ログ1件のinsert/select/delete確認が通った後でも、すぐに通常画面をSupabase保存へ切り替えません。

次に進む場合の順番:

1. テストscriptで安全ログ1件のinsert/selectを確認する。
2. 必要なら同じscriptでdelete確認する。
3. adapterの保存ON/OFF設計を確定する。
4. ミニ画面の保存先切替は、feature flagまたは明示的なテストモードから始める。
5. 金額ログやpublic Storyログは、private安全ログが通った後に別ステップで確認する。

## 8. まだしないこと

- ミニ画面の保存先をSupabaseへ切り替える。
- `/os` / `/log` / `/story` / `/desk` の保存元をSupabaseへ切り替える。
- 既存MarketNote本体を変更する。
- `lib/activity-log.ts` を変更する。
- RLS / policy / constraint を変更する。
- 金額ログを保存する。
- public Storyログを保存する。
- 本番導線から保存する。
## 9. 2026-07-06 safe insert test result

あゆみさんがローカルPowerShellの一時環境変数に `MIKKEOS_TEST_ACCESS_TOKEN` を設定し、以下を実行しました。

```powershell
npm.cmd run test:mikkeos:safe-activity-log
```

結果画面で以下を確認済みです。

| item | result |
| --- | --- |
| overall result | `ok: true` |
| insert | `ok: true` |
| select | `ok: true` |
| RLS | insert passed with the authenticated `user_id` / owned `profile_id` pair |
| `source_service` | `mikkeos_test` |
| `source_record_id` | test output generated a unique `mikkeos-safe-test-...` id |
| `visibility` | `private` |
| `display_on_story` | `false` |
| `counts_toward_summary` | `false` |
| `has_financial_value` | `false` |
| `amount` | `null` |
| `transaction_type` | `none` |
| Story public exposure | not a public Story target because `visibility` is `private` and `display_on_story` is `false` |
| DESK aggregation | not a DESK target because `has_financial_value` is `false`, `amount` is `null`, and `transaction_type` is `none` |

Access token handling:

- The access token was not pasted into chat.
- The access token was not written to docs.
- The access token was not committed to Git.
- The access token was not stored in `.env.local`.
- After the test, PowerShell ran `Remove-Item Env:MIKKEOS_TEST_ACCESS_TOKEN`.
- `echo $env:MIKKEOS_TEST_ACCESS_TOKEN` returned empty.

Current decision:

- The safe private adapter-payload test is successful.
- The test confirms that the payload shape can pass current `activity_logs` constraints and RLS for an authenticated user.
- Normal app screens still use localStorage.
- Do not switch `/os`, `/log`, `/story`, `/desk`, or mini app screens to Supabase yet.
- Do not save financial logs yet.
- Do not save public Story logs yet.
- Do not change existing MarketNote saving yet.

Delete decision:

- The test log may remain temporarily as a trace of the successful Phase 4 safety test.
- If cleanup is needed, run the same test path later with `MIKKEOS_TEST_DELETE=1` or add a dedicated cleanup command that targets only `source_service = "mikkeos_test"` and the exact `source_record_id`.
- Do not run broad deletes.
