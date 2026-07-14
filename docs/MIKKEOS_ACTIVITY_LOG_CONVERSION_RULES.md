# mikkeOS Activity Log Conversion Rules

## WP-4 追記: 重複防止規約

DB制約やmigrationはこのWPでは変更しない。アプリ側のActivity Log変換規約として、同じ活動を二重に作らないために以下を一意キーとして扱う。

```text
source_service + source_record_id + activity_type
```

- `source_service`: 発生元アプリ。例: `marketnote`, `item_studio`, `team_works`, `fund`
- `source_record_id`: 発生元アプリ内の元レコードIDまたは安定したイベントID
- `activity_type`: 同じ元レコードから複数種類のActivity Logを作る場合の区別

同じ `source_record_id` でも、請求作成と入金確認のように意味が違うイベントは `activity_type` を分ける。逆に、同じ操作の再送・再同期ではこの3点を変えない。

Team Worksでは以下を初期規約にする。

- 授業完了: `team_works_lesson_completed`。Story候補、活動実績候補。ただし学校名・生徒名などの個人情報は出さない。
- 学校請求: `team_works_invoice_created` / `team_works_invoice_paid`。DESK対象、強制private。
- パートナー報酬: `team_works_partner_reward_recorded`。DESK対象、強制private。

FundはOrder派生アプリとして `source_service: fund` を使用する。2026-07-14の正式構想と実装計画に基づく初期変換候補は次のとおり。

- プロジェクト公開: `fund_project_published`。Story素材候補だがprivate / limited初期。
- 目標達成: `fund_goal_reached`。Story実績候補だが自動表示しない。
- 応援受付: `fund_support_recorded`。応援者情報・金額はprivate。
- 支払い確認: `fund_payment_confirmed`。DESK revenue候補、強制private。
- 提供完了: `fund_fulfillment_completed`。個人情報を含まない集計値だけStory素材候補。
- 挑戦完了: `fund_project_completed`。Fund内の「挑戦の軌跡」へのリンクをStory素材候補にできる。
- 応援者本人の参加: `fund_participation_recorded`。本人と実行者の同意後のみStory候補、初期private。

2026-07-14のF3では、上記のうち応援者本人の参加を除く5種類をlocal Activity Logへ接続した。local側でも `appKey + sourceId + eventType` を同一操作の重複防止キーとして扱う。応援者・支払いログはアダプターでも強制privateとし、Storyへ出せるのは本人が選択した `fund_project_completed` の要約リンクだけとする。

作成日: 2026-07-08

このdocsは、各アプリで発生する操作や記録を、mikkeOS共通の `activity_logs` にどう変換するかを整理するための初期ルール表です。

目的は、今後 MarketNote / Item Studio / Order / Fund / Academy / Community / Team Works / Session / Event をSupabase本接続する時に、Story / DESK / OS Home の扱いがブレないようにすることです。

Storyは公開Activity Log一覧ではなく、名刺・自己紹介・ミニホームページ・活動ポートフォリオとして扱います。このdocs内の `Story対象` は、原則として「Storyへ自動表示するログ」ではなく「本人が選べばStory Profileの数字・作品・レビュー・リンクなどに使えるStory素材候補」と読み替えます。

重要: 今回は設計docsのみです。通常表示のSupabase本接続、各アプリ保存の一斉Supabase化、DBマイグレーション、RLS / policy / constraint変更、Order / Team Works / MarketNote / Academy / Community 本体の実装変更は行いません。

Academy / Community は、別進行の認定講座構築教科書と連動して構築が始まっているため、今後のOS連携対象として優先度を少し高めに扱います。ただし、先に単体アプリとして機能することを優先し、後からActivity Logへ変換できる構造を残す方針です。

## 1. 共通判定ルール

Story素材候補のDB上の安全条件:

```text
visibility = public
display_on_story = true
```

DESK対象:

```text
has_financial_value = true
amount !== null
transaction_type = revenue または expense
```

活動実績対象:

```text
counts_toward_summary = true
```

金額集計:

```text
transaction_type = revenue -> 売上に加算
transaction_type = expense -> 経費に加算
transaction_type = none -> 金額集計しない
```

## 2. 重要な安全方針

