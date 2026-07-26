# Team Works ポータル統合計画（2026-07-26 Fable策定・実装はSonnet）

作業場所: `G:\Musubiプロジェクト\mikke-os-mvp`
この文書が本計画の正典。実装セッション（Sonnet）はこの文書のフェーズ順に進め、各フェーズ完了時に末尾の進捗ノートへ追記すること。

---

## 1. あゆみの確定方針（2026-07-26時点・全部この日の会話で確定）

1. **1アカウント複数役割**: 同一アカウントが worker（パートナー）と client_user（クライアント）を同時に持てる。別プロジェクトでも**同じプロジェクト内でも**可（例: 学校担当者が先生も兼ねる、本部がクライアントとして依頼する）。役割が分かれていれば同一人物で問題ない。**変わるのはアクセスするポータルだけ**。
2. **固定URLオンボーディング**: 相手に渡すのは固定ポータルURL1本だけ（worker=`/apps/team-works/portal/worker`、client=`/apps/team-works/portal/client`）。名簿（partners/clients）にメール登録→相手はmikkeOSでログイン/新規登録→メール一致で自動開通。プロジェクトごとの個別招待URLは廃止済み。
3. **承認フロー**: プロジェクト割当時、パートナーもクライアントも**ポータル内の承認**を経て参加（実装・実機検証済み）。
4. **メニュー入口は役割ベース**: Team Worksアプリには誰でもアクセス可。メニューには「今持っている役割のポータル入口だけ」表示（worker所属があればパートナーポータル、client所属があればクライアントポータル、両方なら両方）。
5. **複数会社×複数プロジェクト**: ポータル内は会社（組織）名ラベル付きで会社×プロジェクトに仕分け。データ層は既に全社横断取得済み。
6. **サブスク**: 課金対象は「運営する本部」のみ。参加者（パートナー/クライアント）は無料でポータル利用。課金実装自体はスコープ外（将来）。
7. **ポータルカスタム**: 業種ごとにポータル画面の呼び名・構成をカスタムできるようにする。最初はアリサ日本語レッスンpreset。コード/データは中立語のまま、ラベルで業種色を出す（[[teamworks-school-field]]の線引きルール踏襲）。

## 2. 現在の状態（2026-07-26夜）

**適用済みSupabase migration（すべてあゆみがSQL Editorで実行・成功確認済み）**:
- `20260726103000` client portal roster/messages RLS
- `20260726120000` r6 client directory（team_works_clients / team_works_project_clients）
- `20260726130000` r6 member reactivation（(org,user) partial unique・archived除外）
- `20260726140000` session_roster DELETE grant
- `20260726150000` r6 multi role membership（partial uniqueを(org,user,role)に）
- `20260726160000` r6 directory self activation（固定URL自動開通RPC）
- `20260726170000` r6 client project approval（description列＋pending一覧/承認RPC）

**実機検証済み**: クライアント名簿登録→固定URL自動開通→割当→承認のお知らせ（会社名/説明/契約期間）→承認→ポータル表示、まで一通り動作した。

**全コード未コミット**（あゆみ検収前はコミットしない方針継続）。

**実データ**: org「アリサ日本語レッスン」(670a2641-…)、運営型project「スリランカ校」(c8877df1-…)。owner=joes.style.a。info.jsparts@gmail.com が worker(archived)×2＋client_user(active) の状態。パートナー名簿に誤登録行（display_name="野田あゆみ" / email=info.jsparts@gmail.com、稼働中）が残存←これが再開通の火種。

## 3. いま起きている不具合（3件）と原因

### 不具合A: 両ポータルが開かない
`duplicate key value violates unique constraint "team_works_organization_membe_organization_id_source_local__key"`
- 原因: `team_works_activate_portal_membership()` が `source_local_id='directory:worker:<uid>'` 固定で INSERT するため、**アーカイブ済み行が同じsource_local_idを持っていると (organization_id, source_local_id) 完全uniqueに衝突**する。アーカイブ→再開通のケースの見落とし。
- パートナー名簿に info.jsparts の行が active で残っているため、ポータルを開くたびRPCがworker再開通を試みて毎回失敗→ポータル全体が読み込み不能。

### 不具合B: クライアントが名簿（学校側の生徒名簿）を作成できない
- 原因: RLSの役割判定 `private.team_works_project_role()` / `team_works_current_project_role()` が **`limit 1`で役割を1つだけ返す**設計。info.jsparts はスリランカ校で worker(active)＋client(active) の両方を持つため、どちらが返るか不定→「役割='client'なら許可」の判定が worker が返った時に失敗。
- これは方針1（同一プロジェクト複数役割）とRLS実装の**構造的な不整合**。ポリシー書き換えが必要（→P1）。

### 不具合C: パートナー管理/クライアント管理ページにアーカイブ操作が無い
- アーカイブUIは企業設定（組織メンバー一覧）にしか無い。名簿（directory）行自体の停止/アーカイブUIも無い。誤登録（野田あゆみ行）を画面から直せない。

## 4. フェーズ計画

### P0: 応急処置（SQLのみ・アリサ7/28はこれで回る）

**P0-1** migration `20260726180000_team_works_r6_activation_hotfix.sql`（作成済み・実行待ち）:
RPCの`source_local_id`にタイムスタンプを付与して再開通時の衝突を根絶＋`on conflict do nothing`で並行実行も安全化。

