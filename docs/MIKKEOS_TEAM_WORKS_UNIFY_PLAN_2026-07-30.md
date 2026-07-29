# Team Works 統一計画（2026-07-30）

対象: Team Works 本部側の全画面（運営型 `style='operations'` / 納品型 `style='delivery'` の両方）
実装者: Sonnet
計画者: Opus

前提となる計画書: `docs/MIKKEOS_TEAM_WORKS_DELIVERY_PLAN_2026-07-29.md`（Phase 1〜7 完了済み）

---

## 0. この計画の背景

納品型プロジェクトの機能（工程・フォーム・提出・承認・期日・作業指示）は 2026-07-29〜30 に
出揃った。しかし**画面としては納品型が別アプリのように浮いている**。あゆみからの指摘:

> ・プロジェクトを削除するも作ってください。
> ・運営型プロジェクトと納品型プロジェクトの新規作成を同じように揃えてください。
> ・急にページの統一感が変わってしまいます。
> ・継続業務を押すとホームに飛んで「最初の運営型プロジェクトを作成」になります。
> ・納品型プロジェクトは運営型プロジェクトのようなメニューや表示はない。
> ・登録メンバーは立ち上げ時しか選べない（工程表では出てこない）。
> ・カレンダーもタスクを表示してあるだけで何の機能もない。しかも謎に2段。
>   本来ならホームに総合のスケジュールが表示されるべきです。運営型プロジェクトの時のように。
>
> 使う人の事を考えて、運営型プロジェクトのように親切使いやすく設計してください。
> 仕様を変えるならメニューを増やしても構いません。統一感を大事にしたいです。

**この計画は機能追加より「揃える・使えるようにする」が主目的。**
運営型を基準（正解）として、納品型をそこに合わせる。

---

## 1. 指摘と原因の対応表

| # | 指摘 | 技術的な原因 |
|---|---|---|
| 1 | 削除がない | `team_works_projects.archived_at` 列は最初からあるが、**UIもlib関数も無い**。運営型も未実装（`TeamWorksOperationsProjectDetail.tsx:1546` に「アーカイブ実行ボタンは本番の確認フローと合わせて追加します」と注記が残っている） |
| 2 | 新規作成が揃っていない | 運営型＝プロジェクト管理ページ内の**インラインフォーム**（`TeamWorksOperationsProjectList.tsx:59-86`）。納品型＝**別ページの4段ウィザード**（`app/apps/team-works/projects/new/page.tsx`）。入口も見た目も別物 |
| 3 | 急に統一感が変わる | 運営型系は `TeamWorksOperationsShell`（左サイドバー8項目）。納品型系（ウィザード・詳細）は `TeamWorksProjectsShell`（**サイドバー無し**＋独自の上部3タブ「継続業務/プロジェクト/テンプレート」）。**外枠が2種類ある** |
| 4 | 継続業務→「最初の運営型プロジェクトを作成」 | `TeamWorksProjectsShell` の「継続業務」が `/apps/team-works` へ飛ぶ。そこは `TeamWorksOperationsDashboard` で、`hasOperationsProjects === false` なら無条件に `FirstOperationsProjectSetup` を出す（`TeamWorksOperationsDashboard.tsx:87-89`）。`loadOperationsDashboardData` は運営型が0件の時点で空を返す（`lib/team-works-operations.ts:397`）ため、**納品型が3件あっても「まだ何もない」扱いになる** |
| 5 | 納品型にメニューが無い | 運営型の詳細は9タブ（概要/スケジュール/メッセージ/パートナー/名簿/報告/マニュアル/ポータル設定/プロジェクト設定、`TeamWorksOperationsProjectDetail.tsx:96-108`）。納品型の詳細は**タブ無しの1画面ベタ書き**で、サマリー・カレンダー・工程・メンバーが縦に全部並ぶ |
| 6 | メンバーが立ち上げ時しか選べない | ①`addDirectoryMemberToDeliveryProject` は `team_works_find_active_member` が空（＝相手がまだポータルにログインしていない）だと **null を返して黙って skip** する。運営型は同じ状況で**招待を作って `pending_activation` を返す**（`lib/team-works-operations-project.ts:2207-2259`）。②そもそも納品型は**プロジェクト作成時にしかメンバー追加を呼んでいない**。後から追加する画面が無い |
| 7 | カレンダーが2段・機能なし | `buildDeliveryCalendarItems` が提出期日と完了期日を**無条件に別項目**として展開するため、同日に両方あると同じ工程が2チップ並ぶ。チップをクリックしても何も起きない（日付クリックで下に一覧が出るだけ）。運営型の `TeamWorksMonthCalendar` とは別実装 |