- 金額ログは原則 `private`。
- 金額ログはStory非対象。
- 金額ログは活動実績対象外。
- 顧客情報・生徒情報・学校情報・受講者情報・会員情報・報酬・請求情報はStoryに直接出さない。
- Storyに出すのは、本人または事業者が公開してよいプロフィール情報・実績サマリー・作品・レビュー・リンクだけ。
- DESKには売上・経費・報酬・外注費・会費・更新料など金額ログを集計する。
- 個人名、連絡先、学校名、受講者名、会員名、請求先、支払い状況の詳細は、Story用ログへ混ぜない。
- Story候補の操作でも、初期値は `private` または `limited` にして、明示的な公開操作を挟む選択肢を残す。
- 予定、受注、申込、参加、授業、予約などの細かな行動ログは、本人の行動予定や生活パターンを推測できるためStoryへ自動表示しない。
- DB defaultに任せず、`visibility` / `display_on_story` / `counts_toward_summary` / `has_financial_value` / `transaction_type` / `payment_status` を保存時に明示する。
- MarketNoteは既存連携との互換のため、当面 `source_service: marketnote` を維持する。

## 3. MarketNote

| アプリ名 | 操作 / イベント名 | activity_type | category | source_service | Story対象 | DESK対象 | 活動実績対象 | has_financial_value | transaction_type | payment_status | visibility | 注意点 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MarketNote | 出店予定を追加 | market_event_created | event | marketnote | 原則いいえ | いいえ | はい候補 | false | none | not_required | private 初期 | 予定公開は行動予定の共有になるため自動表示しない。出店実績の集計値だけStory素材候補。 |
| MarketNote | 出店売上を記録 | market_revenue_recorded | event | marketnote | いいえ | はい | いいえ | true | revenue | paid | private | 金額ログ。Story・活動実績に混ぜない。 |
| MarketNote | 出店経費を記録 | market_expense_recorded | event | marketnote | いいえ | はい | いいえ | true | expense | paid | private | 材料費・出店料・交通費など。Story非対象。 |
| MarketNote | 出店振り返りを書く | market_reflection_created | event | marketnote | 候補 | いいえ | 要検討 | false | none | not_required | private 初期 | 初期はprivate。公開できる学びだけStory候補にできる。 |

## 4. Item Studio

| アプリ名 | 操作 / イベント名 | activity_type | category | source_service | Story対象 | DESK対象 | 活動実績対象 | has_financial_value | transaction_type | payment_status | visibility | 注意点 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Item Studio | 作品を登録 | item_created | product | item_studio | 素材候補 | いいえ | はい候補 | false | none | not_required | private または limited 初期 | 商品登録そのものをタイムライン表示せず、本人が選んだ作品をポートフォリオ表示する。 |
| Item Studio | 販売を記録 | item_sold | product | item_studio | いいえ | はい | いいえ | true | revenue | paid | private | Phase 4で `amount: 4800` のDESK対象確認済み。 |
| Item Studio | 在庫を追加・調整 | item_stock_adjusted | product | item_studio | いいえ | いいえ | いいえ | false | none | not_required | private | 内部管理ログ。Story / DESK / 活動実績には初期では流さない。 |
| Item Studio | 材料費を記録 | item_material_expense_recorded | product | item_studio | いいえ | はい | いいえ | true | expense | paid | private | 金額ログ。Story非対象。 |

## 5. Order

| アプリ名 | 操作 / イベント名 | activity_type | category | source_service | Story対象 | DESK対象 | 活動実績対象 | has_financial_value | transaction_type | payment_status | visibility | 注意点 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Order | 受注を追加 | order_created | order | order | いいえ | 金額ありなら候補 | いいえ | 金額ありならtrue | revenue または none | unpaid または not_required | private 初期 | 顧客情報・受注タイミングはStory非公開。依頼件数などの集計だけStory素材候補。 |
| Order | 見積を作成 | order_estimate_created | order | order | いいえ | いいえ | いいえ | false | none | not_required | private | 顧客・価格交渉情報を含むため非公開。 |
| Order | 納品完了 | order_delivered | order | order | 候補 | いいえ | はい | false | none | not_required | public または limited | 公開できる制作実績だけStory候補。金額は別ログでDESK対象。 |
| Order | 請求 / 入金 | order_payment_recorded | order | order | いいえ | はい | いいえ | true | revenue | paid または unpaid | private | 金額ログ。Story・活動実績に混ぜない。 |

