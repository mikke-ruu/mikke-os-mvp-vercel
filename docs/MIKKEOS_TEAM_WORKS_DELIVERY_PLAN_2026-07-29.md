# Team Works 納品型プロジェクト 実装計画（2026-07-29）

対象: 納品型（`projects.style = 'delivery'`）プロジェクト
実装者: Sonnet
検証案件: 認定講座 個別構築コース（9工程）

---

## 0. この計画の背景

納品型プロジェクトは 2026-07-29 にSupabase接続したが、実装したのは
「タスク名＋期日＋状態プルダウン」だけの**タスクチェック表**だった。
あゆみからのフィードバック:

> これではただのタスクチェック表です。カレンダーにも反映できませんし、
> ポータル連携の意味も持ちません。

問題の本質は、**仕事のバトンが人から人へ渡る**という実体が抜けていること。
本計画はそれを入れ直す。

### 認定講座の1工程で実際に起きること（テキスト・ディプロマ作成）

| # | 誰が | 何をする | 状態 |
|---|---|---|---|
| 1 | 本部 | テキスト記入テンプレートを用意 | フォーム作成（記入者=client） |
| 2 | **クライアント** | 講座説明・材料・工程・注意点・よくある失敗を記入し提出 | `submitted` |
| 3 | **本部** | 内容確認。不足があれば理由を書いて差し戻し | `revision_requested` → 2へ戻る |
| 4 | 本部 | AI整文・写真配置・表記統一 → テキスト第1版 | 成果物 `internal_review` |
| 5 | 本部 | 内部確認OK → クライアントへ公開 | `client_review` |
| 6 | **クライアント** | 確認して承認 or 修正依頼 | `approved` / `revision_requested` |
| 7 | — | 工程完了、次へ | 完了 |

**1工程でバトンが4回行き来する。** これを表現できることが本計画のゴール。

---

## 1. 重要な前提：DBは既に完成している

**新規テーブルはほぼ不要。** P8-a / P8-c で必要なテーブルが作られており、
一度もUIに繋がれていないだけ。**新しく作らず、既存を繋ぐこと。**

| テーブル | 役割 | 状態値 |
|---|---|---|
| `team_works_project_forms` | 工程ごとの入力フォーム定義 | `input_actor: admin / client / worker` |
| `team_works_form_submissions` | フォームの提出と審査 | `draft → submitted → revision_requested → approved` |
| `team_works_project_deliverables` | 成果物の提出と承認 | `draft → submitted → internal_review → client_review → revision_requested → approved → delivered` |
| `team_works_project_comments` | やり取り | `audience: internal / client` |

### RLSが承認フローを守っている（変更しないこと）

- フォーム作成・編集は**本部staffのみ**
- worker には `input_actor='worker'` のフォームだけ見える
- client には `input_actor='client'` かつ `client_visible` のフォームだけ見える
- 提出は「自分の役割と一致するフォーム」にしか出せない
- 提出後の再編集は `draft` か `revision_requested` の時だけ（差し戻された時のみ直せる）
- 成果物は worker が**自分に割り当てられたタスクの分だけ**提出可
- client は `client_review` 状態の時だけ、`approved` / `revision_requested` にのみ変更可

**このRLSは仕様そのもの。回避せず、これに沿ってUIを作る。**

### 既存の再利用可能な資産

| 資産 | 場所 | 備考 |
|---|---|---|
| フィールド型15種＋日本語ラベル | `lib/team-works-projects.ts` の `projectFormFieldTypeLabels` | そのまま使う |
| `ProjectFormField` 型 | 同上 | id/type/label/description/placeholder/required/options |
| 添付ストレージ | バケット `team-works-form-attachments`（非公開・25MB） | 既に作成済み |
| 状態遷移ロジック | `lib/team-works-project-forms.ts`, `lib/team-works-project-deliverables.ts` | localStorage版だが**遷移の考え方は流用可** |
| フォーム回答UI | `components/team-works/projects/TeamWorksProjectFormResponse.tsx` | localStorage版。Supabase版の参考にする |

---

## 2. 設計方針

1. **主役は「今、誰の番か」**。工程一覧ではなくバトンの受け渡しを表示する
2. **新規テーブルを作らない**。既存の forms / submissions / deliverables を繋ぐ
3. **RLSを変更しない**。DBが守っている制約に沿ってUIを作る
4. **運営型（アリサ）には一切触れない**。`style='operations'` の画面・ロジックは変更禁止
5. **差し戻し回数のカウントは不要**（あゆみ判断: 感覚で判断するため機能化しない）