---

## 2. 設計方針

1. **外枠は1種類にする。** 本部側の全画面（運営型・納品型・テンプレート・ウィザード）は
   左サイドバーのある `TeamWorksOperationsShell` を使う。`TeamWorksProjectsShell` の
   独自3タブは廃止する。
2. **納品型も運営型と同じ「タブのある詳細画面」にする。** タブの中身は仕事の性質が違うので
   同じにしないが、**枠・タブの見た目・遷移の作法は完全に同じ**にする。
3. **ホームは全プロジェクトの総合ダッシュボード。** 運営型のコマと納品型の期日を
   同じカレンダーに載せる。「対応が必要なこと」も両方合算する。
4. **削除はアーカイブ方式。** 物理削除はしない（`archived_at` を入れる）。アーカイブ済みは
   一覧から隠し、別枠で復元できる。Team Works の他のテーブルと同じ作法。
5. **migrationは不要。** 必要な列（`archived_at`）は既にある。新規テーブル・新規列を作らない。
6. **RLSを変更しない。** 既存ポリシーが仕様。
7. **既存の運営型の動作を壊さない。** 運営型に手を入れるのは「アーカイブ追加」と
   「ホームの合算」だけ。シフト・コマ生成・名簿・報告のロジックには触らない。
8. **色は役割トークンのみ**（`--tw-title` `--tw-action` `--tw-done` `--tw-planned` `--tw-deadline`）。
   正典 `docs/MIKKEOS_EDITORIAL_UI_DESIGN_RULES.md` に従う。

---

## Phase A: 外枠とナビの統一 ★最初にやる

### 目的
指摘 #3 #4 #5 を消す。**見た目の浮きが無くなるので体感が一番大きく変わる。**

### A-1. 外枠を1本化する

`TeamWorksProjectsShell`（サイドバー無し＋3タブ）を使っている全画面を
`TeamWorksOperationsShell`（サイドバーあり）に差し替える。

対象:
- `app/apps/team-works/projects/new/page.tsx`（新規作成ウィザード）
- `app/apps/team-works/project-templates/page.tsx`, `.../generator/page.tsx`, `.../[templateId]/page.tsx`
- `TeamWorksOperationsProjectDetail.tsx:168-171`（納品型詳細をラップしている箇所）

`TeamWorksProjectsShell` 本体は**3タブのnavだけ削除**し、
`teamWorksProjectInputClass` / `TeamWorksProjectField`（多数のファイルが import している）は
そのまま残す。もしくは shell 関数だけ削除して2つのexportを残す。

> **注意**: `TeamWorksOperationsShell` という名前は「運営型専用」に見えるが、実体は
> **本部側の共通サイドバー**。ファイル名は変えずに、冒頭コメントに
> 「運営型・納品型の両方で使う本部共通の外枠」と書き足すこと。
> リネームは他セッションと衝突するので**やらない**。

### A-2. サイドバーに「テンプレート管理」を追加

3タブを廃止すると工程テンプレートへの導線が消える。サイドバー（`buildTeamWorksNavItems`）の
「プロジェクト管理」の直後に追加する。

```
ホーム
── 運営
スケジュール管理
メッセージ管理
プロジェクト管理
テンプレート管理   ← 追加（href: /apps/team-works/project-templates, icon: LayoutTemplate）
パートナー管理
クライアント管理
マニュアル管理
── 設定
企業設定
```

### A-3. 納品型の詳細画面をタブ化

`TeamWorksDeliveryProjectDetail.tsx` を、運営型と同じ「戻る矢印＋タイトル＋種別バッジ＋
下線タブnav」の構造にする。**タブnavのマークアップとclassNameは
`TeamWorksOperationsProjectDetail.tsx:216-250` からそのまま持ってくる**（見た目を完全に揃えるため）。

