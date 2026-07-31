# Team Works 現場フィードバック対応＋作業窓の汎用化計画（Phase M/N）（2026-07-31）

対象: Team Works（納品型の説明欄・プレビュー移設・資料テキスト／スタッフポータルの「作業窓」汎用化）
計画者: **Fable**（この計画書）
実装者: **Sonnet**（Phase M → Phase N の順。モック工程は今回省略 — 既存部品の流用のみで新しい見た目を発明しないため）

前提となる計画書（すべて実装完了・push済み・migration実行済み）:
- `docs/MIKKEOS_TEAM_WORKS_GENERALIZE_PLAN_2026-07-30.md`（Phase J/K/L。機能ON/OFF＝feature_settings）
- 最終コミット `3a7036e`（K-2運営型ポータルプレビュー）

---

## 0. 背景（あゆみ実機フィードバック 2026-07-31）

テスト事業（運営型）と mikkeOS Official Academy 初期構築（納品型）を実際に組み立てての指摘:

> 1. プロジェクトの説明を書く場所が欲しい。クライアント・メンバーにポータルを渡す際に共有できるといい
> 2. ポータルプレビューは、クライアント・メンバーがいなくても今見える状態が分かるといい。
>    納品型はなぜ「プロジェクト設定」にプレビューがある？「機能とポータルの設定」に置いた方が自然では
> 3. 資料はテキストも書けるようにしたい。運営型のマニュアルみたいに、手順書をサッと作れたら楽
> 4. スタッフ側ポータルは「レッスン画面」前提だが、他の企業では出勤・退勤ボタンなどになる。
>    レッスン画面にチェックを入れないとポータル側に予定が表示されないのも問題。
>    Zoomを使わない事業者もいる。スケジュールとスタッフを紐づけて、何の作業をするかを書く欄が欲しい。
>    流れ: スケジュール作成 → 作業内容 → 時間 → スタッフ → スタート → ストップ → 報告。
>    ポータルには「作業窓」を作り、Zoom情報☑・タイマー☑・作業開始☑・クライアントタスク(名簿)☑・
>    タスクとマニュアル連動☑ のように項目ごとにON/OFFとラベル設定ができるとよい

**②の回答（このセッションで確認済み）**: 納品型プレビューが「プロジェクト設定」タブにあるのは、
K-2実装時点で「機能とポータルの設定」タブ（L-4）がまだ存在しなかったから。意図は無い。移設が正しい。

**④の核心**: Phase Lで `lessons=false` にするとスタッフポータルの**セッション取得ごと**消える実装にした
（`lessonsProjectIds` フィルタ）。これは「予定は常に見える。業種で変わるのはコマを開いた中身」という
あるべき姿と食い違う。**lessonsの意味を再整理し、スタッフの作業画面を「作業窓」として部品単位で
構成できるようにする**のがPhase Nの本命。

**大原則（継承）: アリサの組織は、設定を変えない限り表示・動作・文言が一切変わらない。**
新設するデフォルト値はすべて「現状のアリサの画面と完全一致」になるように選ぶ。

---

## 1. 調査済みのコード事実（Fableが2026-07-31に確認）