---

## Phase 1: 工程の構造化（バトンの土台）

### 目的
工程に「誰が作業し、何を出し、誰が確認するか」を持たせる。ここが全ての土台。

### migration

```sql
alter table public.team_works_project_tasks
  -- 誰が作業するか
  add column if not exists owner_role text
    check (owner_role in ('admin', 'worker', 'client')),
  -- 何を提出するか
  add column if not exists submission_type text
    check (submission_type in ('none', 'form', 'file', 'url')),
  -- 確認フロー
  add column if not exists needs_internal_review boolean not null default false,
  add column if not exists needs_client_review boolean not null default false,
  -- 担当者が提出する期日（既存 due_on は「工程の完了期日」として使う）
  add column if not exists submit_due_on date,
  -- 仮メンバー名。実メンバー未確定の工程に「ネオン」「カメラマン(未定)」等を置く。
  -- 実メンバーが決まったら assignee_member_id を埋め、この列は表示しない。
  add column if not exists assignee_label text;
```

**期日が2種類あるのが要点。** `submit_due_on`（担当者が出す期日）と
`due_on`（工程が完了する期日）。認定講座なら「クライアントが8/15までに記入」
「本部が8/25までに仕上げる」を別々に持てる。

### 変更対象
- `lib/team-works-delivery.ts`: `DeliveryTask` 型に上記を追加、CRUD拡張
- `components/team-works/projects/TeamWorksDeliveryProjectDetail.tsx`: 工程の編集UI

### 完了条件
- 本部が工程ごとに「担当ロール・提出物種別・確認者・2つの期日・仮担当名」を設定できる
- `npm run lint` 通過

---

## Phase 2: フォームビルダー ✅完了(2026-07-29)

### 目的
本部が工程ごとに設問を自由に組めるようにする。案件ごとに聞くことが変わるため必須。

### 実装
- 新規テーブル不要。`team_works_project_forms` に保存
- `fields` (jsonb) に `ProjectFormField[]` を入れる
- `input_actor` で「クライアントが記入」「ワーカーが記入」を指定
- `task_id` で工程に紐づける
- **フィールド型は既存15種をそのまま使う**（`projectFormFieldTypeLabels`）
- 項目の追加・削除・並べ替え・必須指定・選択肢編集ができること

### UI配置
プロジェクト詳細の工程を開いた中に「この工程のフォーム」として置く。
（独立した画面にしない。工程との紐づきが分かりにくくなるため）

### 完了条件
- 本部が工程に対しフォームを作り、項目を自由に組める
- 記入者（client / worker）を選べる
- `npm run lint` 通過

---

## Phase 3: 提出 → 確認 → 承認フロー ★最優先 ✅実装完了(2026-07-29・要実機確認)

### 目的
**ここまでで実際に案件が回る。** クライアントが提出し、本部が承認できる。

### 実装

**ワーカー / クライアントポータル側**
- 自分が記入すべきフォームを表示し、記入・提出できる（`submitted`）
- ファイル/画像項目は既存バケット `team-works-form-attachments` へアップロード
- 差し戻された（`revision_requested`）場合、理由を表示し再編集・再提出できる
- 成果物（deliverables）の提出も同様

**本部側**
- 提出されたフォーム・成果物の一覧と中身を確認できる
- **承認** / **差し戻し（理由必須）** ができる
- 成果物は `internal_review` → `client_review` へ進め、クライアント確認に回せる

**クライアント側の承認**
- `client_review` の成果物に対し **承認** / **修正依頼** ができる
- RLSがこの2つ以外の変更を弾くので、UIもこの2択に限定する

### 注意
- 状態遷移は既存の `lib/team-works-project-forms.ts` / `team-works-project-deliverables.ts`
  の考え方を参考にする（ただし保存先はSupabase）
- 差し戻し理由は `review_memo` に入れる

### 完了条件
- クライアントがフォームを提出 → 本部が差し戻し → クライアントが直して再提出 → 本部が承認、が通しで動く
- 本部が成果物をクライアント確認へ回し、クライアントが承認できる
- `npm run lint` 通過

