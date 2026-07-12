# mikkeOS 全体設計レビューと次フェーズ計画

作成日: 2026-07-11
作成: Claude (Fable) — 全体設計の判断担当
実装: 各作業パッケージ（WP）を他モデルへ個別に依頼する前提

このdocsは、codexからの設計レビュー依頼6項目への回答と、次フェーズの作業パッケージ定義です。

前提の確認（依頼文の通り）:

- mikkeOSは裏側の共通基盤・シリーズ名。表側はアプリ名が主役。
- コアは Mikke ID + Activity Log。
- 触らない: DB migration / Supabase本接続 / RLS / 本番データ設計の確定。

---

## 1. 構造の妥当性（回答: 妥当。ただし直すべき歪みが3つ）

「OS土台 + アプリを置いていく」という現在の構造は、この段階として正しいです。

正しくできている点:

- `lib/mikkeos/` にOSコア（型・adapter・store・集計）が集まっており、アプリ本体（`lib/marketnote.ts` `lib/team-works.ts` `lib/academy/`）と分離できている。
- 通常表示はlocalStorage/mock、Supabaseはテスト枠という二層構造。`activity-client-store.ts` と `activity-adapter.ts` の境界が薄く保たれている。
- `toSupabaseActivityLogInsert()` の「金額ログは強制的に `visibility: private` / `display_on_story: false`」という安全弁は、公開事故防止として設計レベルで正しい。壊さないこと。
- 単一Next.jsリポジトリのまま。この規模でrepo分割は不要。分割はSupabase本接続とユーザー認証が固まってからで遅くない。

直すべき歪み:

### 歪みA: `AppKey` に `team_works` がない

`lib/mikkeos/types.ts` の `AppKey` は
`market_note / event / order / item_studio / academy / session / community` の7つ。

Team Worksは `/apps/team-works` 配下に12ページ、`lib/team-works.ts` 702行まで育っているのに、Activity Logへ書き込む経路が型レベルで存在しない。「授業完了はStory候補、請求・報酬はDESK対象」という方針（Phase 4.5 docs）を実装できない状態。

対応: `AppKey` に `team_works` を追加し、`toSupabaseSourceService()` と `toSupabaseActivityCategory()` に対応分岐を足す。今はまだ書き込まなくてよいが、型の欠落だけ先に埋める。

### 歪みB: MarketNoteの名前が3系統ある

```text
ルート:          /marketnote と /apps/market-note
AppKey:          market_note
source_service:  marketnote
```

変換は `toSupabaseSourceService()` に隠れているが、ルートが2系統あるのは事故のもと。`lib/mikkeos/routes.ts` を「AppKey → ルート」の唯一の対応表にし、全リンクをそこ経由にする。

### 歪みC: 色が三重管理になっている

`app/globals.css` にCSS変数（`--foreground: #07152f` など）があるのに:

- `StoryProfile.tsx` は `#111827` `#1f2a7a` `#e6e8ef` を直書き
- `OsShell.tsx` は `#07152f` `#e7ebf2` `#f46a14` を直書き

ネイビー系だけで `#07152f` `#111827` `#1f2a7a` の3種類が混在。**このまま共通部品を切り出すと、ズレた色が部品に焼き付く。** 部品化の前にトークン統一が必要（WP-1）。

---

## 2. 次に作るべき共通部品（回答: 部品の前にトークン。部品は5つに絞る）

順番が重要です。

```text
0. デザイントークン統一（WP-1）… 部品より先
1. MikkeAppShell（WP-2）… OsShellの後継。ブランド方針準拠
2. MikkeOwnerMenu（WP-2）… StoryOwnerMenuの汎用化。右上ハンバーガー
3. MikkeSection / MikkeListRow / MikkeStatusBadge（WP-3）
4. MikkeActionCard / MikkeEmptyState（WP-3）
```

ロードマップに15個の部品候補が並んでいるが、最初から作るのは上の5〜7個だけ。
`MikkeMetricCard` `MikkeSegmentedTabs` `MikkeTemplatePreview` などは、使う画面を移行する時に初めて切り出す（先回りで作ると未使用部品が腐る）。

MikkeAppShellの要件（OsShellとの差分）:

- `brandLabel` のデフォルトを `"mikkeOS"` にしない。アプリ名が主役。
- グローバルナビから `Log` を外す。Logへの導線はOwnerMenu（本人用メニュー）内に置く。
- 右上にハンバーガー（MikkeOwnerMenu）を標準装備。Storyで実装済みの形を移植。
- フッターに小さく `{アプリ名} by mikke` を置けるようにする。
- モバイル下部ナビは維持（現OsShellの実装は良い）。ただし項目は `OS / Story / DESK / Apps` の4つ+現在のアプリ。

