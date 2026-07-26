# Team Works 継続業務モード「日本語レッスン現場」実戦投入プラン

作成: 2026-07-24 / 計画: Opus / 実装: Sonnet（1機能=1実装者）
背景: あゆみが Team Works を最優先で「皆に使ってもらえる」状態にしたい。第一目標は**日本語レッスンの現場（アリサ運用）で実際に使う**こと。

## 0. 設計方針（他業態を締め出さない線引き）

Team Works は既に「汎用データ＋ラベル設定＋機能フラグ＋テンプレート」で業種を切り替える設計。日本語学校の完成形を作っても、次の3原則を守れば他業態は締め出さない:

1. **コード・データは中立な言葉**（group / holiday / roster / progress。"日本語レッスン"を埋め込まない）
2. **業種色はラベルで**（画面表示は「グループ」「会話パートナー」でOK、内部は汎用）
3. **学校特有の挙動は機能フラグで任意化**（グループ・休講・出席順・自動進行など）

アリサ要望の機能（月カレンダー・出席簿づくり・グループ・休講・進捗番号・順番割当）は、繰り返し人が稼働する業務全般に効く汎用機能。日本語学校っぽいのは"言葉"だけ。

## 1. 確定した現場フロー（あゆみ/アリサ 2026-07-24）

**学校側**
- 生徒登録時に**自由にグループ分け**（生徒数増加に備える。グループ名リネーム可）
- トップ＝**月間カレンダー**。各日にその日のコマ（開始時間）を一覧表示。3コマなら開始時間3つ。
- 日付クリックで**休講登録**。
- コマ（開始時間）クリック→ **Zoom開始 / 出席簿 / 担当パートナー表示**。
- **出席簿ビルダー**: 登録済み生徒一覧にチェックボックス。出席する生徒に☑を入れると、**クリックした順に①②③と番号が振られる**。→確認→**それがそのコマの名簿＝レッスンを受ける順番**として保存。

**パートナー側**
- Zoom開始→ **左にZoom・右に生徒名簿（①②③順）**。
- 名簿の**名前をクリックすると、その生徒に合ったマニュアル**（教材/質問/表現）が出る。
- **レッスン時間＋1人あたりの割り当て時間**（総時間÷人数。①②③順に受講）を表示。
- **進捗番号は授業ごとに自動+1**（＝現状の「報告で自動進行」ロジックが既にこれ）＋**手動修正**可。

## 2. 現状との差分（＝ゼロからではない）

既存（データ&ロジックあり）:
- 授業 session（日時/zoomUrl/担当worker/状態）※今は**リスト表示**。カレンダーではない。
- 出席 AttendanceEntry（sessionId/participantId/status/note）※**順番なし**。
- 生徒 participant（level/cautions/**currentGuideItemId=進捗テーマ**/lastGuideItemId）。
- テーマ guideItem（number/title/materialUrl/questions/expressions/cautions）。
- パートナー画面 WorkerPortalView（Zoom起動/名簿/選択生徒のガイド/報告）※単一縦画面。
- **進捗自動進行**: ReportsView で報告提出時に currentGuideItemId を次の番号へ自動更新（TeamWorksScreen ~1129-1156）。手動修正は生徒フォームで可能。

保存: 継続業務モードは **localStorage**（TeamWorksScreen が storageKey で load/save、teamWorksInitialState が seed、normalizeState が後方互換）。Supabase接続は後フェーズ。

## 3. データモデル追加（既存を壊さない・normalizeStateで後方互換）

```text
TeamWorksGroup { id, organizationId, clientId, name }      // 学校内の自由グループ
TeamWorksParticipant.groupId?: string                      // 生徒の所属グループ（任意）
TeamWorksHoliday { id, organizationId, clientId?, date, memo? }  // 休講（clientId無し=全校）
AttendanceEntry.orderIndex?: number                        // ①②③ 受講順（学校が出席簿ビルダーで設定）
TeamWorksState: groups: [], holidays: []                   // 追加。旧データは normalizeState で [] 補完
```

進捗/1人あたり時間は導出値（DB変更不要）: 1人あたり = session.durationMinutes ÷ 出席人数。

## 4. フェーズ（各完了ごとに lint＋実測＋コミット可能単位）

大きい新ビューは**新規ファイル** `components/team-works/school/*` に置き、TeamWorksScreen からは委譲（1978行へ直接足さない）。

- **Phase 1（土台）**: Group 型/state/normalize、participant.groupId。生徒登録UIにグループ選択＋グループ作成・リネーム（設定的UI）。既存 ParticipantsView を拡張または隣に追加。
- **Phase 2（月カレンダー・共通）**: 新規カレンダー（MarketNote `components/marketnote/HomeCalendar.tsx` を参考）を**再利用可能な共通コンポーネント**として作る。各日にコマ（開始時間）表示、休講日マーク、日付クリックで休講トグル。Holiday 型/state。まず管理者/学校側の予定画面に載せる。
- **Phase 2b（3ロールのトップに共通配置）**: 同じカレンダーコンポーネントを **管理者・パートナー・学校の各トップ画面**に共通で置く（あゆみ確定 2026-07-24）。表示するコマは役割で絞る: 管理者=全コマ / パートナー(worker)=自分の担当コマ / 学校(client)=自校のコマ。休講は全員に表示。Zoom は各自でウィンドウ配置する前提でMVP確定（真の埋め込みはしない）。
- **Phase 3（コマ詳細＋出席簿ビルダー）**: コマクリック→パネル（Zoom開始/出席簿/担当）。出席簿ビルダー: その学校の生徒一覧（グループ絞込）＋チェックボックス→クリック順①②③→確認→AttendanceEntry(orderIndex) としてそのコマに保存。
- **Phase 4（パートナー画面刷新）**: WorkerPortalView を刷新。Zoom開始で名簿（①②③順）を右／名前クリックでその生徒のマニュアル（guideItem）／レッスン時間＋1人あたり時間／進捗自動+1（既存）＋手動修正。
  - **Zoom埋め込みの現実**: Zoom会議は通常iframe埋め込み不可（X-Frame-Options/CSP。Meeting Web SDKは重い）。MVPは「Zoom開始」で別ウィンドウ/アプリ起動＋当ツールは名簿/マニュアル/タイマーの作業パネル。真の左右埋め込みは将来のZoom SDK検討。

## 5. 制約（共通）
- localStorage維持（Supabase接続は別フェーズ）。--mikke-* トークン＋共通部品。AuthGate維持（管理系）。
- 既存の継続業務ビュー・state・保存を壊さない（normalizeStateで後方互換）。
- 中立命名（generic）＋業種色はラベル。ai-office系ファイル不可触。
- 大きい新ビューは新規ファイルへ。lint(tsc)＋稼働中devサーバー実測で検証（**稼働中devに build を並行実行しない**）。コミットはあゆみ確認後。
