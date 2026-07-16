# mikkeOS Team Works プロジェクト管理拡張 計画

作成日: 2026-07-15
作成: Claude (Fable) — 全体設計の判断担当
実装: TW-P番号を指定してcodexまたはSonnetへ依頼する前提

統合更新: 2026-07-16（Codex）
現在地: TW-P0（型・localStorage store・汎用デモ）実装・検収完了。次はTW-P1。

このdocsは、次の2つの構想書を、現在の一本化実行ライン・既存Team Works構造・共通部品・安全規約へ落とし込んだ実装計画です。

- 一次資料A（全体像・ジェネレーター思想）: `G:/Musubiプロジェクト/Mikke OS/Team Works 新構想.md`
- 一次資料B（独立して渡せるMVPブリーフ）: `G:/Musubiプロジェクト/Mikke OS/Team Works 追加機能ブリーフ.md`

## 0. ユーザー確定事項（2026-07-15）

**ジェネレーター案で確定。** 認定講座構築などの業種テンプレをrepoへ同梱しない。

```text
理由（ユーザー判断）:
- テンプレを同梱すると、他業種にその業務フロー（ノウハウ）が露出する
- 認定講座構築は特殊な仕事であり、標準配布に向かない
→ 質問に答えて工程を生成するテンプレートジェネレーターを主とする
```

したがって:

- 認定講座構築テンプレは**repoのシードデータにしない**。あゆみさんがジェネレーターから作り、自社（organization）専用テンプレとして保存する「ユーザーデータ」として扱う。
- repoに置く仮データは、ランタイムUI検証用の**業種色のない汎用デモ案件1件のみ**（例:「サンプル制作案件」工程3つ程度）。
- 一次資料Bが「認定講座構築テンプレを最初から用意」としている箇所は、この確定により**採用しない**（ブリーフのP2/13章の具体テンプレはシードにしない）。ブリーフの他のMVP範囲・データ構造・UI方針は採用する。

## 1. Team Worksの新しい位置づけ（確定）

Team Worksは「人へ仕事を割り当てるアプリ」から「継続業務とプロジェクトの両方を、クライアント・管理者・メンバーで共有しながら納品・完了まで回すアプリ」へ拡張する。

2モードを同一アプリ内に持つ:

```text
A. 継続業務モード（既存・そのまま残す）
   日本語会話授業など。clients/participants/workers/sessions/reports/
   payouts/invoices/guides/assignments。既存コードは一切壊さない。

B. プロジェクトモード（今回追加）
   案件ごとに 目的/開始日/納期/工程/タスク/担当/成果物/確認/承認/納品。
   ジェネレーターで工程の下書きを生成し、ビルダーで編集して回す。
```

## 2. 既存コードとの接続（Fable判断・確認済みの事実に基づく）

現状（実コードで確認済み）:

```text
- lib/team-works.ts（702行）に既に templateKey / templateFamily /
  labelSettings / featureSettings / roleModel が存在する。
  → ブリーフの前提（template/label_settings/feature_settings で
    切り替える）は正しい。この仕組みを維持・拡張する。
- components/team-works/TeamWorksScreen.tsx は1902行の単一巨大コンポーネント。
  継続業務の全ビューがここに入っている。
- ロールは owner / manager / client_user / worker の4種。
- AuthGateは「mode === 'admin' のときだけラップ」する形で適用済み
  （worker/clientポータルは公開のまま。2026-07-14にFableが修正した箇所）。
```

### 2.1 コード配置の判断（重要）

TeamWorksScreen.tsxは既に1902行で肥大化している。プロジェクト機能をここへ直接足すと保守不能になる。

```text
決定:
- プロジェクト機能は新規ファイルに置く。既存の巨大画面はナビ項目の
  追加以外は触らない（継続業務モードを壊さない要件の構造的保証）。
- 新規モジュール:
    lib/team-works-projects.ts        型 + store（localStorage）
    lib/team-works-generator.ts       ジェネレーターの質問→下書き変換ロジック
- 新規ルート（app/apps/team-works/ 配下・下記5章）は独立page。
- 既存 lib/team-works.ts の FeatureSettings に新フラグを追加する
  （下記2.2）。既存stateやビューのロジックは変更しない。
```

### 2.2 FeatureSettingsの拡張（既存を壊さない）

既存`FeatureSettings`に次を追加する。プロジェクト系は**全てデフォルトOFF**にし、既存の`japanese_conversation_training`組織の挙動を変えない。