| タブ | 中身（既存コードの移動先） |
|---|---|
| **概要** | `TeamWorksDeliveryStaffPendingSummary`（クライアント待ち/本部確認待ち/期限超過）＋ 進捗（n工程中m件完了）＋ 納期 ＋ 直近の対応事項一覧 ＋ 次の期日3件 |
| **工程** | 工程の追加フォーム ＋ 工程一覧（`TaskListSection` をそのまま） |
| **スケジュール** | 納期の設定 ＋ 逆算配置ボタン（`ProjectDueOnEditor`）＋ カレンダー（Phase Eで作り直す） |
| **成果物** | 工程をまたいだ提出物の一覧。確認待ち→承認/差し戻しをここでまとめて処理できる（今は工程を1つずつ開かないと確認できない） |
| **メンバー** | 参加中／招待中／仮の担当名（Phase Dで作る） |
| **プロジェクト設定** | プロジェクト名の変更 ＋ 納期 ＋ クライアント公開 ＋ **アーカイブ**（Phase Cで作る） |

タブは `?tab=` クエリで直接開けるようにする（運営型と同じ、`useSearchParams`）。
概要タブの「対応が必要なこと」からその工程へ飛ぶときは
`?tab=工程#task-{id}` の形にして、**飛んだ先で該当工程が自動で開いている**ようにする
（今はアンカーで飛ぶだけで、自分でクリックして開く必要がある）。

### 変更対象
- `components/team-works/operations/TeamWorksOperationsShell.tsx`（nav1項目追加＋コメント）
- `components/team-works/projects/TeamWorksProjectsShell.tsx`（3タブnav廃止）
- `components/team-works/projects/TeamWorksDeliveryProjectDetail.tsx`（タブ化・大きめの分割）
- `app/apps/team-works/projects/new/page.tsx`, `app/apps/team-works/project-templates/**`
- `components/team-works/operations/TeamWorksOperationsProjectDetail.tsx`（168-171 のラップを差し替え）

### 完了条件
- どの本部画面でも左サイドバーが出ていて、現在地がハイライトされる
- 「継続業務/プロジェクト/テンプレート」の3タブがどこにも無い
- 納品型の詳細が運営型と同じ見た目のタブで切り替わる
- `npm run lint` 通過

---

## Phase B: 新規作成フローの統一

### 目的
指摘 #2。**入口を1か所にし、枠を共通化する。**

### B-1. 入口を1つにする

プロジェクト管理ページ（`TeamWorksOperationsProjectList`）の先頭を、
今の「運営型を立ち上げるインラインフォーム」から**種類を選ぶカード2枚**に変える。

```
┌─────────────────────────┐  ┌─────────────────────────┐
│ 運営型プロジェクト        │  │ 納品型プロジェクト        │
│ 契約期間中、予定・名簿・  │  │ 期日までに成果物を仕上げる│
│ シフト・報告を繰り返す    │  │ 期間限定の制作案件        │
│ 例）教室運営、定期メンテ  │  │ 例）認定講座構築、サイト制作│
│         [ 作成する ]      │  │         [ 作成する ]      │
└─────────────────────────┘  └─────────────────────────┘
```

どちらも `/apps/team-works/projects/new?style=operations|delivery` へ遷移する。
一覧セクション（Operations / Delivery）の中にあった `新規作成` ボタンは**消す**
（入口が2か所あるのが混乱の元）。

### B-2. ウィザードの枠を共通化する

`components/team-works/projects/TeamWorksProjectWizard.tsx`（新規）を作る。
ステップのチップ列・戻る/次へ・エラー表示・最終ボタンを持つ**枠だけ**のコンポーネント。

```tsx
<TeamWorksProjectWizard
  steps={[{ label: "ゴール" }, { label: "メンバー" }, ...]}
  step={step} onStepChange={setStep}
  canGoNext={...} submitLabel="プロジェクトを作成"
  onSubmit={...} saving={saving} error={error}
>
  {step === 1 ? <>...</> : null}
</TeamWorksProjectWizard>
```

これを両方で使う。

| | ステップ |
|---|---|
| **運営型** | ①基本情報（プロジェクト名・組織名・契約開始日・契約終了日） → ②確認 |
| **納品型** | ①ゴール → ②メンバー → ③作業の順番 → ④確認 |