### 実装メモ(2026-07-29)
- `lib/team-works-delivery-forms.ts` に提出まわり(`fetchMyFormSubmission` / `saveMyFormSubmission` /
  `uploadMyFormAttachment` / `fetchFormSubmissions` / `reviewFormSubmission`)を追加。
  記入UIは既存の `TeamWorksProjectFormResponse.tsx`(localStorage版)をそのまま再利用。
- `lib/team-works-delivery-deliverables.ts` を新規作成(成果物のCRUD)。差し戻し理由は
  `team_works_project_deliverables` に列が無いため `team_works_project_comments`
  (`deliverable_id` 付き)に記録している。
- **P8-h(フォーム添付)/P8-g(成果物ファイル)のstorage RLSは、対象行の`source_local_id`が
  オブジェクトパスと一致することを前提にしている。** 納品型はSupabase直書きで
  localStorage版のsource_local_id同期を経由しないため、`team_works_project_tasks` /
  `team_works_project_forms` の作成時に`source_local_id`を発行するよう変更した
  (`createDeliveryTask` / `createTaskForm`)。**Phase 1/2で作成済みの既存タスク・
  フォームには`source_local_id`が入っていないため、ファイル/画像添付を使うタスクは
  作り直すか、`source_local_id`を後追いでUPDATEする必要がある。**
- 本部staffは成果物テーブルへのINSERT/UPDATEはRLSを全てバイパスできるが、
  `team-works-deliverables`バケットへの書き込みは**割り当てられたworkerしか
  できない**(RLSがworker以外を想定していない)。そのため本部の直接登録は
  URL/メモ形式のみに限定した。ownerRole=本部でsubmissionType=ファイルの工程では
  ファイル提出ができないため、運用上はURL提出にするか担当をworkerに設定すること。
- ブラウザでの実機確認は未実施(ログインが必要でパスワード代行はできないため)。
  `npm run lint`(tsc --noEmit)は通過。次回セッションで実際にログインしての
  通し確認(提出→差し戻し→再提出→承認、成果物のclient_review→承認)を推奨。

---

## Phase 4: 期日とカレンダー ✅実装完了(2026-07-29・要マイグレーション実行)

### 目的
カレンダーが最初から埋まっている状態にする。今は期日未設定なので空。

### 実装
- ①ゴール設定で **納期** を入力
- 工程ごとに **標準日数** を持たせる
- **納期から逆算**して全工程の期日を自動配置するボタン（後から個別調整可）
- カレンダーに `submit_due_on`（提出期日）と `due_on`（完了期日）の**両方**を表示し、色で区別
- 期限超過を目立たせる

### 参考
旧ジェネレーター `lib/team-works-generator.ts` の `standardDays` に同じ発想がある。

### 完了条件
- 納期を入れると全工程に期日が入り、カレンダーに反映される
- `npm run lint` 通過

### 実装メモ(2026-07-29)
- migration `supabase/migrations/20260729160000_team_works_delivery_schedule.sql`
  **要SQL Editorでの実行**。`team_works_projects.delivery_due_on` と
  `team_works_project_tasks.standard_days` を追加(既存列はそのまま・追加のみ)。
- 逆算アルゴリズム: 並び順(position)の最後の工程がproject.dueOnに完了し、
  そこから標準日数ぶん遡って前工程の期日を決める。確認(本部/クライアント)が
  必要な工程は、提出期日を完了期日の1日前に置く(確認の余裕)。後から個別調整可。
- カレンダーの色は役割トークン固定: 完了=GREEN、期限超過=ORANGE、
  提出期日=PINK(締切)、完了期日=BLUE(基準日)。

---

## Phase 5: ポータルを「今あなたの番」画面にする ✅実装完了(2026-07-29)

### 目的
ポータルを開いた瞬間に何をすればいいか分かる状態にする。**これがポータルの存在理由。**

### クライアントポータル（最上部に配置）

```
🔴 今すぐ対応   テキスト記入シートを提出してください（期日 8/15）  [記入する]
🟡 確認待ち     第1章テキスト案                        [承認] [修正を依頼]
進捗 9工程中3件完了 ／ 次回 8/20 撮影 ／ 納品予定 10/31
```

### ワーカーポータル

```
🔴 撮影データを提出（期日 8/22）                        [アップロード]
🟠 差し戻し  第2章の写真が不足しています                 [再提出]
```

### 本部ダッシュボード

```
クライアント待ち 3件 ／ 本部確認待ち 2件 ／ 期限超過 1件
```

