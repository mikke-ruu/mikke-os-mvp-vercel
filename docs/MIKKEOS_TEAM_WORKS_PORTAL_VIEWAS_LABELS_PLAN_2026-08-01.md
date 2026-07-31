# Team Works Phase O — ポータル「〜として表示」・ラベル汎用化・設定の整理

作成: 2026-08-01
前段: `MIKKEOS_TEAM_WORKS_WORK_WINDOW_PLAN_2026-07-31.md`（Phase M/N）

あゆみが「機能とポータルの設定」タブを実際に使って出た指摘3点への対応。

---

## 0. 調査で分かったこと（着手前の事実確認）

### 0-1. 「クライアントポータル全体」は運営型では何もしていない

チェックの実体は `team_works_projects.client_visible` 列。この列を実際に読んでいるのは
**納品型のタスク・成果物のRLSだけ**（`team_works_tasks_select` / `team_works_deliverables`
系。`20260717155456_team_works_p8a_foundation.sql:295` 等）。

運営型のクライアントポータルは、

- 読み込み側 `buildClientPortalData`（`lib/team-works-operations-client.ts`）がこの列で絞り込んでいない
- `team_works_op_sessions` / `team_works_session_roster` の RLS
  （`20260726190000_team_works_r6_multi_role_rls.sql:124`）も参照していない

ため、**OFFにしてもクライアントには全部見えている**。インドネシア校は現在OFFだが
クライアント視点プレビューに中身が出るのがその証拠。

**素直に「OFFなら非表示」を実装してはいけない**: `client_visible` の DB デフォルトは
`false`。既存の運営型プロジェクト（アリサ含む）はほぼ全て `false` のはずなので、
そのまま繋ぐとアリサのクライアントポータルが全部消える。

→ あゆみ判断: **運営型の設定画面からは外す**（「必要じゃない画面には出さない方がいい。
混乱する」）。列そのものは納品型が使っているので残す。

### 0-2. 「名簿」はラベルだけで一般化できる

あゆみの指摘:
> 名簿はタスクとしてクライアントが設定できたり。家事代行ならトイレ、お風呂など、
> その手順書を紐づけておけるなど工夫できる。

現在のデータモデルは既にこの形になっている:

| 現在の呼び名 | 実体 | 家事代行での読み替え |
|---|---|---|
| 名簿 | `team_works_participants` | 作業リスト |
| 生徒 | participants の1行 | トイレ／お風呂などの作業箇所 |
| グループ | `team_works_groups` | エリア（1F／2F など） |
| 出席順の確定 | `team_works_session_roster` | 今日やる箇所と順番 |
| マニュアル連動 | `workWindow.manualLink` | 箇所ごとの手順書 |

**データモデルの変更は不要**。呼び名を組織設定から差し替えられるようにすれば成立する。

### 0-3. 埋め込みプレビューの構造的な限界

1. `loadOperations*PortalPreview` は**保存済みのDB値**を読む。チェックを入れただけでは変わらない
2. `pointer-events-none`（`TeamWorksOperationsClientPortal.tsx:145` 等）で操作不可のため、
   コマをクリックして開く**作業窓には辿り着けない**
3. サンプル表示でも実データを読むので、予定・名簿が空のプロジェクトでは何も映らない

→ あゆみ提案「実際管理者も各ポータルを見に行けるようにしても良いんじゃないでしょうか？
現在は違うメールアドレスで見に行ってます」を採用する。既に
`loadOperationsClientPortalPreview` / `loadOperationsPartnerPortalPreview`
（staffが対象メンバーIDを指定して読む関数）があり、staffはRLS上もともと組織の全データを
読めるので、**権限の変更なしに実現できる**。

---

## O-1. 運営型から「クライアントポータル全体」を外す

- `TeamWorksOperationsProjectDetail.tsx` の「クライアントに表示」セクションから
  `クライアントポータル全体` の `FeatureCheck` を削除する。
- 保存時は `data.project.clientVisible` を**そのまま送り直す**（DBの値を変えない）。
  値を落とすと `false` で上書きされ、納品型と共用の列に副作用が出る。
