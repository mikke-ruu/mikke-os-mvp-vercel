# Team Works 本番実装 計画・段取り（引き継ぎ用・2026-07-24）

作成: Opus（計画）／実装: Sonnet または codex（1機能=1実装者）
目的: Team Works を「いろんな業種が使える汎用SaaS」として本番実装する。**第一目標=アリサの日本語レッスン現場でテスト運用（7/28開始）**。
この文書は **context / ツールを跨いで引き継げる段取り書**。codex や新セッションでも、これ＋下記関連文書だけで作業継続できるように書いてある。

## 関連文書（正典）
- 現場フロー/経緯: memory `teamworks-school-field.md`
- 設計言語（色・メニュー・アイコン・VIEW ALL等の共通ルール）: memory `mikkeos-story-design-language.md`
- 既存プロジェクトモード（納品型）の実装記録＝流用元: `docs/MIKKEOS_TEAM_WORKS_PROJECTS_PLAN.md`（TW-P0〜P8M。Supabase多組織/RLS/招待/finance/storage 完成済み）
- 旧・学校用localStorageプラン（考え方の流用元）: `docs/MIKKEOS_TEAM_WORKS_SCHOOL_FIELD_PLAN_2026-07-24.md`
- **UI視覚仕様の基準＝承認済みクリックプロトタイプ（グリーン版）**: https://claude.ai/code/artifact/fe999e5f-6c38-4d32-97d5-992f1f534039
- 検収チェックリスト: `docs/MIKKEOS_ACCEPTANCE_CHECKLIST.md`

## 1. 確定アーキテクチャ
- **器は1つ＝「プロジェクト」。中身のスタイルが2種類**: ①運営型(operations)=契約期間ずっと回る（繰り返し予定・名簿・シフト・報酬・請求・進捗、終わり=契約終了でアーカイブ）②納品型(delivery)=工程・タスク・成果物・納品（既存project mode）。**旧「継続業務モード」は廃止し、運営型プロジェクトに統合**。
- 例: ①スリランカ校プロジェクト ②インドネシア校プロジェクト＝契約=アーカイブ単位。プロジェクトごとにマニュアル/報酬レートを閉じて持つ。
- **SaaS-first**: 既存の多組織Supabase基盤（team_works_* テーブル / organization / organization_member / project_member / role=owner/manager/client_user/worker / RLS / メール招待 / finance / private storage = TW-P8A〜M）の上に「運営型」を新規追加する。
- **汎用の土台**: ラベル(呼び名)＋機能フラグ(既存FeatureSettings 約30)＋テンプレート/ジェネレーター。日本語レッスン＝「運営型テンプレ」の1プリセット。アリサ＝最初のテナント。他業種は新テンプレ(ラベル+フラグ)追加だけ。
- 募集・申込のフロントは将来 **Page アプリ**に分離（Team Works=チーム連携の"中"の道具）。接続点=「Page申込→本部承認→Team Worksメンバー化」。今は作らない。

## 2. 確定デザイン（全アプリ共通・すべて本番実装対象）
- 背景=白。**タイトル・見出しは全アプリ共通で固定ブルー #3f4eb5**（色を増やすと世界観が崩れるため）。**テーマ色はアクセントのみ**（メニューのアクティブ囲い等の差し色。Team Works=green系 #8bc7ad）。
- **左ドロワーメニュー（軽い版）**: プロフィール行 → 機能リスト（アイコン＋文字1行・箱なし・説明なし）→ 「APPS」小アイコンタイル・グリッド → 「＋アプリをつなげる」1行折りたたみ。**= 既存 `MikkeOwnerMenu` を作替**。全アプリ共通。PC左サイドバー下部にもAPPSタイル。
- **APPSタイル/サービスタイルはSTORY流のカラフル（5色）**。**淡色タイル(pink/yellow/green)の文字・アイコンは黒 #1b1b1f**（可読性ルール）。
- **冗長ナビ撤去**: `MikkeAppShell` の「現アプリ/Manager/Apps」ナビ（ヘッダー右のピル＋下部モバイル3ナビ）を削除。左ドロワーがナビ＋アプリ切替を担う。
- アイコン=lucide（絵文字禁止）。一覧の「もっと見る」=「VIEW ALL」（英大文字）。
- ダッシュボード等の画面レイアウトは承認済みプロトタイプ（§関連文書のURL）を基準にする。

## 3. データモデル（Supabase・運営型で新規追加。team_works_ prefix・RLS必須・project-scoped）
- `team_works_projects` に `style text ('operations'|'delivery')` 追加（既存は delivery 扱い）。運営型は納期/工程を必須にしない。契約期間・アーカイブ状態を持つ。
- `team_works_groups` (id, project_id, name) — 生徒の自由グループ
- `team_works_participants` (id, project_id, group_id, name, level, cautions, memo, current_manual_no, ...) — 対象者/生徒。※旧localStorage participant のDB化
- `team_works_manuals` (id, project_id, no, title, material_type, material_url, questions jsonb, expressions jsonb, cautions, source_template_manual_id) — プロジェクト専用マニュアル。共通雛形から複製して育てる
- `team_works_schedule_rules` (id, project_id, weekday, start_time, duration_min, partner_member_id) — 週次パターン
- `team_works_op_sessions` (id, project_id, date, start_time, duration_min, partner_member_id, status, generated_from_rule_id) — パターンから自動生成するコマ（個別編集可）
- `team_works_session_roster` (id, session_id, participant_id, order_index int, attendance_status) — 出席簿①②③順＋出席状況
- `team_works_holidays` (id, project_id null=org全体, date, memo) — 休講
- 進捗: participant.current_manual_no を基本に、報告提出/授業実施で自動+1、手動修正可。履歴が要れば別テーブル。
- 流用（既存）: messages / payouts / invoices / reports / project_members / deliverables。
- **RLS原則**: owner・manager=組織内全プロジェクト。partner=担当プロジェクトの担当分のみ。client_user=自プロジェクトのみ。報酬/原価/収支/他校=非表示（**本部以外は横も何も見えない=自分の専門のみ**）。client_visible は表示属性で、認可の代わりにしない。anon直公開しない。ファイルはprivate bucket+署名URL。各テーブルに owner/manager/partner/client/anon の否定テストを書く。

