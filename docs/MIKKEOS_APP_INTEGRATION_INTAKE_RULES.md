# mikkeOS App Integration Intake Rules

作成日: 2026-07-09

このdocsは、別ラインで実装されている MarketNote / Team Works / Academy / Community などのアプリを、後からmikkeOS本体へ合流させる時の受け入れルールです。

目的は、今すぐSupabase本接続することではありません。各アプリを後から Activity Log / Story / DESK / OS Home へ接続する時に、情報の扱いがブレないようにするための確認表です。

重要: 今回はdocs作成のみです。通常表示のSupabase本接続、各アプリ保存の一斉Supabase化、DBマイグレーション、RLS / policy / constraint変更、Order / Team Works / MarketNote / Academy / Community 本体の実装変更は行いません。

## 1. 前提

- 各アプリは単体実装を先に進めてよい。
- ただし、mikkeOSへ接続する時はActivity Log変換ルールに従う。
- OS側の通常表示・DB・RLS・マイグレーションは勝手に変更しない。
- mikkeOSの中心は `Mikke ID + Activity Log` であり、Story / DESK / OS Home はActivity Logから派生する表示面として扱う。
- 別ラインのアプリは、まず raw event / app event を残し、後から `activity_logs` へ変換できる形を保つ。
- Storyは公開Activity Log一覧ではなく、本人が編集・選択する名刺・自己紹介・ミニホームページ・活動ポートフォリオとして扱う。

## 2. 合流前に確認すること

各アプリをmikkeOSへ合流させる前に、最低限以下を確認します。

```text
主要レコードに一意のIDがあるか
user_id または organization_id を持てるか
source_service を決めているか
source_record_id に使える値があるか
Story素材にできる情報と出せない情報が分かれているか
金額ログが分離されているか
顧客/受講者/生徒/会員など個人情報がStoryに出ない設計か
売上・経費・報酬・請求がDESKへ変換できるか
活動実績に数える操作が定義されているか
raw event / app event から activity_logs へ変換できるか
```

追加で確認したいこと:

- 同じ操作を二重にActivity Log化しないための `source_record_id` または `idempotency_key` を持てるか。
- `occurred_at` と `created_at` のどちらを活動発生日として使うか。
- アプリ内部の詳細レコードと、Activity Logに出す要約ログを分けられるか。
- Story候補のログでも、初期値を `private` または `limited` にできるか。
- 金額ログを `private` / Story非対象 / 活動実績対象外として扱えるか。

## 3. Activity Logへ変換する前の確認

操作単位で、以下を確認してから `activity_logs` へ変換します。

```text
この操作はStory素材候補か
この操作はDESK対象か
この操作は活動実績対象か
金額ログか
公開可能か
個人情報を含むか
重複保存を防ぐsource_record_idがあるか
```

変換時に明示する主な項目:

```text
source_service
source_record_id
activity_type
category
title
visibility
display_on_story
counts_toward_summary
has_financial_value
amount
transaction_type
payment_status
occurred_at
```

特に、`visibility` / `display_on_story` / `counts_toward_summary` / `has_financial_value` / `transaction_type` / `payment_status` はDB default任せにせず、アプリ側のadapterで明示します。

## 4. 各アプリ別の合流注意点

### MarketNote

- 出店予定・売上・経費・振り返りを分ける。
- 出店予定はStoryへ自動表示しない。
- 出店実績数などの集計値はStory素材候補。
- 売上 / 経費はDESK対象。
- 金額ログは `private`。
- 出店条件、内部メモ、金額詳細はStoryに直接出さない。
- 当面 `source_service: marketnote` を維持する。

### Team Works

- 授業完了・請求・報酬・授業報告を分ける。
- 生徒情報・学校情報はStory非対象。
- 請求はDESK売上。
- パートナー報酬はDESK経費または報酬支払い。
- 授業報告は内部ログとして扱い、Storyや活動実績へ直接混ぜない。
- 公開する場合は、学校名・生徒名を含まない匿名化した実績に変換する。

### Academy

