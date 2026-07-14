# Fund F4 Schema and RLS Review

作成日: 2026-07-14

対象repo: `G:/Musubiプロジェクト/mikke-os-mvp`

状態: F4-a完了・F4-b1 migration履歴整合済み・actor別RLSは2人目profile待ち

## 1. 結論

F4の本人同定・双方同意・公開解除という方向は維持します。ただし、現在のFund本体と応援記録はlocalStorageにあり、実DBにはFundの所有関係がありません。

この状態で `fund_supports` 以降の4テーブルだけを作ると、RLSが `project_id` の所有者をDB内で検証できません。クライアントから送られた `owner_user_id` を信用する実装は不可です。

したがってF4-bは、次の2段階へ再編します。

```text
F4-b1: Fund所有関係のDB基盤
  fund_projects + fund_supports の最小schema、所有制約、RLS

F4-b2: 招待・参加・公開投影
  fund_support_claims + fund_participations + fund_public_participations
  claim受取のserver-side transaction、双方同意、公開解除
```

画面と保存処理の本接続はF4-c以降です。F4-b1/b2はmigrationとRLSを先に検収し、localStorageの現行動作を変更しません。

## 2. 読み取り確認の範囲

対象Supabase project ref: `nttqpprkqbynxyldbnjs`

2026-07-14にanon keyを使ったData APIの読み取りだけを実施しました。行の値、メール、UUID、token、秘密鍵は記録していません。insert / update / delete、SQL実行、migration、policy変更は行っていません。

接続済みSupabase connectorのproject一覧には対象projectが含まれなかったため、catalogとpolicy本文を直接取得できませんでした。列の存在とanon側の見え方はRESTで確認し、policy本文は既存のDashboard確認docsと正典SQLを参照しています。

## 3. 実DB確認結果

### 3.1 Auth

| 項目 | 結果 |
| --- | --- |
| email signup | 有効 |
| email auto confirm | 無効 |
| phone auth | 無効 |
| anonymous auth | settings endpointに項目がなく、未確認 |

F4ではemail/password等の再ログイン可能なAuthをMikke IDの入口として維持します。匿名Authを応援者本人同定の完成形にはしません。

### 3.2 `profiles`

次の列はData APIで存在を確認しました。

```text
id, user_id, display_name, handle, bio, avatar_url, area,
website_url, instagram_url, member_number, joined_at,
created_at, updated_at
```

anonから `user_id` を含むSELECTが成功します。現在のpublic profile policyは行全体を公開する形なので、メール、claim、同意、金額、管理情報を `profiles` へ追加してはいけません。

また、正典SQLでは1ユーザーが複数profileを持てる制約です。F4では応援者がStory表示先として選んだ `supporter_profile_id` を参加レコードに保持し、そのprofileが本人所有かを受取時と更新時に検証します。

### 3.3 `activity_logs`

主要列の存在を確認しました。実DBの列名は `display_in_timeline` / `display_as_achievement` で、`display_on_timeline` / `display_on_achievement` ではありません。`currency` 列はありません。

anon確認では次の結果でした。

| 確認 | 結果 |
| --- | --- |
| `visibility != public` | 0件 |
| `display_on_story = false` | 0件 |
| public Story対象 | SELECT可能 |

既存Dashboard確認docsには、own SELECT/INSERT/UPDATE/DELETEと `visibility = 'public' AND display_on_story = true` のpublic SELECT policyが記録されています。今回policy本文は再取得できていないため、F4-b前にDashboardまたは管理接続で再確認します。

既存DBの重複制約はrepoの確認docs上 `profile_id + source_service + source_record_id` です。一方、現在のアプリ共通規約は `source_service + source_record_id + activity_type` を意味上の一意キーとしています。F4の参加ログは `source_record_id = participation.id` をイベント専用IDにして衝突を避けます。既存制約の変更はF4へ同梱しません。

### 3.4 Fundテーブル

次の5テーブルはData API上に存在しません。

```text
fund_projects
fund_supports
fund_support_claims
fund_participations
fund_public_participations
```

既存データとの衝突や移行済みFundレコードはありません。

## 4. F4 schemaレビュー結果

### 4.1 `fund_projects` を前提に追加

F4のRLSには、少なくとも次をDBで検証できるFund親テーブルが必要です。

```text
fund_projects
  id uuid primary key
  owner_user_id uuid not null references auth.users(id)
  owner_profile_id uuid not null references profiles(id)
  visibility text not null
  status text not null
  created_at / updated_at
```

F4-b1では所有判定に必要な最小列を確定します。公開本文などF1-F3の全項目を同時移行するかは、保存接続を行うF4-c前に別途マッピングします。

必須制約:

- `owner_profile_id` が `owner_user_id` 所有であることをINSERT/UPDATE policyで検証する。
- `visibility` は少なくとも `private | unlisted | public` に制限する。
- anonの直接SELECTは公開専用投影を用意するまで許可しない。

### 4.2 owner-private: `fund_supports`

`project_id` は `fund_projects.id` への外部キーとし、`owner_user_id` は重複保持しない案を第一候補にします。所有者は必ず親projectとの `exists` で判定します。

応援者本人へこのテーブルを直接公開しません。氏名、メール、コメント、金額、決済、提供状況はowner-privateのままです。

### 4.3 private claim: `fund_support_claims`

追加条件:

- `token_hash` はunique。生tokenはDBへ保存しない。
- `support_id` ごとに未使用・未取消claimを1件に制限する。
- token照合、期限確認、使用済み化、参加作成を1 transactionで行う。
- `accepted_by_user_id` と `supporter_profile_id` は認証済み `auth.uid()` と本人profileからserver側で確定する。

hashしか保存しないため、ブラウザからclaimsを直接SELECT/UPDATEする構造にはしません。F4-b2で、権限を限定したserver-side functionまたは同等のserver-only処理を別レビューします。

### 4.4 shared-safe: `fund_participations`

設計案へ `supporter_profile_id` を追加します。

```text
id
project_id
support_id unique
owner_user_id
supporter_user_id
supporter_profile_id
owner_consent_status
supporter_consent_status
public_name
display_mode
created_at / updated_at
```

`story_enabled` はクライアント更新可能な真偽値として持たず、双方同意、display mode、Fund visibility、support validityから公開投影処理が導出します。

更新可能列を分離します。

- 実行者: `owner_consent_status` のみ
- 応援者: `supporter_consent_status`, `supporter_profile_id`, `public_name`, `display_mode` のみ
- `owner_user_id`, `supporter_user_id`, `project_id`, `support_id`: クライアント更新不可

通常のtable UPDATE policyだけでは列別更新を十分に縛れないため、同意更新は限定RPCまたはserver-only処理を優先します。

### 4.5 public-safe: `fund_public_participations`

公開専用テーブルを維持します。anonにはこのテーブルのSELECTだけを許可し、クライアントからのINSERT/UPDATE/DELETEは許可しません。

```text
participation_id primary key
project_id
supporter_profile_id nullable
display_name
is_anonymous
public_fund_path
published_at
```

公開条件:

```text
owner consent granted
supporter consent granted
display_mode != hidden
Fund visibility = public
support record = valid
```

`unlisted` は公開投影を作りません。どちらかの同意解除、Fund非公開化、support無効化時には同じtransactionで公開投影を削除します。

## 5. RLS policyレビュー案

全policyでroleと所有条件を明示し、`auth.uid()` は `(select auth.uid())` の形を使います。

| table | operation | 条件 |
| --- | --- | --- |
| `fund_projects` | owner SELECT/INSERT/UPDATE | `owner_user_id = (select auth.uid())` かつprofile所有確認 |
| `fund_supports` | owner CRUD | 親projectの `owner_user_id = (select auth.uid())` |
| `fund_support_claims` | owner SELECT/INSERT/revoke | 親support -> projectの所有確認 |
| `fund_support_claims` | supporter claim | 直接table操作不可。server-side transactionのみ |
| `fund_participations` | owner SELECT | `owner_user_id = (select auth.uid())` |
| `fund_participations` | supporter SELECT | `supporter_user_id = (select auth.uid())` |
| `fund_participations` | consent update | actor別の限定処理のみ |
| `fund_public_participations` | anon/auth SELECT | 公開投影済みの行だけ |
| `fund_public_participations` | write | browser roleはすべて不可 |

UPDATEをtable policyで行う場合は、SELECT policy、`USING`、`WITH CHECK`をすべて用意します。認可に `raw_user_meta_data` / `user_metadata` は使いません。service roleやsecret keyはブラウザへ置きません。

## 6. F4-bの実行前テスト

### 6.1 migration静的確認

- 全Fund tableでRLS enabled
- FK、check、unique、index、updated_at trigger
- policyにroleと所有条件がある
- security definerを使う場合は固定 `search_path`、最小grant、入力検証を確認
- 公開投影にメール、金額、コメント、決済、提供状態がない

### 6.2 actor別の否定テスト

| actor | 必須確認 |
| --- | --- |
| anon | private/shared/claim/supportを0件、public projectionだけ読める |
| owner A | 自分のproject/supportだけCRUD。他ownerの行は不可 |
| supporter B | 自分のparticipationだけ読め、owner consentを変更できない |
| unrelated C | claim tokenを知らない状態では全Fund private行を読めない |
| expired/revoked token | 受取不可 |
| reused token | 2回目の受取不可 |
| unlisted Fund | public projection 0件 |
| consent revoked | public projectionが消える |

Supabase Database Advisorも確認し、security definer view、RLS無効、過剰grant、未index FKの警告を解消してからF4-cへ進みます。

## 7. F4-aセルフチェック

```text
1. 機械: docsのみ。秘密情報・実データ値を記録していない
2. 挙動: profiles/Auth/activity_logs/Fund table有無を読み取り確認
3. 安全: insert/update/delete/migration/RLS変更なし。anon漏えい確認は件数のみ
4. 共通影響: アプリコード・保存処理・公開Storyの見た目変更なし
5. 次工程: F4-bをb1/b2へ再編し、別承認まで停止
```

## 8. F4-b1適用後の現在地

2026-07-14に `fund_projects` / `fund_supports` とRLSを対象Supabaseへ適用した。2026-07-15に実DBとmigrationを照合し、authenticatedをCRUDのみへ制限、constraint名の統一、所有者profile複合FK index追加を行った。anon RESTは両tableとも `401 / 42501` で再確認済み。

```text
完了:
- Database Advisor確認（FUND固有security警告なし、複合FK index不足は是正）
- CLI migration履歴のLocal / Remote一致
- anon REST再確認
- lint / build

未完了:
- actor別transaction RLS test（異なるAuth userに属するprofileが現在1件のため安全停止）
```

詳細は `MIKKEOS_FUND_F4_B1_HANDOFF_2026-07-14.md`。actor別testを完了するまでF4-b1は合格扱いにせず、F4-b2へ進まない。