## 4. フェーズと段取り（この順・各フェーズ末に lint＋セルフチェック＋あゆみOKでコミット）
- **R0 共通シェル&デザイン基盤（app-common）**: `MikkeAppShell` の冗長ナビ撤去／固定ブルータイトル維持／`--theme` アクセント導入(TW=green)。`MikkeOwnerMenu` を軽いドロワーへ作替（機能リスト＋カラフルAPPSタイル(淡色は黒文字)＋つなげる折りたたみ）。**検収**: lint、全アプリのヘッダー/メニューが新形（STORY含む）、回帰なし。
- **R1 運営型プロジェクトの器＋データ（Supabase）**: style追加、§3の新テーブル＋migration＋RLS＋actor別否定テスト。**検収**: owner/manager/partner/client/anon RLS否定テスト成功、Supabase Advisor 由来指摘0、lint/build。
- **R2 本部**: ダッシュボード（プロトタイプ準拠：カレンダー/収支概算/Needs attention/新着メッセージ/本日）＋月カレンダー＋**週次パターン→コマ自動生成**＋休講＋スケジュール管理（時系列カード）。**検収**: 自動生成が動く、役割で表示が絞られる、375/768/1280で崩れない。
- **R3 プロジェクト詳細（運営型）**: 概要ミニダッシュボード（今やること/数字4/今後の予定3/新着メッセージ3/最近の報告3/その他ボタンリンク）＋各タブ（名簿=グループ＋出席簿①②③ビルダー／マニュアル複製・編集／パートナー・シフト／報告／報酬(記録)／請求(手入力・振込額ベース)／契約期間・アーカイブ／ポータル設定(機能チェックリスト式)／メッセージ）。
- **R4 パートナーポータル＋クライアントポータル（役割scoped）**: パートナー=本日のコマ・名簿①②③・生徒ごとマニュアル・1人あたり時間(総時間÷人数)・進捗自動+手動・報告。クライアント=自校スケジュール・提出物・メッセージ・進捗・休校記入。※Zoomは各自でウィンドウ配置（埋め込みしない）。
- **R5 招待＋設定**: 本部メンバー招待（共同管理者・エンジニア設定用＝owner/manager追加）／パートナー・クライアント招待／設定（ラベル＝呼び名カスタム、メンバー、機能フラグ）。
- **R6 アリサ日本語レッスンpreset投入**: ラベル（学校/生徒/会話パートナー/授業/会話マニュアル…）＋機能フラグ＋初期マニュアル・テーマ。アリサが最初のテナントとして運用開始。

**7/28テスト運用の最小構成**: R0(最低限)＋R1＋R2の核＋R3の名簿/マニュアル＋R4パートナー＋R6。報酬/請求/ポータル設定/週表示/ダッシュボード磨きは後追い可。
**現実的目標: 7/28は「コアが動く→アリサの実データで詰める」**。フル汎用（ジェネレーターUI・複数テンプレ自己設定・課金）は数週間先。

## 5. 制約・運用ルール（重要）
- **稼働中の `next dev`（preview_start / npm run dev）に対して `npm run build` を並行実行しない**。`.next` を取り合って dev が落ちる（実害あり）。検証は `npm run lint`(tsc) ＋ 稼働中dev ＋ **あゆみのログイン確認**（AuthGate配下の画面はClaude/エージェントからは目視不可）。`.next` が壊れたら削除して再起動。
- `components/ai-office/*`・`app/apps/ai-office/*`・`lib/ai-office/*` は不可触（別セッションの未コミット差分あり）。
- 既存の納品型プロジェクト機能・データを壊さない（後方互換）。
- コミットはあゆみ確認後、**自分の変更ファイルのみ**（ai-office/他アプリ差分を混ぜない）。
- OPUS計画／Sonnet実装。各フェーズ完了で lint＋セルフチェック（ACCEPTANCE_CHECKLIST）。
- 環境: Windows / G:\Musubiプロジェクト\mikke-os-mvp。dev は既定 port 3000（あゆみのターミナル）。G:\ はネットワークドライブ扱いで遅い（next.js警告）→ 速度が要るならローカルへ引っ越し可（引っ越したらパス更新）。

## 6. 現状（2026-07-24時点）
- P1(グループ)/P2(月カレンダー)= **旧・継続業務モード上のlocalStorageプロトタイプ**として実装済み（`components/team-works/school/SchoolCalendar.tsx`、`lib/team-works.ts` に group/holiday型、`TeamWorksScreen.tsx`）。**新アーキテクチャでは"運営型プロジェクト内"にSupabaseで作り直す**（考え方・カレンダー部品・①②③順・グループは流用、データはDB化）。未コミット。
- P2a済み: `MikkeAppShell` を `AppHeader` 使用にrefactor済み（☰左・中央タイトル・左ドロワー）。R0でこの上に冗長ナビ撤去＋メニュー作替。
- UI仕様＝承認済みクリックプロトタイプ（グリーン版・§関連文書URL）。
- 次アクション: **R0 から着手**（あゆみが「引っ越し」する場合は移動後に、この文書に沿って開始）。

