# Team Works ホーム3状態化＋組織カスタマイズ計画（2026-07-30）

対象: Team Works 本部側ホーム（運営型/納品型の共存）＋企業設定（組織カスタマイズ）
実装者: Sonnet
計画者: Fable（モックはあゆみ確認済みのものに従う）

前提となる計画書:
- `docs/MIKKEOS_TEAM_WORKS_DELIVERY_PLAN_2026-07-29.md`（Phase 1〜7 完了）
- `docs/MIKKEOS_TEAM_WORKS_UNIFY_PLAN_2026-07-30.md`（Phase A〜F 完了）

承認済みモック: `docs/mockups/team-works-home-tabs-mock_2026-07-30.html`
（ブラウザで開くと3種類の組織状態と企業設定案を切り替えて確認できる。
実装の見た目はこのモックではなく**既存の実コンポーネントの見た目**を正とし、
モックは「構成・出し分け・文言」の指示書として使う）

---

## 0. 背景（あゆみ指摘 2026-07-30）

> ・カレンダーですべての予定を共有したい。運営型、納品型が混在して見にくい
> ・DELIVERYが重くて、そのあとカレンダーではページを開けたときに見にくい。カレンダーを冒頭に
> ・タブ切り替えはカレンダーの切り替えではなく、ページを切り替えればいい
> ・もうアリサの事業で動いているteamworksがあるから運営型のUIは動かしたくない
> ・納品ページにもNeeds attention。運営型と表示・言い回しを揃える
> ・納品、運営共にカレンダー下にプロジェクトページに飛べるリンクが欲しい
>   （現状は左メニューのプロジェクトに入って切り替えている）
> ・アリサの事業が運営型の基本になってしまっている。ラベル変更設定、休日設定を
>   細かくやらないと他の事業者が使えない。ここは整備する

**大原則: アリサの組織（運営型のみ・設定未変更）の画面は1ピクセルも変えない。**
例外は2つだけ。どちらもあゆみ了承済みの意図的変更:
1. カレンダー下のプロジェクトリンク（明示要望。運営型ホームにも出る）
2. 自動更新間隔 5秒→45秒（G-5。表示内容は不変、Supabaseクエリ消費対策）

---

## 1. 調査済みのコード事実（実装前にここを信じてよい）

| 事実 | 場所 |
|---|---|
| 「休校」文字列はハードコード | `TeamWorksMonthCalendar.tsx:138,141,193` / `TeamWorksOperationsProjectDetail.tsx:604,615` / `TeamWorksPartnerShiftPanel.tsx:153` / `school/SchoolCalendar.tsx:158` / `ClientMonthCalendar.tsx:143` |
| **土日祝はコマ登録・移動が全組織一律で不可**（アリサの業態が全組織のルールになっている） | `lib/team-works-operations-project.ts:1336-1338`（createOperationsSession）, `:1355-1357`（updateOperationsSession）。`isJapanDayOffKey` 直呼び |
| ラベル設定の器は既にある。`team_works_organizations.label_settings jsonb`（nullable）。null＝アリサ現行文言。今は `workers` キーのみ | `lib/team-works-labels.ts` / migration `20260729120000` / `useTeamWorksLabels.ts` |
| ポータル表示設定は**プロジェクト単位で実装済み**（運営型詳細の「ポータル設定」タブ、機能チェックリスト式） | `TeamWorksOperationsProjectDetail.tsx:1881` / migration `20260727100000` |
| ホームの空判定は運営型・納品型どちらか1件で通る（=納品型のみの組織には空の運営UIが並ぶ） | `TeamWorksOperationsDashboard.tsx:97` `hasAnyProject` |
| 納品型ホーム集計は横断関数が既にある | `lib/team-works-delivery-home.ts` `loadDeliveryHomeSummary` |
| 企業設定ページの現状: 企業情報／運用日の設定／本部メンバー招待／組織メンバーのみ。ラベル設定UIは無い | `app/apps/team-works/settings/page.tsx` |
| ホームとプロジェクト詳細は**5秒間隔**で全データを再取得している。納品ホーム集計はプロジェクト数×4〜5クエリなので、開きっぱなしでSupabaseクエリを大量消費する | `TeamWorksOperationsDashboard.tsx:63` / `TeamWorksOperationsProjectDetail.tsx:146`（どちらも setInterval 5000） |
| 納品ホーム集計の「今日」は**UTC判定**（日本時間の朝9時まで前日扱い＝期日・期限超過が朝だけ1日ずれる） | `lib/team-works-delivery-home.ts:45` `toISOString().slice(0,10)` |
| **報酬・請求（payout/invoice）機能は実装済みなのに休眠中**。旧localStorage版詳細のfinanceタブにしか無く、Supabase版（運営型9タブ／納品型6タブ）から到達不能。ホームのFINANCEカードが常に「未設定」なのはこのため | `components/team-works/projects/TeamWorksProjectFinance.tsx` / `lib/team-works-project-finance.ts` / 到達経路は `TeamWorksOperationsProjectDetail.tsx:169` のフォールバックのみ |
| ポータル表示設定が細かく切り替えられるのは**運営型のみ**。納品型は「クライアント公開」ON/OFFだけ | `TeamWorksOperationsProjectDetail.tsx:1881`（運営型タブ）／納品型はプロジェクト設定内のトグルのみ |

