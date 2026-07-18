# MIKKEOS Manager M1 正式検収レポート

作成日: 2026-07-18
対象: Manager M1 localStorage MVP

## 1. 結論

Manager M1は、N1の自己チェック範囲では合格。

Managerはログイン直後の巨大な玄関ではなく、各アプリで進んでいる予定・タスク・進行を横断で見る場所として実装されている。入口は引き続き個々のアプリで、`/` とログイン後の既定遷移は `/os` のまま変更していない。

## 2. 機械チェック

```text
lint: 成功
build: 成功（87 static pages）
```

確認した追加チェック:

```text
Manager範囲の直書きhex色: 0件
Manager表示範囲の内部語（Activity Log / MIKKEOS / mikkeOS）: 0件
Manager表示範囲の避ける語彙（管理 / 監視 / 評価）: 0件
/manager配下6ルートのAuthGate: 全ページあり
```

対象ルート:

```text
/manager
/manager/calendar
/manager/tasks
/manager/progress
/manager/history
/manager/settings
```

## 3. 保存境界

Managerが書き込むlocalStorageキーは次の2つのみ。

```text
mikke.manager.personal-events.v1
mikke.manager.preferences.v1
```

各アプリ由来の予定・タスク・進行は、Manager側に複製保存せず、表示時に読み取って導出している。

## 4. 個人予定の隔離

個人予定は `ManagerPersonalEvent` としてManager専用storeに保存される。

確認結果:

```text
ManagerPersonalEventをUnifiedActivityLogへ変換するコード: なし
ManagerPersonalEventをStoryへ渡すコード: なし
ManagerPersonalEventをDESKへ渡すコード: なし
Managerから各アプリstoreへ書き戻すコード: なし
```

`personalEventsToManagerSchedules()` はManager画面上の予定表示へ変換するだけで、Activity Log / Story / DESK への出力経路を持たない。

## 5. UI文言の修正

N1チェック中に、Manager表示範囲で避けるべき語彙が残っていたため、以下を修正した。

```text
「管理しやすい履歴」→「見返しやすい履歴」
「申込管理」→「申込対応」
「投稿管理」→「投稿対応」
```

## 6. ブラウザ確認

開発サーバーは既存プロセスが `http://localhost:3005` で稼働していたため、そちらで確認した。

確認できたこと:

```text
/manager はHTTP 200
未ログイン状態ではAuthGateにより「読み込み中」画面になる
```

補足:

Codex内蔵ブラウザのWebview接続が途中で不安定になったため、3幅の完全な目視巡回はコード検収とbuild確認で補完した。N1のFable判断で厳密な目視証跡が必要な場合は、手元ブラウザで 375px / 768px / 1280px の再確認だけを追加で行う。

## 7. Fable判断ポイント

今回のN1では、以下の判断変更は行っていない。

```text
/os と /log の最終処遇
/home と /marketnote 旧ルートの処遇
ボトムナビのOS枠再設計
Managerをログイン直後の既定遷移先にする案
Supabase本接続
Google Calendar接続
```

これらは計画どおりM2以降の判断対象。