**R0完了（2026-07-24・Sonnet実装・lint EXIT=0）**: `MikkeAppShell`の冗長ナビ（ヘッダー右ピル＋下部3ナビ）撤去、`theme`アクセントprop導入(Team Works=green配線済み)、`MikkeOwnerMenu`を軽量ドロワーへ全面作替(プロフィール行/機能リスト箱なし説明なし/APPSカラフルタイル4列/「＋アプリをつなげる」折りたたみ)。STORYの独自`StoryOwnerMenu`も撤去し共通`MikkeOwnerMenu`(theme="pink")へ統合。稼働中devサーバー(port 3000)でSTORY実測: タイル5色サイクル・淡色黒文字/濃色白文字を確認、コンソールエラーなし。Manager等AuthGate配下は未検証（あゆみのログイン確認待ち）。未コミット。
**既知の残課題（軽微・次回共通修正）**: APPSタイルのアイコンが全アプリ共通のGrid3X3フォールバックになっており、アプリごとの個別アイコン（MarketNote/Item Studio/Order等）が出ていない（あゆみ2026-07-24指摘、スクショで確認）。`MikkeOwnerMenuItem`は`icon`を渡せる型になっているが、呼び出し側(StoryProfileのownedApps/otherAppItems等)がGrid3X3を一律指定しているのが原因。次回、`lib/mikkeos/apps.ts`のアプリ定義に対応するlucideアイコンを持たせて全呼び出し元に配線する「共通修正」として対応する。

**R1着手（2026-07-24・Sonnet実装）**: §3のスキーマ+RLSを作成・未実行（要SQL投入・DBへは繋いでいないためClaude Code側では実行不可）。
- migration: `supabase/migrations/20260724060000_team_works_r1_operations_foundation.sql` — `team_works_projects`に`style`('operations'|'delivery'、既存行は'delivery')＋`contract_started_on`/`contract_ended_on`追加。新規7テーブル(groups/participants/manuals/schedule_rules/op_sessions/session_roster/holidays)、P8-aと同じRLS作法(enable+force RLS・grant最小化・helper関数はprivateスキーマ)。
- 設計判断（BUILD_PLAN §3から具体化した点）: ①`team_works_holidays`は`organization_id`を追加必須化（`project_id`がnull=組織全体の休講だとテナント境界が消えるため。project_id指定時はcomposite FKで所属組織一致を強制）②`team_works_manuals`（教材）はclient_userには見せない設計に確定（本部+partnerのみ。教材はクライアントの学校ではなく運営側のノウハウという判断。§3原文には明記なし、他業種汎用性の観点からstaffのみが安全側と判断）③partner(worker)の`team_works_participants`可視範囲は「自分がpartner_member_idのセッションにroster登録された生徒のみ」で実装（helper関数`private.team_works_ops_assigned_participant_ids`）。client_userは自プロジェクトの全生徒が見える（partnerより広い）。
- test: `supabase/tests/team_works_r1_operations_rls.sql` — owner/manager/partner(worker)/client/anonの5アクター否定テスト（p8a_rls.sql/p8c_collaboration_rls.slqと同じ「2プロファイル使い回し+ロール差し替え」方式）。特にworkerが担当外の生徒・他partnerのセッション/roster・manualsのclient非公開を確認。
**R1完了（2026-07-24・あゆみ実行・検収合格）**: migration→test→索引追加migrationの3本をあゆみがSupabaseダッシュボードSQL Editorで実行。
- migration/索引migrationとも「Success」。testは赤エラーなく`rollback`まで到達＝owner/manager/partner(worker)/client/anonの5アクター否定テスト全通過（partnerが担当外の生徒・他partnerのセッション/rosterを見れないこと、clientがmanualsを見れないこと等を確認）。
- Supabase Advisor(Security 16件・Performance 73件warning)を「team_works」でブラウザ内検索し0/0ヒットを確認＝今回追加した7テーブル・3関数由来の指摘はゼロ（既存warningは全部profiles/activity_logs/academy_*等の既存分、R1と無関係）。
- **R1検収条件（owner/manager/partner/client/anon RLS否定テスト成功・Supabase Advisor指摘0・lint/build）を全て満たし完了**。追加migration: `supabase/migrations/20260724063000_team_works_r1_foreign_key_indexes.sql`（複合外部キーの索引追加、P8-a追走と同じ形）。
- **次アクション: R2（本部ダッシュボード）へ着手**。プロトタイプ(§関連文書URL)準拠のダッシュボード＋月カレンダー＋週次パターン→コマ自動生成＋休講＋スケジュール管理。

**R2実装完了（2026-07-24・Sonnet実装・lint EXIT=0・未コミット）**:
- `lib/team-works-operations.ts`: 本部(owner/manager)が所属する組織を`team_works_organizations.owner_user_id`＋`team_works_organization_members(role in owner/manager)`から解決→運営型プロジェクト一覧→月間カレンダー/本日/シフト未決定(次7日・partner未定)/新着メッセージ(`team_works_project_comments`流用)をまとめて取得する`loadOperationsDashboardData`と、スケジュール管理ページ用の`loadOperationsScheduleGroups`、週次パターン→コマ自動生成の`generateSessionsForProject`/`generateSessionsForReachableProjects`（既定=本日から4週間・休講日と既存枠をスキップ・DBのunique制約もフォールバックで捕捉）を実装。データ取得パターンはP8-cポータル実装(`lib/team-works-portal-database.ts`)に合わせ、localStorage単一オーナー前提の`ensureDatabaseContext`は使っていない。
- `app/api/team-works/operations/generate-sessions/route.ts`: 生成ロジックを叩くRoute Handler。このアプリはサーバー側cookieセッションを持たない構成のため、クライアントがAuthorizationヘッダーで自分のaccess_tokenを渡し、それをそのままPostgRESTに転送するSupabaseクライアントをリクエスト毎に作る方式（service_roleキー不使用＝RLSがそのまま効く）。
- `components/team-works/operations/`配下: `TeamWorksOperationsShell`(共通シェル・本部/スケジュール管理/プロジェクト管理の切替)、`TeamWorksOperationsDashboard`(カレンダー行＋Finance＋Messages＋Today＋Needs attention)、`TeamWorksMonthCalendar`(月グリッド・週/日はプロトタイプ通りプレースホルダー文言のみ)、`TeamWorksDayPanel`(日別ボトムシート)、`TeamWorksScheduleList`(時系列スケジュール＋「次の4週間分のコマを生成」ボタン)。
- ルーティング: `app/apps/team-works/page.tsx`を新HQダッシュボードに差し替え（旧`TeamWorksScreen`は未削除・単に導線を外しただけ）。新規`app/apps/team-works/schedule/page.tsx`追加。両方`AuthGate`配下。
- 判断（brief記載の逸脱指示に対する具体化）: Finance＝レート未実装のため常に空状態表示（ドーナツ枠のみ・数字は全て「—」）／Todayのロール切替トグルは作らず本部固定表示／Needs attentionは「シフト未決定(次7日)」のみ実装（報告承認待ち・請求・契約更新は未実装の別サブシステムのため見送り）／プロジェクト詳細へのリンクは全て既存の`/apps/team-works/projects/[projectId]`（納品型UIしか出ないプレースホルダーである点はbrief通り許容）。
- 未検証: AuthGate配下のため目視確認は本人ログイン待ち。375/768/1280pxのレスポンシブ崩れ確認も本人環境で。