**P0-2** データ整理（1回限りSQL・migrationにしない）:
```sql
-- 誤登録パートナー行（野田あゆみ/info.jsparts）をアーカイブ→worker再開通の火種を消す
update team_works_partners
set status='archived', archived_at=now(), updated_at=now()
where email='info.jsparts@gmail.com';
```
※ worker org_member行は既にあゆみがアーカイブ済み。これで info.jsparts は client 専任に戻り、単一役割なので**不具合BもP1を待たずに解消**する（アリサ運用は役割が人ごとに分かれるため、P1が無くても実運用可能）。

**P0-3** 検証: クライアントポータルが開く／学校側名簿の登録ができる／パートナーポータルは空状態（担当なし）表示になる。

### P1: 複数役割RLS刷新（本丸・7/28後すぐでも可）

方針1を本当に成立させる。**「役割=Xか」を「役割Xを持っているか」に全面書き換え**。

新ヘルパー（`private`スキーマ・SECURITY DEFINER・既存関数は互換のため残すが新規参照禁止）:
- `team_works_has_project_role(pid uuid, r text) returns boolean` — activeメンバー行の中に役割rがあるか
- `team_works_project_member_id_for(pid uuid, r text) returns uuid` — 呼び出し元の役割r用organization_member_id（(org,user,role) partial uniqueにより役割内では高々1行）
- `team_works_is_own_project_member_id(pid uuid, mid uuid) returns boolean` — midが呼び出し元のどれかのメンバー行か（author検証用）

書き換え対象（`grep -rn "team_works_project_role(\|team_works_current_project_role(\|team_works_current_project_member_id(" supabase/migrations/` で全列挙可能）:
- `20260724060000` r1: participants_select / manuals_select / sessions select・update（worker分岐の`partner_member_id = current_project_member_id`は`= project_member_id_for(pid,'worker')`へ）/ roster / ops_assigned_participant_ids
- `20260724112532` r4 portal requests: worker側・client側
- `20260725032524` direct messages
- `20260725144511` partner offers（`organization_member_id = current_project_member_id`→role指定版へ）
- `20260726103000` client roster/messages（participants client insert/update、roster insert/delete、comments insert）
- `20260717223358` p8c（納品型: forms/form_submissions（input_actor равenство→has_role(pid, input_actor)）/deliverables/comments）
- `20260717234401` p8f（worker判定関数・トリガー）
- `20260718001256` p8g / `20260718003633` p8h（storageポリシー）

注意点:
- comments等の `author_member_id = current_project_member_id(pid)` は「自分のメンバー行のどれか」判定（is_own_project_member_id）へ。役割固定で書くとworker兼clientが片方の顔で書き込めなくなる。
- 完了後、`supabase/tests/`の流儀（team_works_r5_partner_directory_rls.sql参照）で**worker+client二役アカウントの肯定/否定テスト**を書き、あゆみがSQL Editorで実行。
- アプリ側: `loadOperationsPartnerPortal`/`loadOperationsClientPortal`のRPC呼び出しをtry-catchにして、開通失敗でもポータル読込は続行させる（今回の全滅を再発させない）。
- 割当成功時に古いpending invite行（`team_works_member_invites`）をrevokeする掃除も入れる（固定URL化でinvite行は形骸化しており、Pending invites一覧に亡霊が残るため）。

### P2: 管理ページの停止/アーカイブUIと表示強化

- **パートナー管理**: 各カードに「一時停止/再開」（directory status active↔paused）と「アーカイブ」（directory archived＋対応するworker org_member行もアーカイブ。確認ダイアログ付き）。
- **クライアント管理**: 同じものを鏡写し。
- **企業設定**: 横断修復室として存続。directory由来メンバー（invite_id無し）のメール表示が現状nullなので、staff向けSECURITY DEFINER RPC（auth.users join）でメール解決して表示。
- lib: `updateOperationsPartnerStatus` / `archiveOperationsPartner` / client版。アーカイブは名簿と組織メンバーの両方を止める（片方だけだと自動開通が復活させてしまう——今回の不具合Aの教訓）。

### P3: 役割ベースのメニュー入口＋会社×プロジェクト仕分け

- lib: `loadTeamWorksPortalRoles()` — ログイン中ユーザーの active org_member 行から `{ hasWorker, hasClient }`（全組織横断）。
- Team Worksホーム/メニュー（`TeamWorksOperationsShell`のナビ・`MikkeOwnerMenu`）に、持っている役割の入口だけ表示: 「パートナーポータル」「クライアントポータル」。
- 両ポータルの読み込みに組織名を追加し、プロジェクト表示を**会社名ラベル→プロジェクト**のグループ表示に。タブ切替（あゆみ案）はプロジェクト数が増えた時の形として、まずプロジェクト切替ボタン（クライアントポータル名簿ページに既にある形式）を全ページへ一般化。
- migration不要（読み取り＋表示のみ）。

### P4: ポータルカスタム（アリサpresetから）

- `team_works_portal_settings`（project_id, key, value のシンプルKV・staff書込/メンバー読取RLS）を新設。
- ポータル画面の呼び名（例:「名簿」→「生徒名簿」、「実施予定」→「レッスン予定」、「対象者」→「生徒」）をラベル化。デフォルト値=現行中立語、presetで上書き。
- アリサpreset（日本語レッスン用ラベルセット）をクライアント/パートナー両ポータルに適用して7/28運用の言葉に合わせる。
- 将来: ホームのカード構成・機能フラグ連動（payouts等は既存フラグ流用）。ジェネレーターUIは後（[[teamworks-school-field]]のMVP規律）。

### P5: テストデータ整理→検収→コミット