ステップ数は違うが、**チップの見た目・戻る/次への位置・確認画面の作り・作成ボタンが同じ**になる。

> **判断が必要なところ（あゆみに確認したい）**: 運営型はもともと1画面4項目で作れていたので、
> 2ステップにすると「かえって手間が増えた」と感じる可能性がある。
> - 案1（この計画の採用案）: 運営型も2ステップにして完全に揃える
> - 案2: 運営型は1画面のまま、ただし**同じ枠・同じボタンの見た目**にする（チップは1個だけ表示）
>
> 迷ったら**案2**でよい。「同じ手順数」より「同じ見た目・同じ場所にボタン」の方が
> 統一感としては効く。実装が軽いのも案2。

### 変更対象
- `components/team-works/projects/TeamWorksProjectWizard.tsx`（新規）
- `components/team-works/projects/TeamWorksProjectGenerator.tsx`（枠を差し替え）
- `components/team-works/operations/TeamWorksOperationsProjectList.tsx`（入口カード2枚に）
- `app/apps/team-works/projects/new/page.tsx`（`?style=` で分岐）
- 運営型作成フォームを `TeamWorksOperationsProjectCreate.tsx` として切り出す（新規）

### 完了条件
- プロジェクト管理ページの先頭で種類を選ぶ形になっている
- 運営型・納品型のどちらを作っても、同じ枠・同じ位置のボタンで進む
- 作成後は両方ともそのプロジェクトの詳細へ遷移する
- `npm run lint` 通過

---

## Phase C: プロジェクトのアーカイブ（削除）

### 目的
指摘 #1。**運営型・納品型の両方に付ける。**

### 方針
物理削除はしない。`team_works_projects.archived_at` に日時を入れる。
一覧の取得は既に `.is("archived_at", null)` で絞っているので、
**アーカイブすれば自動的に一覧から消える。migration不要。**

### C-1. lib関数

`lib/team-works-delivery.ts` と `lib/team-works-operations-project.ts` の両方に追加
（共通化しても良いが、既存の置き場所の作法に合わせる）:

```ts
export async function archiveProject(client, projectId): Promise<void>   // archived_at = now()
export async function restoreProject(client, projectId): Promise<void>   // archived_at = null
export async function fetchArchivedProjects(client): Promise<...>        // archived_at is not null
```

RLS: `team_works_projects_update` は org staff のみ。変更不要。

### C-2. UI

**プロジェクト設定タブ**（納品型は Phase A で作る、運営型は既にある `ProjectSettingsTab`）の
一番下に「このプロジェクトをアーカイブする」ブロックを置く。

- 赤枠（`--tw-action`）で囲み、何が起きるかを日本語で書く
  「一覧から見えなくなります。工程・提出物・やり取りは消えません。あとで元に戻せます。」
- **プロジェクト名を入力させてから**ボタンを有効化する（誤操作防止）
- 実行後はプロジェクト管理ページへ戻る

**プロジェクト管理ページの一番下**に「アーカイブ済み（n件）」の折りたたみを追加。
中に一覧＋各行に「元に戻す」ボタン。

### 完了条件
- 運営型・納品型のどちらもアーカイブでき、一覧から消える
- アーカイブ済みから元に戻せる
- プロジェクト名を入力しないとアーカイブボタンが押せない
- `npm run lint` 通過

---

## Phase D: メンバーを後から追加できるようにする

### 目的
指摘 #6。**ここが一番「使えない」原因になっている。**
今は名簿の相手を選んでも、その相手がポータンにまだログインしていないと**黙って無視される**。

### D-1. 原因の再確認（実装前に読むこと）

`team_works_project_members` は `organization_member_id` への外部キーを持つ。
`team_works_organization_members` の行は**本人が招待を受けてログインしないと作られない**。
だから「名簿にいる（`team_works_partners`）」だけではプロジェクトメンバーにできない。

運営型はこれを**招待で解決している**（`lib/team-works-operations-project.ts:2207-2259`）:
1. アクティブなメンバーが居れば → プロジェクトメンバーに追加
2. 居なければ → **招待を作り**、`pending_activation` を返す
3. 本人がログインすると、既存トリガー `team_works_mark_invite_accepted` が
   **自動で `team_works_project_members` に入れてくれる**（`20260717223358` migration）

