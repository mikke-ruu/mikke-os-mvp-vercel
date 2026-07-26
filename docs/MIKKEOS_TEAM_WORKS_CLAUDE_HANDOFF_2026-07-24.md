# Team Works Claude Code 引継ぎ（2026-07-24・随時更新）

**このファイルは常に「今の続きから始められる」状態に保つ。作業者（Claude Code / codex いずれでも）は開始時に必ずこのファイルと`docs/MIKKEOS_TEAM_WORKS_BUILD_PLAN_2026-07-24.md`を全文読むこと。**

## 作業場所

- repo: `G:\Musubiプロジェクト\mikke-os-mvp`
- 正典: `docs/MIKKEOS_TEAM_WORKS_BUILD_PLAN_2026-07-24.md`
- Supabase: `mikke-os-dev`
- project id: `nttqpprkqbynxyldbnjs`
- local app: `http://localhost:3000`

## 現在地

- R0 共通シェル: 完了
- R1 運営型DB/RLS: 完了・DB適用済み
- R2 本部ダッシュボード／カレンダー／生成: 完了
- R3 運営型プロジェクト詳細／11タブ／初回作成／週次ルール: 完了
- R4 パートナー／クライアントポータル: 基盤と安全な書き込み境界まで完了
- R5 第一スライス（worker/client招待・accept後割当・割当済み/招待中一覧）: 完了（migration不要・既存P8-c invite基盤を流用。lint EXIT=0）。
- **バグ修正済み**: 招待受諾で`?organization=&role=`が消える問題。原因は`components/AuthGate.tsx`（全アプリ共通）が未ログイン時リダイレクトに`usePathname()`のみ使いクエリを落としていたため。`useSearchParams()`併用で修正。lint EXIT=0。詳細はBUILD_PLAN末尾参照。
- **実機検収成功**: あゆみが`info.jsparts@gmail.com`で招待受諾→「案件へ参加しました」→本部の「パートナー・シフト」タブSHIFTセクションに「参加中」で反映を確認。R5コア（招待→accept→割当→一覧反映）は実アクターで検収完了。
- 追加で見つけた小バグも修正済み: 受諾後の「案件一覧を開く」が全ロール共通で管理者専用ページ(`/apps/team-works/projects`)に固定されていたためworkerだと空表示で紛らわしい問題。`TeamWorksInviteAccept.tsx`で役割別に遷移先を分岐（worker→`/portal/worker`、client_user→`/portal/client`、manager等→従来どおり）。lint EXIT=0。
- **実機検収完了**: `/apps/team-works/portal/worker`で「1件の運営型プロジェクトに参加しています」を確認（TODAY/UPCOMINGは週次パターン0件のため空状態、想定通り）。`/apps/team-works/portal/client`も未招待の状態で正しく空表示（プライバシー境界も機能）。**R5第一スライスは実アクターで検収完了**。
- すべて未コミット。ユーザーが「コミットして」と言うまでコミットしない。

## R4で今回完了した内容

### UI

- `/apps/team-works/portal/worker`
  - 担当コマだけ表示
  - ①②③名簿
  - 1人あたり時間
  - 対象者別マニュアル
  - 出欠／終了後進捗No.／報告提出
- `/apps/team-works/portal/client`
  - 自校の今後60日スケジュール
  - 対象者と進捗No.
  - 休講
  - client向けメッセージ
  - 休校連絡
- 既存納品型ポータルは以下に維持:
  - `/apps/team-works/portal/worker/projects`
  - `/apps/team-works/portal/client/projects`

### DB（適用済み）

- `supabase/migrations/20260724112532_team_works_r4_portal_requests.sql`
  - `team_works_ops_session_reports`
  - `team_works_client_requests`
- `supabase/migrations/20260724112628_team_works_r4_portal_request_indexes.sql`
- `supabase/tests/team_works_r4_portal_requests_rls.sql`

Supabase migration historyとローカルファイル名は以下のversionへ同期済み。

