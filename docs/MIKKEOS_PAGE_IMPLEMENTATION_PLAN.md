# mikkeOS Page 実装計画

作成日: 2026-07-15
作成: Claude (Fable) — 全体設計の判断担当
実装: PG番号を指定してcodexまたはSonnetへ依頼する前提

一次資料: `G:/Musubiプロジェクト/Mikke OS/Page 正式構想書.md`

このdocsは、Page構想を現在の一本化実行ライン・既存アプリのselectors・共通部品・安全規約へ落とし込んだ実装計画です。

## 0. Pageの本質（Fable判断）

Pageは新しいデータを生むアプリではなく、**既存アプリの活動を束ねて外部へ見せるレイヤー**である。
mikkeOSが既に採用している derive-on-read（アプリ由来データを保存せず読み取り時に導出）の思想と最も相性がよい。

```text
Pageが保存するもの: ページ構成・ブロック・CMSブロックの参照設定と表示条件・
                    公開設定・（後続）掲載依頼レコード。
Pageが保存しないもの: 活動データそのもの（Story/Item Studio/Event/Academy/
                    Session/Communityが各自管理し、Pageはselectorsで読むだけ）。
```

したがって「Item Studioを更新するとPageの商品一覧も更新される」は新発明ではなく、
既存の selectors / activity 参照パターンの再利用で実現する。

## 1. 位置づけの確定

```text
Story = 個人の名刺・活動プロフィール（既存・変更しない）
Page  = 会社・団体・ブランド・個人事業のホームページ（新規）
Pageは Story の上位互換ではない。両者は別レイヤーとして併存する。
```

Connect / Partners は独立アプリにしない。PageのCMSコンテンツ種別として実装する。

## 2. 難易度の2層構造（着手判断の要）

Pageの機能は難易度が明確に2層に割れる。**軽い層を先に、基盤依存の重い層を後に**置く。

```text
軽い層（localStorageで完結・依存なし）:
  - ブロックエディタ（見出し/文章/画像/ボタン/フォーム枠/区切り）
  - 自組織CMSブロック（自分のItem Studio/Event/Academy/Session/自分のStoryを参照表示）
  - セレクト/フィルタ（おすすめ・今月・認定のみ・承認済みのみ 等）
  - Connect/Partners（CMSコンテンツ種別）

重い層（外部インフラ・他フェーズ依存）:
  - 他者データの掲載依頼（他人のStory/Item Studioを mikkeID経由で承認掲載）
    → Fund F4の本人同定・双方同意基盤 + Manager受信箱に依存
  - 公開・ホスティング・独自ドメイン
    → Supabase本接続 + DNS/SSL（Pageは外部公開が目的の初アプリ）
```

## 3. コード配置（Fable判断）

```text
新規モジュール:
  lib/page/types.ts       Page / PageDocument / Block / CmsBlock /
                          CmsSelect / PagePublication / PageListingRequest の型
  lib/page/store.ts       localStorage store（mikke.page.v1 等・
                          activity-client-store方式に合わせる）
  lib/page/cms-selectors.ts  各アプリのselectorsをPage表示用に束ねる読み取り層
                          （既存 lib/mikkeos/selectors.ts と各アプリlibを参照。
                           Pageは書き込まない）
新規ルート: app/apps/page/ 配下（下記7章）。
型追加: lib/mikkeos/types.ts の AppKey に "page" を追加。
        lib/mikkeos/apps.ts に Page の MikkeAppDefinition を追加
        （status: "planned"、accentは未使用色から選ぶ）。
```

既存アプリのlib・画面・保存処理は変更しない。Pageは各アプリを**読むだけ**。

## 4. フェーズ定義（PG-0〜PG-5・最適順）

各フェーズ完了ごとにlint/build/セルフチェック（`MIKKEOS_ACCEPTANCE_CHECKLIST.md`）＋コミット。
全Page管理ルートはAuthGate必須（新規アプリ画面のAuthGate徹底ルール）。