### 未コミットの先行差分（このセッションで発生済み・Phase Gに含めてコミットする）

同じ工程の提出期日と完了期日が同日の場合に「今後の期日」を1行にまとめる修正
（`kind: "both"` → 表示「提出・完了期日」）。lint通過済み。

- `lib/team-works-delivery-home.ts`（16行）
- `components/team-works/operations/TeamWorksDeliveryHomeSection.tsx`（2行）
- `components/team-works/operations/TeamWorksScheduleList.tsx`（2行）

---

## 2. Phase G: ホームの3状態化とページタブ

### G-1. 3状態の判定

```
運営型あり × 納品型なし → タブなし。現行の運営ダッシュボードのみ（アリサ）
運営型あり × 納品型あり → ページタブ [運営] [納品]。初期表示は運営
運営型なし × 納品型あり → タブなし。納品ダッシュボードのみ
両方なし             → 現行の FirstOperationsProjectSetup（変更しない）
```

- `TeamWorksOperationsDashboard` の `hasAnyProject` 判定部を上の4分岐に差し替える。
- **運営ダッシュボードの中身（レンダリング順・コンポーネント）は変えない。**
  タブは運営ダッシュボードの外側（ラッパー）に置き、「運営型のみ」のとき
  タブnavを一切レンダリングしない（アリサはDOMも変わらない）。
- `TeamWorksDeliveryHomeSection`（ホーム上部のDELIVERY合算）は
  **納品ページへ引っ越す**。運営ページからは消える
  （運営型のみの組織では納品型0件で元々 null を返しているので表示差なし）。

### G-2. 納品ダッシュボード（新規コンポーネント）

`components/team-works/operations/TeamWorksDeliveryDashboard.tsx` を新規作成。
構成は上から（モックの「納品」タブの通り）:

```
① 月カレンダー（納品期日）        ← 冒頭に置くのが今回の主目的
   ＋右レールに FINANCE / MESSAGES（運営ホームと同じ配置・同じカード）
② カレンダー下: プロジェクトリンク（G-4）
③ NEEDS ATTENTION（運営型と同じ見出し・言い回し）
   - 件数3箱: クライアント待ち / 本部確認待ち / 期限超過
   - 対応が必要なこと一覧（各行から該当工程へ）
   - 空のとき: 「対応が必要なことはありません」
     helper「期限超過・本部確認待ち・クライアント待ちの工程はありません。」
   - 区切り線の下に「今後の期日（n件）」＋すべて見る
     （TeamWorksDeliveryHomeSection の中身をここへ移植・分解してよい）
```

- データは既存の `loadDeliveryHomeSummary` を使う。カレンダー用の日付展開は
  `loadDeliveryCalendarTasks`（`lib/team-works-delivery.ts`、横断取得可）を使う。
- カレンダーの見た目は Phase E で運営型に近似させた納品カレンダーの作法を踏襲。
  同日の提出=完了は1チップ（Phase Eの規則）。
- `FinanceCard` / `MessagesCard` は `TeamWorksOperationsDashboard.tsx` 内の
  ローカル関数。**中身は1行も変えず** export を付けて共有するか、
  `TeamWorksHomeCards.tsx` に切り出す（切り出す場合も JSX は移動のみ）。