納品型はステップ2が無く `null` を返して終わっている。**ステップ2を足すだけで解決する。**

### D-2. lib の修正

`lib/team-works-delivery.ts` の `addDirectoryMemberToDeliveryProject` を
運営型と同じ3分岐にする。返り値を判別可能にする:

```ts
type DeliveryMemberAddResult =
  | { status: "assigned"; organizationMemberId: string; displayName: string }
  | { status: "invited"; email: string; displayName: string; expiresAt: string }
  | { status: "not_found" };
```

招待作成は運営型の `createOperationsProjectInvite` を再利用する
（テーブルは共通の `team_works_member_invites`、`project_id` を持つので納品型でも同じに使える）。

> **運営型のオファー/シフトの仕組み（`team_works_project_partners`,
> `team_works_project_partner_offers`）には触らない。** あれはシフト承認前提で、
> 納品型にシフトの概念は無い。納品型は「招待 → 承諾でメンバー」だけでよい。

### D-3. メンバータブ（新規）

納品型詳細の「メンバー」タブに3つのグループを出す:

| 表示 | データ元 | できること |
|---|---|---|
| **参加中** | `team_works_project_members` | 役割の確認、プロジェクトから外す |
| **招待中** | `team_works_member_invites`（`project_id` 一致・`status='pending'`・期限内） | 招待の取り消し、招待リンクの再発行 |
| **仮の担当名** | 各工程の `assignee_label` を集計 | 実メンバーが決まったら差し替え（後述） |

そして**このタブから名簿の相手を後から追加できる**ようにする（パートナー名簿／クライアント名簿の
セレクト＋追加ボタン）。結果は日本語で必ず返す:
- 「〇〇さんをメンバーに追加しました。」
- 「〇〇さんに参加のお願いを送りました。相手がログインすると自動でメンバーになります。」

### D-4. 工程の担当セレクトを分かるようにする

`assignee_member_id` は外部キーなので**参加中の人しか選べない**（これはDBの制約で正しい）。
なので工程の担当セレクトは:

```
担当メンバー  [ 未割当 ▾ ]     ← 参加中のメンバーだけが並ぶ
              招待中の人はまだ選べません。相手がログインすると選べるようになります。
              それまでは下の「仮の担当名」を使ってください。
仮の担当名    [ 教材制作担当 ]
```

とヘルパー文を出す。**「出てこない」と感じさせないことが目的。**

さらに「仮の担当名」から実メンバーへの**差し替え導線**を付ける:
メンバータブの「仮の担当名」グループに、その名前を使っている工程数を出し、
`[ 参加中のメンバーに差し替える ▾ ]` で一括置換できるようにする
（`assignee_member_id` を入れて `assignee_label` を null にする）。

### 完了条件
- 名簿の相手がまだログインしていなくても、追加すると「参加のお願いを送りました」になり招待中に並ぶ
- 相手がログインするとメンバーになり、工程の担当セレクトに出てくる
- プロジェクト作成後にメンバーを追加・削除できる
- 仮の担当名を実メンバーに一括で差し替えられる
- 黙って無視されるケースが無い（必ず日本語のメッセージが出る）
- `npm run lint` 通過

---

## Phase E: カレンダーを作り直す

### 目的
指摘 #7 の前半。「2段」「何の機能もない」を消す。

### E-1. 「謎に2段」を直す

原因は `buildDeliveryCalendarItems` が提出期日と完了期日を無条件に別項目にしていること。
**同じ日なら1件にまとめる。**

```
submitDueOn === dueOn        → 1チップ「提出・完了 〇〇」
submitDueOn !== dueOn（両方）→ 2チップ（別の日なので2段にならない）
どちらか片方だけ             → 1チップ
```

加えて、逆算配置（Phase 4）が「確認が必要な工程は提出=完了-1日、不要なら提出=完了」という
規則で入れているため、**確認不要の工程は必ず同日2件になっていた**。ここが一番の原因。

### E-2. 見た目を運営型に合わせる

運営型の `TeamWorksMonthCalendar`（`components/team-works/operations/`）が既にあり、
ホームでもプロジェクト概要でも使われている。**納品型もこれを使う**。