- info.jsparts のテスト行整理（必要なら正しい名前でパートナー再登録）。
- あゆみ実機で: 単役割クライアント一連／単役割パートナー一連／（P1後）二役アカウント一連。
- 検収後に初コミット（テーマ別に分割コミット推奨: migrations / directory+承認 / ポータルUI / メニュー）。

## 5. 守ること（既存ルール継続）

- `components/ai-office/*` `app/apps/ai-office/*` `lib/ai-office/*` に触らない。
- service_roleをブラウザに出さない。SECURITY DEFINERは自分のメール/uidスコープ限定。
- 実在の曜日・時刻・人名を仮入力しない。
- 検証は `npm.cmd run lint`＋あゆみ実機。稼働中devとbuildを並行しない。あゆみ確認前にコミットしない。
- migrationはファイル作成→あゆみがSQL Editorで実行→成功確認後にコードで前提にする、の順。
- Supabaseエラーは`instanceof Error`にならない: 新規エラーハンドリングは`toErrorMessage`パターン（TeamWorksOperationsClientPortal.tsx参照）。※既存35箇所の握りつぶしは別途の技術的負債（P1のポータル2ファイルだけは直す）。

## 6. 既知の技術的負債（本計画のスコープ外・記録のみ）

- `instanceof Error`握りつぶし残り約32箇所（14ファイル）。
- `lib/team-works-portal-database.ts:466`の`.single()`（納品型・多役割で理論上衝突）。
- `TeamWorksInviteAccept`（旧個別招待URL受諾ページ）: 固定URL化で新規発行は無いが、既存pending invite受諾のため当面残す。P1の掃除後に廃止判断。
- 案B（roleをproject_members側だけに持たせる根本リファクタ）は将来候補のまま。

---

## 進捗ノート（実装セッションが追記）

- 2026-07-26 Fable: 計画策定。P0-1 migrationファイル作成済み（実行待ち）。P0-2/P0-3はあゆみ実行・確認待ち。
- 2026-07-26 Sonnet: P0（hotfix migration `20260726180000`）実行済み・成功確認済み。学校側名簿がつながることを実機確認。ただし新たな症状（両ポータルの「野田あゆみ」重複・削除できない）を確認→P1着手。
- 2026-07-26 Sonnet: **P1完了**。migration `20260726190000_team_works_r6_multi_role_rls.sql`（未実行・あゆみのSQL Editor待ち）に以下を集約:
  - 新ヘルパー`team_works_has_project_role`/`team_works_project_member_id_for`/`team_works_is_own_project_member_id`
  - `team_works_ops_assigned_participant_ids`を新ヘルパー使用に修正
  - r1 operations（participants/manuals/schedule_rules/op_sessions/session_roster選択＋client insert/update/delete）、r4 portal-requests（reports/client_requests）、comments（direct messages＋client roster/messages統合）、partner offersのRLSを全面書き換え
  - delivery-style専用（p8c forms/deliverables、p8f/p8g/p8h storage）は計画通りスコープ外・旧関数のまま維持（コメントで明記）
  - **追加で発見した深いバグ**: `addOperationsPartnerToProject`/`addOperationsClientToProject`の「既に開通済みか」判定が`team_works_member_invites`の承諾記録だけを見ており、固定URL自動開通（招待なし）で開通した人を見つけられず、2件目以降のプロジェクト割当が宙に浮く欠陥があった→新RPC`team_works_find_active_member(org,role,email)`で解決し、両関数をこちらへ置き換え。あわせて割当成功時に古いpending invite行をrevokeする掃除も追加。
  - アプリ側: `loadOperationsPartnerPortal`/`loadOperationsClientPortal`の自動開通RPC呼び出しをtry-catchで保護（失敗してもポータル全体は落ちない）。
  - テスト`supabase/tests/team_works_r6_multi_role_rls.sql`作成済み（worker+client二役アカウントで各ポリシー・新ヘルパーの直接検証）。
- 2026-07-26 Sonnet: **P2完了**（当初計画より前倒し。あゆみの「パートナー削除ができない」という直接の訴えに対応するため）。同じmigration `20260726190000`に追加:
  - `team_works_find_active_member`（P1の副産物、P2でも再利用）
  - `team_works_list_organization_members(org)`——企業設定のメンバー一覧で、自動開通（招待なし）で入った人のメールが空欄だった問題を解消
  - lib: `updateOperationsPartnerStatus`/`archiveOperationsPartner`/`updateOperationsClientStatus`/`archiveOperationsClient`（アーカイブは名簿行＋対応する組織メンバー行の両方を止める。片方だけだと自動開通RPCが復活させてしまうため）
  - UI: パートナー管理・クライアント管理の各カードに「一時停止/再開」「アーカイブ」ボタン（確認ダイアログ付き）。プロジェクト側の割当ドロップダウンは一時停止中の名簿を除外。