### PG-0: 型・store・登録・デモ（依存なし）

```text
- lib/page/types.ts / store.ts。localStorage。
- AppKeyに "page" 追加、apps.tsにPage定義追加。
- 業種色のない汎用デモPage 1件だけseed（例:「サンプル団体」ホーム＋会社概要の2ページ、
  見出し/文章/画像ブロック数個）。特定業種のノウハウを内蔵しない。
```

### PG-1: ブロックエディタ＋自組織CMS＋OS内プレビュー（依存なし）

```text
ルート（AuthGate必須）:
  /apps/page                     Page一覧（自分の作成済みサイト）
  /apps/page/new                 サイト新規作成
  /apps/page/[siteId]            サイト編集（ページ一覧・追加・削除・並び替え）
  /apps/page/[siteId]/[pageId]   ページ編集（ブロックを積む）
機能:
  - 基本ブロック: 見出し / 文章 / 画像 / ボタン / お問い合わせフォーム枠 / 区切り。
    スマホ操作前提（ブロックの追加・並び替え・削除がタップで完結）。
  - 自組織CMSブロック: 自分のItem Studio商品 / 自分のEvent / 自分のAcademy講座 /
    自分のSession / 自分のStory を cms-selectors で参照表示（承認フロー不要）。
  - OS内プレビュー（編集者だけが見る下書き表示）。まだ外部公開しない。
禁止: Studio的な自由配置は作らない（積み上げ式のみ）。
```

### PG-2: セレクト/フィルタ＋Connect/Partners（依存なし）

```text
- CMSブロックの表示データを管理者が選択・絞り込み:
  おすすめ / 今月 / 注目 / 認定のみ / 掲載承認済みのみ 等（構想のセレクト機能）。
- Connect（加盟団体/提携団体）・Partners（スポンサー/協力企業/認定販売店）を
  CMSコンテンツ種別として追加。独立アプリにはしない。
  Partners/Connectは mikkeが「1事業者として」このPage上に作るもの（2026-07-16確定）。
  OSのプラットフォーム機能ではない（MIKKEOS_MONETIZATION_AND_PRICING.md 7.1章）。
```

### PG-補記: 成約手数料徴収機能（有料機能・PG-3以降・要設計）

Pageで広告業・紹介業を営めるようにする有料機能。他HPシステムとの差別化の核。
正典: `MIKKEOS_MONETIZATION_AND_PRICING.md` 7.2〜7.3章。
**具体的な業務フロー（セレクトショップ／占い／ワークショップ／商店街）の設計は
`MIKKEOS_SELECT_SHOP_MODEL.md` を参照。** 販売は確認型（在庫確認→確定→決済）で、
Pageは申込ブロック＋確定後の決済リンクまで。成約はPageに保存せずTeam Worksが受け皿。

```text
想定フロー:
  お客様がPageを見る → 掲載提供者（例:占い師）を利用 → お客様が支払う
  → Page所有事業者のStripeで満額徴収 → 提供者の報酬はTeam Worksで設定
  → 後日振込（Team Worksのpayout） → 事業者のマージン＝実質の成約手数料

設計上の要点:
  - Stripe Connectは不要。事業者が販売者本人として通常のStripeで徴収する。
    mikkeは決済に触れない（関与しない原則）。
  - 新ブロック種別: 決済・申込ブロック（事業者のStripe決済へつなぐ）＋成約の記録。
    Stripe連携が要るためPG-3以降（Supabase接続フェーズ）が現実的。
  - 報酬管理はTeam Worksの既存payout（パートナー報酬）を再利用する。Pageに作らない。
  - 要設計: 掲載関係（PG-4のmikkeID掲載依頼→承認）と
    報酬関係（Team Worksのworker・payout）は別物。この2つの紐づけ方が肝。
  - 収支はDESKへ（売上=お客様の支払い、経費=提供者への報酬）。
    既存のActivity Log変換ルール（金額は強制private）に従う。
  - このモデルはPage＋Team Worksの両方が要る（個別課金の方針と自然に噛み合う）。
```

