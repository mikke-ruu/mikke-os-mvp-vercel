# Fund F4-b1 Handoff

作成日: 2026-07-14

対象repo: `G:/Musubiプロジェクト/mikke-os-mvp`

対象branch: `master`

状態: migration適用済み・anon遮断確認済み・actor別RLS検収待ち

## 1. 最初に読むもの

```text
1. docs/MIKKEOS_FUND_F4_SCHEMA_AND_RLS_REVIEW.md
2. docs/MIKKEOS_FUND_F4_IDENTITY_AND_CONSENT_PLAN.md
3. supabase/migrations/20260714070637_fund_f4_b1_ownership_foundation.sql
4. supabase/tests/fund_f4_b1_rls.sql
```

F4-b2へは進まない。まずこのdocsの未完了項目を終えてF4-b1を検収する。

## 2. 完了したこと

Supabase target:

```text
project name: mikke-os-dev
project ref: nttqpprkqbynxyldbnjs
branch: main / PRODUCTION表示
```

ユーザーがSupabase SQL EditorへF4-b1 SQLを貼り付け、Role `postgres` で実行した。結果欄の次の表示をスクリーンショットで確認済み。

```text
Fund F4-b1 migration applied
```

実DBへ作成済み:

```text
public.fund_projects
public.fund_supports
public.set_fund_updated_at()
各index / FK / check / trigger / RLS / owner policy
```

UI保存処理は変更していない。Fund F1-F3は引き続きlocalStorageで動作する。

## 3. 読み取り確認済み

anon keyによるData API確認:

| table | HTTP | PostgreSQL code | 判定 |
| --- | --- | --- | --- |
| `fund_projects` | 401 | 42501 | anon権限なし |
| `fund_supports` | 401 | 42501 | anon権限なし |

応援者名、メール、金額を持つ `fund_supports` がanonへ公開されていないことを確認した。実データ値の読み取り、insert、update、deleteは行っていない。

## 4. まだ完了していないこと

F4-b1は次を終えるまで合格・完了扱いにしない。

```text
1. supabase/tests/fund_f4_b1_rls.sql をSQL Editorで実行
2. owner A / owner Bが自分のproject/supportだけ見えることを確認
3. 他人project/supportのUPDATEとINSERTが拒否されることを確認
4. test SQL末尾のROLLBACKにより一時データが残らないことを確認
5. Supabase Database Advisor確認
6. migration履歴の整合
7. npm.cmd run lint / build
```

RLS testは異なるAuth userに属するprofileが2件必要。足りない場合はテストが明示的に停止する。無理にAuth userを作らない。

## 5. migration履歴の注意

CLI loginのverification code自体は成功したが、このCodex環境ではCLI tokenが次プロセスへ保持されなかった。そのため `supabase db push` ではなくSQL Editorで手動適用した。

結果として、実DB schemaには反映済みだが、`supabase_migrations.schema_migrations` にversion `20260714070637` が登録されたことは未確認。

次の担当は、CLI接続が使える環境で必ず次の順に確認する。

```text
supabase --version
supabase link --project-ref nttqpprkqbynxyldbnjs
supabase migration list
supabase migration repair --help
```

実DBとmigration SQLが一致することを確認してから、CLIの現行helpに従ってversion `20260714070637` をappliedとしてrepairする。確認前に `db push` を実行しない。

migration SQL自体は再実行時にtable/indexを壊さないよう、主要DDLとpolicy/triggerをidempotentにしてある。ただしmigration履歴確認を省略してよいという意味ではない。

## 6. ブラウザ・CLIの経緯

```text
- Supabase CLI 2.105.0はインストール済み
- CLI loginのverification code承認は成功
- tokenが後続processへ保持されずprojects listは認証不可
- Chrome画面操作はChatGPT Chrome Extension / native host未接続で利用不可
- ユーザーがSQL Editorへ手動貼り付けして適用
```

同じCLI loginを繰り返さない。次の環境でCLI credentialが保持できるか、またはSupabase Dashboardの正式なmigration運用へ寄せる。

## 7. 次の実行手順

```text
1. git statusで他者のManager docs変更を巻き込まないことを確認
2. migration historyを確認・repair
3. supabase/tests/fund_f4_b1_rls.sqlを実行
4. Database Advisorを確認
5. anon RESTを再確認
6. lint / build
7. F4-b1 docsを完了へ更新してコミット
8. F4-b2は改めてユーザー承認を取る
```

## 8. 同時に存在する別作業

作業ツリーにはFundとは別に、Manager関連の未コミットdocsが存在している。Fundコミットへ混ぜない。

```text
docs/MIKKEOS_MANAGER_INTEGRATION_PLAN.md
docs/MIKKEOS_SESSION_HANDOFF_2026-07-14.md
docs/MIKKEOS_UI_DOCS_INDEX.md のManager追記
docs/MIKKEOS_APP_PORTFOLIO_MASTER_PLAN_2026-07-12.md のManager追記
```

削除・revertもしない。次の担当は既存変更として保持する。