## 6. Academy

Academyは、講座・教材・認定講座・受講管理・講師サイト・講座販売に関わるアプリとして扱います。

Academy側ではPhase 0後に、ローカルの変換前イベントログとして `academy_activity_events` を持つ方針が出ています。mikkeOS側ではこれを raw event として扱い、将来 `activity_logs` へ変換する入口にします。raw event自体は公開せず、Storyに出す場合は匿名化・要約・公開可否確認済みのActivity Logへ変換してから扱います。

| アプリ名 | 操作 / イベント名 | activity_type | category | source_service | Story対象 | DESK対象 | 活動実績対象 | has_financial_value | transaction_type | payment_status | visibility | 注意点 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Academy | 講座を作成 | academy_course_created | academy | academy | 素材候補 | いいえ | 候補 | false | none | not_required | private または limited 初期 | 講座作成ログを自動表示せず、公開中講座リンクや講座数の材料にする。 |
| Academy | 教材を追加 | academy_material_added | academy | academy | 候補 | いいえ | 候補 | false | none | not_required | public または limited | 公開できる教材追加だけStory候補。教材本文や購入者情報は含めない。 |
| Academy | レッスンを公開 | academy_lesson_published | academy | academy | 候補 | いいえ | 候補 | false | none | not_required | public または limited | 公開レッスンの実績として扱える。非公開教材はStory非対象。 |
| Academy | 受講申込 | academy_enrollment_received | academy | academy | いいえ | 金額ありならはい | いいえ | 金額ありならtrue | revenue または none | unpaid または paid | private | 受講者情報は非公開。金額がある場合はDESK対象。 |
| Academy | 受講開始 | academy_learning_started | academy | academy | いいえ | いいえ | いいえ | false | none | not_required | private | 受講者個人の進捗ログ。Storyには出さない。 |
| Academy | 章・レッスン完了 | academy_lesson_completed | academy | academy | いいえ | いいえ | いいえ | false | none | not_required | private | 受講者個人の進捗ログ。OS活動実績へ混ぜる場合は集計単位を別途検討。 |
| Academy | 講座販売 / 受講料入金 | academy_course_payment_recorded | academy | academy | いいえ | はい | いいえ | true | revenue | paid または unpaid | private | 金額ログ。受講者情報・支払い情報はStory非対象。 |
| Academy | 認定課題提出 | academy_assignment_submitted | academy | academy | いいえ | いいえ | いいえ | false | none | not_required | private | 内部ログ。受講者情報・課題内容・評価情報は非公開。 |
| Academy | 認定完了 | academy_certification_completed | academy | academy | 候補 | いいえ | 候補 | false | none | not_required | public または limited | 受講者本人の公開許可がある認定実績だけStory候補。 |
| Academy | 講師登録 | academy_instructor_registered | academy | academy | 候補 | いいえ | 候補 | false | none | not_required | public または limited | 公開プロフィール化できる講師登録だけStory候補。個人情報は出さない。 |
| Academy | 講座実施完了 | academy_session_completed | academy | academy | 候補 | いいえ | はい | false | none | not_required | public または limited | 受講者個人情報を含めない。 |
| Academy | 更新料入金 | academy_renewal_payment_recorded | academy | academy | いいえ | はい | いいえ | true | revenue | paid | private | 金額ログ。Story非対象、活動実績対象外。 |
| Academy | 教材 / キット注文 | academy_material_ordered | academy | academy | いいえ | 金額ありならはい | いいえ | 金額ありならtrue | revenue または expense | paid または unpaid | private | 売上・仕入れ・発送管理はDESK/内部向け。 |

AcademyのOS連携方針:

- 講座作成 / 教材追加 / レッスン公開 / 認定完了 / 講座実施完了はStory候補。
- 受講料 / 更新料 / 講座販売はDESK対象。
- 受講者個人情報、課題内容、評価内容、支払い情報はStory非対象。
- 認定講師数、講座実施数、教材数などは活動実績候補。
- 単体アプリとして先に作る場合も、後から `activity_logs` へ変換できるイベント名・対象ID・発生日時を残す。