```text
enableRecurringOperations  継続業務モードを使う
enableProjects            プロジェクトモードを使う
enableProjectTemplates    テンプレート管理・ジェネレーターを使う
enableProjectClientPortal クライアントにプロジェクト進捗を見せる
enableDeliverables        成果物の提出・確認・承認を使う
enableProjectComments     プロジェクト内コメント
enableProjectPayouts      プロジェクト報酬（既存payoutsへの接続準備）
enableProjectInvoices     プロジェクト請求（既存invoicesへの接続準備）
```

`enableRecurringOperations`は既存組織・値が欠けた旧保存データでは`true`として扱う。これにより、既存の継続業務画面を消さずに「継続業務のみ / プロジェクトのみ / 両方」を選べる。`enableProjects`がtrueのときだけTeam Worksのナビに「プロジェクト」セクションが現れる。`teamWorksSchemaPlan`（将来DB化リスト）にもproject系テーブル名を追記する。

### 2.3 UI契約（ブリーフ23章の扱い）

ブリーフ23章は「落ち着いた業務画面」「今やることを優先」「進捗・確認待ち・遅延を明瞭にする」という**情報設計の要望**として採用する。色・余白・カード・ヘッダー・ナビゲーションの具体仕様は、OS全体のデザイン仕様を優先する。

```text
- Storyを視覚基準とし、MikkeAppShellと既存の共通部品を使う。
- 色は--mikke-*トークンだけを使う。Team Works専用の色体系を増やさない。
- 既存.tw-appの独自上書きは解消対象であり、新しい上書きを追加しない。
- 黒い帯、過剰なカード、独自ヘッダー、独自ボトムナビを作らない。
- PCでは一覧性、スマホでは「今やること」を優先するが、同じOS部品で組む。
- TW-P0は型・storeのみ進められる。画面を作るTW-P1以降はこの契約を検収対象にする。
```

## 3. 実行ラインへの組み込み

```text
- Team Worksプロジェクト拡張は、共通機能ではなく既存アプリの機能追加。
  番号は TW-P0〜TW-P7 で管理する。
- Fund F5は2026-07-16に完了。追加ブリーフと新構想の統合も本docsで完了した。
- 次の実装はcodexがTW-P0から直列に進める。TW-P0の検収・コミット前に
  TW-P1へ進まない。1機能=1実装者を守る。
- 既存の継続業務変更、Manager、Page等の未コミット差分をTeam Worksの
  コミットへ混ぜない。
```

## 4. フェーズ定義（ジェネレーター案・TW-P0〜P7）

各フェーズ完了ごとにlint/build/セルフチェック（`MIKKEOS_ACCEPTANCE_CHECKLIST.md`）＋コミット。全プロジェクト管理ルートはAuthGate必須（既存の`mode==='admin'`ゲートと同じ扱い）。

### TW-P0: 型・store・汎用デモ

```text
- lib/team-works-projects.ts: Project / ProjectPhase / ProjectTask /
  ProjectDeliverable / ProjectComment / ProjectTemplate /
  ProjectTemplateVersion / ProjectMember / ProjectRole の型
  （一次資料A 18章・B 15章のフィールドをcamelCaseで）
- store: localStorage（mikke.team-works.projects.v1 等）。
  activity-client-store方式に合わせる。
- 汎用デモ案件1件だけseed（業種色なし）。認定講座構築テンプレは入れない。
- FeatureSettingsに2.2章の8フラグ追加。
  enableRecurringOperationsは既存互換でtrue、プロジェクト系7つはデフォルトOFF。
```

### TW-P1: プロジェクトランタイム（管理UI）

```text
ルート（AuthGate必須）:
  /apps/team-works/projects            一覧（ステータス・進捗・納期・対応要件数）
  /apps/team-works/projects/new        新規作成（ブリーフ4-2の入力項目）
  /apps/team-works/projects/[projectId] 詳細（サマリー＋タブ:概要/工程/タスク/成果物/メンバー）
機能:
  - 工程一覧・タスク一覧・ステータス変更・担当割当
  - 進捗表示: 工程進捗率 × 工程比重 の合計（ブリーフ7章）
    MVPは固定マッピング（未着手0/進行中50/確認待ち80/修正中90/完了100）、
    手動進捗率は後続で拡張可能に。
  - まだテンプレ・ジェネレーターは無い。空プロジェクトに手で工程/タスクを足せる。
```

### TW-P2: ジェネレーター＋ビルダー＋自社テンプレ保存