**R2実機確認（2026-07-24・あゆみ・port3000でログイン確認）**: `/apps/team-works`(本部ダッシュボード)・`/apps/team-works/schedule`(スケジュール管理)とも表示成功。運営型プロジェクトが0件のため両方とも空状態カード（「運営型プロジェクトがまだありません」「今後の予定はまだありません」）が正しく表示＝コードパス自体は正常に動作している状態を確認（実データでの本描画はまだ未確認）。既存の納品型`/apps/team-works/projects`（継続業務/プロジェクト/テンプレート切替・Supabase同期・招待UI）は無傷で表示されることも確認＝R2実装による既存機能への回帰なし。
ハンバーガードロワーも実機確認: 「Team Works」ヘッダー+greenアイコンチップ(R0のtheme="green"配線が実際に効いている)、表示設定、APPSタイル(Manager青/Story赤橙/DESK緑/Apps黄)。
**ここで新たに気づいた既知課題（軽微・次回共通修正・既存の「アイコンがGrid3X3固定」課題と合わせて対応）**: APPSタイルの色が`mikkeos-story-design-language.md`で確定した「アプリ別テーマ色マップ」(Blue=Academy/Page, Orange=Order/Session/Event, Green=TeamWorks/MarketNote/ItemStudio, Yellow=Fund/Community, Pink=Story)ではなく、`MikkeOwnerMenu.tsx`の`tileToneCycle`（配列の並び順でblue→orange→green→yellow→pinkを機械的に繰り返す実装、R0で意図的にそう作った暫定ロジック）になっている。次回の共通修正タスクで、アイコンと色を両方とも`lib/mikkeos/apps.ts`のアプリ定義（またはそこに追加するテーマ色マップ）から取るように配線し直す。

**あゆみが利用枠の都合でcodexへ移動するための引き継ぎ（2026-07-24時点）**:
- **正典はこのファイル**。§1〜6を読めば設計・データモデル・フェーズ・制約が全部わかる。関連文書（§冒頭）も参照。
- **完了済み: R0・R1・R2**（本ファイルの各完了ノート参照）。R2はコードパスの空状態確認までは済み、実データでの見た目確認はまだ。
- **次にやること（2択、どちらから始めてもいい）**:
  ① R2の実データ確認: 運営型プロジェクト(`team_works_projects.style='operations'`)＋`team_works_schedule_rules`を1件Supabaseへ手動投入 → ダッシュボードのカレンダー/Today/週次生成ボタンが実データで正しく動くか確認 → 375/768/1280pxのレスポンシブ確認。投入用SQLが要れば作成する。
  ② そのままR3（プロジェクト詳細＝運営型）へ進む: BUILD_PLAN §4のR3の内容（概要ミニダッシュボード＋名簿/マニュアル/パートナー・シフト/報告/報酬/請求/契約期間/ポータル設定/メッセージの各タブ）。プロトタイプの`#view-project`セクション（`view-project`のtabs構造、各tabpaneの中身）が視覚仕様。UI視覚仕様の生ファイルは会話内で一度全文取得済みだが再取得する場合はプロトタイプURL(§冒頭)を開くか、あゆみに主要画面のスクショをもらう。
- **軽微な既知課題（後回しでよい・まとめて共通修正予定）**: ①APPSタイルのアイコンが全部Grid3X3固定 ②APPSタイルの色がテーマ色マップでなく機械的サイクル。両方とも`lib/mikkeos/apps.ts`起点で直す想定。
- **絶対に守ること**: `components/ai-office/*`・`app/apps/ai-office/*`・`lib/ai-office/*`は不可触（別セッションの未コミット差分あり、triageしない）。稼働中`npm run dev`（既定port 3000、あゆみのターミナル）に対して`npm run build`を並行実行しない（`.next`競合で実害あり済み）。検証は`npm run lint`(tsc --noEmit)＋あゆみの実機ログイン確認。コミットはあゆみ確認後、自分（このセッション）の変更ファイルのみ。
- 現在すべて未コミット（R0/R1のコード・R1のmigration/testファイル・R2のコード、いずれもgit未コミット）。あゆみが「コミットして」と言うまでコミットしない。