- 希望シフト・TODAY・只今のレッスン状況は納品ページに**出さない**。

### G-3. タブUI

- 見出し下に下線タブ（運営型プロジェクト詳細のタブnavと同じ className を流用。
  新しい見た目を発明しない）。ラベルは「運営」「納品」。
- `?home=delivery` クエリで納品タブを直接開ける（`useSearchParams`）。
  タブ切替でクエリを replace する。
- タブ選択は再読み込みしても保てるよう URL を正とする。

### G-4. カレンダー下のプロジェクトリンク（運営・納品 共通）

- カレンダーカードの凡例の下に区切り線＋
  `プロジェクト（n件）` ラベル＋プロジェクト名のピル（クリックで
  `/apps/team-works/projects/{id}` へ）＋右端に「プロジェクト管理へ ›」。
- 運営側は `TeamWorksOperationsDashboard` のカレンダーカード直下に追加。
  **これはアリサ画面にも出る意図的変更**（あゆみ要望）。追加のみで
  既存要素の位置・並びは変えない。
- ピルの色ドットはカレンダー凡例と同じプロジェクト色を使う。

### G-5. 動作の軽量化と日付判定の修正（同じPhaseでやる小修正）

- ポーリング間隔を 5秒 → **45秒** に変更し、`document.visibilityState === "hidden"`
  のあいだはスキップする。対象は `TeamWorksOperationsDashboard.tsx:63` と
  `TeamWorksOperationsProjectDetail.tsx:146` の2箇所。間隔は定数
  `TEAM_WORKS_POLL_INTERVAL_MS` に切り出し、戻したくなったら1行で戻せるようにする。
  **アリサ画面にも効く変更**だが表示は不変（自動更新がゆっくりになるだけ）。
- `lib/team-works-delivery-home.ts:45` の `toISOString().slice(0,10)` を
  ローカル日付キー（`formatDateKey` と同じ組み立て）に修正。

### 変更対象
- `components/team-works/operations/TeamWorksOperationsDashboard.tsx`
  （3状態分岐・タブラッパー・DeliveryHomeSection撤去・プロジェクトリンク追加・カード export・G-5）
- `components/team-works/operations/TeamWorksDeliveryDashboard.tsx`（新規）
- `components/team-works/operations/TeamWorksDeliveryHomeSection.tsx`（移植後に整理 or 廃止）
- `components/team-works/operations/TeamWorksOperationsProjectDetail.tsx`（G-5のポーリングのみ）
- `lib/team-works-delivery-home.ts`（G-5のUTC修正）
- 先行差分3ファイル（§1）を含める

### 完了条件
- 運営型のみの組織: タブが出ず、DOM構成が現行と一致（プロジェクトリンク追加を除く）
- 両方ある組織: タブで切替、納品タブはカレンダー冒頭・希望シフト非表示
- 納品型のみの組織: タブなしで納品ダッシュボードが出る。空の運営UI（空カレンダー・
  空シフト・空TODAY）が出ない
- `?home=delivery` で直接開ける
- `npm run lint` 通過

---

## 3. Phase H: 組織カスタマイズ（ラベル・休日）

### H-1. 表示ラベルの拡張（migration不要）

`lib/team-works-labels.ts` の `TeamWorksLabels` に `holidayLabel: string` を追加。

```ts
DEFAULT_LABELS         = { workers: "パートナー", holidayLabel: "休校" }
GENERAL_PURPOSE_LABELS = { workers: "スタッフ",   holidayLabel: "休校" }
```

ファイル冒頭の注記通り**両方に追加**すること。null／キー欠落は
`resolveTeamWorksLabels` のスプレッドで自動的に「休校」になる＝アリサ影響なし。

「休校」直書きを `labels.holidayLabel` に置換する箇所（§1の一覧）:
- `TeamWorksMonthCalendar.tsx:138,141,193`
- `TeamWorksOperationsProjectDetail.tsx:604,615`（615は「◯◯日」の形）
- `TeamWorksPartnerShiftPanel.tsx:153`
- `school/SchoolCalendar.tsx:158`
- `ClientMonthCalendar.tsx:143`