```text
ルート:
  /apps/team-works/project-templates            テンプレート一覧
  /apps/team-works/project-templates/generator  質問ウィザード（新構想6章 STEP1-8）
  /apps/team-works/project-templates/[templateId] ビルダー編集
ジェネレーター（新構想の中心）:
  - STEP1仕事の種類 / STEP2完了条件 / STEP3関係者 / STEP4基本工程 /
    STEP5各工程の管理 / STEP6クライアント公開 / STEP7成果物 / STEP8報酬請求
  - 回答から汎用的な下書き（工程枠・役割・タスク枠・報告/確認/承認ポイント）を生成。
    lib/team-works-generator.ts に純粋関数として実装（回答→ProjectTemplate下書き）。
  - 業種名から完成形を作らない。特定業種ノウハウを内蔵しない。
ビルダー:
  - 工程ブロック（名称/説明/並び順/標準日数/比重/必須任意/担当役割/公開ON-OFF）
  - タスクブロック（名称/担当役割/期限/優先度/チェックリスト/成果物有無/承認有無/公開）
  - ドラッグ並び替え・追加・複製・削除
  - 「この内容で作成 / 工程編集 / 役割編集 / 使用機能変更 / やり直す」（新構想7章）
  - 自社テンプレとして保存（organization専用）。
注: フォームブロック（新構想の項目タイプ15種）・資料ブロックの権限は
    範囲が大きいのでTW-P7へ送る。P2ではフォームは「枠（名称＋入力者/確認者/
    必須任意/公開）」までとし、リッチな項目タイプは後続。
```

### TW-P3: テンプレからプロジェクト生成・バージョン

```text
- テンプレート→プロジェクト作成時に 工程/タスク/役割/成果物設定/公開範囲を
  コピー（新構想15章。案件側編集は元テンプレへ自動反映しない）。
- テンプレバージョン（上書き/新バージョン/複製/アーカイブ。新構想16章）。
  進行中プロジェクトへ新テンプレ内容を自動反映しない。
```

### TW-P4: クライアントポータル（プロジェクト）

```text
ルート:
  /apps/team-works/portal/client/projects
  /apps/team-works/portal/client/projects/[projectId]
- 既存 client_user を利用。内部情報（報酬/原価/外注単価/内部メモ/
  未公開下書き/内部確認前成果物）は出さない（新構想10章の非表示リスト厳守）。
- 「あなたが今やること」を最上部に。全体進捗/現在工程/納期/対応事項/
  確認待ち成果物/承認済み成果物。
- client_visibility フラグを工程・タスク・成果物の各レベルで尊重する。
```

### TW-P5: 成果物ワークフロー＋コメント

```text
- 成果物ステータス: draft→submitted→internal_review→client_review→
  revision_requested→approved→delivered（新構想8章）。
- 内部確認→修正依頼→再提出→内部承認→（必要時）クライアント公開の流れ。
- コメント（enableProjectComments）。MVPは作業報告をタスクコメントで代用可
  （ブリーフ18章 reports）。
- ファイル保存は本実装せずURL/仮データ（ブリーフ8章）。
```

### TW-P6: workerポータル・ダッシュボード

```text
- /apps/team-works/portal/worker/projects: 自分の担当プロジェクト/工程/
  タスクのみ表示。継続業務とプロジェクトをタブで分ける（新構想/ブリーフ10章）。
- 管理者ダッシュボードにプロジェクトカード追加。継続業務とプロジェクトで
  セクションを分け、既存カードと混ぜすぎない（ブリーフ11章）。
```

### TW-P7（後続・着手判断は別途）

```text
- フォーム項目リッチ型15種（new構想フォームブロック）・資料ブロック権限
- テンプレ改善ループ（案件完了時「今回の変更を元テンプレへ反映しますか」・新構想12章）
- 報酬・請求の実接続（既存 payouts/invoices へ project_tasks から反映）
- Manager連携（プロジェクトの納期/タスクをManagerへ derive-on-read で供給）
- Order/Studioからの自動案件作成、Marketplace（テンプレ公開・販売）は将来構想
```

## 5. ルート一覧（AuthGate方針つき）

```text
管理側（AuthGate必須・mode==='admin'扱い）:
  /apps/team-works/projects
  /apps/team-works/projects/new
  /apps/team-works/projects/[projectId]
  /apps/team-works/project-templates
  /apps/team-works/project-templates/generator
  /apps/team-works/project-templates/[templateId]
ポータル側（localStorageデモでは既存portalと同じ公開扱い）:
  /apps/team-works/portal/client/projects
  /apps/team-works/portal/client/projects/[projectId]
  /apps/team-works/portal/worker/projects
```

注意: localStorageデモでは個人情報・実在案件を入れない。「自分のscopeのみ表示」は
UIフィルターだけではセキュリティにならない。Supabase本接続時はclient_user / workerを
認証または安全な招待tokenで本人同定し、RLSと公開投影で担保する。本接続条件は10章。

## 6. 進捗計算（Fable確定）