- lint（tsc --noEmit）は全段階success。**未コミット。あゆみが migration `20260726190000_team_works_r6_multi_role_rls.sql` をSQL Editorで実行後、実機で以下を確認**: ①名簿の一時停止/アーカイブができる②企業設定のメンバー一覧でメールが全員分表示される③info.jspartsの古いworker重複行をアーカイブで整理できる④二役（worker+client同時）が同じプロジェクトで両方成立する⑤学校側名簿・出席順保存が引き続き通る。
- 2026-07-26 Sonnet: P2の実機検証中に2件の追加バグを発見・即修正（migration不要・コードのみ）:
  - パートナーオファー（承認待ち）に取り消しボタンが無く、名簿をアーカイブしても「承認待ち」がゴミとして残り続けていた→`updateOperationsProjectPartnerOffer(status:'removed')`を呼ぶ「キャンセル」ボタンを追加。あわせて`PartnersTab`の`pendingOffers`計算で、対応する組織メンバーがarchivedなオファーは自動的に非表示に。
  - **カレンダーの「担当」選択プルダウンが、アーカイブ済みの組織メンバーもフィルタせず出し続けていた**（`loadOperationsProjectDetail`の`data.partners`が`team_works_organization_members.status`を見ていなかった）→`memberResult`クエリに`status`を追加し、`activeMemberIds`セットで`partners`配列をフィルタ。過去の記録（セッション担当名・コメント著者名・支払先名など）はarchived後も表示上は残す（`memberNameById`は引き続き全件解決）——選べる相手からだけ外す設計。
  - 併せて`PartnersTab`のMembersセクションの絞り込みにも`member.status !== "archived"`条件を追加（同じ理由で漏れていた）。
  - lint成功。SQL不要、コードのみの修正。
- 次はP3（役割ベースのメニュー入口＋会社×プロジェクト仕分け）・P4（ポータルカスタム）・P5（データ整理→検収→コミット）が未着手。

---

## P3+ クライアントポータルUI刷新（2026-07-27 Opus設計・Sonnet実装）

あゆみ確定: **上部タブ方式**（総合ホーム＋各校タブ）。今回は基本ページのみ（項目の出し分け=P4カスタムは後）。参照実装=本部の月カレンダー`components/team-works/operations/TeamWorksOperationsProjectDetail.tsx`の443行付近。

### 全体構造（2階層ナビ）
- **左サイドメニュー（P3・役割ベース）**: 「クライアントポータル」＋（workerでもある時だけ）「パートナーポータル」。純クライアントは1項目。
- **ポータル内 上部タブ**: `[総合ホーム] [スリランカ校] [インドネシア校]…`。stateは `activeView: "home" | projectId`。複数org時はタブに会社名を小さく併記。
  - **総合ホーム**: 全プロジェクト合体の月カレンダー→選択日の予定一覧（全校横断・予定を押すとその校ビューの出席編集へ遷移）→本日のスケジュール→3カード（次回実施日/未確定の出席/メッセージ）。
  - **各校ビュー**: サブタブ `カレンダー / 名簿 / メッセージ`。カレンダー=その校の月グリッド、日付クリックでその日の予定詳細＋出席順編集。名簿=その校の生徒CRUD。メッセージ=その校の連絡先＋チャット。

### 手順1: データ層（`lib/team-works-operations-client.ts`）
- `loadOperationsClientPortal`:
  - `projects[]`に`organizationName`追加（projectResultのselectに`organization_id`を足し、team_works_organizationsからname解決）。`OperationsClientPortalData.projects`型に`organizationName: string`追加。
  - `holidays`追加: `team_works_holidays`から、client参加projectの休講＋org全体休講(project_id null)を取得（`.in("organization_id", orgIds)`＋RLSが自動でフィルタ。安全のため`project_id in projectIds or project_id is null`も付ける）。返り値型`holidays: { id: string; projectId: string | null; date: string; memo: string | null }[]`をOperationsClientPortalDataに追加。

### 手順2: 新規`ClientMonthCalendar`コンポーネント（同ファイル or 別ファイル）
- 本部の月グリッドを参考にした**読み取り専用**版。props: `sessions`（呼び出し側でフィルタ済み）, `holidays`, `selectedDate: string|null`, `onSelectDate(dateKey)`。
- 内部state`monthDate`（前月/次月ボタン）。7列グリッド。各セル: 日付＋その日のsession時間バッジ（総合表示で複数校ある時は校を見分ける頭文字/色も）＋休講ピンクバッジ。
- 本部にある「予定追加/休講設定」フォームは**付けない**（クライアントは閲覧＋出席編集のみ）。

### 手順3: `TeamWorksOperationsClientPortal.tsx`再構成
- トップに上部タブ（総合ホーム＋各校）。承認待ち`PendingApprovals`は従来通り最上部。
- 総合ホーム: `ClientMonthCalendar`に全sessions＋全holidays→`selectedDate`の予定一覧（`sessions.filter(s=>s.sessionDate===selectedDate)`、各予定に校名＋時間＋出席者数、押下で`setActiveView(session.projectId)`＋その校カレンダーで当日を選択）→本日のスケジュール→3カード。
- 各校ビュー: サブタブstate`projectTab: "calendar"|"roster"|"messages"`。
  - calendar: `ClientMonthCalendar`にその校のsessions＋holidaysのみ→選択日のsession詳細＋`RosterEditor`（既存流用）。
  - roster: 既存`RosterPage`のロジックを流用しつつ、プロジェクトチップを削除しactiveViewのprojectId固定に。
  - messages: 既存`MessagesPage`のロジックを流用、そのprojectのcontacts/messagesに絞る。
- 既存の`SessionsPage`(実施予定フラットタブ)は各校カレンダーの日付クリックに統合して廃止。

### 手順4: 左メニュー（P3・役割ベース）
- 新規hook `components/team-works/useTeamWorksPortalRoles.ts`: `supabase.from("team_works_organization_members").select("role").eq("user_id",uid).eq("status","active")`→`{ hasWorker, hasClient }`（全org横断）。
- `TeamWorksClientProjectsShell`（`components/team-works/client-projects/`）で、rolesからnavItemsを組み立て`MikkeAppShell`に`navItems`として渡す:
  - hasClient→{label:"クライアントポータル", href:"/apps/team-works/portal/client", icon:FolderKanban}
  - hasWorker→{label:"パートナーポータル", href:"/apps/team-works/portal/worker", icon:Users}
  - theme="green"継続。shellはローディング中もレイアウトが崩れないよう配慮。