**R3着手・詳細画面基盤実装（2026-07-24・codex・lint EXIT=0・未コミット）**:
- 承認済みクリックプロトタイプの`#view-project`を実機で確認し、概要（今日の予定／数字4つ／今後の予定／新着メッセージ／最近の報告／その他）と11タブの構成・見た目を実装。
- `lib/team-works-operations-project.ts`を追加。運営型プロジェクト、グループ、名簿、マニュアル、週次パターン、コマ、①②③順のroster、パートナー、報告（既存form submission流用）、報酬、請求、メッセージをRLS配下のブラウザSupabase clientで取得する。
- `components/team-works/operations/TeamWorksOperationsProjectDetail.tsx`を追加。概要／スケジュール／名簿／パートナー・シフト／マニュアル／報告／報酬／請求／契約期間／ポータル設定／メッセージを実データで表示し、グループ・名簿・進捗・コマ名簿①②③追加・出欠・マニュアル本文・契約期間・ポータル設定の基本更新を実装。
- `/apps/team-works/projects/[projectId]`はUUIDのDBプロジェクトが`style='operations'`なら新しい運営型詳細、既存localStorage IDまたは`delivery`なら従来の納品型詳細へフォールバックする。既存サンプル制作案件が従来UIで表示されることをport3000で確認し、コンソールerror/warn 0件。
- 接続中の`mikke-os-dev`で参照テーブルの実カラムがコードと一致することをread-only確認。運営型プロジェクトは現時点で0件のため、実データによる新画面の目視・375/768/1280確認は未実施。
- 次の確認: 運営型プロジェクトを1件作成してR3の実データ表示・基本更新・レスポンシブを確認。rosterは追加・順番付与・出欠更新まで対応済み。R1はDELETE権限を意図的に付けていないため、既存行の削除を伴う差し替え・並び替えはRLSを含む更新方式を確定してから追加する。

**R3初回セットアップ＋実データ確認（2026-07-24・codex・未コミット）**:
- `/apps/team-works`の「運営型プロジェクトがまだありません」を初回作成フォームへ変更。既存のowner/manager所属組織があれば再利用し、なければログインユーザー所有の組織＋owner memberをRLS配下で作成する。その後`style='operations'`プロジェクト＋owner/manager project memberを作成し、R3詳細へ遷移する。
- port3000で「アリサ日本語レッスン」組織／「スリランカ校」運営型プロジェクトを実作成。project id=`c8877df1-82d9-44c3-a00b-c596f3702427`、status=`active`、contract_started_on=`2026-07-24`、project member 1名をDBでread-only再確認。
- 作成後のR3詳細で概要＋11タブが表示され、`/apps/team-works`へ戻ると月カレンダー、スリランカ校の凡例、Finance、Messages、Today、Needs attentionが表示されることを確認。375/768/1280pxで横スクロールなし、コンソールerror/warn 0件。
- 現在は予定・名簿・マニュアル等が0件なので各カードは空状態。次はスリランカ校の週次パターン・生徒・初期マニュアルを投入して実運用データで詰める。

**R3スケジュール入力＋プロジェクト一覧統合（2026-07-24・codex・lint EXIT=0・未コミット）**:
- 運営型詳細のスケジュールタブから、曜日／開始時刻／時間／担当（未定可）の週次パターンを作成、一時停止・再開、有効ルールから次の4週間分のコマ生成、プロジェクト休講日＋メモ登録ができるようにした。既存R1 RLS（schedule_rules/holidaysのINSERT/UPDATE各2 policy）をそのまま使用し、service_role不使用。
- スリランカ校のスケジュールタブで各入力・生成ボタン・休講フォームの表示を実機確認。375pxでページ横スクロールなし（11タブだけ意図した内部横スクロール）、コンソールerror/warn 0件。実際の曜日・時刻は現場情報なのでcodex側では仮投入していない。
- `/apps/team-works/projects`に「運営型」と「納品型」を分けた一覧を追加。運営型のスリランカ校がSupabaseから表示され、既存localStorage納品型一覧・同期・招待UIも維持されることを確認。
- 次は実際の曜日・時刻を週次パターンへ登録して4週間生成し、名簿／マニュアルの実データを入れる。その後R4パートナーポータルへ進む。

**R4パートナーポータル基盤（2026-07-24・codex・lint EXIT=0・未コミット）**:
- `/apps/team-works/portal/worker`を運営型パートナーポータルへ差し替え。ログインユーザーが`worker`として参加する運営型プロジェクトと、自分が`partner_member_id`に指定された今後30日間のコマだけをRLS配下で取得する。担当コマごとに開始時刻／総時間／人数／1人あたり時間（総時間÷人数）、①②③順の名簿、対象者のレベル・注意事項・現在のマニュアル番号、対応マニュアルの教材リンク・質問・表現・指導上の注意を表示する。
- 既存の納品型ワーカーポータルは`/apps/team-works/portal/worker/projects`にそのまま残し、上部タブを「運営業務」「プロジェクト」に整理。既存サンプル案件1件が従来どおり表示されることを確認した。
- 本部アカウントで運営型worker割当がない場合は「担当中の運営型プロジェクトはありません」の安全な空状態を表示。375pxで横スクロールなし、ブラウザconsole error/warn 0件。
- 現行R1 RLSではworkerの`team_works_participants`と`team_works_session_roster`はSELECTのみ担当範囲を許可し、UPDATEは本部限定。RLSだけでworker UPDATEを開けると対象行の全列変更が可能になるため、出欠・進捗・報告ボタンはまだ有効化せず「本部で更新」と明記した。次のDB変更では、専用更新テーブルまたは列権限を含む狭い書き込み境界をmigration＋actor別否定テストで追加してから有効化する。
- `/apps/team-works/portal/client`も運営型の学校／クライアントポータルへ差し替え。自分が`client`として参加する運営型プロジェクトだけを対象に、今後60日間の自校スケジュール、①②③順の対象者と進捗番号、休校・休講、`audience='client'`のメッセージを表示する。manuals・報酬・原価・他校データは取得しない。既存の納品型クライアント案件は`/portal/client/projects`に維持。
- 本部アカウントでは「共有中の運営型プロジェクトはありません」の空状態となること、既存の「共有プロジェクト」画面が開くこと、375pxで横はみ出しがないこと、console error/warn 0件を確認。現行RLSではclientの休講INSERTも本部限定のため、学校からの休校登録は安全な書き込み境界を追加するまで本部連絡と明記した。
- 次はパートナー用の出欠／進捗／報告と、クライアント用の休校連絡／提出物の安全な書き込み境界を追加する。実データ表示の本検収には、パートナー・クライアント招待、プロジェクト割当、週次コマ、名簿、マニュアルの投入が必要。