| 事実 | 場所 |
|---|---|
| `team_works_projects.description` は既存列。運営型は編集UI（`updateOperationsProjectDescription`）・招待承認カードでの表示あり。納品型はselectも編集UIも無し | `lib/team-works-operations-project.ts` / `lib/team-works-delivery.ts:239`付近のselect |
| 納品型の設定更新は `updateDeliveryProjectSettings`（patch: title/clientVisible のみ） | `lib/team-works-delivery.ts:363` |
| 資料タブは `team_works_manuals` 流用。**`body`列が既に存在**（運営型マニュアルが使用中。`isMissingSupabaseField`フォールバックまで整備済み）だが、納品型の`DeliveryMaterial`型・fetch・createはtitle/material_urlしか扱っていない | `lib/team-works-delivery.ts:800-848` |
| 納品型プレビュー`DeliveryPortalPreview`は`SettingsTab`内に配置。メンバー不在時は`MikkeEmptyState`を出すだけ | `components/team-works/projects/TeamWorksDeliveryProjectDetail.tsx` |
| 運営型プレビューはロード関数を「auth解決」と「member解決後」に分離済み。`buildClientPortalData`/`buildPartnerPortalData`は**memberIdを表示・絞り込みにしか使わない**ため、実在しないIDでも組み立て自体は通る | `lib/team-works-operations-client.ts` / `lib/team-works-operations-partner.ts` |
| クライアントプレビューのセッション取得は**プロジェクト単位**（実データが出る）。パートナー側のセッション取得は**partner_member_id単位**（ダミーIDだと予定0件の枠だけになる） | 同上 |
| スタッフの作業画面は `TeamWorksPartnerLessonConsole`。スタンバイ→(戻す)→レッスン終了のプレゼンス機構（`partner_presence_status`: not_started/standby/in_progress/ended、`partner_standby_at`/`partner_ended_at`のタイムスタンプ付き）・Zoom表示・名簿（生徒送り）・マニュアル連動・報告提出が実装済み | `TeamWorksOperationsPartnerPortal.tsx:458` |
| Phase Lの `lessons=false` はスタッフポータルのセッション取得を `lessonsProjectIds` で除外している（=スケジュールごと消える。今回これを撤回する） | `lib/team-works-operations-partner.ts` |
| 表示ラベルは組織単位 `label_settings` jsonb（workers/holidayLabelの2キー）。DEFAULT=アリサ現状、GENERAL_PURPOSE=新規組織用。キー追加時は両方に足す約束 | `lib/team-works-labels.ts` |
| コマ（`team_works_op_sessions`）に作業内容のテキスト列は無い | `lib/team-works-operations.ts`（work_description不存在を確認） |

---

## 2. Phase M: 現場フィードバックの即応（小さい3つ・migration不要）

### M-1. プロジェクト説明欄（納品型）とポータルでの共有

- `loadDeliveryProjectDetail` のプロジェクトselectに `description` を追加し、
  `DeliveryProjectSummary`（または detail側のproject型）に `description: string | null` を追加。
- 納品型「プロジェクト設定」タブに説明のtextareaを追加（`updateDeliveryProjectSettings` の
  patchに `description` を追加）。プレースホルダは「この案件の目的・範囲・共有事項など。
  クライアントと参加メンバーのポータルにも表示されます」。
- **ポータルでの表示**: `TeamWorksDeliveryPortalProjectDetail` のヘッダ（タイトル直下）に
  説明を表示（`whitespace-pre-wrap`・薄い文字色）。説明が空なら何も出さない。
- 運営型は編集UIが既にあるため、**表示側だけ**合わせる: クライアントポータルの
  `ProjectView` ヘッダ（タブの上）に説明ブロックを追加（`OperationsClientPortalData.projects`に
  descriptionを追加してselectに足す）。パートナーポータルの `PartnerProject` ヘッダにも同様
  （「担当レッスンだけを表示しています」の文言の下）。空なら出さない=アリサで説明未入力なら不変。

### M-2. プレビューの移設＋メンバー不在でも「サンプル表示」

**移設（納品型）**: `DeliveryPortalPreview` を `SettingsTab` から `DeliveryFeatureSettingsTab`
（機能とポータルの設定）の保存ボタン下へ移動する。運営型と同じ「設定→保存→すぐ下のプレビューで
確認」の1画面完結にする。`SettingsTab`側からは削除（アーカイブパネルの上に何も残さない）。

**サンプル表示（納品型）**: メンバーが1人もいない役割は、EmptyStateの代わりに
**架空メンバーでそのまま描画**する:

```ts
const SAMPLE_CLIENT: DeliveryProjectMember = {
  organizationMemberId: "00000000-0000-0000-0000-000000000000",
  projectRole: "client", displayName: "クライアント（サンプル）"
};
// worker版も同様
```

`TeamWorksDeliveryPortalProjectDetail` は previewMembership を props注入するだけの作りなので
そのまま通る（ダミーIDのクエリは空を返すだけ）。ヘッダ帯の表示は
「◯◯ さんの画面」→「サンプル表示（クライアントを追加すると実データで確認できます）」に切替える。

