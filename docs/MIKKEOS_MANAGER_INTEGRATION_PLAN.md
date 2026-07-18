# mikkeOS Manager統合計画

作成日: 2026-07-14
作成: Claude (Fable) — 全体設計の判断担当
実装: M番号を指定してsonnetまたはcodexへ依頼する前提

このdocsは、`G:/Musubiプロジェクト/Mikke OS/Manager機能 正式構想書.md`（追記事項含む）を、現在の一本化実行ライン・共通部品・Activity Log安全規約へ落とし込んだ実装計画です。

仕様の優先順位:

1. Managerの思想・体験: `Manager機能 正式構想書.md`
2. repo内の実装範囲・順番・型・ルート: このdocs
3. OS共通UI・ブランド・Activity Log: 既存のmikkeOS共通docs

## 1. Managerの位置づけ（確定）

Managerは**アプリではなく共通機能**。マスタープランのBP番号（アプリ構築）ではなく、**M番号（M0〜M5）**で管理する。

```text
各Mikkeアプリ = 入口・作業場所
Manager       = 予定・進行・履歴のナビゲーション（Mikke IDに付属）
Activity Log  = 裏側の記録エンジン（表に出さない）
Story         = 公開する実績
```

## 2. 既存repoとの矛盾の解消（Fable判断・3件）

### 2.1 「OSホームは作らない」vs 既存の `/os`

構想書はOSホーム否定だが、repoには `/os`（OS Home・管制塔）が既に存在し、loginのリダイレクト先でもある。

```text
決定:
- /os への新機能追加を凍結する（内部確認画面として残置。削除しない）。
- Manager M1完了後、loginリダイレクトを /os → /manager へ変更する。
- （2026-07-15追記・動線監査）リダイレクトは2箇所ある。login（app/login/page.tsx）
  に加えて、ルート / も app/page.tsx で /os へ固定リダイレクトしている。
  M1完了時に両方を /manager へ変更する（片方だけ直すと玄関が旧HOMEのまま残る）。
- /os の最終処遇（Managerへの統合 or 開発用への降格）はM2で判断する。
```

### 2.2 グローバルナビの「OS」枠

MikkeAppShellのボトムナビは現在 `OS / Story / DESK / Apps + 現在のアプリ` の5枠。

```text
決定:
- M1ではナビを変更しない。Manager入口はMikkeOwnerMenuの先頭項目
  「Manager（予定と次にやること）」として追加する。
- ボトムナビ「OS」枠を「Manager」へ置き換えるかは、M1完了検収時に
  Fable/ユーザーが判断する（全アプリに効く共通部品の意味変更のため、
  チェックリスト6章の相談事項）。
```

### 2.3 既存 `/log` とOwnerMenuのLog項目

構想書は「Activity Logを表に出さない」。現在OwnerMenuに「Log」項目がある。

```text
決定:
- /manager/history が利用者向けの「最近の活動」になる。
  画面上でActivity Logという名称を使わない。
- /log と OwnerMenuのLog項目は内部管理用として当面残置。
  整理（削除 or 開発用フラグ化）はM2で判断する。
```

### 2.4 旧ルートの残置（2026-07-15追記・動線監査で発見）

新導線と矛盾する旧ルートが2つ現役で残っている。

```text
- app/home/       旧AppShell製の旧HOME画面（MarketNoteデータを直読みする古いホーム）
- app/marketnote/ MarketNoteの旧入口（現行は /apps/market-note。入口が二重）

決定:
- どちらも新機能追加を凍結（触らない・直さない）。
- 処遇（現行ルートへのリダイレクト化 or 削除）は /os・/log と同時にM2で判断する。
  ブックマーク・履歴から旧画面へ入れる裏口を、M2で確実に閉じる。
```

### 2.5 受信箱（2026-07-15追記・Page構想対応）

Page構想の掲載依頼フロー「管理者がmikkeID宛に掲載依頼を送る → Manager通知
→ 本人が承認/辞退」は、Managerに**他者からの依頼を受け取る受信箱**があることを
前提にしている。従来のM0〜M5には自分宛の期限通知しかなく、席が無かった。