- worker portal側のシェルにも同じhook＋navItemsを適用（twの役割切替を両ポータルで一貫させる）。worker portal内部の再構成は今回スコープ外（左メニュー追加のみ）。

### スコープ外（今回やらない）
- P4ポータルカスタム（ラベル/項目の出し分け・`team_works_portal_settings`）。
- 休講リクエスト（`team_works_client_requests`）のUI。
- worker portalの内部ページ再構成。

### 検証
- `npm.cmd run lint`。あゆみ実機で: ①左メニューにクライアント（＋二役ならパートナー）が出る②総合ホームが月カレンダーになり予定日クリックで該当校の出席編集へ飛ぶ③各校タブ切替でカレンダー/名簿/メッセージが校ごとに分かれる④名簿登録・出席順保存が引き続き通る。migration不要（データ層は既存テーブルの読み取り追加のみ）。

---

## 2026-07-27 本番デプロイ完了（Sonnet）

- リポジトリ`github.com/mikke-ruu/mikke-os-mvp-vercel`（Vercel連携済み・GitHub push→自動デプロイ）へ、Team Works関連72ファイル＋依存する共通部品（AppHeader/StatChip/MikkeAppShell等）を選別コミット（`d5a7b11`）。ai-office/Academy/Story等の別作業は含めず。
- **本番URL稼働中**: `https://mikke-os-mvp-vercel.vercel.app`。Supabase本番環境変数も設定済みで、実データ（スリランカ校の予定・参加者・メッセージ）が正しく表示されることを実機確認済み。
- デプロイ後に発覚・即修正した2件（いずれもpush・再デプロイ済み）:
  - **ビルド失敗**: `AuthGate.tsx`に足した`useSearchParams()`がSuspense境界なしで、全アプリ共通のためAcademy等の静的prerenderが軒並み失敗。`AuthGate`内部で`<Suspense>`ラップする根本修正（`6921bdb`）。
  - **非スタッフのルーティング事故**: worker/client役割のみのアカウントが`/apps/team-works`（本部ダッシュボード）に直接入ると「最初の運営型プロジェクトを作成」画面が出てしまう（新規組織を誤って作りかねない）。staff権限が無く、worker/clientいずれかの役割があれば自動で該当ポータルへ`router.replace`する修正（`389646d`）。実機で解消確認済み（あゆみ「kawarimashita」）。
- 固定ポータルURLカード(`TeamWorksPortalUrlCard.tsx`)は`window.location.origin`ベースで動的生成のため、本番URLで開けば自動的に本番アドレスになる。コード修正不要、確認のみ。
- 独自ドメイン（`mikke-os.com`取得検討中）は未接続。取得後にVercelのDomainsで接続すれば、既存の登録データ・ログインアカウントはそのまま引き継がれる（やり直し不要、共有済みURLの再案内のみ発生）。
- 次: 実際のパートナー・クライアントのメールアドレスで名簿登録→本番URLの固定リンクを渡す、の実運用開始。P3残り（左メニューの役割ベース入口の全体反映）・P4（ポータルカスタム）は継続中。

---

## 進捗ノート（P3+ 実装セッションが追記）

- 2026-07-27 Sonnet: 手順1〜4を実装。
  - 手順1: [lib/team-works-operations-client.ts](../lib/team-works-operations-client.ts) — `projects[]`に`organizationId`/`organizationName`追加、`OperationsClientHoliday`型＋`holidays`取得（client参加projectの休講＋org全体休講を`.or("project_id.in.(...),project_id.is.null")`で取得）を追加。
  - 手順2: 新規 [components/team-works/operations/ClientMonthCalendar.tsx](../components/team-works/operations/ClientMonthCalendar.tsx) — 読み取り専用月カレンダー。複数校のsessionsを渡した場合（総合ホーム）はproject毎に色ドットを出して見分けられるようにした（本部側の予定追加/休講設定フォームは持たせていない）。
  - 手順3: [components/team-works/operations/TeamWorksOperationsClientPortal.tsx](../components/team-works/operations/TeamWorksOperationsClientPortal.tsx)を全面再構成。`activeView: "home" | projectId`＋`projectTab: "calendar"|"roster"|"messages"`のstate構成。総合ホーム＝全校sessions/holidaysの月カレンダー→選択日の全校予定一覧（押すとその校のカレンダーへ遷移＋当日選択）→本日のスケジュール→3カード。各校ビュー＝サブタブでカレンダー（月カレンダー＋選択日のセッション詳細＋出席順編集）／名簿／メッセージ。旧`SessionsPage`（実施予定フラットタブ）は削除し、各校カレンダーの日付クリックに統合。複数組織にまたがる時はタブに組織名を小さく併記。
  - 手順4: 新規フック [components/team-works/useTeamWorksPortalRoles.ts](../components/team-works/useTeamWorksPortalRoles.ts)（`team_works_organization_members`をuser_id×status=activeで見て`{hasWorker,hasClient}`を返す）。[TeamWorksClientProjectsShell.tsx](../components/team-works/client-projects/TeamWorksClientProjectsShell.tsx)と[TeamWorksOperationsPartnerPortal.tsx](../components/team-works/operations/TeamWorksOperationsPartnerPortal.tsx)（worker portal本体）の両方に`navItems`を追加。ローディング中にサイドバーごと消えて戻る見た目を避けるため、自分が今いる側の項目（client側なら「クライアントポータル」、worker側なら「パートナーポータル」）は判定を待たず常時表示し、もう一方の項目だけ役割判定が終わり次第出す設計にした。
  - `npm.cmd run lint`（tsc --noEmit）success。
  - **未検証**: このセッションではBrowserペインが表示されずスクリーンショット取得不可＋実データでのログイン検証もできなかったため、実機での動作確認は未実施。あゆみ実機で①〜④（本セクション冒頭の検証項目）を確認してください。
  - 未コミット（P5でまとめてコミットの方針通り）。