---

## 3. Story基準UIの展開順（回答: DESK → MarketNote → Order）

依頼の3アプリについて、この順番を推奨します。

```text
1. DESK        … 最小・最速。app/desk/page.tsx は17行の器だけ。
                  リデザインではなく「Story基準で最初から作る」対象。
                  単体アプリとして見せる方針（Branding Policy 5章）とも一致。
2. MarketNote  … 実装スペック(SPEC_00〜10)が既にあり、画面仕様が固い。
                  ヘッダー・カード・一覧・詳細の4点だけ共通部品に置換。
                  ロジック・保存処理は触らない。
3. Order       … status: prototype でミニページしかない。
                  リトロフィット不要。作る時が来たら最初から共通部品で建てる。
                  よって「展開」作業としては実質最後尾でよい。
```

理由: DESKは空に近いので共通部品の実地テストに最適。MarketNoteは仕様が固まっているので「見た目だけ差し替え」の境界を守りやすい。Orderはまだ建っていないので、揃える対象ではなく最初から揃った状態で建てる。

この前に `/apps` と `/apps/*`（入口ページ8枚）を先に揃えるのはロードマップ通り。入口が揃うと「同じOSの中」感が一番安く手に入る。

---

## 4. 各アプリをActivity Logへつなぐ設計（回答: adapter一本化＋raw event境界の明文化）

現在の設計を維持しつつ、次の4点を固めます。

### 4.1 書き込み経路は一本だけ

```text
各アプリ → UnifiedActivityLog を作る → activity-store（localStorage）
                                      → 将来: ActivityLogAdapter.create() → Supabase
```

アプリが直接Supabaseへ書く経路を作らない。`toSupabaseActivityLogInsert()` の安全弁（金額→強制private）を必ず通す。

### 4.2 アプリ別の接続方式は2種類に分ける

```text
方式1: プリセット直結型 … MarketNote / Order / Item Studio / Session / Event
        アプリ内の操作が ActivityActionPreset を通して即 UnifiedActivityLog になる。
        既存の app-actions.ts の形。

方式2: raw event変換型 … Academy / Community / Team Works
        アプリ内では独自イベント（例: academy_activity_events）に溜め、
        OS側の変換層が UnifiedActivityLog に変換する。
```

変換責務の置き場所（Phase 4.5の未決事項への回答）: **OS側**に置く。
`lib/mikkeos/adapters/academy.ts` のような「OSコア側の変換ファイル」を作り、`lib/academy/` はOSを知らないままにする。理由: Academy/Communityは別ライン実装中で仕様が動く。動く側（アプリ）に変換を持たせると、OSの型変更が毎回アプリに波及する。

### 4.3 重複防止を本接続前に決める

`SupabaseActivityLogInsert` には `source_record_id` があるが、重複挿入を防ぐ仕組みが未定義。本接続前に「`source_service + source_record_id + activity_type` で一意」をアプリ側規約として決めておく（DB制約の追加は本接続フェーズで。今は規約だけ）。

### 4.4 Team Worksの分類ルールを変換ルール表に追加

授業完了 → Story候補 / 学校請求・パートナー報酬 → DESK対象・強制private。
`MIKKEOS_ACTIVITY_LOG_CONVERSION_RULES.md` にTeam Works行を追加する。

---

## 5. Supabase本接続前に固める画面・導線（回答: 5つ）

本接続の順番はPhase 4.5の推奨（/log → /story → /desk → /os）を維持。その前に固めるべきは:

```text
1. MikkeOwnerMenu の導線
   持っているアプリ / 管理画面 / 繋げますか提案。
   これが決まらないと「どの画面から何が見えるか」の公開境界が決まらない。

2. Story の公開面と本人面の分離
   公開Storyに出る情報の最終チェックリスト
   （プロフィール・実績サマリー・作品・口コミ・リンクのみ。ログ時系列は出さない）。

3. /log の表示仕様
   localStorageログとSupabaseログの共存 or 切り替え。
   推奨: feature flag で切り替え表示（混在させない）。
   混ぜると重複・欠落がデバッグ不能になる。

4. DESK の分類画面
   売上/経費/報酬/外注費/会費/更新料 の見せ方。
   transaction_type だけで足りるか、ここで画面から逆算して判断する。

5. 設定画面のアプリ接続ON/OFF
   「アプリを繋げる」体験の器。所有判定の本実装は不要、UIと状態だけ。
```

