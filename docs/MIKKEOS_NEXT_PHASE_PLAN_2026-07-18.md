# mikkeOS 次フェーズ計画（2026-07-18）

作成: Claude (Fable) — 全体設計の判断担当
実装: N番号を指定してcodexへ依頼する前提（1機能=1実装者・同時に1人）

Manager M1E（`e6f27cc`）の区切りで、計画と実装の相違・方向性のズレを監査した結果と、
ここからの実行計画。新しいセッションはこのdocsと `MIKKEOS_UI_DOCS_INDEX.md` から読む。

## 1. 監査結果（codex確認依頼の3点）

### 1.1 「入口は個々のアプリ、Managerは横断参照」になっているか → 合格

- `MIKKEOS_MANAGER_INTEGRATION_PLAN.md` 1.1章（2026-07-18確定）に体験方針が明文化済み。
- 実装も一致: ManagerShellのmenuDescription・ダッシュボードのsubtitleが
  「入口は各アプリ。Managerは横断で参照する場所」と明示。
- OwnerMenuの先頭項目としてのみ入口追加（ナビは不変更）。計画2.2章の通り。

### 1.2 `/` やlogin後を `/manager` へ変える計画が残っていないか → コードは合格・docsに残骸あり（修正済み）

- コード: `app/page.tsx` は `/os` へ、`app/login/page.tsx` も既定 `/os` へ。`/manager` 化なし。
- Manager計画2.1章は撤回を明記済み。
- **ただし撤回前の記述が3箇所残っていた**（いずれも未コミットdocs）。2026-07-18に修正済み:
  - `MIKKEOS_APP_PORTFOLIO_MASTER_PLAN_2026-07-12.md` 9章「M1完了後にloginを/managerへ」
  - `MIKKEOS_UI_DOCS_INDEX.md` 動線監査の節「/ もloginと同時に/managerへ変更」
  - `MIKKEOS_UI_DOCS_INDEX.md` Manager統合計画の節（同上＋「OS枠置き換えはM1検収時判断」）

### 1.3 提案が「アプリ一覧」でなく状況に応じた控えめな提案か → 合格

- `lib/manager/app-suggestions.ts`: 動きのあるアプリ集合から文脈で導出、最大3件。
  全アプリ一覧の掲出なし。動きゼロの時だけ「アプリから始める」1枚（/appsへの静かな案内）。
- 文言も「〜も使えます」「候補です」で押しつけなし。禁止事項6章（管理・監視語彙）違反なし。
- 軽微な注記: `activeAppKeys.has("team_works")` はM1ではTeam Worksアダプタ未配線のため
  常にfalse（Fund活動時のTeam Works提案は常時出る）。M2でTWアダプタ配線時に設計通りに動く。
  バグではない。

### 1.4 M1実装の検収前スポットチェック（Fable実施）

- `/manager` 配下6ルート全てAuthGateあり（page/calendar/tasks/progress/history/settings）。
- components/manager に「Activity Log」の内部語の露出なし。
- 保存はManager専用2キーのみ・アプリ由来はderive-on-read（collect-manager-items確認）。
- 連携5アプリ（MarketNote/Order/Session/Event/Fund）は計画通り。TWはM2対象で未配線＝計画通り。
- 残り: lint/build・実ブラウザ確認はN1（正式検収）で実施。

## 2. 計画との相違・気づき（監査で見つけたもの）

```text
A. docsの鮮度ズレ（実装がdocsを追い越した）
   - MIKKEOS_SESSION_HANDOFF_2026-07-14.md が「F4-b1承認待ち」のまま。
     実際は Fund F1〜F5-f完了、Team Works TW-P0〜P8M完了、Manager M0〜M1E完了。
   - MIKKEOS_UI_DOCS_INDEX.md の「次の作業候補」も同様に古い。
   → N0で更新する（handoffは新セッションの入口なので放置すると誤誘導する）。

B. 作業ツリーに別スコープの未コミット差分が混在
   - 認定講座admin一式（app/nintei-koza-admin/ + components + lib + types/database.ts
     + settings導線）
   - AI OFFICE一式（app/apps/ai-office/ + components/ai-office/ + lib/ai-office/
     + globals.css + spec docs）
   - 戦略docs（Page計画・料金正典・セレクトショップ・handoff）
   → M0レポート7章の通り混ぜない。N0でスコープ別に分離コミットする。

C. AI OFFICEの位置づけ（2026-07-18ユーザー確定）
   - AI OFFICEは実験・試作段階。**mikkeOSとして繋げない・実行ラインに登録しない**。
     マスタープランへの追記・Manager/Activity Log連携・AuthGate対応はすべて不要。
   - 作業ツリー整理のため分離コミットだけ行う（実行ライン外の実験コードとして）。

D. 方向性の整合は取れている
   - 料金正典「アップセルはManager M2の文脈案内に相乗り・課金壁禁止」
     ⇔ app-suggestionsの控えめ設計 … 一致。
   - セレクトショップ「Manager受信箱で掲載依頼＋販売委託を統合承認」
     ⇔ Manager計画2.5章の受信箱の席 … 一致。
   - Page/セレクトショップ/Managerとも derive-on-read（コピー禁止）で一貫。
```