```text
決定:
- Managerに「受信箱（インボックス）」の設計上の席を作る。
  受け取るもの: 他者からの依頼（最初のユースケースはPageの掲載依頼。
  承認/辞退の2択で応答し、承認後のみ相手側に効果が出る）。
- M1では実装しない。型の予約のみ（ManagerInboxItem。4章M1参照）。
- 設計確定はM2、実装はFund F4の本人同定・双方同意基盤の完成後に
  PageのPG-4と同時（他者間のやり取りはF4のレール無しには成立しない）。
- 受信箱の新着はM4のアプリ内通知の対象に含める。
```

## 3. 実行ラインへの組み込み（Fundとの調整）

現在codexがFund F4（本人同定・同意・RLS）を進行中（F4-a完了・F4-b1承認待ち）。一本化原則を守りつつ、次のように滑り込ませる。

```text
- M0（設計報告・docsのみ）: 今すぐ依頼可。マスタープラン2.0の例外
  「docsだけ書く作業」に該当し、Fund実装と衝突しない。
- M1（localStorage MVP実装): Fund F4-b1の承認待ち・検収待ちの間に実施してよい。
  理由: 触るファイルが重ならない（新規 lib/manager/ + 新規 /manager routes +
  OwnerMenuへの1項目追加のみ。Fund F4はmigration/RLSでコード面の変更なし）。
  実装者はsonnetまたはcodexの手が空いている方。同時に両方が実装しない。
- M2以降: Fund F4-b2完了後に順次。
```

## 4. フェーズ定義

### M0: 現状確認・設計報告（docsのみ・実装しない）

構想書39章Phase 0の13項目を、実装者が現repoで確認して1枚のdocs（`MIKKEOS_MANAGER_M0_REPORT.md`）に報告する。特に:

```text
- 各アプリの予定データの現状（下記5章の想定を実コードで検証）
- MarketNoteだけSupabase保存である非対称性の扱い
- 既存Activity Log（useUnifiedActivityLogs）を履歴表示に使う方法
- 影響範囲（OwnerMenu変更が全アプリに及ぶことの確認）
```

報告後、このdocsとの差分があればFableが裁定して仕様を固定する。

### M1: localStorage Manager MVP

画面（全ルートAuthGate必須・MikkeAppShell使用・appName="Manager"・footerLabel="Manager by mikke"）:

```text
/manager            ホーム（今日の予定・今週の締切・対応が必要・進行中・最近の活動）
/manager/calendar   月カレンダー（MarketNoteのHomeCalendarの月グリッド実装を参考に。
                    個人予定の追加はここから）
/manager/tasks      やること（今日/今週/期限超過/日程未定/完了）
/manager/progress   進行中（アプリ別件数・元アプリリンク）
/manager/history    最近の活動（Activity Log読み取り・内部用語を出さない）
/manager/settings   表示設定（アプリ別・項目別ON/OFF、おすすめ初期設定）
```

?source=クエリで入口アプリを保持し、該当アプリの項目を優先表示（構想書16章）。

データ設計（最重要のFable判断）:

```text
Managerが保存するのは次の2つだけ:
  mikke.manager.personal-events.v1   個人予定
  mikke.manager.preferences.v1       表示設定

アプリ由来の予定・タスクは保存しない。表示のたびに各アプリのstoreから
「読み取り時に導出」する（derive-on-read）。
理由: 構想書14章「元アプリで編集する」原則の構造的な保証。
      コピーを保存すると同期ズレ・重複・編集責任の分散が必ず起きる。
      現状の各アプリstoreは同一ブラウザ内なので導出コストは無視できる。
```

アダプタ形式:

```text
lib/manager/types.ts     ManagerItem / ManagerTask / ManagerPersonalEvent /
                         ManagerPreferences（構想書32章のフィールドをcamelCaseで。
                         sourceGroupIdは予約のみ・M1では未使用）
                         ManagerInboxItem（受信箱・2.5章。予約のみ・M1では未使用）
lib/manager/adapters/    アプリごとに collect(): Promise<{items, tasks, progress}>
                         を実装（MarketNoteはSupabase読みで非同期のため
                         インターフェースはPromiseで統一）
```

M1で連携するアプリ（既存データから導出可能なもののみ）:

```text
MarketNote  出店日・支払い期限・チェック期日（既存listMarketEvents/listCheckItems）
Order       希望納期・新規申込あり
Session     予約日時・申込ステータス
Event       開催日・申込受付状況
Fund        募集終了日・提供予定日・活動報告未投稿
```

