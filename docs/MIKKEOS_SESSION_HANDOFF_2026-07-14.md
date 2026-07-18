# mikkeOS セッション引き継ぎ（2026-07-18版）

新しいセッション・別モデルはまずここを読む。詳細は各docsへのリンク先を参照。

## 体制

```text
設計判断: Fable / Claude
実装: codex または Sonnet（同時に1人だけ・作業ツリーを分けない）
検収の自己チェック: 実装者が実施
Fableに戻す判断: docs/MIKKEOS_ACCEPTANCE_CHECKLIST.md 6章
```

正典の読み順:

```text
1. docs/MIKKEOS_NEXT_PHASE_PLAN_2026-07-18.md
2. docs/MIKKEOS_UI_DOCS_INDEX.md
3. docs/MIKKEOS_APP_PORTFOLIO_MASTER_PLAN_2026-07-12.md
4. このdocs
```

## 現在地

```text
最新確定コミット: e6f27cc Refine Manager M1E app-first guidance

完了:
- Fund F5-fまで完了
- Team Works TW-P8Mまで完了
- Manager M0〜M1Eまで完了

次:
- N0 整地
- N1 Manager M1正式検収
- N2 Manager M2設計・実装
- N3 Page PG-0〜PG-2
```

## Managerの体験方針（2026-07-18確定）

```text
入口はあくまで個々のアプリ。
Managerは巨大なOSホームでも、ログイン直後の唯一の玄関でもない。

Managerで見るもの:
- 次にやること
- 他のアプリで進んでいること
- 状況に応じた「こんなアプリもあるよ」という控えめな提案

禁止:
- / やlogin後を単純に /manager へ変える
- Managerを全アプリ一覧の中心にする
- Activity Logなど内部語を利用者画面へ出す
```

正典:

```text
docs/MIKKEOS_MANAGER_INTEGRATION_PLAN.md
docs/MIKKEOS_MANAGER_M0_REPORT.md
```

## N0 整地の扱い

作業ツリーには別スコープの未コミット差分が混在している。N0では3つに分けてコミットする。

```text
1. docs一式
   - 戦略docs
   - 本計画
   - UI index / マスタープラン修正
   - このhandoff

2. 認定講座admin一式
   - app/nintei-koza-admin/
   - components/nintei-koza/
   - lib/nintei-koza/
   - types/database.ts
   - app/settings/page.tsx の導線
   - 必要なら tsconfig の実差分

3. AI OFFICE一式
   - app/apps/ai-office/
   - components/ai-office/
   - lib/ai-office/
   - app/globals.css
   - docs/MIKKEOS_AI_OFFICE_MVP_SPEC.md
```

AI OFFICEは実験・試作段階。mikkeOSの実行ラインへ登録しない。Manager / Activity Log / AuthGate連携も不要。

## 次フェーズ

### N1: Manager M1正式検収

```text
- lint / build
- /manager配下6ルートのAuthGate
- Manager画面にActivity Logの内部語が出ていない
- 個人予定がActivity Log / Story / DESKへ流れない
- 元アプリのstoreへManagerから書き込まない
- 3幅・ブランド語・hex色チェック
```

### N2: Manager M2

```text
M2-a Team Works / Academy / Item Studio アダプタ
M2-b /home・/marketnote 旧裏口の処遇、/os・/logの最終判断
M2-c ボトムナビ再設計（単純なManager置き換えは禁止）
M2-d 文脈案内の拡張
M2-e 受信箱設計確定
```

### N3: Page PG-0〜PG-2

正典: `docs/MIKKEOS_PAGE_IMPLEMENTATION_PLAN.md`

```text
PG-0 型・store・登録・デモ
PG-1 ブロックエディタ
PG-2 セレクト・フィルタ
```

## 保留・注意

```text
- CommunityはAcademy会員モデル確定待ち
- Event後続E1〜E5は優先順位未判断
- PG-3以降・課金実装はSupabase本接続フェーズ＋ドッグフーディング後
- Nintei / AI OFFICE / Page docsをManagerやTeam Worksコミットへ混ぜない
```