- `academy_activity_events` はraw eventとして扱う。
- 講座作成・教材公開・認定完了はStory素材候補。
- 受講料・更新料はDESK対象。
- 受講者情報・課題内容はStory非対象。
- 課題評価、学習進捗、支払い詳細はStoryに直接出さない。
- raw event自体は公開せず、匿名化・要約・公開可否確認済みの `activity_logs` へ変換してからStory / DESK / OS Homeへ流す。

### Community

- 投稿 / コメントは初期ではStory非対象。
- 勉強会・イベント開催はStory素材候補。
- 会費・イベント参加費はDESK対象。
- 会員情報・内部投稿はStory非対象。
- コメント内容、会員名、支払い情報をStoryへ直接出さない。
- Academyと連動する場合も、Community側の会員・投稿・支払い情報はActivity Logへ要約変換してから扱う。

### Item Studio

- 作品登録はStory素材候補。
- Storyには本人が選んだ作品だけポートフォリオとして表示する。
- 販売記録はDESK対象。
- 在庫調整は内部ログ。
- 材料費など金額を持つログはDESK対象、Story非対象。
- Phase 4で作品登録ログと販売記録ログのSupabase保存・読み取り・分類は確認済み。

### Order

- 受注・納品・請求・入金を分ける。
- 顧客情報はStory非対象。
- 納品完了はStory素材候補。
- 請求 / 入金はDESK対象。
- 受注作成時点では `private` 初期を推奨する。
- 公開する場合は、顧客名・連絡先・金額を含まない制作実績として変換する。

### Session

- 予約・実施完了・売上を分ける。
- 顧客情報はStory非対象。
- 実施完了はStory素材候補。
- 売上はDESK対象。
- 相談内容、予約者名、連絡先、支払い情報はStoryへ直接出さない。

### Event

- イベント作成・開催完了・参加費 / 出店料を分ける。
- 申込者情報はStory非対象。
- イベント開催完了はStory素材候補。
- 参加費 / 出店料はDESK対象。
- 出店者申込や参加申込は、個人情報を含むため初期では `private` とする。
- 公開する場合は、開催実績や公開済み出店者名など、確認済みの範囲に限定する。

## 5. 合流時にまだ禁止すること

当面、以下は行いません。

```text
全アプリ一括Supabase本接続
Storyへの個人情報表示
金額ログのStory公開
予定や細かな行動履歴のStory自動公開
RLS / policy / constraint の安易な変更
DBマイグレーションの先行実施
既存localStorage導線の一括削除
```

禁止事項の理由:

- 各アプリの仕様が並行して変わるため、OS側の本接続と混ぜると原因切り分けが難しくなる。
- 個人情報、金額情報、予定、細かな行動履歴の公開事故を防ぐため、Story接続は特に慎重に進める。
- localStorage / mock導線は、Supabase移行時の比較対象としてしばらく残す。

## 6. 推奨する合流手順

以下の流れを推奨します。

```text
1. アプリ単体で機能を作る
2. raw event / app event を整理する
3. Activity Log変換ルール表に照らす
4. 1操作だけテスト保存する
5. /log で読み取り確認
6. Story / DESK / OS summary の対象判定を確認
7. 問題なければ段階的に通常導線へ接続する
```

補足:

- 最初から全操作を本接続しない。
- まずは1アプリ・1操作だけをテスト保存する。
- 保存後は `/log` で読めるかを確認する。
- 次に `/story` / `/desk` / `/os` のテスト枠で分類・集計を確認する。
- 通常表示への接続は、テスト枠での確認が済んだ後に検討する。

## 7. 関連docs

- `docs/MIKKEOS_ACTIVITY_LOG_CONVERSION_RULES.md`
- `docs/MIKKEOS_PHASE4_5_NEXT_CONNECTION_STRATEGY.md`
- `docs/MIKKEOS_PHASE4_SUPABASE_CONNECTION_TEST_SUMMARY.md`
- `docs/MIKKEOS_PHASE4_LOG_SUPABASE_READ_TEST.md`
- `docs/MIKKEOS_PHASE4_STORY_SUPABASE_READ_TEST.md`
- `docs/MIKKEOS_PHASE4_DESK_SUPABASE_READ_TEST.md`
- `docs/MIKKEOS_PHASE4_OS_SUPABASE_SUMMARY_TEST.md`