個人予定の隔離（構想書13章・データ構造レベルで保証）:

```text
- ManagerPersonalEventはUnifiedActivityLogへ変換するコードを書かない
- Story・DESK・実績集計のどの導出経路にも個人予定を通さない
```

### M2: 残アプリ連携・整理

```text
- Academy / Team Works / Item Studio のアダプタ追加
- 引き継ぎ重複防止（sourceGroupId実装。Fundのfund_app_links相当と接続）
- 関連アプリへの文脈案内（構想書17章。宣伝ではなく状況ベース）
- 完了後の次の予定候補（自動登録ではなく提案。構想書25章）
- /os・/log の最終処遇の判断（2章の保留事項）
- 旧ルート /home・/marketnote の処遇（リダイレクト化 or 削除。2.4章）
- 受信箱の設計確定（2.5章。実装はFund F4基盤完成後・Page PG-4と同時）
- ボトムナビOS枠→Manager置き換えの実施（M1検収時に承認済みなら）
  ※置き換え判断の際、ナビ全体の痩身（固定のStory/DESK常設をやめ
  「使っているアプリだけ見せる」Branding Policy 6-7章へ寄せるか）も同時に判断する
```

### M3: Supabase本接続（別承認）

manager_personal_events / manager_display_preferences（＋必要ならcalendar_items/tasksのキャッシュテーブル）。FundのF4/F5と同じ規約: migration・RLSはFable/ユーザーの個別承認、Phase4安全方針（user_id + profiles所有検証）踏襲。

### M4: PWA・ホーム画面追加・通知（構想書追記事項）

```text
- Manager用manifest（start_url=/manager）・アイコン
- ホーム画面追加の案内コンポーネント（今すぐ/あとで/表示しない）
- アプリ内通知（期限接近・期限超過・受信箱の新着）。プッシュ/LINEは対象外のまま
```

### M5: Google Calendar・高度機能

構想書26-27章・35章の将来機能。初期対象外。

## 5. 各アプリの予定データ源（M0で実コード検証する想定表）

| アプリ | 予定の源 | やることの源 |
|---|---|---|
| MarketNote | market_events.event_date、支払い期限 | market_check_items.due_date未完了 |
| Order | orderApplication.desiredDueDate | status=newの申込 |
| Session | booking.bookingDate/Time | status=requestedの予約 |
| Event | event.eventDate | status=submittedの申込 |
| Fund | project.endAt、plan.deliveryDate | 活動報告未投稿・提供未完了 |
| 履歴（全アプリ） | — | useUnifiedActivityLogs（localStorage） |

## 6. 禁止事項（構想書40章＋repo共通）

```text
- OSホームを新規作成しない（/osも拡張しない）
- 全アプリ一覧をManagerの中心に置かない
- Activity Logという名称を利用者画面に出さない
- 元アプリのデータをManagerから変更しない（読み取り専用。個人予定のみ編集可）
- 個人予定をActivity Log・Story・DESKへ流さない
- Google Calendar連携をM1に入れない
- 管理・監視・評価の語彙を使わない（構想書37章の言い換え表に従う）
- 新しいデザイン体系・独自色を作らない（--mikke-*トークンのみ）
- Supabaseへ勝手に本接続しない・既存Activity Log型を無断変更しない
- 全ルートAuthGate必須（予定・進行は個人情報。公開面は存在しない）
```

## 7. 検収条件（各Mフェーズ共通）

`MIKKEOS_ACCEPTANCE_CHECKLIST.md` の1〜5章に加えて:

```text
- 個人予定がActivity Log / Story / DESKのどこにも現れないこと（コード経路で確認）
- 元アプリのstoreへの書き込みがゼロであること（アダプタはread-only）
- 「管理します」系の文言が1つもないこと
- 全/managerルートが未ログインで読み込み中画面になること
```

## 8. このdocsで決めないこと

```text
- ボトムナビのOS枠置き換え → M1検収時
- /os・/logの最終処遇 → M2
- 通知のチャネル（メール等） → M4着手時
- Google Calendar連携の詳細 → M5着手時
- Managerの課金上の扱い → 事業判断（構想書5章の通りMikke ID付属が前提）
```