祝日は従来どおり祝日名（japanDayOff.label）を優先表示し、
土日などラベルが無い休みだけ `holidayLabel` を出す（現行ロジック維持）。
ポータル側（SchoolCalendar / ClientMonthCalendar / PartnerShiftPanel）にも
ラベルを渡す経路が必要。各コンポーネントの既存 props 取得経路を確認し、
`useTeamWorksLabels` が使えるならそれを使う（ポータルは組織コンテキストが
異なる場合があるため、実装時に hook の組織解決を確認すること）。

### H-2. 休日設定（migration 1本のみ・組織デフォルト＋プロジェクト上書き）

**設定の置き場所の方針（あゆみ確認 2026-07-30）:**

| 設定 | 置き場所 | 理由 |
|---|---|---|
| 表示ラベル（呼び名） | **組織のみ** | サイドバー「◯◯管理」など組織共通画面で使うため。プロジェクトごとに変えると同じ画面内で呼び名が揺れる |
| 休日設定 | **組織デフォルト＋運営型プロジェクトで上書き可** | 校舎・店舗ごとに休みが違い得る（例: インドネシア校とスリランカ校で現地事情が違う、店舗ごとの定休日） |
| ポータル表示 | **プロジェクトのみ**（運営型は実装済み） | 既存の「ポータル設定」タブが正。組織レベルは作らない |

新カラム（**1本のmigrationで両方追加**。nullable・DEFAULTなし。
`label_settings` と同じ作法。既存行=null=現行動作）:
- `team_works_organizations.operation_settings jsonb`
- `team_works_projects.operation_settings jsonb`（運営型の上書き用）

```ts
type TeamWorksOperationSettings = {
  closedWeekdays: number[];          // 0=日〜6=土。デフォルト [0,6]
  closeOnNationalHolidays: boolean;  // デフォルト true
  customClosedDates: string[];       // "YYYY-MM-DD"。デフォルト []
};
// null → { closedWeekdays:[0,6], closeOnNationalHolidays:true, customClosedDates:[] }
//        ＝現行の「土日祝は休み」と完全に同じ
```

- `lib/team-works-operation-settings.ts` を新規作成（labels と同じ構造:
  DEFAULT / resolve / load）。判定関数 `isClosedDayKey(settings, dateKey)` を置く。
  解決順は **プロジェクト設定 ?? 組織設定 ?? デフォルト（土日祝）**。
- `lib/team-works-operations-project.ts:1336,1355` の `isJapanDayOffKey` 直呼びを
  `isClosedDayKey` に差し替え。エラーメッセージは
  「{holidayLabel}日のため、レッスンを登録できません。」の形にラベル反映。
- プロジェクト上書きUI（**H-2b・別コミットでよい**）: 運営型の「プロジェクト設定」
  タブに折りたたみパネル「このプロジェクトだけの休日」を追加。未設定のときは
  「組織の休日設定に従っています」と明示し、上書きを始める/やめるを切り替えられる。
  納品型には出さない（休日概念が無いため）。
- カレンダーの休日色（`holidayDates` / japanDayOff 由来の着色）も同じ判定に
  揃える。**祝日名の表示は維持**（祝日を休みにしない組織では色を付けず
  祝日名だけ小さく出す、が理想。難しければ祝日名表示は現状維持で色だけ制御）。
- セッション自動生成・シフト系のロジックには**触らない**（週次パターンが
  休日曜日を指す場合の挙動は現行のまま。登録時ブロックだけ設定に従う）。

### H-3. 企業設定ページにUI追加

`app/apps/team-works/settings/page.tsx` に2セクション追加（モックの通り。
既存セクションは触らない）:

1. **表示ラベル設定**: 働く人の呼び名（workers）／休みの日の呼び名（holidayLabel）。
   テキスト2つ＋例示。保存は `label_settings` の update。
2. **休日設定**: 定休の曜日チップ（7個）／祝日を休みにするチェック／
   個別の休業日（date追加・一覧・削除）。保存は `operation_settings` の update。
   説明文「休みの日はカレンダーに色付きで表示され、コマ（レッスン）の登録が
   できなくなります。」
3. **ポータル表示設定は案内カードのみ**: 「プロジェクト管理 → 対象プロジェクト →
   ポータル設定タブ」への導線を示す。組織レベルの新設はしない（既存の
   プロジェクト単位設定が正）。文言は「運営型はポータル設定タブで細かく切替可、
   納品型は今はクライアント公開のON/OFFのみ」と正確に書く（モック文言に合わせる）。