## 3. ここからの実行計画（N番号）

前提キュー（ユーザー確定）: Manager → Team Works → Page の順。前2つは実装完了済みのため、
検収と整地を挟んでPageへ進む。

### N0: 整地（今すぐ・codex）

```text
1. 分離コミット（3つに分ける・混ぜない）
   a. docs一式（戦略docs＋本計画＋索引/マスタープラン修正）
   b. 認定講座admin一式（+ types/database.ts + settings導線 + tsconfig）
   c. AI OFFICE一式（+ globals.css）※実験コード・実行ライン外（2.C参照）
2. MIKKEOS_SESSION_HANDOFF を2026-07-18版へ全面更新
   （完了: Fund F5-f / TW-P8M / Manager M1E。次: N1→N2→PG-0）
3. MIKKEOS_UI_DOCS_INDEX の「次の作業候補」を本docsのN番号へ差し替え
```

### N1: Manager M1正式検収（codex自己チェック→Fable判断）

```text
- MIKKEOS_ACCEPTANCE_CHECKLIST.md 1〜5章＋Manager計画7章＋M0レポート6章。
- 機械チェック（lint / build / hex色ゼロ / ブランド語 / 3幅 / AuthGate）は実装者が実施。
- 個人予定がActivity Log/Story/DESKのどの経路にも乗らないことをコード経路で最終確認。
- 6章判断ポイントに当たったら停止してFableへ。
```

### N2: Manager M2（設計確定はFable→実装codex）

M2の中身はManager計画4章の通り。着手順の推奨:

```text
M2-a 残アプリのアダプタ配線
     Team Works（lib/team-works-manager-adapter.ts 既存・つなぐだけ）→
     Academy / Item Studio（新規アダプタ）
M2-b 旧ルートの裏口閉鎖: /home・/marketnote をリダイレクト化、
     /os・/log の最終処遇（Fable判断を仰ぐ）
M2-c ボトムナビ再設計（Fable設計が先行条件）
     方向: OS枠の単純Manager置換はしない。ナビ痩身
     （Story/DESK常設をやめ「使っているアプリだけ見せる」Branding Policy 6-7章）
     と合わせて1回で設計する。
M2-d 文脈案内の拡張（構想書17章）＋料金正典1.5章のアップセル相乗り。
     課金壁・ポップアップは作らない。
M2-e 受信箱の設計確定（実装はPG-4と同時。Fund F4基盤は完成済みのため
     依存は解消している）
```

### N3: Page PG-0〜PG-2（キュー通り・依存なし層）

```text
正典: MIKKEOS_PAGE_IMPLEMENTATION_PLAN.md
PG-0 型・store・登録・デモ → PG-1 ブロックエディタ（自組織CMS）→
PG-2 セレクト・フィルタ（Connect/Partners）。localStorage・依存なし。
着手前にFableがPG-0の受け入れ条件を1枚に確定する。
```

### N4: セレクトショップ着手条件の解消（N3と並行可・調査から）

```text
- 着手条件: worker portalのアクセス制御をRLSで担保（発送先=個人情報）。
- まずTW-P8D（authenticated portals）/TW-P8M（connection boundaries audit）で
  どこまで担保済みかを実装者が調査報告 → 残があればFund F5-aのRLS否定テストと
  同パターンで実装。
```

### 保留のまま（変更なし）

```text
- Event後続 E1〜E5（優先順位未判断）
- Community（Academy会員モデル確定待ち）
- PG-3以降・課金実装（Supabase本接続フェーズ＋ドッグフーディング後）
```

## 4. このdocsで決めないこと

```text
- ボトムナビ痩身の具体案 → N2-c着手時にFableが別途設計
- /os・/logの最終処遇 → N2-b時にFable判断
- AI OFFICEの本格化・OS連携 → 対象外（実験のまま。やるならユーザーの別指示から）
- PG-0の詳細受け入れ条件 → N3着手時
```