### PG-3: OS内公開ルート（自組織のみ・最初のSupabase接点になりうる）

```text
- 公開読み取りルート（例 /p/[slug] または /site/[handle]）。
  自組織のデータだけを外部から閲覧可能にする。
- 公開は外部からの読み取りが要るため、localStorageでは完結しない。
  ここがPageで最初にSupabase（または静的書き出し）が必要になる地点。
  方式（サーバ保存 vs 静的エクスポート）はPG-3着手時にFableが判断する。
- 内部情報（金額・原価・内部メモ・未公開下書き）は公開面に出さない
  （Activity Log安全規約・各アプリのvisibility判定を尊重）。
```

### PG-4: 他者掲載依頼（Fund F4基盤＋Manager受信箱に依存）

```text
- 他人のStory / Item Studio を mikkeID宛の掲載依頼→本人承認→掲載。
- 依存: Fund F4の本人同定・双方同意・限定公開の伝播防止
  （MIKKEOS_FUND_F4_IDENTITY_AND_CONSENT_PLAN.md のレールを再利用）。
- 依存: Manager受信箱（承認/辞退のUI。Manager計画2.5章に設計上の席を確保済み。
  設計確定はManager M2、実装はこのPG-4と同時に行う）。
- 承認後のみ表示。検索して誰でも掲載する仕組みは作らない（構想の明示禁止事項）。
- 掲載元の更新は掲載先へ自動反映（参照であってコピーしない）。ただし本人が
  掲載許可を撤回したら即座に非表示になること（撤回の伝播）。
```

### PG-5: 公開・独自ドメイン・ホスティング（Supabase本接続フェーズ）

```text
- 独自ドメインは「持ち込み式」（2026-07-16確定）。mikkeはドメインを取得・契約・
  更新・解約しない。ユーザーが自分で取得したドメインを、mikkeのホスティングへ
  向ける（DNS向け先の受け入れ＝マッピングのみ）。取得・課金・解約の面倒は持たない。
  → このフェーズは「持ち込みドメインのマッピング＋SSL＋ホスティング」に単純化。
    ドメイン代の転嫁・マージンは無し（ユーザー実費・mikke外）。
- PageはmikkeOSで唯一「外部の本物のホームページ」を目的とするアプリ。
  他アプリのlocalStorage MVP方針とは別枠のインフラ判断が要る。
- 決済・フォーム送信の実処理はこのフェーズで別途設計。
- 料金上の位置づけは MIKKEOS_MONETIZATION_AND_PRICING.md 参照
  （Pageは団体別課金・1ヶ月無料トライアル対象。公開・独自ドメイン・CMS掲載が課金起点）。
```

### PG-補記: mikkeOS製品紹介HP（ドッグフーディング）

```text
- mikkeOSの使い方を全掲載する製品紹介HPを、このPage自身で構築する（2026-07-16確定）。
  mikke自身がPageユーザー第1号。PGの実装が進んだ段階で着手。
- 配布はPWA + URL/QR。面の3層: 製品紹介LP → ログイン → OS本体(Manager HOME)。
- 製品HP用のmikkeOS全体ドメイン取得は後日todo（ユーザー持ち込みドメインとは別物）。
- 告知活動の戦略は後日別途（入口: マルシェ→MarketNote、主催者→Event 等）。
```

## 5. 実行ラインへの組み込み（ユーザー確定）

