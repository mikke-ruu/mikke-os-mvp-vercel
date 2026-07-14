# Fund F4 Identity and Consent Plan

作成日: 2026-07-14

対象repo: `G:/Musubiプロジェクト/mikke-os-mvp`

状態: F4-b1 migration履歴整合済み・actor別RLSは2人目profile待ち、F4-b2未着手

## 1. 目的

F4は、外部で受け付けた応援をMikke IDへ安全に紐づけ、実行者と応援者の双方が同意した場合だけ、応援者本人のStoryへ参加記録を表示できるようにする段階です。

このdocsでは実装境界、データ分離、同意状態、RLS検収条件を固定します。migration、RLS、Supabase本接続、保存処理はまだ変更しません。

参照した現行Supabase公式資料:

- https://supabase.com/docs/guides/auth/users
- https://supabase.com/docs/guides/auth/identities
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/database/secure-data

## 2. 固定する判断

- 応援参加の紐づけには、再ログイン可能なMikke IDを使う。匿名Authを本人同定の完成形にしない。
- メールアドレス一致だけで自動紐づけしない。
- 実行者が任意のMikke IDを直接指定して応援者に設定できないようにする。
- 1回限り・期限付きの招待リンクを、ログイン済みの応援者本人が受け取って確定する。
- Story表示は実行者同意と応援者同意の両方が有効な場合だけ。
- 応援者名、メール、管理メモ、金額、決済状態を公開用レコードへ入れない。
- 応援金額はF4ではStory表示不可。金額公開はF5以降も別承認事項とする。
- `unlisted` のFundをStoryへ伝播させない。Story対象はFund本体が `public` の場合だけ。
- 同意を片方が解除したら、公開用レコードとStory表示を停止する。Activity Logの元記録はprivateで保持する。

## 3. 画面

| Route | 利用者 | 役割 |
| --- | --- | --- |
| `/apps/fund/[id]/supporters` | 実行者 | 既存一覧に「Mikke IDへ招待」「同意状態」を追加 |
| `/fund/invite/[token]` | 応援者 | ログイン後に対象Fundと公開されない情報を確認して参加を受け取る |
| `/fund/me` | 応援者 | 自分が受け取った参加記録とStory表示状態を管理 |
| `/fund/me/[participationId]` | 応援者 | 公開名・匿名・Story表示・解除を管理 |

公開Storyには新しい巨大セクションを作らず、既存の活動・リンク一覧に小さなFund参加行を置きます。

## 4. データ分離案

F4実装時に以下をそのままmigrationへ書かず、実DBの `profiles` / Auth / Data API設定を読み取り専用で再確認してから確定します。

### 4.1 owner-private: `fund_supports`

実行者だけが管理する元の応援記録です。

```text
id
project_id
owner_user_id
supporter_name
supporter_email
comment
amount
payment_status
fulfillment_status
record_status
...
```

応援者本人にもこの行を直接SELECTさせません。RLSだけでは列単位の秘匿を表現しにくいため、応援者に見せる情報は別テーブルへ分離します。

### 4.2 private claim: `fund_support_claims`

```text
id
support_id
token_hash
expires_at
accepted_by_user_id
accepted_at
revoked_at
created_at
```

- 生の招待tokenは保存せずhashだけを保存する。
- 1応援記録につき有効なclaimは1件。
- 受取時の `accepted_by_user_id` はクライアント入力ではなく認証済み `auth.uid()` から決める。
- 期限切れ・使用済み・取消済みtokenは再利用できない。

### 4.3 shared-safe: `fund_participations`

実行者と応援者が双方とも閲覧できる、個人情報と金額を含まない参加関係です。

```text
id
project_id
support_id
owner_user_id
supporter_user_id
owner_consent_status
supporter_consent_status
public_name
display_mode
story_enabled
created_at
updated_at
```

```text
consent_status: pending | granted | revoked
display_mode: hidden | public_name | anonymous
```

`support_id` は一意。`supporter_user_id` は招待受取処理以外から変更不可とします。

### 4.4 public-safe: `fund_public_participations`