- 2026-07-27 Sonnet: あゆみの実機確認スクリーンショットから2件のフィードバックを反映。
  - **バグ修正**: [lib/team-works-operations-client.ts](../lib/team-works-operations-client.ts)のクライアント向け連絡先(`contacts`)生成が、`team_works_organization_members.status`を見ずに`team_works_project_members`の行をそのまま出していたため、アーカイブ済みパートナー（例: 重複登録されていた「野田あゆみ」）がメッセージの連絡先一覧に残り続けていた。archiveOperationsPartner等はorg_member行をarchivedにするだけでproject_members側の紐付け行までは消さない設計（P2で確認済み）なので、クライアントポータル側のクエリで`status !== "active"`を除外するよう修正。
  - **新機能**: 本部の「ポータル設定」タブに「クライアントへパートナー連絡先を表示」チェックを追加（プロジェクト単位）。オフにすると、そのプロジェクトのクライアントポータルの連絡先/メッセージから担当パートナーが外れ、本部窓口のみになる。本部のみで完結させたい企業と、パートナーとも直接やり取りしたい企業が混在する想定に対応。
    - migration（**実行待ち・あゆみがSQL Editorで**）: [supabase/migrations/20260727100000_team_works_client_partner_contact_visibility.sql](../supabase/migrations/20260727100000_team_works_client_partner_contact_visibility.sql) — `team_works_projects.client_partner_contact_visible boolean not null default true`を追加（デフォルトは現行動作＝両方表示のまま）。
    - lib: [lib/team-works-operations-project.ts](../lib/team-works-operations-project.ts)の`OperationsProject`型・select・`updateOperationsProjectVisibility`に反映。[lib/team-works-operations-client.ts](../lib/team-works-operations-client.ts)の`contacts`生成でこのフラグがfalseの時はworker役割の連絡先を除外。
    - UI: [components/team-works/operations/TeamWorksOperationsProjectDetail.tsx](../components/team-works/operations/TeamWorksOperationsProjectDetail.tsx)の`PortalTab`にチェック項目を追加。
  - **UI改善**: [TeamWorksOperationsClientPortal.tsx](../components/team-works/operations/TeamWorksOperationsClientPortal.tsx)の総合ホーム3カードのうち「次回実施日」「メッセージ」をクリック可能なリンクに変更。「次回実施日」はその予定の校のカレンダー（該当日選択済み）へ、「メッセージ」は直近メッセージがあるプロジェクト（無ければ最初のプロジェクト）のメッセージタブへ遷移する。「未確定の出席」は指示になかったため据え置き。
  - `npm.cmd run lint`（tsc --noEmit）success。
  - **未検証**（同上の理由でBrowserペイン不可）。あゆみ実機で: ①アーカイブ済みパートナーが連絡先に出ないこと②ポータル設定でパートナー連絡先表示をオフにするとクライアント側の連絡先から消えること③次回実施日/メッセージカードのリンクが正しい校・タブへ飛ぶこと、をご確認ください。migration `20260727100000` の実行が先です。
  - 未コミット。

---

## P6 本部調整計画（2026-07-27 Opus策定・実装はSonnet/codex）

本番稼働中（`https://mikke-os-mvp-vercel.vercel.app`）の本部（HQ）画面を、あゆみの実機フィードバック6点で調整する。**実装はまだ。この計画に沿ってcodex/次セッションが進める**。あゆみの設計判断（2026-07-27の会話で確定）:
- **Zoom**: 「プロジェクトに固定Zoom1つ＋各回で上書き可」。過去回の番号は書き換えない。
- **マニュアル**: ファイルアップロードは不要。**テキスト本文＋リンク**で、パートナーポータル側が**生徒進捗に合わせてセクションごとにタブ切替**できる表示になればOK。
- **プロジェクト設定**: ①クライアント承認を送る前に「ポータル利用規約への同意」を挟んでから承認、を将来入れたい ②契約書＝両者サイン済みPDF/電子契約書をここに置く（**クライアントには非表示**＝先方の担当者が契約担当と限らないため） ③請求書＝毎月請求用にあると良い（すぐでなくて可）。

作業ディレクトリは複数セッション共有のため、**コミット前は必ず`git status`で無関係変更（ai-office/Academy等）を除外してから対象ファイルだけ`git add`**（[[teamworks-school-field]]の運用ルール）。検証は`npm.cmd run lint`＋あゆみ実機。あゆみ確認前にコミットしない。migrationはファイル作成→あゆみがSQL Editor実行→成功確認後にコードで前提化。

### W1: migration不要・すぐ効く3点（最優先）