## 7. Community

Communityは、講座受講者・講師・会員・主催者が集まるコミュニティ運営アプリとして扱います。

| アプリ名 | 操作 / イベント名 | activity_type | category | source_service | Story対象 | DESK対象 | 活動実績対象 | has_financial_value | transaction_type | payment_status | visibility | 注意点 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Community | コミュニティ作成 | community_created | community | community | 素材候補 | いいえ | 候補 | false | none | not_required | private または limited 初期 | 公開中コミュニティリンクや運営実績の材料にする。内部設定や会員情報は出さない。 |
| Community | 投稿 | community_post_created | community | community | いいえ | いいえ | いいえ | false | none | not_required | private または limited | 初期はStory非対象。投稿内容をActivity Log実績へ混ぜすぎない。 |
| Community | コメント | community_comment_created | community | community | いいえ | いいえ | いいえ | false | none | not_required | private | コメント内容・会員情報はStory非対象。 |
| Community | お知らせ配信 | community_announcement_sent | community | community | いいえ | いいえ | いいえ | false | none | not_required | private または limited | 内部連絡は非対象。公開告知として使う場合は別途Story用ログに変換する。 |
| Community | 勉強会 / イベント開催 | community_event_hosted | community | community | 素材候補 | いいえ | 候補 | false | none | not_required | private または limited 初期 | 開催予定ではなく、開催実績数や公開イベントリンクの材料にする。参加者情報は出さない。 |
| Community | ライブ配信 | community_live_hosted | community | community | 候補 | いいえ | 候補 | false | none | not_required | public または limited | 公開してよい開催実績だけStory候補。参加者情報は出さない。 |
| Community | 会員参加 | community_member_joined | community | community | いいえ | いいえ | いいえ | false | none | not_required | private | 会員情報はStory非対象。人数集計に使う場合は別集計。 |
| Community | 月額会費入金 | community_membership_payment_recorded | community | community | いいえ | はい | いいえ | true | revenue | paid | private | 金額ログ。会員情報・支払い情報はStory非対象。 |
| Community | イベント参加費 / 講座販売 | community_fee_or_course_sale_recorded | community | community | いいえ | はい | いいえ | true | revenue | paid または unpaid | private | 参加費・講座販売の金額ログ。購入者情報はStory非対象。 |
| Community | 月次レポート作成 | community_monthly_report_created | community | community | 候補 | いいえ | 候補 | false | none | not_required | limited 初期 | 公開範囲を確認してからStory候補。会員個人情報は含めない。 |

CommunityのOS連携方針:

- 通常投稿やコメントは初期ではStory非対象。
- 勉強会開催 / イベント開催 / ライブ開催はStory候補。
- 月額会費 / 講座販売 / イベント参加費はDESK対象。
- 会員情報、コメント内容、内部投稿、支払い情報はStory非対象。
- コミュニティ運営実績として公開できるものだけStory候補にする。
- Academyと連動する場合も、Community側の会員・投稿・支払い情報をStoryへ直接出さない。

## 8. Team Works

| アプリ名 | 操作 / イベント名 | activity_type | category | source_service | Story対象 | DESK対象 | 活動実績対象 | has_financial_value | transaction_type | payment_status | visibility | 注意点 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Team Works | 授業完了 | team_works_lesson_completed | team_works | team_works | 候補 | いいえ | 候補 | false | none | not_required | private 初期 | 生徒情報・学校情報は非公開。公開するなら匿名化した実績だけ。 |
| Team Works | 学校への請求 | team_works_invoice_created | team_works | team_works | いいえ | はい | いいえ | true | revenue | unpaid | private | 請求情報はStory非対象。 |
| Team Works | 学校からの入金 | team_works_invoice_paid | team_works | team_works | いいえ | はい | いいえ | true | revenue | paid | private | 金額ログ。Story非対象。 |
| Team Works | 会話パートナー報酬 | team_works_partner_reward_recorded | team_works | team_works | いいえ | はい | いいえ | true | expense | paid または unpaid | private | 報酬・外注費はDESK対象、Story非対象。 |
| Team Works | 授業報告 | team_works_lesson_report_created | team_works | team_works | いいえ | いいえ | いいえ | false | none | not_required | private | 内部ログ。生徒・学校情報をStoryに出さない。 |