**サンプル表示（運営型）**: `loadOperationsClientPortalPreview` / `loadOperationsPartnerPortalPreview`
は対象memberが見つからないと空を返す作りにしたので、**memberが見つからない場合に
ダミーmember（display_name「クライアント（サンプル）」等）で組み立てを続行する**分岐を追加する
（§1のとおり組み立てはダミーIDで通る）。制限として、パートナー視点のサンプルは担当コマが
0件の枠になる（セッションがpartner_member_id基準のため）。プレビュー帯に
「サンプル表示・実際の担当者を追加すると予定入りで確認できます」と明記して割り切る。
クライアント視点のサンプルは実データ（コマ・名簿）がそのまま出る。

### M-3. 資料にテキスト本文（手順書をサッと書く）

- `DeliveryMaterial` に `body: string | null` を追加。`fetchDeliveryMaterials` のselectに
  `body` を追加（運営型と同じ `isMissingSupabaseField(["body"])` フォールバック付き）。
- `createDeliveryMaterial` の input に `body?: string` を追加してinsertに含める。
- 資料タブの追加フォームに「本文（任意）」textareaを追加。ヘルパ文言:
  「手順やメモをそのまま書けます。URLと併用も可能」。
- 一覧側: 本文がある資料は折りたたみ（`details`/既存の開閉パターン流用）で
  `whitespace-pre-wrap` 表示。タイトル行に「本文あり」の小バッジ。
- migration不要（`body`列は既存）。編集UIは今回は作らない（追加とアーカイブのみ、現状踏襲）。

### 完了条件（Phase M）
- 納品型: 設定タブで説明を保存→クライアント/メンバーのポータルとプレビューに表示される
- 納品型: プレビューが「機能とポータルの設定」タブにあり、メンバー0人でもサンプルが見える
- 運営型: プレビューがメンバー0人でもサンプルが見える（パートナー側は枠のみで可）
- 資料: 本文つき資料を作成でき、一覧で開いて読める
- アリサ相当: 説明未入力・メンバー既存のため見た目の変化なし
- `npm run lint` 通過。コミットはM-1/M-2/M-3で分けてよい（まとめて1つでも可）

---

## 3. Phase N: 作業窓（スタッフポータルの汎用化・本命）

### N-0. 概念の再整理（実装前にこれを共通認識にする）

| 概念 | 意味 | 制御 |
|---|---|---|
| スケジュール | コマの一覧・カレンダー。**スタッフには常に見える**（本部が予定を組む以上、担当者が予定を見られないことはあり得ない） | 常時ON（設定なし） |
| クライアントのカレンダー | クライアントポータルのカレンダータブ | 既存 `lessons` の意味を**これに限定**する |
| 作業窓 | スタッフがコマを開いたときの画面（現 `TeamWorksPartnerLessonConsole`）。業種によって中身が変わる | 新設 `workWindow`（部品単位のON/OFF） |

### N-1. スタッフのスケジュール常時表示（Phase Lの部分撤回・最優先）

- `lib/team-works-operations-partner.ts` の `lessonsProjectIds` によるセッション取得の絞り込みを
  **撤回**し、常に全担当プロジェクトのセッションを取得する。
- `lessons=false` のプロジェクトでもカレンダー・スケジュール一覧・行は出す。
  ただし行の「レッスン画面」ボタン（別窓を開く導線）は `workWindow` が全部品OFFのときだけ隠す
  （下記N-2）。
- クライアントポータル側の `lessons` 連動（カレンダータブ非表示）は現状のまま維持。
- 設定UIの「レッスン画面」項目は**「クライアントのカレンダー」**に改名し、説明とタグを
  クライアント側だけに絞る（スタッフ側の記述を削除）。

### N-2. workWindow 設定（feature_settings拡張・migration不要）

`lib/team-works-feature-settings.ts` に追加:

```ts
export type TeamWorksWorkWindowSettings = {
  zoom: boolean;       // Zoom情報の表示・変更
  presence: boolean;   // 開始/終了ボタン（プレゼンス通知）
  timer: boolean;      // 経過タイマー表示（★新機能なのでデフォルトfalse）
  roster: boolean;     // クライアントタスク（名簿・生徒送り）。attendance=falseなら強制false
  manualLink: boolean; // 名簿とマニュアルの連動表示
};

export type TeamWorksOperationsFeatureSettings = {
  // 既存6キーはそのまま
  workWindow: TeamWorksWorkWindowSettings;
};

export const DEFAULT_WORK_WINDOW_SETTINGS: TeamWorksWorkWindowSettings = {
  zoom: true, presence: true, timer: false, roster: true, manualLink: true
  // ★timer以外は全true = アリサの現行レッスンコンソールと完全一致
};
```

- resolve関数で `workWindow` 欠落（既存保存分・null）→ DEFAULT に落とす。
  `attendance=false → workWindow.roster=false`、`manuals=false → workWindow.manualLink=false` の
  依存もresolveで吸収。
- `TeamWorksPartnerLessonConsole` に settings を渡し、各ブロックを出し分け:
  - `zoom=false`: Zoomボタン・Zoom変更UI非表示
  - `presence=false`: スタンバイ/終了ボタン非表示（状態表示も出さない）
  - `roster=false`: 名簿パネル非表示（「名簿はまだ設定されていません」も出さない）
  - `manualLink=false`: マニュアル表示部を非表示（マニュアルタブ自体は既存 `manuals` の管轄）
  - 全部品false: スケジュール行の「レッスン画面」導線を隠す（N-1）。報告導線は `reports` の管轄で不変
- 設定UI（機能とポータルの設定タブ）: 「この事業で使う機能」の下に
  **「作業窓（スタッフの作業画面）」**グループを新設し、5項目を既存 `FeatureCheck` で並べる
  （ネストの新デザインは作らない。グループ見出し＝`PortalFeatureHeading` 流用）。
  各項目に「誰のどの画面に出るか」タグを付ける（全てスタッフ＝GREEN、rosterのみクライアント連動の注記）。

### N-3. 作業窓のラベル（呼び名）設定

`lib/team-works-labels.ts` の `TeamWorksLabels` に3キー追加（組織単位・既存の作法どおり）:

```ts
sessionNoun: string;  // コマの呼び名。DEFAULT "レッスン" ／ GENERAL_PURPOSE "作業"
startAction: string;  // 開始ボタン。 DEFAULT "スタンバイ" ／ GENERAL_PURPOSE "作業開始"
endAction: string;    // 終了ボタン。 DEFAULT "レッスン終了" ／ GENERAL_PURPOSE "作業終了"
```

- 企業設定ページの「表示ラベル設定」に3入力を追加（例のプレースホルダ:
  出勤/退勤、開始/終了、レッスン/勤務）。
- `TeamWorksPartnerLessonConsole`・スケジュール行・通知文言（「本部へスタンバイを通知しました」等）・
  本部側の「只今のレッスン状況」見出し・presenceラベル（`standby: "スタンバイ"`等）を
  ラベル参照に置き換える。**DEFAULTが現行文言と一字一句同じであることを必ず確認**
  （アリサは何も変わらない）。
- 置換箇所が多いので、`useTeamWorksLabels` から返る値をそのまま使い、文言の組み立ては
  `` `${labels.startAction}前に戻しました。` `` のようにテンプレート化する。

### N-4. コマの「作業内容」欄（migration 1本・このPhase唯一のmigration）

```sql
-- 20260731XXXXXX_team_works_session_work_description.sql
alter table public.team_works_op_sessions
  add column if not exists work_description text;
alter table public.team_works_op_schedule_rules
  add column if not exists work_description text;
```

（★rulesテーブルの実名はSonnetが実装時に確認すること。週次パターン→コマ生成時に
ルールの値をコマへコピーする）

- 本部のコマ作成UI（`ProjectCalendarPanel` の追加フォーム・週次パターン）に
  「作業内容（任意）」の1行入力を追加。コマ詳細（ScheduleTab）でも編集可。
- 表示: スタッフポータルのスケジュール行・作業窓ヘッダ・本部のスケジュール一覧・
  クライアントカレンダー（lessons=trueの組織のみ）に、値があるときだけ表示。
- 未入力なら一切表示しない＝アリサ不変。ジェネレーター（`generateSessionsForProject`）は
  ルールに値があればコマへコピー、無ければnull。