```text
全体進捗 = Σ(工程進捗率 × 工程比重)
MVP工程進捗率の固定マッピング:
  未着手 0% / 進行中 50% / 確認待ち 80% / 修正中 90% / 完了 100%
比重の合計は100%に正規化（ビルダーで比重を編集可能）。
手動進捗率入力は後続拡張。
```

## 7. 禁止事項（構想書＋repo共通）

```text
- 認定講座構築など業種テンプレをrepoへ同梱しない（0章のユーザー確定）
- 既存の継続業務モードの画面・state・保存処理を壊さない
- 新機能を1902行のTeamWorksScreen.tsxへ直接足さない（新規ファイルへ）
- Supabase本接続・Activity Log本接続・DESK本接続・STORY本接続をしない
- Order/Studioからの自動案件作成を今回作らない
- 本格ファイルストレージ・リアルタイムチャット・メール/プッシュ通知を作らない
- 全プロジェクト管理ルートにAuthGate（新規アプリ画面のAuthGate徹底ルール）
- ブリーフ23章を独立デザイン仕様として実装しない。2.3章のOS共通UI契約に従う
- 「管理・監視・評価」の強い文言を避け、進捗/確認待ち/遅延を分かりやすく
```

## 8. 検収条件（各TW-Pフェーズ共通）

`MIKKEOS_ACCEPTANCE_CHECKLIST.md` 1〜5章に加えて:

```text
- 継続業務モード（既存ビュー）が壊れていないこと（回帰確認）
- TeamWorksScreen.tsx への変更がナビ項目追加のみであること
- enableProjects=false の組織でプロジェクトUIが一切現れないこと
- enableRecurringOperations=false の組織で既存継続業務ナビが現れず、旧保存データでは
  値が欠けていても継続業務が従来どおり現れること
- 全 /projects・/project-templates ルートが未ログインで読み込み中になること
- クライアントポータルに内部情報（報酬/原価/内部メモ）が出ないこと
- 新規画面がMikkeAppShell・共通部品・--mikke-*トークンだけで構成されること
```

## 9. このdocsで決めないこと

```text
- フォーム項目リッチ型の詳細 → TW-P7着手時
- テンプレ改善ループのUI → TW-P7着手時
- 報酬・請求の実接続方式 → TW-P7＋Supabase本接続フェーズ
- Marketplace（テンプレ公開・販売）→ 将来構想
```

## 10. Supabase本接続の再開条件（Fund F4/F5の学びを反映）

TW-P0〜P6はlocalStorageで操作感を検証する。本接続は別フェーズとして、UI検収後に
migration・RLS・actor別否定テストを一体で設計する。

```text
- DBテーブル名はprojectsのような汎用名にせず、team_works_projects等の
  app prefixを付ける。既存Fund・将来アプリとの衝突を避ける。
- actorは owner / manager / client_user / worker / anon / service_role を分ける。
- client_visibleは表示属性であり、認可の代わりにしない。
  client_userとworkerの所属・担当関係をRLSで検証する。
- anonへ組織内テーブルを直接公開しない。必要なら安全な公開投影または
  hash化した期限付きtokenの専用RPCを設計する。
- 成果物ファイルはprivate bucket＋署名URLを前提にし、公開URLを保存しない。
- DELETE権限・アーカイブ・保持期間をmigration前に決める。
- owner/他owner/client/worker/anonの否定テスト、Database Advisor、
  migration履歴整合を完走してから本接続完了とする。
```

## 11. TW-P0実装結果（2026-07-16）

```text
実装:
- lib/team-works-projects.tsを追加。
- Project / ProjectPhase / ProjectTask / ProjectDeliverable / ProjectComment /
  ProjectTemplate / ProjectTemplateVersion / ProjectMember / ProjectRoleを定義。
- mikke.team-works.projects.v1とmikke.team-works.project-templates.v1の
  localStorage store、更新event、React hook、resetを追加。
- 業種色・実在案件・個人情報を含まない「サンプル制作案件」1件だけをseed。
- 工程比重による進捗計算を追加。保留時は直前の進捗率を保持する。
- FeatureSettingsへ8フラグを追加。既存継続業務はtrue、プロジェクト系はfalse。
- teamWorksSchemaPlanへteam_works_* prefixの将来テーブル名を追加。

検収:
- localStorageの保存・読込・reset、seed件数、重み付き進捗、保留時進捗を確認。
- lint成功。
- build成功（69 routes）。
- TeamWorksScreen.tsx、既存ルート、既存継続業務stateは未変更。

未着手境界:
- プロジェクト画面・ルート・ナビはまだ作らない。
- ジェネレーター、自社テンプレ保存UI、ポータルはまだ作らない。
- Supabase / Activity Log / DESK / Storyへ接続しない。
```