UIが固まってから本接続する理由: 画面が要求するデータの形が確定してからDBに触る方が、migration回数が減る。逆順にやるとRLSとデータ設計をやり直すことになる。

---

## 6. ブランド設計チェック（回答: 方針は正しい。既存コードに違反が3つ）

Branding Policy自体は良い設計。既存コードとの矛盾:

```text
違反1: OsShell の brandLabel デフォルトが "mikkeOS"
       → 全コア画面の最上部にオレンジ大文字で mikkeOS が出ている。
       → MikkeAppShell 移行時にデフォルトを「アプリ名」へ。

違反2: グローバルナビ（PC上部・スマホ下部）に Log が常時露出
       → Activity Log は前面に出さない方針と矛盾。
       → Log は OwnerMenu 内の管理項目へ移動。

違反3: by mikke 表示がどこにもない
       → Story公開面の下部に小さく Story by mikke を置く（最初の1箇所）。
```

Storyの公開面がOsShellを使わず独自ヘッダーなのは正しい。公開面にOSナビを出さない構造は維持。

---

## 7. 作業パッケージ（他モデルへの依頼単位）

各WPは独立して依頼できる粒度。**全WP共通の禁止事項: DB migration / Supabase本接続 / RLS / 保存処理の変更 / 本番データ設計の確定。**

### WP-1: デザイントークン統一（最初。他の前提）

- `globals.css` のCSS変数を正とし、Storyの実色に合わせて値を確定する
  （ネイビーは1色に統一。`#07152f` / `#111827` / `#1f2a7a` のどれにするかはStoryの見た目を正とする）。
- `StoryProfile.tsx` / `OsShell.tsx` のハードコード色をCSS変数参照へ置換。
- 見た目が1pxも変わらないことを目視確認（PC 1280 / タブレット768 / スマホ375）。
- 成果物: 変更済みcss/tsx + 変数一覧表をdocsに1枚。

### WP-2: MikkeAppShell + MikkeOwnerMenu（WP-1の後）

- OsShellを元に MikkeAppShell を新規作成（OsShellは残し、画面ごとに移行）。
- 2章の要件（brandLabel / Logをナビから外す / ハンバーガー / by mikkeフッター）。
- StoryOwnerMenu を MikkeOwnerMenu へ汎用化（アプリ名・メニュー項目をprops化）。
- 適用第1号: `/apps` と `/apps/*` の8ページ。

### WP-3: 基本部品3+2（WP-2と並行可）

- MikkeSection / MikkeListRow / MikkeStatusBadge、次いで MikkeActionCard / MikkeEmptyState。
- Storyの既存マークアップから切り出す（新デザインを発明しない）。

### WP-4: 型と対応表の整備（小。いつでも可）

- `AppKey` に `team_works` 追加、`toSupabaseSourceService` / `toSupabaseActivityCategory` 対応。
- `routes.ts` を AppKey→ルートの唯一の対応表にする。
- `MIKKEOS_ACTIVITY_LOG_CONVERSION_RULES.md` にTeam Works行を追加。
- 重複防止規約（source_service + source_record_id + activity_type 一意）をdocsに明文化。

### WP-5: DESKをStory基準で建てる（WP-2/3の後）

- `app/desk/page.tsx` を共通部品で実装。データは現行のlocalStorage集計のまま。
- 分類（売上/経費/報酬/外注費/会費/更新料）の見せ方をこのWPで画面から逆算して提案させる。

### WP-6: MarketNoteの見た目差し替え（WP-5の後）

- ヘッダー・カード・一覧・詳細の4点のみ共通部品へ。ロジック・保存は触らない。
- SPEC_00〜10と画面が食い違う場合は、直さずdocsに差分メモを残す。

### WP-7: ブランド違反の解消（WP-2に同梱でも可)

- 6章の違反1〜3を解消。

依頼順の目安:

```text
WP-1 → WP-2 → WP-3 →（WP-4はどこでも）→ /apps適用 → WP-5 → WP-6
```

---

## 8. このレビューで変えないこと

- Phase 4.5の本接続順（/log → /story → /desk → /os）は変更しない。
- `toSupabaseActivityLogInsert` の強制privateロジックは変更禁止（緩める変更は全て要レビュー）。
- Academy / Community / Team Works の本体仕様には踏み込まない（別ライン進行を尊重）。