保存後は必ず日本語の完了メッセージ。RLS: organizations の update は
既存の企業情報保存と同じ経路なので変更不要のはず（実装時に確認）。

### 完了条件
- label_settings が null の組織（アリサ）: 表示は全画面で現行と同一
- 呼び名を変えると「◯◯管理」「◯◯希望シフト」「休校→◯◯」が全画面で変わる
- 休日設定を「日曜のみ休み」にすると、土曜にコマ登録ができ、カレンダーの
  土曜の色付けが消える。null のままなら土日祝ブロックが現行どおり
- migration は `operation_settings` 追加の1本のみ
- `npm run lint` 通過

---

## 3.5 Phase I 候補（今回はやらない。あゆみの判断待ち・優先度順）

2026-07-30の全体点検で見つかった「次にやる価値があるもの」。**この計画書の
スコープ外**。着手する場合は別途計画書を起こす。

1. **FINANCE（報酬・請求）の復活** ★リターン最大。
   payout/invoice の仕組み（金額・状態管理・タスク紐付け）は
   `TeamWorksProjectFinance.tsx` に実装済みだが、旧localStorage版にしか
   繋がっておらず休眠中。Supabaseテーブル化（新テーブル＋RLSが必要）して
   運営型・納品型の詳細タブとホームのFINANCEカードに接続すれば、
   「未設定」のままのFINANCEカードが初めて生きる。
2. **メンバーを外す**: `team_works_project_members` にDELETE用RLSポリシーを
   1本追加＋メンバータブにUI。人が辞めたときに現状は外せない。
3. **納品型のポータル設定タブ**: クライアント公開ON/OFFしかないので、
   運営型と同じチェックリスト式に揃える（必要になったら）。
4. **納品型のメッセージタブ**: `team_works_project_comments` 基盤は
   差し戻し理由で使用中。タブとして出すだけの状態。
5. **通知**: 現状メール通知ゼロ（招待リンクは手動送付、提出・承認は
   ポータルを開かないと気づけない）。まずはアプリ内バッジ強化で足りる想定。
   メールが要るなら mikkeruu の Edge Function 資産（Resend送信）を流用できる。

## 4. アリサ安全チェック（受け入れテスト・最重要）

アリサ相当の状態（運営型のみ・label_settings null・operation_settings null）で:

1. ホームにタブが出ない。セクションの並びが現行と同じ
   （只今のレッスン状況→カレンダー→希望シフト→TODAY→NEEDS ATTENTION→今後）
2. カレンダー下にプロジェクトリンクが**追加されている**（意図的変更その1）
2-b. 自動更新が5秒→45秒になっている（意図的変更その2。表示内容は不変）
3. 「休校」「パートナー」の文言がすべて現行のまま
4. 土日祝のコマ登録ブロックが現行のまま動く
5. クライアント/パートナーポータルの表示が現行のまま
6. 企業設定を開いても、新セクションに初期値が表示されるだけ（保存しない限り無変化）

---

## 5. 触ってはいけないもの（前計画から継承）

1. 運営型のシフト・コマ生成・オファーのロジック（登録時の休日判定差し替えを除く）
2. RLSポリシー
3. `team_works_find_active_member` RPC
4. 他セッションのファイル: `ai-office/`, `mikkeos/StoryProfile`, `app/globals.css`,
   `app/story/`, `app/marketnote/` など
5. 運営型の新規作成フォーム

## 6. Sonnetへの約束事（継承）

1. 正典 `docs/MIKKEOS_EDITORIAL_UI_DESIGN_RULES.md` を読む。色は役割トークンのみ
2. 見た目は既存コンポーネントの className を流用。新しい見た目を発明しない
3. migration は §3 H-2 の1本のみ。RLS変更・新規テーブル禁止
4. `npm run lint`（`tsc --noEmit`）通過
5. コミットは Team Works 関連ファイルのみ選別（`git add -A` 禁止）。
   Phase G / Phase H で分けてコミット。§1 の先行差分3ファイルは Phase G に含める
6. 黙って失敗する処理を作らない。必ず日本語メッセージ
7. `.next` が壊れて全ルート404になったら `rm -rf .next` して再起動

## 7. 進める順番