```text
- Pageは共通機能ではなく新規アプリ。番号は PG-0〜PG-5 で管理。
- ユーザー確定（2026-07-15）: 急がない。最適順でよい。codexが一本化作業中のため
  Pageはキュー最後尾。並行させない（1機能=1実装者を厳守）。
- 現在の待ち行列（参考・変動する）:
    codex進行中: Fund F4-b2
    キュー: Manager M0/M1 → Team Works TW-P0〜 → Page PG-0〜
  Pageの軽い層（PG-0〜PG-2）は依存なしでいつでも積めるが、実装者が空いてから。
```

## 6. 進捗・依存関係の一覧

```text
PG-0  型・store・登録・デモ            依存なし
PG-1  エディタ＋自組織CMS＋プレビュー   依存なし
PG-2  セレクト＋Connect/Partners       依存なし
PG-3  OS内公開ルート                   Supabase or 静的書き出し（方式は着手時判断）
PG-4  他者掲載依頼                     Fund F4 identity基盤 + Manager受信箱
PG-5  独自ドメイン・ホスティング        Supabase本接続 + DNS/SSL
```

## 7. ルート一覧（AuthGate方針つき）

```text
管理側（AuthGate必須）:
  /apps/page
  /apps/page/new
  /apps/page/[siteId]
  /apps/page/[siteId]/[pageId]
公開側（外部読み取り・PG-3以降・内部情報は出さない）:
  /p/[slug]  もしくは  /site/[handle]  （命名はPG-3で確定）
```

## 8. 禁止事項

```text
- Pageに活動データを保存しない（各アプリのselectorsを読むだけ・コピー禁止）。
- 既存アプリのlib・画面・保存処理を変更しない。
- Studio的な自由配置エディタを作らない（積み上げ式のみ）。
- 検索して誰でも他者を掲載できる仕組みを作らない（掲載は依頼→承認のみ）。
- 公開面に内部情報（金額・原価・内部メモ・未公開下書き）を出さない。
- 色は --mikke-* トークンのみ。白ベース・ネイビー×オレンジ・カードUI・広い余白。
  黒サイドバー・過剰装飾を作らない。
- PG-4/PG-5の外部インフラ・決済・ドメイン契約を前フェーズへ前倒し実装しない。
```

## 9. 検収条件（各PGフェーズ共通）

`MIKKEOS_ACCEPTANCE_CHECKLIST.md` 1〜5章に加えて:

```text
- Page管理ルートが未ログインで読み込み中になること（AuthGate）。
- 各アプリを更新するとPageのCMSブロック表示が追随すること（参照であることの確認）。
- Pageが各アプリのデータを書き換えていないこと（読み取り専用の確認）。
- 公開面（PG-3以降）に内部情報が出ないこと。
- 掲載許可の撤回（PG-4以降）が掲載先へ伝播し非表示になること。
```

## 10. このdocsで決めないこと

```text
- PG-3の公開方式（サーバ保存 vs 静的書き出し）→ PG-3着手時にFable判断。
- 公開ルートの命名（/p/[slug] vs /site/[handle]）→ PG-3着手時。
- 独自ドメインの契約・課金・DNS運用フロー → PG-5（Supabase本接続フェーズ）。
- お問い合わせフォームの実送信・決済の実処理 → 本接続フェーズ。
- Community CMSブロックの詳細 → Community本体の会員モデル確定後。
```
## 2026-07-19 訂正: Connect / Partners と Page CMS の解釈

Connect / Partners は、Pageアプリに組み込む専用機能・専用管理画面ではない。
あゆみが、PageのCMSブロックを使って自分で構築・運営していくページ構想である。

Page CMSで重要なのは、mikkeIDを軸に「どのmikkeOSアプリの何を参照できるか」「Pageに何を表示できるか」「どの公開条件なら表示してよいか」を明確にすること。
現時点のCMS参照元は Story / Item Studio / Event / Academy / Session とし、Connect / Partners はこれらを組み合わせて作れるかを検証する構築対象として扱う。

そのため、Page側に Connect / Partners 専用の保存型・追加フォーム・管理画面・独立アプリ導線を作らない。