**R4安全な書き込み境界完了（2026-07-24・codex・DB適用済み・lint EXIT=0・未コミット）**:
- `team_works_ops_session_reports`を追加。担当partnerは自分が`partner_member_id`の未キャンセルコマに対して1件だけ、出欠スナップショット／終了後の進捗No.／報告本文をimmutableに提出できる。本部は全件閲覧可。canonicalな`team_works_session_roster.attendance_status`と`team_works_participants.current_manual_no`は引き続き本部だけが更新し、提出内容を無条件で自動適用しない。
- `team_works_client_requests`を追加。clientは自プロジェクトの休校連絡を`pending`で作成・自分の申請のみ閲覧でき、本部だけが`accepted/rejected`へ更新できる。canonicalな`team_works_holidays`は本部確認後に別途作成する。
- migration `20260724112532_team_works_r4_portal_requests.sql`と外部キー索引追補`20260724112628_team_works_r4_portal_request_indexes.sql`を`mikke-os-dev`（project id=`nttqpprkqbynxyldbnjs`）へ適用済み。2テーブルともRLS enabled+forced、policy数はreport=2/request=3。Security Advisor今回分0、Performance Advisorの外部キー索引不足0（新規直後のunused_index INFOのみ）。
- `supabase/tests/team_works_r4_portal_requests_rls.sql`をDBで実行し、partner正例／client正例／worker→client request拒否／client→partner report拒否／partnerのcanonical出欠直接更新0件／staff閲覧・review／anon SELECT拒否を全通過。transaction rollback後、両新規テーブルの実データ件数は0。
- パートナーポータルに出欠・終了後進捗No.・コマ報告フォームを接続。提出後は「本部確認後に正本へ反映」と表示する。学校ポータルにプロジェクト／休校日／理由の休校連絡フォームを接続。現ログイン本部アカウントはworker/client割当がないため両方とも安全な空状態、375px横はみ出しなし、console error/warn 0件。
- 次の推奨作業はR5の招待・割当。まず運営型詳細の「パートナー・シフト」から既存invite基盤を使ってworker/clientを招待・project memberへ割当できる導線を作る。これによりR4ポータルを実アクターで検収可能になる。

**R5 第一スライス（招待・accept後割当・割当済み一覧）完了（2026-07-24・Claude Code・lint EXIT=0・未コミット）**:
- **新migration不要**。既存P8-c invite基盤（`team_works_member_invites` ＋ acceptトリガー `private.team_works_mark_invite_accepted`）が project style 非依存で、accept時に `team_works_project_members` を自動作成するため、運営型プロジェクトのUUIDを直接指定して招待行を作るだけで流用できることを確認して採用。
- `lib/team-works-operations-project.ts` に追加: ①`createOperationsProjectInvite(client,{projectId,email,role})` — `team_works_projects` で style='operations' を検証しorganization_idを取得→`team_works_member_invites` へINSERT（`created_by_user_id`=`auth.getUser()`のuid、RLS `team_works_invites_insert`＝org staff限定＋created_by一致がそのまま効く。service_role不使用）。role型 `OperationsInviteRole='worker'|'client_user'`。②`loadOperationsProjectMembers(client,projectId)` — `team_works_project_members`＋`team_works_organization_members(display_name,status)` で割当済みメンバー（役割＋active/inactive）と、`team_works_member_invites` の pending 招待一覧を返す。
- `components/team-works/operations/TeamWorksOperationsProjectDetail.tsx` の「パートナー・シフト」タブを刷新: 招待フォーム（メール＋役割worker/client_user→招待リンク作成・コピー・有効期限表示。リンクは`/apps/team-works/invite/{id}?organization=&role=`＝既存accept画面`TeamWorksInviteAccept`をそのまま使用）、割当済みメンバー一覧（氏名・役割・稼働中/停止中）、招待中一覧（メール・役割・期限）、シフト概況、担当未定コマ。シフトの「担当」ドロップダウン(スケジュールタブ)から `projectRole==='client'` を除外（クライアントがパートナー候補に出ないように）。
- **accept側は無改修**: `TeamWorksInviteAccept` ＋ `acceptTeamWorksMemberInvite` は inviteId＋org＋role で org member をINSERTし、既存トリガーが運営型project_memberを作成する汎用フロー。項目5（パートナーを週次ルールへ割当）は、割当後 `data.partners` に現れシフトの担当ドロップダウンに自動で出るため追加実装不要。
- 制約遵守: AI OFFICE不可触、既存納品型（`style='delivery'`/localStorage）フォールバック不変、service_roleをブラウザに出さない、`--mikke-*`＋既存部品のみ、実在の曜日/時刻/人物は未投入。検証は `npm.cmd run lint`(EXIT=0)。**AuthGate配下のため実画面検収はあゆみのport3000ログイン待ち**。
- **次（R5残り）**: あゆみが実アカウントでworker/clientを招待→accept→割当を実機確認し、R4ポータル（パートナー=担当コマ/名簿/マニュアル/報告、クライアント=自校スケジュール/休校連絡）を実アクターで検収。その後、本部メンバー（manager＝共同管理者/エンジニア）招待、設定（ラベル/機能フラグ）、R6アリサpreset投入。未コミット（あゆみ確認後）。

