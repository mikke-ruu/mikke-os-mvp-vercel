# MIKKEOS Manager M2-b 旧ルート監査

作成日: 2026-07-18
対象: `/home` `/marketnote` `/os` `/log`

## 結論

M2-bは、すぐにリダイレクト実装へ進まず、Fable判断を挟むのが安全。

理由:

```text
/home        古いMarketNoteホーム。機能としては旧式だが、認証後にMarketNoteデータを直接読む現役画面。
/marketnote  現在のMarketNote実運用入口。計画上は旧入口扱いだが、/apps/market-note は現時点では簡易説明ページ。
/os          OS Home。アプリファースト方針では通常入口にしないが、内部確認画面として残置中。
/log         Activity Log画面。利用者向けには出さないが、内部確認画面として残置中。
```

特に `/marketnote` は、現状で `/apps/market-note` より機能が濃い。単純に `/apps/market-note` へリダイレクトすると、MarketNoteの実作業入口を失う。

## ルート別の確認

| ルート | 現状 | M2-b判断案 |
| --- | --- | --- |
| `/home` | `AppShell` ベースの古いMarketNoteホーム。直書き色が多く、現行MikkeAppShell系ではない | `/marketnote` または将来の正式MarketNote入口へリダイレクト候補 |
| `/marketnote` | MarketNoteの実運用入口。AuthGateあり。予定一覧・カレンダー・詳細導線あり | まだ閉じない。先に `/apps/market-note` との役割統合が必要 |
| `/os` | OS Home。Activity Log / Story / DESK / Apps の内部管制塔 | 通常入口にはしない。内部確認画面として残すか、開発用に降格する判断が必要 |
| `/log` | Activity Log一覧。内部語が画面名に出る | Manager利用者向けには出さない。内部確認用として残すか、開発用に降格する判断が必要 |

## 推奨順

```text
1. /home を /marketnote へリダイレクト化
2. /apps/market-note を説明ページではなくMarketNote正式入口へ近づける
3. その後で /marketnote → /apps/market-note の正規化を判断
4. /os /log は削除ではなく「内部確認」扱いに寄せる
5. ボトムナビのOS枠はM2-cで別判断
```

## 今回は実装しないこと

```text
リダイレクト実装
/os /log の削除
ボトムナビ変更
login後遷移先変更
Managerを巨大な入口に見せる変更
```

## 次の安全スライス

Fable判断後、最小実装は `/home` のみ。

```text
app/home/page.tsx を /marketnote への redirect に変更
lint / build
専用コミット
```