**W1-1 メッセージのアクティブ/アーカイブ分離**（不具合: アーカイブ済みの重複メンバー＝「野田あゆみ」等がクライアント/パートナー欄に混在）
- `loadOperationsProjectMembers`（[lib/team-works-operations-project.ts](../lib/team-works-operations-project.ts)）は各メンバーの`status`を既に返している。
- [TeamWorksOperationsProjectDetail.tsx](../components/team-works/operations/TeamWorksOperationsProjectDetail.tsx)の`MessagesTab`で、`clients`/`partners`をそれぞれ`status==="active"`と`!=="active"`に分割。アクティブは従来通り`ConversationGroup`で上部表示。アーカイブは各グループ末尾に`<details>`（既定折り畳み・「アーカイブ済み(N)」ラベル）でまとめる。会話自体は選べるが既定で隠す。
- コンポーネントのみ。migration不要。

**W1-2 スケジュールページの日付クリックで展開編集**（現状`ScheduleTab`はUPCOMINGが読み取り専用リスト）
- `ScheduleTab`（同ファイル491行）のUPCOMING各行を、クリックで展開するアコーディオンに。展開部は既存`CalendarSessionEditor`（483行・時間/長さ/担当の編集＋削除）を流用。`data.partners`を渡す。
- WEEKLY RULESはそのまま。migration不要。
- 補足: 本部の月カレンダー（`ProjectCalendarPanel`）は既に日付クリック→右側で編集できる。ScheduleTabはリスト派の入口なので、そこにも編集を付ける形。

**W1-3 ポータル設定をクライアント/パートナーで2分割表示**
- `PortalTab`（同ファイル1462行）の1枚チェックリストを、見出し付き2グループに再編。既存フラグの割り当てを明示:
  - 「クライアントポータルに表示」: クライアントポータル全体(`clientVisible`)／担当パートナー連絡先(`clientPartnerContactVisible`)／請求記録(`invoicesEnabled`＝請求先)
  - 「パートナーポータルに表示」: 報酬記録(`payoutsEnabled`)／マニュアル(常時ON・client非表示の注記)
  - 「両ポータル共通・常時」: 名簿・進捗
- 各項目に「どこに何が出るか」の一言を添える。**フラグは既存のまま・追加なし**＝migration不要。純UI再構成。

#### W1 実装記録（2026-07-27 codex）

- **W1-1 実装済み・実機確認待ち**: メッセージのクライアント／パートナーをactiveとそれ以外に分離。activeを上に表示し、各グループ末尾の「アーカイブ済み（N）」`details`内から過去の会話も選べるようにした。初期選択もactiveを優先。
- **W1-2 実装済み・実機確認待ち**: ScheduleのUpcomingを既存`CalendarSessionEditor`へ置換。日付を含む各行クリックで展開し、時間・長さ・担当の保存と予定削除ができる。
- **W1-3 実装済み・実機確認待ち**: 既存フラグを変更せず、「クライアントに表示」「パートナーに表示」「共通・常時」の3グループへ再編し、表示先の説明を追加。
- 検証: `npm.cmd run lint`（`tsc --noEmit`）success。migrationなし。共有worktreeのAI OFFICE／Story等の既存差分は未変更。計画ルールどおり、あゆみ実機確認前のコミットは未実施。

### W2: Zoom情報（migration小・7/28以降の実運用で重要）

方針=**プロジェクト固定1つ＋各セッション上書き可**。
- migration（新規・あゆみSQL Editor実行待ち）: `team_works_projects`に`zoom_url text`／`zoom_meeting_id text`／`zoom_passcode text`を追加。`team_works_op_sessions`に`zoom_url text`（nullable上書き・nullならプロジェクト値にフォールバック。IDやパスコードもまとめて`zoom_url`1本に寄せるか3列持つかは実装時判断。MVPはURL1本で可）。
- lib:
  - [lib/team-works-operations-project.ts](../lib/team-works-operations-project.ts): `OperationsProject`型・`ProjectRow`・selectにzoom列追加。`updateOperationsProjectVisibility`とは別に`updateOperationsProjectZoom`を新設（プロジェクト既定Zoom保存）。`updateOperationsSession`（セッション編集）に`zoomUrl`上書きを追加。`loadOperationsProjectDetail`のsession整形にzoom（session上書き優先・なければproject既定）を含める。
  - [lib/team-works-operations-partner.ts]・[lib/team-works-operations-client.ts]: 各ポータルのsession取得にzoom（同フォールバック）を含める。パートナーは実際にZoomを開く人なので必須表示、クライアントにも表示（Zoom参加のため）。
- UI:
  - `ProjectSettingsTab`（または新規Zoomパネル）に「Zoom設定」フォーム（URL/ID/パスコード・保存）。
  - `CalendarSessionEditor`・`ProjectCalendarPanel`の予定詳細・パートナーポータル`SessionCard`・クライアントポータルのセッション詳細に、Zoomリンク表示＋「この回だけ変更」の上書き入力（本部/パートナーは編集可、クライアントは表示のみ）。
- 注意: `partner_member_id`同様、session編集は`updateOperationsSession`経由。RLSは既存のsession update（本部＋担当worker）を流用でzoom上書きも通る（列追加のみでポリシー変更不要のはず・要確認）。

### W3: 名簿グループをクライアントへ移管（migration小）