## 9. Session

| アプリ名 | 操作 / イベント名 | activity_type | category | source_service | Story対象 | DESK対象 | 活動実績対象 | has_financial_value | transaction_type | payment_status | visibility | 注意点 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Session | 予約受付 | session_booking_received | session | session | いいえ | 金額ありなら候補 | いいえ | 金額ありならtrue | revenue または none | unpaid または not_required | private | 顧客情報・相談内容は非公開。 |
| Session | セッション実施完了 | session_completed | session | session | 候補 | いいえ | 候補 | false | none | not_required | public または limited | 顧客情報や相談内容を伏せた実績だけStory候補。 |
| Session | 売上記録 | session_revenue_recorded | session | session | いいえ | はい | いいえ | true | revenue | paid | private | 金額ログ。Story非対象。 |
| Session | キャンセル記録 | session_cancelled | session | session | いいえ | 必要なら候補 | いいえ | 金額ありならtrue | revenue または none | paid または not_required | private | キャンセル料がある場合だけDESK候補。 |

## 10. Event

| アプリ名 | 操作 / イベント名 | activity_type | category | source_service | Story対象 | DESK対象 | 活動実績対象 | has_financial_value | transaction_type | payment_status | visibility | 注意点 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Event | イベント作成 | event_created | event | event | 素材候補 | いいえ | 候補 | false | none | not_required | private または limited 初期 | イベント予定は自動公開しない。公開中イベントリンクや開催実績の材料にする。 |
| Event | 出店者申込 | event_exhibitor_application_received | event | event | いいえ | いいえ | いいえ | false | none | not_required | private | 申込者情報・連絡先は非公開。 |
| Event | 出店者承認 | event_exhibitor_approved | event | event | 候補 | いいえ | 候補 | false | none | not_required | limited 初期 | 公開名義の確認後にStory候補。 |
| Event | 参加費 / 出店料売上 | event_fee_recorded | event | event | いいえ | はい | いいえ | true | revenue | paid または unpaid | private | 金額ログ。Story非対象。 |
| Event | 会場費 / 運営費 | event_expense_recorded | event | event | いいえ | はい | いいえ | true | expense | paid | private | 経費ログ。Story非対象。 |
| Event | イベント開催完了 | event_completed | event | event | 候補 | いいえ | 候補 | false | none | not_required | public または limited | 個人情報を含めず、開催実績として公開できる範囲だけ。 |

## 11. 本接続前の確認チェック

各アプリをSupabase本接続する前に、操作ごとに以下を確認します。

```text
1. そのログは本人または事業者が公開してよい活動実績か
2. 金額を持つか
3. 顧客・生徒・学校・受講者・会員・請求・報酬などの非公開情報を含むか
4. Story素材 / DESK / 活動実績のどれに使うべきか
5. source_service はどのアプリ名で固定するか
6. DB defaultに任せず、visibility / display_on_story / counts_toward_summary / has_financial_value / transaction_type / payment_status を明示するか
7. 同じ操作を二重にActivity Log化しないための source_event_id または idempotency_key を持てるか
```

## 12. 現時点の推奨

本接続は一気に進めず、以下の順で進めることを推奨します。

```text
1. この変換ルール表をレビューする
2. 優先アプリを1つ選ぶ
3. そのアプリの保存payloadだけを実装する
4. /log / /story / /desk / /os のテスト枠で分類を再確認する
5. 問題なければ通常表示への段階移行を検討する
```

候補としては、Phase 4で2パターン確認済みのItem Studioが最も安全です。Academy / Community は認定講座構築教科書と連動して構築が始まっているため、OS連携対象として優先度を少し高めに扱います。ただし、まずは単体アプリとして機能することを優先し、Activity Logへ後から変換できる構造を残す方針です。MarketNote、Order、Team Worksは既存処理・個人情報・金額情報の扱いが広いため、変換ルールのレビュー後に進める方が安全です。
