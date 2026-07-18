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
