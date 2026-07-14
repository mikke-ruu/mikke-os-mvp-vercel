# Fund F4-b1 Handoff

作成日: 2026-07-14
更新日: 2026-07-15

対象repo: `G:/Musubiプロジェクト/mikke-os-mvp`

対象branch: `master`

状態: migration履歴整合済み・anon遮断確認済み・actor別RLSは2人目profile待ち

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

2026-07-15にCLI接続を復旧し、実DBとmigration SQLを照合した。照合時に見つかった次の差分もF4-b1内で是正済み。

```text
- authenticatedに残っていたTRUNCATE / REFERENCES / TRIGGERを失効させ、CRUDだけに限定
- SQL Editor初期適用時の自動constraint名をmigrationの明示名へ統一
- Fund projectの所有者profile複合FKにcovering indexを追加
- migration SQLを実DBへ再適用し「Fund F4-b1 migration applied」を確認
```

## 3. 読み取り確認済み

anon keyによるData API確認:

| table | HTTP | PostgreSQL code | 判定 |
| --- | --- | --- | --- |
| `fund_projects` | 401 | 42501 | anon権限なし |
| `fund_supports` | 401 | 42501 | anon権限なし |

応援者名、メール、金額を持つ `fund_supports` がanonへ公開されていないことを確認した。2026-07-15の権限是正後にも両tableで同じ `401 / 42501` を再確認済み。実データ値の読み取りは行っていない。

## 4. まだ完了していないこと

F4-b1は次を終えるまで合格・完了扱いにしない。

```text
1. 正規の利用フローで2人目のAuth user + profileが作成されるのを待つ
2. supabase/tests/fund_f4_b1_rls.sql を再実行
3. owner A / owner Bが自分のproject/supportだけ見えることを確認
4. 他人project/supportのUPDATEとINSERTが拒否されることを確認
5. test SQL末尾のROLLBACKにより一時データが残らないことを確認
```

2026-07-15の実行で `distinct profile users = 1` を確認し、testは `Fund F4-b1 RLS test requires profiles for two different auth users` で明示停止した。テスト行のinsert前に停止するため、一時データは作成されていない。無理にAuth userを作らない。

## 5. migration履歴の注意

2026-07-15にSupabase CLI 2.105.0の認証が後続プロセスでも有効なことを確認し、repoをproject ref `nttqpprkqbynxyldbnjs` へlinkした。

```text
Local          | Remote
20260714070637 | 20260714070637
```

実DBのcolumn / constraint / index / trigger / function / grant / RLS policyをmigration SQLと照合・是正した後、`supabase migration repair 20260714070637 --status applied --linked` を実行済み。`db push` は実行していない。

## 6. ブラウザ・CLIの経緯

```text
- Supabase CLI 2.105.0はインストール済み
- CLI projects list / link / db query / migration repair / advisors実行成功
- migration履歴のLocal / Remote一致確認済み
- Database AdvisorでFUND固有のsecurity警告なし
- FUND固有の複合FK index不足を是正済み
- 新規tableのunused index INFOは使用履歴がまだ無いため想定内
- 他アプリ由来の既存Advisor警告はFUNDの範囲外として変更していない
```

## 7. 次の実行手順

```text
1. git statusで他者のManager docs変更を巻き込まないことを確認
2. 正規の2人目profileが存在する状態で `supabase/tests/fund_f4_b1_rls.sql` を再実行
3. actor別RLS passとROLLBACKを確認
4. F4-b1 docsを完了へ更新してFundのみコミット
5. F4-b2は改めてユーザー承認を取る
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