- 汎用化できるなら `TeamWorksMonthCalendar` に props を足して共有する（推奨）
- 難しければ `TeamWorksDeliveryCalendar` のマークアップ・余白・罫線・凡例の位置を
  `TeamWorksMonthCalendar` に完全に合わせる

判断は実装時に `TeamWorksMonthCalendar` を読んでから決めてよい。
**ただし「2種類の見た目のカレンダーが並ぶ」状態にはしないこと。**

### E-3. 機能を付ける

| 操作 | 挙動 |
|---|---|
| チップをクリック | その工程へ（`?tab=工程#task-{id}`、飛んだ先で自動展開） |
| 日付をクリック | 右（PC）／下（スマホ）にその日の詳細。工程名・担当・状態・提出物の種別・「開く」ボタン |
| 表示切替 | `[ 両方 ] [ 提出期日だけ ] [ 完了期日だけ ]` のトグル |
| 期限超過 | 今日より前で未完了はORANGE。凡例に「期限超過」 |

運営型のカレンダーは日付クリックで右側に `TeamWorksDayPanel` が出る作りなので、
**その作法に合わせる**。

### 完了条件
- 同じ工程が同じ日に2チップ出ない
- チップから工程へ飛べて、飛んだ先で開いている
- 日付クリックでその日の中身が読める（工程名だけでなく担当・状態も）
- 運営型のカレンダーと見た目が揃っている
- `npm run lint` 通過

---

## Phase F: ホームを総合ダッシュボードにする

### 目的
指摘 #4 #7後半。**「本来ならホームに総合のスケジュールが表示されるべき」に応える。**

### F-1. 「まだ何もない」判定を直す

現状:
```
loadOperationsDashboardData → 運営型が0件なら即 empty を返す（lib/team-works-operations.ts:397）
TeamWorksOperationsDashboard → hasOperationsProjects が false なら FirstOperationsProjectSetup
```

直す:
```
運営型0件 かつ 納品型0件 → はじめての作成カード（両方の種類を選べるもの。Phase B と同じカード2枚）
それ以外               → 総合ダッシュボード
```

`hasOperationsProjects` は `hasAnyProject` に相当する判定に置き換える
（`fetchDeliveryProjects` の件数も見る）。
**運営型が0件でも納品型があればダッシュボードが出る**ようにするのがこのPhaseの核心。

### F-2. 総合カレンダー

ホームのカレンダーに**両方**を載せる。

| 種類 | 出すもの | 色 |
|---|---|---|
| 運営型 | コマ（セッション） | 既存のまま |
| 納品型 | 工程の提出期日・完了期日 | 提出=PINK、完了=BLUE、期限超過=ORANGE（Phase E と同じ規則） |

チップにはプロジェクト名を添える（複数プロジェクトが混ざるため）。
クリックでそのプロジェクトの該当箇所へ飛ぶ。

### F-3. 「対応が必要なこと」を合算

Phase 5 で作った `buildStaffPendingSummary`（`lib/team-works-delivery-summary.ts`）は
**プロジェクト単位の純粋関数**。これを全納品型プロジェクトぶん回して合算する。

```
本部の対応が必要なこと
🔴 期限超過 2件
🟠 本部確認待ち 3件   ← 納品型（提出されたフォーム・成果物）
🟡 クライアント待ち 4件
🟠 担当未定のコマ 1件  ← 運営型（既存の needsAttentionUnassigned）
```

各行からその工程／コマへ飛べるようにする。

### F-4. スケジュール管理ページにも納品型を載せる

`/apps/team-works/schedule`（「全プロジェクトの予定を時系列で確認する」）は
現在運営型のコマだけ。**納品型の期日も時系列に混ぜる。**
`loadDeliveryCalendarTasks`（`lib/team-works-delivery.ts`、既に横断取得できる）を使う。

### 完了条件
- 納品型しか無いアカウントでも、ホームに総合ダッシュボードが出る（「最初の運営型プロジェクトを作成」が出ない）
- ホームのカレンダーに運営型のコマと納品型の期日が両方出る
- 「対応が必要なこと」に両方の件数が出て、そこから飛べる
- スケジュール管理に納品型の期日も出る
- `npm run lint` 通過