**バグ修正: 招待受諾で `?organization=&role=` が消える（2026-07-24・Claude Code・lint EXIT=0・未コミット・全アプリ共通コンポーネント）**:
- あゆみが実機で招待→受諾を検証したところ、受諾画面で「招待リンクが不完全です」「役割：確認できません」と表示される再現バグを発見。
- 原因: `components/AuthGate.tsx`（**Team Works専用ではなく全アプリ共通の認証ゲート**）が未ログイン時のリダイレクト先を `usePathname()` のみから作っていた（`/login?next=${encodeURIComponent(pathname)}`）。Next.js App Routerの`usePathname()`は**クエリ文字列を含まない**ため、招待URL `/apps/team-works/invite/{id}?organization=...&role=worker` へ未ログインでアクセスすると、ログイン画面へは `?organization=`と`?role=` が失われた状態で飛び、ログイン後もクエリなしの`next`へ戻ってしまい、`TeamWorksInviteAccept`が`organization`/`role`を読めず「不完全」判定になっていた。招待リンク自体・作成ロジックは正しく動いていた（バグはAuthGate側）。
- 修正: `AuthGate.tsx`に`useSearchParams()`を追加し、`nextPath = search ? pathname+"?"+search : pathname` を作って`next`パラメータに使うよう2箇所変更（初回未ログイン判定／認証状態変化での未ログイン判定）。ログイン画面(`app/login/page.tsx`)は元々`next`をそのまま`router.replace`しているため変更不要。後方互換（クエリが無いパスは従来通り）。
- **これはTeam Works固有ではなく全アプリの深いリンク（招待・フィルタ付きURL等）に影響する一般バグだったため修正**。lint EXIT=0。

**AuthGate修正の実機検証成功＋2件目の小バグ修正（2026-07-24・あゆみ実機／Claude Code修正・lint EXIT=0・未コミット）**:
- あゆみが実アカウント(`info.jsparts@gmail.com`)で招待リンクを開き直し、役割「担当メンバー」が正しく表示→「この案件に参加する」→「案件へ参加しました」まで成功。**AuthGateのクエリ消失バグ修正が実機で有効と確認**。
- 本部側「パートナー・シフト」タブのSHIFTセクションで`info.jsparts`が「参加中」表示 → `team_works_project_members`への割当（project_role='worker'）が正しく作成されたことを確認。**R5コア（招待→accept→割当→一覧反映）が実アクターで検収完了**。
- **2件目の小バグ発見・修正**: 受諾後の「案件一覧を開く」ボタンが全ロール共通で`/apps/team-works/projects`（owner/manager専用の管理者向け一覧）へ固定されていた。workerで受諾すると、割当自体は成功しているのにこの管理者ページでは「運営型プロジェクトはまだありません」と表示され紛らわしい（RLS/データの問題ではなく、このページが元々staffのみをスコープにする設計のため空になるのが正しい挙動。バグは遷移先の方）。
- 修正: `components/team-works/TeamWorksInviteAccept.tsx`に`postAcceptHref`/`postAcceptLabel`を追加し、受諾後の遷移をrole別に分岐——worker→`/apps/team-works/portal/worker`（自分の担当を見る）、client_user→`/apps/team-works/portal/client`（学校ポータルを開く）、manager/その他→従来どおり`/apps/team-works/projects`（案件一覧を開く）。lint EXIT=0。
- 次の実機確認: workerアカウントで`/apps/team-works/portal/worker`を開き、割り当てられた運営型プロジェクトが表示されるか（週次パターン・コマがまだ0件のため空状態表示になる想定）。

**R5第一スライス 実機検収完了（2026-07-24・あゆみ実機確認）**:
- `info.jsparts@gmail.com`で`/apps/team-works/portal/worker`を開き「1件の運営型プロジェクトに参加しています」と正しく表示（TODAY/UPCOMINGは週次パターン・コマ0件のため想定通りの空状態）。
- `/apps/team-works/portal/client`は「共有中の運営型プロジェクトはありません」（`info.jsparts`はclient_userとして未招待のため正しい空状態＝他プロジェクトのデータが漏れていないことも確認）。
- **R5第一スライス（招待→accept後割当→パートナー/学校ポータルへの反映）を実アクターで検収完了**。AuthGateバグ修正・受諾後遷移バグ修正も含め、この一連は解決済み。
- 次: (a) client_user招待も同様にテスト（任意）、(b) 実際の曜日・時刻（アリサから）でスケジュールタブに週次パターンを登録→4週間分のコマ生成→パートナーポータルにTODAY/UPCOMINGが実データで出るか確認、(c) 本部メンバー（manager＝共同管理者）招待の導線、(d) 設定（ラベル/機能フラグ）、(e) R6アリサpreset投入。

## ★UI/構成の是正＋パートナー/クライアント設計（あゆみ確定 2026-07-24・最重要方針）

**背景**: 実機を見たあゆみから「メニュー・配置・ページ構成が承認済みモックと違う」「モックにこだわって一緒に決めたのだからアレンジ不要」と是正指示。**承認済みクリックプロトタイプ（§冒頭URL）をUIの絶対基準にする。勝手な省略・アレンジ禁止**。以下は「モック忠実化＋あゆみが今回明確化したパートナー/クライアント運用」を反映した方針。

**現状のギャップ（実コード確認済み）**:
- `components/mikkeos/MikkeAppShell.tsx` は PC/スマホとも「☰でドロワー」方式のみ。**モックの「PC=常時表示の左サイドメニュー」が未実装**（R0はドロワーの中身を軽くしただけ）。＝全アプリ共通コンポーネントの不足。
- `components/team-works/operations/TeamWorksOperationsShell.tsx` の上部タブは暫定3項目（本部/スケジュール管理/プロジェクト管理）。モックの6項目のうち**パートナー管理/マニュアル管理/企業設定の独立画面が未作成**（コメントにも「画面自体が無いためリンクしない」と明記）。

**確定UI（モック準拠・全アプリ共通）**:
- PC(≥約900px)= **常時表示の左サイドメニュー**（機能リスト＝アイコン＋文字1行＋下部にAPPSタイル）。スマホ= ☰左スライドドロワー（同内容）＋下部アイコンのみメニュー。タイトルは固定ブルー、テーマ色はアクセントのみ（TW=green）。lucideアイコン・絵文字禁止・VIEW ALL。これを`MikkeAppShell`に実装（全アプリ波及）。
- Team Worksの左メニュー6項目（モック通り）: ①ホーム ②スケジュール管理 ③プロジェクト管理 ④**パートナー管理** ⑤**マニュアル管理** ⑥**企業設定**（④⑤⑥は独立画面を新規作成）。