### 実装メモ
「誰の番か」は `task.owner_role` と、紐づく submission / deliverable の
状態から導出する。新しい状態列は追加しない。

### 完了条件
- 各ポータルの最上部に「自分が対応すべきこと」が出る
- 本部で「誰待ちか」が一覧できる

### 実装メモ(2026-07-29)
- `lib/team-works-delivery-summary.ts` に純粋関数として実装(`buildMyDeliveryActionItems` /
  `buildStaffPendingSummary`)。DB書き込みは一切なく、既存のforms/submissions/deliverablesを
  読んで導出するだけ。
- ポータル最上部の項目、本部ダッシュボードの一覧項目はどちらも該当工程への
  ページ内アンカーリンク(`#task-{id}`)になっている。クリックするとその工程まで
  スクロールする(自動展開はしていない。手動でクリックして開く)。
- **スコープはプロジェクト単位。** 「本部ダッシュボード」は現状1プロジェクトの詳細画面の
  最上部に出しており、複数プロジェクトを横断した一覧ではない(将来、全案件横断の
  ダッシュボードページを作る場合はこのsummary関数をそのまま使い回せる)。

---

## Phase 6: ジェネレーターの作り直し

### 目的
Phase 1〜5 の設定を、質問形式で一気に組めるようにする。

### 方針
現在の4段階（ゴール / メンバー / 作業の順番 / 確認）を土台に、
**③作業の順番** を工程ごとの設定まで聞ける形へ拡張する。

工程1行ごとに聞くこと:
- 工程名
- 誰がやるか（本部 / ワーカー / クライアント）
- 何を出すか（なし / フォーム / ファイル / URL）
- 誰が確認するか（本部 / クライアント / 両方 / なし）
- 標準日数

### 旧ジェネレーターについて
`lib/team-works-generator.ts` の質問項目（担当者へタスクを割り当てる / フォームへ入力する /
内部担当者が確認する / クライアントが確認する / 修正依頼を出す / 承認後に次工程へ進む）は
**着眼点として正しい**。抽象的なチェックボックスではなく、
上記のように工程ごとの具体的な設定として聞き直す。

### テンプレート
`team_works_project_step_templates.steps` (jsonb) に上記設定も保存し、
次の案件でそのまま流し込めるようにする。認定講座の9工程を実例として登録済み。

---

## 完了の定義（受け入れテスト）

**認定講座 個別構築コースの9工程が実際に回ること。** 具体的には:

1. 本部が9工程を作り、それぞれに担当・提出物・確認者・期日を設定できる
2. 「テキスト・ディプロマ作成」工程にクライアント記入フォームを作れる
3. クライアントがポータルで記入・提出できる
4. 本部が差し戻し、クライアントが直して再提出できる
5. 本部が承認し、成果物をクライアント確認に回せる
6. クライアントが成果物を承認できる
7. カレンダーに提出期日・完了期日が表示される
8. 各ポータルの最上部に「今あなたの番」が出る

---

## Sonnetへの約束事

1. **正典を読む** — `docs/MIKKEOS_EDITORIAL_UI_DESIGN_RULES.md`
2. **色は役割トークンのみ** — `--tw-title` `--tw-action` `--tw-done` `--tw-planned` `--tw-deadline`
   5色の直書き・Tailwind既定色・`opacity`での薄めは禁止
3. **運営型（アリサ）に触れない** — `style='operations'` の画面・ロジック・migrationは変更禁止
4. **RLSを変更しない** — 既存ポリシーが仕様。回避せずこれに沿う
5. **新規テーブルを作らない** — 既存の forms / submissions / deliverables を繋ぐ
6. **`npm run lint` を通す**
7. **コミットはTeam Works関連のみ選別** — `git add -A` 禁止。他セッションの
   ai-office / Story / globals.css 等を巻き込まない
8. **migrationは手動実行** — 作成後に「SQL Editorでの実行が必要」と必ず案内する

---

## 進める順番

```
Phase 1（工程の構造化）
      ↓
Phase 2（フォームビルダー）
      ↓
Phase 3（提出→確認→承認）★ここまでで実際に案件が回る
      ↓
Phase 4（期日・カレンダー）
      ↓
Phase 5（ポータル「あなたの番」）
      ↓
Phase 6（ジェネレーター作り直し）
```

Phase 3 が終わった時点で一度あゆみに実機確認してもらうこと。
