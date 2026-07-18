# MIKKEOS Manager M2 進捗レポート

作成日: 2026-07-18
対象: N2 / Manager M2

## M2-a: Team Worksアダプタ配線

完了。

既存の `lib/team-works-manager-adapter.ts` を再利用し、Manager側の `ManagerBridge` へ薄く変換する専用アダプタを追加した。

```text
追加: lib/manager/adapters/team-works.ts
更新: lib/manager/collect-manager-items.ts
```

接続内容:

```text
Team Worksプロジェクト納期 → Manager予定
Team Works未完了タスク → Managerタスク
Team Works進行中プロジェクト → Manager進行
```

境界:

```text
ManagerからTeam Works storeへの書き込みなし
Team Works側の既存保存形式変更なし
Activity Log / Story / DESK 経路への変更なし
```

## 残り

```text
M2-b: 旧ルート /home・/marketnote の処遇
M2-b: /os・/log の最終処遇
M2-c: ボトムナビ再設計
```

## M2-a: Academy / Item Studioアダプタ配線

完了。

```text
追加: lib/manager/adapters/academy.ts
追加: lib/manager/adapters/item-studio.ts
更新: lib/manager/collect-manager-items.ts
```

接続内容:

```text
Academy申込・受講日・キット対応・講師更新期限・講座公開準備 → Manager予定/タスク/進行
Item Studio作品公開準備・出品先・販売記録 → Manager予定/タスク/進行
```

境界:

```text
AcademyはSupabase読み取りのみ。取得失敗時は空表示。
Item Studioは既存localStorage hookから読み取りのみ。
ManagerからAcademy / Item Studioへの書き込みなし。
Activity Log / Story / DESK 経路への変更なし。
```

## M2-b: 旧ルート監査

監査のみ完了。実装判断は保留。

```text
追加: docs/MIKKEOS_MANAGER_M2_ROUTE_AUDIT_2026-07-18.md
```

要点:

```text
/home は /marketnote へリダイレクト候補。
/marketnote は現時点の実運用入口なので、すぐ /apps/market-note へ寄せると機能入口を失う。
/os /log は通常入口ではなく、内部確認扱いへ寄せる判断が必要。
```

## M2-b: MarketNote入口整理

完了。

```text
更新: app/apps/market-note/page.tsx
```

`/apps/market-note` は簡易説明ページだったため、現時点の実運用入口である `/marketnote` へリダイレクトする形にした。

これにより、Apps側からMarketNoteを開いても、実際に使えるMarketNote画面へ到達する。

未実施:

```text
/marketnote 自体の廃止または正規化
/marketnote/[id] など詳細ルートの移動
/os /log の処遇変更
```

## M2-b: 判断待ち

ここから先はFable判断待ち。

```text
/marketnote を将来 /apps/market-note に統合するか
/os を内部確認画面として残すか、開発用へ降格するか
/log を内部確認画面として残すか、開発用へ降格するか
```

アプリファースト方針により、Managerを `/` やログイン直後の唯一の入口にする変更は引き続き行わない。

## M2-c: ボトムナビ再設計

完了。

```text
更新: components/mikkeos/MikkeAppShell.tsx
```

変更内容:

```text
旧: OS / Story / DESK / Apps / 現在のアプリ
新: 現在のアプリ / Manager / Apps
```

意図:

```text
入口は個々のアプリに置く。
Managerは作業開始の巨大な玄関ではなく、予定・次にやること・他アプリの動きを見る横断面として置く。
Story / DESK は常設ナビから外し、OwnerMenu側の「使っているアプリ」に残す。
```

未実施:

```text
アプリ所有判定による動的ナビ
Story / DESK の利用状況に応じた表示制御
/os /log の処遇変更
```