```
モック承認（あゆみ） ✅ 2026-07-30
      ↓
Phase G（ホーム3状態化・納品ダッシュボード・プロジェクトリンク） ✅実装完了(Sonnet, 2026-07-30)
      ↓ ここで一度あゆみ実機確認 ← ★今ここ
Phase H（ラベル・休日設定） ✅実装完了(Sonnet, 2026-07-30)
      ↓ アリサ安全チェック（§4）を通しで実施 ← ★未実施(実機ログイン確認が必要)
完了
```

---

## 8. 実装メモ・当初計画からの変更点(2026-07-30・Sonnet)

- **migrationは未実行。** `supabase/migrations/20260730120000_team_works_operation_settings.sql`
  を作成したが、このリポジトリの運用ではmigrationはあゆみがSupabase SQL Editorで
  手動実行する(過去のPhaseと同じ)。実行前でも新カラムを参照するクエリはエラー時に
  必ずデフォルト値へフォールバックする設計にしてあるため、**未実行の間はアプリの
  動作・表示は一切変わらない**(=先にコードだけデプロイしても壊れない)。
  ラベル設定・休日設定の「保存」ボタンだけは、migration未実行だとエラーになる
  (保存しようとして初めて気づく形。日本語のエラーメッセージは出るがやや技術的)。
- **customClosedDatesは実装しなかった。** 当初案では組織の休日設定に個別の休業日
  リストを持たせる予定だったが、調査の結果 `team_works_holidays` テーブル
  (組織/プロジェクト単位・migration不要で既存)が既にこの用途で存在し、カレンダー
  表示にも使われていた。重複させず、`TeamWorksOperationSettings` は
  `closedWeekdays` と `closeOnNationalHolidays` の2項目のみにした。
- **H-2の適用範囲は「登録時のブロック」と「ホーム/スケジュール管理の表示フィルタ」
  まで。** `generateSessionsForProject`(週次パターン→コマ自動生成、
  `lib/team-works-operations.ts`)は計画通り触っていない。一方、
  `loadOperationsDashboardData` / `loadOperationsScheduleGroups` の表示フィルタと
  `TeamWorksMonthCalendar` の休日色分けは、登録時ブロックと矛盾しないよう
  settings対応させた(でないと「土曜に登録できたのにカレンダーには出ない」という
  壊れ方をする)。
  **未対応で残っているのはプロジェクト詳細内の `ProjectCalendarPanel`**
  (`TeamWorksOperationsProjectDetail.tsx` の「予定を追加」フォームの出し分け)。
  ここだけは土日祝ベースの表示のまま。次にこの計画を触るセッションで直すこと。
- **H-2bのプロジェクト単位の上書きUIは作っていない。** データ層
  (`team_works_projects.operation_settings` 列・`resolveEffectiveOperationSettings`)
  は用意済みで、直接値を入れれば効く。企業設定ページの「休日設定」説明文に
  「プロジェクト設定タブで上書きできます」と書いてあるが、**そのタブ自体はまだ無い**。
  文言と実態がずれているので、UIを作るまでは注意。
- **副産物として見つけたもの**: `TeamWorksOperationsProjectDetail.tsx` の中に
  `PayoutsTab` / `InvoicesTab` / `FinanceSummary` という報酬・請求機能一式が
  既にコードとして存在するが、`buildTabs()` にも `activeTab === ...` の描画分岐にも
  入っておらず、**一度も画面に出ない状態**だった。Phase I候補1「FINANCE復活」の
  難度が想定より低い可能性がある(UIは書いてあるので、Supabaseテーブル化と
  配線だけで済むかもしれない)。次にFINANCEをやるセッションはまずここを見ること。
- **未コミットの先行差分(同日期日1行まとめ)はPhase Gに含めてある。**
  `lib/team-works-delivery-home.ts` / `TeamWorksScheduleList.tsx` / (削除済みの
  `TeamWorksDeliveryHomeSection.tsx`)。あわせて、同じ「toISOString()がUTC」バグが
  `lib/team-works-delivery-summary.ts`(`buildStaffPendingSummary`の期限超過判定)
  にも見つかったため、G-5のついでに直した(計画外だが同種・低リスクの1行修正)。
- **`npm run lint`(tsc --noEmit)は通過。** ブラウザでの実機確認は未実施
  (別セッションがこのフォルダのdevサーバーを使用中だったため)。次のあゆみ確認で
  §4のアリサ安全チェックを通しでやること。