- `20260724112532 team_works_r4_portal_requests`
- `20260724112628 team_works_r4_portal_request_indexes`

設計判断:

- partnerに`participants`や`session_roster`の直接UPDATEは許可しない。
- partnerはimmutableなコマ報告を提出し、本部確認後に正本へ反映する。
- clientに`holidays`の直接INSERTは許可しない。
- clientは休校申請を作り、本部確認後にcanonical holidayへ反映する。
- public SECURITY DEFINER RPCやservice_roleのブラウザ利用は追加していない。

DB検証済み:

- 新2テーブルはRLS enabled + forced。
- report policy=2、client request policy=3。
- actor別RLSテスト全通過。
- Security Advisor今回追加分0。
- Performance Advisor外部キー索引不足0。
- テストはrollback済みで、新2テーブルの実データは各0件。

## 実データ

- organization: `アリサ日本語レッスン`
- operations project: `スリランカ校`
- project id: `c8877df1-82d9-44c3-a00b-c596f3702427`
- status: `active`
- contract_started_on: `2026-07-24`
- 現在project memberはowner 1名。
- 週次ルール、コマ、名簿、マニュアル、worker/client割当はまだ0件。実際の曜日・時刻・人物は推測して投入しない。

## 現在地（2026-07-24・最新）

R5の第一スライス（招待→accept後割当→一覧反映）は実アクターで検収完了。**その直後、あゆみから2つの重要な是正指示が入り、今はこれに対応中**:

### 是正①: UI/メニュー構成がモックと違う（最優先）

あゆみ「メニュー、配置、ページ構成はモックでつくったようにしてください。アレンジは不要です」。

- **UIの絶対基準＝承認済みクリックプロトタイプ**: `https://claude.ai/code/artifact/fe999e5f-6c38-4d32-97d5-992f1f534039`（グリーン版）。ローカルの元ファイルは `C:\Users\user\AppData\Local\Temp\claude\G--Musubi------\08b55e42-7157-42aa-a54c-a54a76516386\scratchpad\teamworks-prototype.html`（このtempパスは別セッション/別ツールからはアクセス不可な場合がある点に注意。**codexへ移行する場合はまずこのURLをブラウザで開いて実物を見ること**。ローカルファイルが読めればそちらでもよい）。
- 確認済みギャップ: `components/mikkeos/MikkeAppShell.tsx`にモックの「PC=常時表示の左サイドメニュー」が無い（今は☰ドロワーのみ、PC/スマホ共通）。`components/team-works/operations/TeamWorksOperationsShell.tsx`の上部タブは暫定3項目のみ（パートナー管理／マニュアル管理／企業設定の独立画面が未作成）。
- 対応方針・Phase A詳細はBUILD_PLAN末尾「★UI/構成の是正…」参照。**Phase A（MikkeAppShellにPC左サイドメニュー実装＋Team Works6項目配線＋未作成画面のスタブ）をSonnetへ実装依頼済み・完了待ち**（このHANDOFFを読んでいる時点で完了しているかもしれない。git statusと該当ファイルを確認すること）。

### 是正②: パートナー/クライアントの設計を完全分離（最重要・安全指示）

あゆみ「招待を送る相手と役割が全然違います。ここは一緒にしておくとミスが起きたら大変です」。

**現R5実装の`PartnersTab`（`components/team-works/operations/TeamWorksOperationsProjectDetail.tsx`内）は、1つの招待フォームでrole(worker/client_user)をドロップダウン選択させる作りになっており、これは取り違えリスクがあるため置き換え対象。**

確定設計（詳細はBUILD_PLAN「確定パートナー/クライアント運用」の表を見ること）:

| | パートナー | クライアント |
|---|---|---|
| 起点画面 | 企業全体「パートナー管理」で事前登録 | プロジェクト作成時／プロジェクト「設定」画面 |
| 事前名簿 | あり（組織の名簿から各プロジェクトへ割当） | なし（都度その場でメール招待） |
| 招待フォーム | 「パートナーを招待」専用・role選択UIなし・**worker固定** | 「クライアントを招待」専用・role選択UIなし・**client_user固定** |
| 招待を送る場所 | プロジェクトの「パートナー・シフト」タブ | プロジェクト作成フォーム／「設定」タブ |

実装順（Phase A完了後に着手。BUILD_PLANのPhase B〜Eに対応）:

- **Phase B**: `team_works_partners`（組織のパートナー名簿）＋`team_works_project_partners`（プロジェクトへの割当）テーブル＋RLS＋企業全体「パートナー管理」画面（一覧・登録）。
- **Phase C**: `PartnersTab`のrole選択式招待フォームを廃止し、「パートナーを招待」（role=worker固定・名簿から選択）に作り替え。`team_works_partner_availability`（シフト可能日）も追加。client招待をこのタブから完全に撤去。
- **Phase D**: プロジェクト「設定」画面新設（クライアント招待＝role=client_user固定の専用フォーム、表示名変更、概要、請求/契約期間の集約は要検討）。プロジェクト作成時のクライアント招待導線も追加。
- **Phase E**: マニュアル管理（組織共通）＋企業設定（ラベルカスタム＝業種カスタムの核・本部メンバー招待）。

既存invite基盤（変更なし・そのまま使う）:

- `team_works_member_invites`（accept時のtriggerがproject_membersを自動作成する汎用フロー。styleに依存しないので流用可）
- `components/team-works/TeamWorksInviteAccept.tsx`（受諾画面。role別に受諾後の遷移先を分岐済み）
- 運営型専用の招待作成/一覧関数: `lib/team-works-operations-project.ts`の`createOperationsProjectInvite`/`loadOperationsProjectMembers`（**Phase Cで`createOperationsPartnerInvite`と`createOperationsClientInvite`に分離する対象**）
- 納品型（localStorage/旧）はそのまま: `components/team-works/projects/TeamWorksMemberInvitePanel.tsx`、`lib/team-works-database.ts`の`createTeamWorksMemberInvite`（触らない）

### 運用上の注意（あゆみへの回答として確定した理解）

- 今アリサ本人はまだログインしていない。作業は`joes.style.a`（あゆみ）のオーナーアカウントで進めている。データは**組織単位**なので、アリサが後から招待（owner/manager）で参加しても作り直しにはならない。
- マルチテナントの土台（別アカウントでログインすると別組織としてまっさらに使える）は実証済み（`info.jsparts@gmail.com`で`/apps/team-works`を開くと「最初の運営型プロジェクトを作成」フォームが出ることを確認）。
- ただし**業種ごとに呼び名をカスタムする仕組み（ラベル設定）はまだ運営型に未接続**。今の画面文言は中立語のハードコードであり、テンプレート/ジェネレーターの仕組みは無い。これはPhase E「企業設定」で対応する。

## 絶対に守ること

- `components/ai-office/*`
- `app/apps/ai-office/*`
- `lib/ai-office/*`

上記は別作業の未コミット差分。触らない、戻さない、Team Worksコミットに混ぜない。

- dirty worktree前提。自分の対象ファイルだけ確認・stageする。
- 稼働中`npm run dev`に対して`npm run build`を並行実行しない。
- 検証は`npm.cmd run lint`＋port3000の実画面。
- 独立CSSを増やさず`--mikke-*` tokenと既存部品を使う。
- service_roleをブラウザへ出さない。
- RLSを`TO authenticated`だけで済ませずproject/member境界を必ず入れる。
- 実際の曜日・時刻・パートナー名・学校担当者を推測入力しない。
- コミットはユーザー確認後。

## 再開時の確認

```powershell
cd "G:\Musubiプロジェクト\mikke-os-mvp"
git status --short
npm.cmd run lint
```

確認URL:

- `http://localhost:3000/apps/team-works`
- `http://localhost:3000/apps/team-works/projects/c8877df1-82d9-44c3-a00b-c596f3702427`
- `http://localhost:3000/apps/team-works/portal/worker`
- `http://localhost:3000/apps/team-works/portal/client`

## codex / 次の作業者へ最初に送る文（2026-07-24更新）

`G:\Musubiプロジェクト\mikke-os-mvp`でTeam Worksの作業を続けてください。最初に`docs/MIKKEOS_TEAM_WORKS_CLAUDE_HANDOFF_2026-07-24.md`と`docs/MIKKEOS_TEAM_WORKS_BUILD_PLAN_2026-07-24.md`を全文読み、`git status --short`を確認してください。

R0〜R5第一スライスは完了・Supabaseへ適用済み・すべて未コミットです。R5完了直後にユーザーから2つの是正指示が入りました:

1. **UIはモック厳守**（承認済みクリックプロトタイプ`https://claude.ai/code/artifact/fe999e5f-6c38-4d32-97d5-992f1f534039`が絶対基準。アレンジ・省略禁止）。PC常時左サイドメニュー化＋Team Works6項目配線（HANDOFF「是正①」参照）をSonnetへ実装依頼済み。まずgit statusで完了しているか確認し、未完了ならBUILD_PLANのPhase Aとして続行してください。
2. **パートナー招待とクライアント招待を完全に別の画面・別のroleハードコードにする**（HANDOFF「是正②」の表の通り。1つの招待フォームでroleを選ばせる今のR5実装は置き換え対象）。Phase A完了後、BUILD_PLANのPhase B〜Eの順で実装してください。

共通の絶対制約: AI OFFICE関連差分(`components/ai-office/*`・`app/apps/ai-office/*`・`lib/ai-office/*`)には絶対に触れない。既存納品型を壊さない。service_roleをブラウザに出さない。実際の曜日・時刻・パートナー名・学校担当者を推測入力しない。稼働中`npm run dev`(port3000)に`npm run build`を並行実行しない。検証は`npm.cmd run lint`＋ユーザーのport3000実機ログイン確認。ユーザー確認前にはコミットしない。`
## 2026-07-24 Codex R5是正追記

今回ここまで完了:

- UI是正①: `git status` と該当ファイル確認で、PC常時左サイドメニュー + Team Works 6項目配線が実装済みであることを確認。
- 招待是正②:
  - パートナー招待とクライアント招待をUI/関数レベルで分離。
  - `/apps/team-works/partners` を組織全体の「パートナー管理」画面に変更。パートナー名・メール・メモを事前登録。
  - プロジェクト詳細の「パートナー・シフト」では、パートナー名簿から選んで `worker` 固定招待。
  - プロジェクト詳細の「ポータル設定」では、メール入力で `client_user` 固定招待。
  - 既存 `team_works_member_invites` とaccept triggerは温存。
- Supabase:
  - migration適用済み: `20260724134437 team_works_r5_partner_directory`
  - 追加テーブル: `team_works_partners`, `team_works_project_partners`
  - RLS enabled + forced、policy各3、実データ0件確認。
  - rollbackテスト追加/実行済み: `supabase/tests/team_works_r5_partner_directory_rls.sql`
- 検証:
  - `npm.cmd run lint` 成功。
  - port3000は応答が詰まっていたため、ブラウザでのログイン済み実機確認は未完了。devサーバーを重ね起動せず停止。

次に確認してほしいこと:

1. `http://localhost:3000/apps/team-works/partners` でパートナー管理画面が表示されること。
2. `http://localhost:3000/apps/team-works/projects/c8877df1-82d9-44c3-a00b-c596f3702427` の「パートナー・シフト」でrole選択が消え、名簿選択だけになっていること。
3. 同じプロジェクトの「ポータル設定」でクライアント招待がclient_user固定で作れること。
4. 問題なければ次は Phase E（マニュアル管理 + 企業設定）へ進む。