あゆみ「本部ではグループ分けしない。クライアントポータル側でグループを作れるように。名簿追加(紙ベース入力)は本部でも可のまま」。
- 本部 `RosterTab`（同ファイル534行付近）: 「グループ追加」フォームを撤去。グループの**表示**（誰がどのグループか）は残す。生徒（participant）追加フォームは残す（グループ選択は任意/未設定でOK、あるいは撤去）。
- クライアントポータル [TeamWorksOperationsClientPortal.tsx](../components/team-works/operations/TeamWorksOperationsClientPortal.tsx)の`ProjectRosterTab`に、グループ作成＋生徒へのグループ割当UIを追加。
- lib [lib/team-works-operations-client.ts](../lib/team-works-operations-client.ts): `loadOperationsClientPortal`に`groups[]`（team_works_groups）とparticipant.groupIdを追加。`saveOperationsClientParticipant`に`groupId`を追加。新規`saveOperationsClientGroup`（グループ作成/リネーム）。
- migration（RLS・あゆみSQL Editor実行待ち）: `team_works_groups`のinsert/updateが現状**本部staffのみ**（[20260724060000](../supabase/migrations/20260724060000_team_works_r1_operations_foundation.sql):223-227）。client（`private.team_works_has_project_role(project_id,'client')`＝[20260726190000](../supabase/migrations/20260726190000_team_works_r6_multi_role_rls.sql)の新ヘルパー）にもgroups insert/updateを許可するポリシーを追加。participant.group_idのclient更新は既存のclient participant updateポリシーで通るか要確認（通らなければgroup_id更新を許すよう調整）。

### W4: マニュアル表示方式＋プロジェクト設定拡充（設計先行・段階実装）

**W4-1 マニュアル（テキスト本文＋リンク／進捗連動セクションタブ）**
- あゆみの狙い: パートナーポータルで、担当生徒の進捗(current_manual_no)に合わせ、マニュアルを**セクションごとにタブ切替**して見たい。ファイルは不要、テキスト＋リンクで表示できればOK。
- データ: `team_works_manuals`は既に`no`(=進捗番号)/`title`/`material_url`(link)/`questions`/`expressions`/`cautions`(jsonb/text)を持つ。**本文用に`body text`列を追加**（コピペ長文用）。material_type=`link`で外部リンク（Googleドキュメント/スプレッドシート等）。
- 本部 `ManualsTab`（同1089行）: 追加/編集フォームを拡張し「番号・タイトル・本文(テキストエリア)・教材リンク(URL)」を編集可能に。既存は番号/タイトル/リンクのみ＝本文欄を足す。編集（既存マニュアルのupdate）UIも追加（現状は追加のみ）。
- パートナーポータル [TeamWorksOperationsPartnerPortal.tsx](../components/team-works/operations/TeamWorksOperationsPartnerPortal.tsx)の`SessionCard`: 現状は生徒ごとに`currentManualNo`の1件だけ表示。これを**マニュアル番号のタブ（例: No.5 / No.6 / No.7…＝担当生徒たちの進捗レンジ）**で切替表示に。各タブで本文＋リンク＋質問/表現/注意を表示。生徒カードから「この生徒の番号へジャンプ」も。
- migration: `team_works_manuals`に`body text`追加のみ（RLSは既存のmanuals select=本部＋workerのままで足りる。clientには従来通り非表示）。

**W4-2 プロジェクト設定の拡充**
現状`ProjectSettingsTab`=説明＋契約期間＋クライアント招待。以下を段階追加:
- **(a) クライアント情報の表示**（今回実装対象）: 割当済みclientメンバーの氏名/メール/会社名を`ProjectSettingsTab`に表示（`loadOperationsProjectMembers`のclient行＋directory名から。read中心）。migration不要。
- **(b) 契約書（HQ限定・クライアント非表示）**（次段）: 両者サイン済みPDF/電子契約書の**URLを貼る欄**をまず用意（`team_works_projects`に`contract_doc_url text`追加）。表示は本部のみ（プロジェクト設定内＝staffしか開けない画面なので自然にHQ限定）。ファイル実アップロードはSupabase Storage設計が要るため後回し、当面はURL参照。
- **(c) 規約同意を承認フローに**（次段）: クライアント承認（`team_works_approve_client_project`）の前に「ポータル利用規約に同意」を必須化。規約テキスト（org単位で保持）＋同意記録（いつ/どの版に同意したか）を新テーブル`team_works_terms_acceptances`等で。承認RPC/`PendingApprovals`UIに同意チェックを追加。→[[teamworks-school-field]]末尾の「規約同意はいつ・どの版に同意したか記録」方針と整合。設計のみ先行、実装は7/28運用後で可。
- **(d) 請求書作成**（将来）: 毎月の請求レコード作成フォーム＋PDF出力。既存`InvoicesTab`は読み取り専用なので、作成UI＋（将来）PDF。会計連携ではなく現場確認用の簡易版。あゆみ「すぐでなくて良い」。
- **追加アイデア（提案）**: ①契約終了時のプロジェクトアーカイブ実行ボタン（`ContractTab`に確認ダイアログ付きで。現状は「本番確認フローと合わせて追加」と保留中）②本部窓口担当（クライアントから見た連絡先名）の設定③P4ポータルカスタム（呼び名ラベル）との合流。

### 実装順の推奨（節約優先・7/28運用重視）
1. **W1（3点・migration不要）**を最初に一括（すぐ効く・リスク低）。
2. **W2 Zoom**（migration1本）— 8月レッスン運用に効く。
3. **W3 名簿グループ移管**（migration=groups RLS）。
4. **W4-1 マニュアル本文＋進捗タブ**（migration=body列）。
5. **W4-2**は(a)クライアント情報表示のみ今回、(b)契約書URL・(c)規約同意・(d)請求書は設計を残して段階実装。

### 検証（各Wごと）
`npm.cmd run lint`→あゆみ実機。W2/W3/W4はmigrationをあゆみがSQL Editorで実行後にコード前提化。あゆみ確認→無関係変更を除外して`git add`→コミット→push（Vercel自動デプロイ）。