---

## 進める順番

```
Phase A（外枠とナビの統一・納品型のタブ化）  ← 見た目の浮きが消える。最優先
      ↓
Phase B（新規作成の統一）
      ↓
Phase C（アーカイブ＝削除）
      ↓
Phase D（メンバーを後から追加）★機能面ではここが一番効く
      ↓
Phase E（カレンダー作り直し）
      ↓
Phase F（ホーム総合ダッシュボード）
```

**Phase A と Phase D が終わった時点で一度あゆみに実機確認してもらうこと。**
A で見た目、D で「実際に人を入れて回せるか」が決まる。

---

## migration について

**この計画に migration は不要。**

- アーカイブに使う `team_works_projects.archived_at` は P8-a から存在する
- 招待に使う `team_works_member_invites` は P8-c から存在し `project_id` も持つ
- 承諾時の自動メンバー化トリガー `team_works_mark_invite_accepted` も既にある
- 新規テーブル・新規列・RLS変更は一切しない

もし実装中に「列が足りない」と思ったら、**まず既存の列を探すこと。**
Team Works のテーブルは P8-a / P8-c / R1 / R4 / R6 でかなり作り込まれている。

---

## 触ってはいけないもの

1. **運営型のシフト・コマ生成・オファーのロジック** — `team_works_project_partners`,
   `team_works_project_partner_offers`, `team_works_schedule_rules`, セッション生成。
   Phase C（アーカイブ）と Phase F（ホーム合算）以外で運営型に触らない
2. **RLSポリシー** — 変更しない。DBが守っている制約に沿ってUIを作る
3. **`team_works_find_active_member` RPC** — 変更しない。使い方を直すだけ
4. **他セッションのファイル** — `ai-office/`, `mikkeos/StoryProfile`, `app/globals.css`,
   `app/story/`, `app/marketnote/` などは別セッションが編集中。**触らない**

---

## Sonnetへの約束事

1. **正典を読む** — `docs/MIKKEOS_EDITORIAL_UI_DESIGN_RULES.md`
2. **色は役割トークンのみ** — `--tw-title` `--tw-action` `--tw-done` `--tw-planned` `--tw-deadline`。
   5色の直書き・Tailwind既定色・`opacity` での薄めは禁止
3. **運営型を基準にする** — 迷ったら運営型の該当コンポーネントを開いて、
   マークアップとclassNameをそのまま持ってくる。**新しい見た目を発明しない**
4. **RLSを変更しない／新規テーブルを作らない／migrationを書かない**
5. **`npm run lint` を通す**（`tsc --noEmit`）
6. **コミットはTeam Works関連のみ選別** — `git add -A` 禁止。
   他セッションの ai-office / Story / globals.css 等を巻き込まない
   （`memory/feedback-shared-workdir-git.md` 参照）
7. **Phaseごとにコミットする。** 1コミットに複数Phaseを混ぜない
8. **`.next` が壊れて全ルート404になったら** `rm -rf .next` して再起動する
   （複数セッションが同じフォルダでdevサーバーを動かすと起きる）
9. **日本語のメッセージを必ず出す。** 黙って失敗する処理を作らない。
   これが今回の指摘 #6 の本質だった

---

## 完了の定義（受け入れテスト）

納品型しか無いアカウントで、次が通しでできること:

1. ホームを開くと総合ダッシュボードが出る（「最初の運営型プロジェクトを作成」が出ない）
2. ホームのカレンダーに納品型の期日が出て、クリックでその工程へ飛べる
3. プロジェクト管理で種類（運営型／納品型）を選んで新規作成できる。どちらも同じ枠
4. どの画面にも左サイドバーがあり、途中で見た目が変わらない
5. 納品型の詳細がタブで切り替わる（概要／工程／スケジュール／成果物／メンバー／プロジェクト設定）
6. メンバータブから、まだログインしていない相手を追加すると「参加のお願いを送りました」と出て招待中に並ぶ
7. 相手がログインすると参加中に移り、工程の担当セレクトに出てくる
8. 仮の担当名を実メンバーに一括で差し替えられる
9. カレンダーで同じ工程が同じ日に2つ出ない
10. プロジェクトをアーカイブして一覧から消し、元に戻せる