**確定パートナー/クライアント運用（あゆみ2026-07-24・重要度=最高。「招待を送る相手と役割が全然違う。一緒にしておくとミスが起きたら大変」）**:

**パートナーとクライアントは、起点画面・事前名簿の有無・招待フォームすべてを構造的に分離する。1つの招待フォームでroleをドロップダウン選択させる今のR5実装は取り違えリスクがあるため廃止する。**

| | パートナー | クライアント |
|---|---|---|
| 起点画面 | 企業全体「パートナー管理」で事前登録 | プロジェクト作成時／プロジェクト「設定」画面 |
| 事前名簿 | あり（組織の名簿から各プロジェクトへ割当） | なし（そのプロジェクト担当者を都度その場でメール招待） |
| 招待フォーム | 「パートナーを招待」専用・role選択UIなし・**worker固定** | 「クライアントを招待」専用・role選択UIなし・**client_user固定** |
| 招待を送る場所 | プロジェクトの「パートナー・シフト」タブ | プロジェクト作成フォーム／「設定」タブ |
| シフト可能日 | パートナー本人が入力→本部が調整 | 対象外 |

- **企業全体「パートナー管理」**: パートナーを組織レベルで登録・一覧（会社の名簿）→各プロジェクトへ割り当て。
- **プロジェクト「パートナー・シフト」**: 登録済みパートナーへ**招待送信（roleは常にworker固定・選択UIなし）**＋**シフト可能日を表示して調整**。※現R5実装（`PartnersTab`の任意メール招待フォームがrole=worker/client_userの選択式）はこの設計に置き換える対象。
- **クライアント招待**: **プロジェクト作成時**＋**プロジェクト設定画面（新設）**から送る（roleは常にclient_user固定・選択UIなし）。パートナー・シフトタブには絶対に置かない。
- **プロジェクト「設定」画面（新設）**: クライアント招待・表示名変更・プロジェクト概要（＋請求/契約期間もここへ寄せる案＝あゆみ「入れても良いかも」・要確認）。

**データモデル追加（Supabase・RLS必須・要Sonnet詳細化）**:
- `team_works_partners`（id, organization_id, display_name, email, note, status）＝組織のパートナー名簿。
- パートナー↔プロジェクト割当: `team_works_project_partners`（project_id, partner_id, status）で「アカウント発行前でも割当済み」を表現。
- パートナー招待: 既存`team_works_member_invites`（role='worker' **固定**）を流用するが、**招待作成関数自体をクライアント招待用と分離**（`createOperationsPartnerInvite`のようにroleを引数で受けず内部固定にし、対象`partner_id`も記録して名簿と紐付ける）。accept時にorg_member↔partnerをemailで紐付け。
- クライアント招待: 既存`team_works_member_invites`（role='client_user' **固定**）を、パートナー招待とは**別関数**（`createOperationsClientInvite`、role引数なし）で作成。
- `team_works_partner_availability`（partner_id/member_id, date or weekday, status）＝パートナーが入力するシフト可能日→本部が調整。
- 企業設定のラベル（呼び名）カスタムを運営型に接続＝**他業種が自分の言葉に変える仕組み**（あゆみの「まっさら→自分用にカスタム」の核）。

**フェーズ（OPUS計画・Sonnet実装）**:
- **Phase A（最優先・モック忠実化）**: `MikkeAppShell`にPC常時左サイドメニュー＋モバイル下メニューをモック通り実装（全アプリ共通）。Team Works6項目を配線し、未作成のパートナー管理/マニュアル管理/企業設定は「準備中」スタブ画面を用意（メニュー構成をまずモックに一致させる）。既存画面の中身は壊さない。
- **Phase B**: パートナー管理（組織名簿の登録・一覧）＋`team_works_partners`＋RLS。
- **Phase C**: パートナー・シフト作り替え（登録済みパートナーの割当＋招待＋シフト可能日）。client招待をこのタブから撤去。
- **Phase D**: プロジェクト設定画面（client招待・表示名・概要・請求/契約期間の寄せ）＋作成時client招待。
- **Phase E**: マニュアル管理（組織共通）＋企業設定（ラベルcustom＝業種カスタムの核・本部メンバー招待）。
- **R6**: アリサ日本語レッスンpreset。
- 7/28現実目標: 機能コア（プロジェクト作成→スケジュール→名簿→パートナー招待→ポータル）は既に動作。Phase A（見た目/メニューのモック一致）を最優先、以降はできる所まで。フル汎用（ラベルcustom等）は継続。

**制約再掲**: AI OFFICE不可触・既存納品型不変・service_roleをブラウザに出さない・RLSはproject/member境界必須・dev稼働中にbuildしない・`npm.cmd run lint`＋あゆみ実機検証・コミットはあゆみ確認後。
## 2026-07-24 R5是正: パートナー/クライアント招待分離

- Phase A確認: `MikkeAppShell` と `TeamWorksOperationsShell` にPC常時左サイドメニュー + Team Works 6項目配線が入っていることを確認。`/apps/team-works/partners` `/manuals` `/schedule` ルートも存在。
- Phase B: Supabaseへ `team_works_partners` と `team_works_project_partners` を追加。組織スタッフだけが登録/割当予約できるRLS。適用済み migration: `20260724134437 team_works_r5_partner_directory`。
- Phase C: プロジェクト詳細の「パートナー・シフト」からrole選択式フォームを撤去。組織のパートナー名簿から選んで `createOperationsPartnerInvite` を呼ぶ。roleは常に `worker` 固定。
- Phase D: 「ポータル設定」タブにクライアント招待フォームを追加。`createOperationsClientInvite` を呼ぶ。roleは常に `client_user` 固定。
- RLS検証: `supabase/tests/team_works_r5_partner_directory_rls.sql` を追加し、実DBでrollback実行済み。新2テーブルは row count 0、policy count は各3、force RLS true。
- 検証: `npm.cmd run lint` 成功。port3000は応答が詰まっていたため、ブラウザ表示の最終確認はあゆみ実機ログイン確認に回す。