### N-5. タイマー（opt-in・migration不要）

- `workWindow.timer=true` のときだけ、作業窓に経過時間を表示:
  `partner_presence_status` が standby/in_progress の間、`partner_standby_at` からの経過を
  `HH:MM:SS` でクライアント側集計（1秒interval、`document.visibilityState`考慮は不要の軽さでよい）。
  ended後は `partner_ended_at - partner_standby_at` の確定値を表示。
- サーバ側の追加記録はしない（プレゼンスのタイムスタンプが既にある）。
  「出勤簿」的な集計・エクスポートは今回のスコープ外（§5の将来アイデアに残す）。

### 完了条件（Phase N）
- lessons=falseでもスタッフポータルに予定が表示される（テスト事業で確認した問題の解消）
- 作業窓の5部品が設定で個別にON/OFFでき、全OFFなら作業窓導線ごと消える
- ラベル3種を変えると、スタッフポータルのボタン・通知・見出しが一貫して変わる
- コマに作業内容を書くと、本部・スタッフ（・lessons=trueならクライアント）に表示される
- timer=trueで経過タイマーが出る。アリサ（全設定null）は文言・画面とも現状と完全一致
- migrationはN-4の1本のみ。RLS変更なし
- `npm run lint` 通過

---

## 4. アリサ安全チェック（受け入れテスト）

アリサ相当（label_settings / feature_settings とも null）で:

1. スタッフポータル: スケジュール・レッスン画面・スタンバイ/レッスン終了ボタン・Zoom・名簿・
   マニュアル連動すべて現状どおり。タイマーは**出ない**
2. 文言: 「スタンバイ」「レッスン終了」「本部へスタンバイを通知しました」等が一字一句不変
3. クライアントポータル: カレンダー・名簿・メッセージ現状どおり。説明ブロックは説明未入力なら出ない
4. 本部: スケジュール・コマ作成に「作業内容」欄が増える（空なら挙動不変）。
   機能とポータルの設定に「作業窓」グループが増える（全ON表示・保存しなければ無変化）
5. 納品型: 設定タブに説明欄が増える以外、プレビューの場所移動のみ

---

## 5. スコープ外（将来アイデア・今回はやらない）

1. **出勤簿・稼働集計**: presenceタイムスタンプから月次の稼働時間を集計してFINANCE（時給×稼働）へ
   つなげる。§3.5の請求・報酬復活とセットでやると効く
2. 資料の編集・並び替えUI（今回は追加＋アーカイブのみ）
3. 作業窓部品のプロジェクト単位ラベル上書き（ラベルは組織単位で十分か様子見）
4. クライアントタスク（名簿）の「タスク」への一般化（名簿=人前提を外す）— 大工事なので
   実需要が出てから

---

## 6. 進める順番と約束事

```
Fable: この計画書 ← 今ここ
  ↓
Sonnet: Phase M（M-1→M-2→M-3、コミット1〜3個）→ lint → コミット
  ↓
Sonnet: Phase N（N-1→N-2→N-3→N-4→N-5、Phaseごとにコミット）→ lint
  （N-4のmigrationはあゆみにSQL Editor実行を依頼。自動実行しない）
  ↓
あゆみ: 実機確認（テスト事業でlessons OFF→予定が見えること、作業窓ON/OFF、ラベル変更）
```

**触ってはいけないもの（継承）**:
1. シフト・コマ生成・オファーのロジック本体／RLS／`team_works_find_active_member`
2. 他セッションのファイル（ai-office/ Story/ Academy/ globals.css 等）。`git add -A` 禁止
3. 色は役割トークンのみ。新しい見た目を発明しない（FeatureCheck/PortalFeatureHeading/
   MikkeSection等の既存部品を流用）
4. 黙って失敗する処理を作らない。必ず日本語メッセージ
5. migrationはN-4の1本のみ。書けたらあゆみに実行を依頼
6. DEFAULT値は必ず「アリサの現行表示と完全一致」。迷ったら現状維持側に倒す
7. migrationのタイムスタンプは `ls supabase/migrations/` で最新を確認してから採番
   （Academy側と並走中。前回 `20260731120000` が衝突して `130000` にずらした）
