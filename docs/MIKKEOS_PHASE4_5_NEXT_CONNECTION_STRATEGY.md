# mikkeOS Phase 4.5 Next Connection Strategy

作成日: 2026-07-08

このdocsは、Phase 4のSupabase接続テスト完了後に、mikkeOSの通常表示をどの順番でSupabase本接続へ進めるかを整理するための方針メモです。

重要: 今回は方針メモのみです。通常表示のSupabase本接続、各アプリ保存の一斉Supabase化、DBマイグレーション、RLS / policy / constraint変更、Order / Team Works / MarketNote / Academy / Community 本体の実装変更は行いません。

## 1. 現在の到達点

Phase 4では、Supabase上の `activity_logs` をmikkeOSの共通ログとして扱えるかを、通常表示とは切り離したテスト枠で確認しました。

補足: Phase 4のStory抽出テストは、`visibility = public` かつ `display_on_story = true` の行を安全に読めるかを確認するための技術テストです。今後のStory通常表示は、公開Activity Log一覧ではなく、名刺・自己紹介・ミニホームページ・活動ポートフォリオとして設計し直します。

確認済み:

- Supabase保存テスト成功。
- `/log` 読み取りテスト成功。
- `/story` Story対象抽出成功。
- `/desk` DESK対象抽出・集計成功。
- `/os` OS Home用サマリー生成成功。
- Story / DESK / 活動実績の分類ロジックを共通関数化済み。
- 各アプリごとのActivity Log変換ルール表作成済み。
- 通常表示はまだlocalStorage / mockのまま。

この時点で、Supabaseへの保存・読み取り・分類・集計は確認できています。ただし、mikkeOS本体の通常表示や各アプリの通常保存はまだSupabaseへ切り替えていません。

## 2. 今すぐ本接続しない理由

現時点では、通常表示のSupabase本接続を急がず、段階接続の順番を先に決めます。

理由:

- MarketNote / Team Works / Academy / Community が並行実装中。
- 各アプリの本体仕様がまだ変わる可能性がある。
- 先に本接続すると、アプリ側変更とOS側変更が混ざる。
- Activity Log変換ルールを実装に落とす前に、優先順位を決める必要がある。
- 金額ログや個人情報の公開事故を避けるため、段階接続が安全。
- localStorage / mockの既存導線を残したまま、Supabase導線を安全に増やす必要がある。

特に、Storyは外部公開の可能性があるため、`visibility` / `display_on_story` / `counts_toward_summary` / `has_financial_value` / `transaction_type` の扱いを曖昧にしたまま通常表示へつなぐことは避けます。

## 3. 次の接続候補

### A. `/log` の通常表示をSupabaseへ段階移行

メリット:

- 全ログ確認の中心なので検証しやすい。
- Story / DESK / OSの前段として自然。
- Supabase上の `activity_logs` と画面表示の差分を見つけやすい。

注意:

- localStorage追加ログとの共存方針が必要。
- Supabaseログとローカルログを同じ一覧に混ぜるか、切り替え表示にするかを先に決める。
- 重複表示を避けるため、`source_record_id` や `idempotency_key` の扱いを確認する。

### B. `/story` の通常表示をSupabaseへ段階移行

メリット:

- 名刺・自己紹介・活動ポートフォリオとして分かりやすい。
- Item Studio / Academy / MarketNoteと相性が良い。
- Activity Logから実績数、レビュー、選択作品、公開リンクを作る流れを確認できる。

注意:

- 公開条件・個人情報除外・行動予定の非表示チェックが重要。
- 顧客情報・受講者情報・会員情報・学校情報・支払い情報がStoryに混ざらないことを確認する。
- 細かなActivity Logを時系列で自動表示しない。
- Story素材候補とStory公開済みを分けるUI/運用が必要。

### C. `/desk` の通常表示をSupabaseへ段階移行

メリット:

- 金額ログの集計に直結する。
- 事業管理として価値が分かりやすい。
- 売上合計 / 経費合計 / 差引の計算を実データで確認できる。

注意:

- 売上 / 経費 / 報酬 / 外注費 / 会費 / 更新料の分類をさらに整理する必要がある。
- `transaction_type` だけでは足りない場合、将来の補助分類が必要になる可能性がある。
- 金額ログは原則 `private` で、Storyや活動実績に混ぜない前提を崩さない。

### D. `/os` の通常表示をSupabaseへ段階移行

メリット:

- 管制塔として一番OSらしさが出る。
- Story対象件数、DESK対象件数、活動実績件数、最近のActivity Logをまとめて確認できる。
- 複数アプリの動きがOS Homeに集まる体験を作りやすい。

注意:

- `/log` / `/story` / `/desk` の判定が固まってからが安全。
- サマリーの数字が正しいかを説明できる状態にしてから通常表示へ入れる。
- Activity Log以外の既存mock情報との共存方針が必要。

### E. 先に各アプリのadapter実装方針を作る

メリット:

- MarketNote / Academy / Team Worksなどの本体実装と合流しやすい。
- 各アプリの保存payloadを、Activity Log変換ルール表に沿って設計できる。
- 本体アプリ側が先に進んでも、後からOSへつなぎやすい。

注意:

- 実装量が増えるので、まずdocs整理でもよい。
- adapterを先に増やしすぎると、未確定のアプリ仕様に引っ張られる。
- Academy / Community のように別ライン実装中のアプリは、ローカルの raw event からActivity Logへ変換する境界を明確にしておく。

## 4. 推奨方針

現時点では、以下の順番を推奨します。

```text
1. 各アプリのActivity Log変換ルール表を維持・更新する
2. MarketNote / Team Works / Academy は単体アプリ実装を優先
3. OS側は /log の通常表示をSupabaseへ段階移行するか検討
4. その後、/story -> /desk -> /os の順で本接続を検討
```

補足:

- 最初の通常表示移行候補は `/log` が安全です。全ログを確認する場所なので、StoryやDESKより先に差分を見つけやすいためです。
- `/story` は公開事故を避けるため、Activity Logをそのまま公開タイムライン化せず、本人が選んだプロフィール情報・実績サマリー・作品・レビュー・リンクだけを出す方向で再設計します。
- `/desk` は金額分類の整理が必要なため、売上 / 経費 / 報酬 / 外注費 / 会費 / 更新料の扱いをActivity Log変換ルール表と合わせてから進めます。
- `/os` は最終的な管制塔に近いため、`/log` / `/story` / `/desk` の読み取りが安定してから通常表示へ入れる方が安全です。

## 5. 当面の禁止事項

当面は以下を行いません。

```text
全画面の一括Supabase本接続
各ミニ画面保存の一斉Supabase化
MarketNote / Team Works / Academy / Community本体への無理な接続
RLS / policy / constraint変更
DBマイグレーション
個人情報・金額情報をStoryへ出す変更
```

特に、金額ログや個人情報を含むログは、Storyや活動実績に混ぜません。公開Storyに出すのは、本人または事業者が公開してよいプロフィール情報・実績サマリー・作品・レビュー・リンクだけです。予定や細かな行動履歴も、行動パターンの推測につながるため自動表示しません。

## 6. 別ライン進行中のアプリ

### MarketNote

- 早めに単体アプリとして形にする予定。
- 既存処理・設定画面・収支カテゴリ・支払い方法との関係があるため、Activity Log本接続は変換ルールのレビュー後が安全。
- 当面 `source_service: marketnote` を維持する。

### Team Works

- アリサ日本語会話事業テンプレートとして別部屋で進行中。
- OS内に器は追加済み。
- 授業完了はStory候補、学校への請求や会話パートナー報酬はDESK対象として扱う。
- 生徒情報・学校情報・報酬情報はStoryに直接出さない。

### Academy

- 認定講座構築教科書と連動してClaude Code側で構築開始。
- `academy_activity_events` を raw event / 変換前イベントとして扱う方針。
- raw event自体は公開せず、将来 `activity_logs` へ変換してからStory / DESK / OS Homeへ流す。
- 講座作成 / 教材追加 / レッスン公開 / 認定完了 / 講座実施完了はStory候補。
- 受講料 / 更新料 / 講座販売はDESK対象。
- 受講者情報・課題内容・評価内容・支払い情報はStoryに直接出さない。

### Community

- Academyと連動する可能性が高い。
- 投稿 / 会員 / イベント / 会費の扱いをActivity Log変換ルール表で管理する。
- 通常投稿やコメントは初期ではStory非対象。
- 勉強会 / イベント / ライブ開催はStory候補。
- 月額会費 / 講座販売 / イベント参加費はDESK対象。
- 会員情報・コメント内容・内部投稿・支払い情報はStoryに直接出さない。

## 7. 次に判断すること

次回以降、通常表示のSupabase本接続に進む前に、以下を判断します。

```text
1. /log 通常表示をSupabaseへ段階移行するか
2. localStorageログとSupabaseログを共存させるか、切り替え表示にするか
3. Supabase表示をfeature flagで制御するか
4. 各アプリのadapter実装を先にdocs化するか
5. Academy / Communityのraw eventをActivity Logへ変換する責務をどこに置くか
```

Phase 4.5では、ここまでを方針メモとして記録し、実装には進みません。