- コード上に「運営型では未接続。プロジェクト単位の非公開が必要になったら
  RLS込みで再設計すること（既存行が全て false なので一括 true の migration が前提）」
  とコメントを残す。

migration: 不要。

## O-2. ラベルの拡張

`lib/team-works-labels.ts` の `TeamWorksLabels` に7キー追加する。

| キー | DEFAULT（アリサ＝現行文言） | GENERAL_PURPOSE（新規組織） |
|---|---|---|
| `rosterNoun` | 名簿 | 作業リスト |
| `participantNoun` | 生徒 | 対象 |
| `groupNoun` | グループ | グループ |
| `attendanceNoun` | 出席 | 実施 |
| `clientNoun` | クライアント | クライアント |
| `manualNoun` | マニュアル | マニュアル |
| `reportNoun` | 報告 | 報告 |

**DEFAULT_LABELS は現行の表示文言と1文字も変えないこと**（`label_settings` が null の
既存組織＝アリサはこれを引き続き引く）。これが「アリサ不変」の担保。

差し替え対象:

- `app/apps/team-works/settings/page.tsx` — 入力欄7つ追加（既存5つと同じ作り）
- `components/team-works/operations/TeamWorksOperationsProjectDetail.tsx` — タブ名、
  「機能とポータルの設定」の見出し・説明・タグ
- `components/team-works/operations/TeamWorksOperationsClientPortal.tsx` — タブ名、
  見出し、ボタン、空状態
- `components/team-works/operations/TeamWorksOperationsPartnerPortal.tsx` — 作業窓の
  見出し・名簿まわり

migration: 不要（`label_settings` jsonb は既存。キー追加は resolve 側の既定値で吸収）。

## O-3. 「〜として表示」モード

### ローダー（RLS変更なし）

- `loadOperationsClientPortalAs(client, organizationMemberId)`
- `loadOperationsPartnerPortalAs(client, organizationMemberId)`

対象メンバーの `team_works_project_members` を引いて、既存の `buildClientPortalData` /
`buildPartnerPortalData` に渡すだけ。`loadOperations*PortalPreview` が projectId 固定なのに対し、
こちらは**その人が実際に持っている全プロジェクト**を解決するので、本人のポータルと同じ姿になる。

### ルート

- `/apps/team-works/portal/client?as=<memberId>`
- `/apps/team-works/portal/worker?as=<memberId>`
- `/apps/team-works/portal/worker/lesson/[sessionId]?as=<memberId>`（作業窓）

### 読み取り専用の担保

`components/team-works/TeamWorksViewAsContext.tsx` を新設。`useViewAs()` が非 null の間は
各ポータルの操作ボタンを `disabled` にし、上部に「〇〇さんとして表示中（本部）・操作はできません」
のバナーを出す。`pointer-events-none` は使わない（タブ切り替えとコマのクリックは通す必要があるため）。

無効化する操作:
- クライアント: 出席順の保存、対象者の登録・更新、グループの追加・更新、メッセージ送信
- スタッフ: 開始/終了ボタン、報告の提出、名簿の進行、メッセージ送信、希望シフト提出

### 入口

「機能とポータルの設定」タブの埋め込みプレビュー上部に「新しいタブで実際の画面を開く」
リンクを置く（クライアント視点／スタッフ視点それぞれ）。埋め込みプレビューは
"雰囲気の確認" 用として残す。

### ガード

`as=` を使えるのは staff のみ。RLS上 staff でなければデータが取れないので実質的には
そこで止まるが、画面には「本部権限が必要です」と明示する。

migration: 不要。

---

## 実装順と検証

1. O-1（小） → コミット
2. O-2（中） → コミット
3. O-3（大） → コミット

各段階で `npm run tsc`（`npm run lint`）を通す。
ブラウザ実機確認はSupabase認証が必要なためあゆみが行う。

## アリサ安全チェック（各段階で確認すること）

- `DEFAULT_LABELS` の7キーが現行文言と完全一致しているか
- `label_settings` が null の組織で表示が1文字も変わらないか
- O-1 で `client_visible` の値を書き換えていないか
- `as=` なしの通常ポータルの挙動が変わっていないか