Story公開に必要な最小情報だけを持つ投影です。

```text
participation_id
project_id
supporter_profile_id
display_name
is_anonymous
public_fund_path
published_at
```

メール、金額、コメント、決済、提供状況は持ちません。双方同意・Fund本体public・応援記録validの条件が崩れた場合は公開対象から外します。

## 5. 状態遷移

```text
実行者が招待を作る
  -> claim pending
  -> 応援者がMikke IDでログインして受取
  -> participation作成
  -> owner granted / supporter pending
  -> 応援者が表示内容を確認してgranted
  -> Fund本体publicなら公開投影を作る
```

解除:

```text
owner revoked または supporter revoked
  -> Story表示停止
  -> 公開投影を除外
  -> fund_participation_recorded Activity Logはprivate化
```

## 6. RLS検収表

| 対象 | anon | 応援者 | 実行者 |
| --- | --- | --- | --- |
| `fund_supports` | 不可 | 不可 | 自分のproject分のみCRUD |
| `fund_support_claims` | 不可 | token受取処理のみ | 自分のsupport分だけ作成・取消 |
| `fund_participations` | 不可 | `supporter_user_id = auth.uid()` の行だけSELECT/同意更新 | `owner_user_id = auth.uid()` の行だけSELECT/同意更新 |
| `fund_public_participations` | 公開条件を満たす最小列のみSELECT | 同左 | 同左 |

実装時の必須条件:

- exposed schemaの全テーブルでRLSを有効化する。
- policyは `TO authenticated` だけで終わらせず、必ず所有条件を持つ。
- UPDATEはSELECT policy、`USING`、`WITH CHECK`を揃える。
- 認可判断にuser-editableな `user_metadata` を使わない。
- service role / secret keyをブラウザへ出さない。
- viewを使う場合は `security_invoker = true` と公開列を確認する。ただし初期案は公開専用テーブルを優先する。

## 7. Activity Log

```text
eventType: fund_participation_recorded
sourceId: participation.id
visibility: private 初期
storyEnabled: 双方同意 + Fund public + display_mode != hidden の場合だけtrue
deskEnabled: false
amountType: none
countsTowardSummary: false 初期
```

公開用title・descriptionへ実行者の管理名やメールを流用しません。公開名は応援者が選んだ `public_name` または匿名表示だけを使用します。

## 8. 実装パッケージ案

### F4-a: 読み取り確認・schema確定

- 完了。結果は `MIKKEOS_FUND_F4_SCHEMA_AND_RLS_REVIEW.md` に記録
- 実DBのprofiles/Auth設定/Data API設定を読み取り専用で確認
- Fundの4テーブルは未作成、DB変更なし
- Fund本体がlocalStorageのため、4テーブルだけではproject所有者をRLSで検証できない依存関係を確認

### F4-b: migration / RLS

- F4-a結果を受けてF4-b1 / F4-b2へ分割
- F4-b1: `fund_projects` + `fund_supports` の最小DB基盤、所有制約、RLS。2026-07-15にmigration履歴・Advisor・anon再確認まで完了、actor別RLSは2人目profile待ち
- F4-b2: claims + participations + public projection、server-side claim transaction
- advisorと本人/他人/anonの否定テスト

### F4-c: 招待・マイページ

- 招待作成・受取・取消
- 応援者マイページ
- 双方同意
- private Activity Log

### F4-d: Story反映・解除

- 公開投影
- Storyの小さな参加行
- 同意解除と限定公開伝播防止

## 9. 次工程に必要な承認

F4-b1 migrationは適用・履歴整合済みです。正規の2人目profileができた後にactor別RLS検収を完了するまでF4-b2へ進みません。

```text
F4-b1検収完了後、F4-b2のmigration / claim実装へ進めてよいかを改めて確認する。
```

現在地と次の手順は `MIKKEOS_FUND_F4_B1_HANDOFF_2026-07-14.md`、設計条件は `MIKKEOS_FUND_F4_SCHEMA_AND_RLS_REVIEW.md` を参照します。
