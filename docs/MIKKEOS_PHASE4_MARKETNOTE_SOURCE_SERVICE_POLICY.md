# mikkeOS Phase 4 MarketNote source_service Policy

作成日: 2026-07-05

このメモは、`activity_logs.source_service` に `market_note` と `marketnote` が混在していることを受けて、本保存へ進む前の正規化方針を固定するものです。

今回の作業では、Supabase本DB、RLS、policy、constraint、既存MarketNote保存処理は変更しません。

## 1. 固定方針

| 層 | 採用する値 | 理由 |
| --- | --- | --- |
| UnifiedActivityLog / 画面側 | `market_note` | mikkeOS上のアプリキーとして読みやすく、他アプリの命名とも揃う |
| Supabase保存時 | `marketnote` | 既存 `lib/activity-log.ts` が `source_service: "marketnote"` を固定しているため、既存互換を優先する |
| Supabase読み取り時 | `marketnote` / `market_note` の両方を `market_note` へ変換 | 既存DBの混在データを画面側で一つのMarketNoteとして扱う |

つまり、当面は以下の扱いにします。

```text
UnifiedActivityLog / UI: market_note
Supabase write payload: marketnote
Supabase read payload: marketnote or market_note -> market_note
```

## 2. 理由

- 既存MarketNote保存処理との互換を保てる。
- 既存DBにある `market_note` / `marketnote` の混在データを、画面側で一つのMarketNoteとして扱える。
- 今すぐDBマイグレーションをしなくて済む。
- 将来DB側を `market_note` に統一する場合も、adapterで吸収しやすい。

## 3. Supabase保存adapter方針

保存adapterでは、当面この変換を維持します。

| UnifiedActivityLog | Supabase `activity_logs` |
| --- | --- |
| `appKey: "market_note"` | `source_service: "marketnote"` |
| `appKey: "event"` | `source_service: "event"` |
| `appKey: "order"` | `source_service: "order"` |
| `appKey: "item_studio"` | `source_service: "item_studio"` |
| `appKey: "academy"` | `source_service: "academy"` |
| `appKey: "session"` | `source_service: "session"` |
| `appKey: "community"` | `source_service: "community"` |

現行の `toSupabaseSourceService()` はこの方針に合っています。

## 4. Supabase読み取りadapter方針

将来 `activity_logs` から `UnifiedActivityLog` へ戻す読み取りadapterを作る場合は、以下の正規化を入れます。

| Supabase `source_service` | UnifiedActivityLog `appKey` |
| --- | --- |
| `marketnote` | `market_note` |
| `market_note` | `market_note` |
| `event` | `event` |
| `order` | `order` |
| `item_studio` | `item_studio` |
| `academy` | `academy` |
| `session` | `session` |
| `community` | `community` |
| その他 | `metadata.sourceService` に保持し、`appKey` は安全なfallbackへ寄せる |

読み取りadapter案:

```ts
function toUnifiedAppKey(sourceService: string): UnifiedActivityLog["appKey"] {
  if (sourceService === "marketnote" || sourceService === "market_note") {
    return "market_note";
  }

  if (
    sourceService === "event" ||
    sourceService === "order" ||
    sourceService === "item_studio" ||
    sourceService === "academy" ||
    sourceService === "session" ||
    sourceService === "community"
  ) {
    return sourceService;
  }

  return "community";
}
```

注記:

- 上記は方針メモであり、今回コードには追加しません。
- fallbackをどの `appKey` にするかは、読み取りadapter実装時に `UnifiedActivityLog["appKey"]` の型と画面要件に合わせて再検討します。
- 不明な `source_service` を捨てず、`metadata.sourceService` に残す方針が安全です。

## 5. Dashboard目視確認の状況

現在のMCP権限では、テーブル定義、制約、RLS policy本文は取得できませんでした。
また、この作業環境からDashboard表示名を直接確認する権限はありません。

| 確認項目 | 状況 |
| --- | --- |
| プロジェクト表示名が `mikke-os-dev` か | 未確認。Dashboardで目視確認が必要 |
| Project refが `.env.local` と一致するか | ローカルでは `nttqpprkqbynxyldbnjs` で一致確認済み。Dashboard表示は未確認 |
| `activity_logs` の型 | 未確認 |
| nullable / default | 未確認 |
| check制約 | 未確認 |
| unique制約 | 未確認 |
| RLS policy本文 | 未確認 |
| insert / update / delete policy | 未確認 |

## 6. 本保存前チェックリスト追記

- [x] `market_note` / `marketnote` 混在時の正規化方針を固定する。
- [x] 保存adapterは当面 `market_note` -> `marketnote` を維持する。
- [x] 読み取りadapterでは `marketnote` / `market_note` の両方を `market_note` に正規化する方針にする。
- [ ] Dashboardでプロジェクト表示名が `mikke-os-dev` か目視確認する。
- [ ] Dashboardで `activity_logs` の型、nullable、default、check制約、unique制約を確認する。
- [ ] DashboardでRLS policy本文を確認する。
- [ ] 本保存ONにする前に、読み取りadapterのfallback方針を実装時に再確認する。

## 7. まだ触らないもの

- Supabase本DB
- RLS / policy / constraint
- insert / update / delete
- `types/database.ts`
- `app/marketnote/**`
- `lib/activity-log.ts`
- `lib/marketnote.ts`
