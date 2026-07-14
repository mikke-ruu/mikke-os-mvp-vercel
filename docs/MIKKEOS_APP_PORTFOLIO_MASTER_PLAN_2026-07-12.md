# mikkeOS アプリポートフォリオ・マスタープラン

作成日: 2026-07-12
作成: Claude (Fable) — 全体設計の判断担当
実装: 各アプリのブリーフ（BP）を他モデルへ個別に依頼する前提

このdocsは、mikkeOSに載せる全アプリの構想を1枚に組み立てたものです。
未構築アプリの「モデルにする旧アプリ」「引き継ぐもの」「捨てるもの」「作る順番」を確定します。

UI・共通部品・Activity Log接続の設計は `MIKKEOS_DESIGN_REVIEW_AND_NEXT_PHASE_2026-07-11.md`（WP-1〜7）に従います。このdocsはその上に載る「何をどの順で建てるか」の計画です。

---

## 1. 全アプリの現在地

### 進行中（UI統一の指示済み・このdocsの対象外）

```text
Story       公開プロフィール・名刺。UI基準。
DESK        収支・請求・領収書。WP-5でStory基準で建てる。
MarketNote  出店管理。SPEC_00〜10あり。WP-6で見た目差し替え。
Team Works  アリサ日本語会話テンプレート。別部屋進行。
Academy     講座管理。別ライン進行（raw event方式）。
```

### 未構築（このdocsの対象）

```text
Order        モデル: 旧miraco
Event        モデル: 旧Mikkeruu（Mikkeruu-codex）
Item Studio  モデル: item-studio_2
Session      構想段階（Order派生）
Fund         構想段階（Order派生・FUND_APP_CONCEPT.mdあり・利用希望者1名）
Community    構想段階（Academy連動）
```

---

## 2. 実行ライン（2026-07-12改訂: 需要優先で一本化）

### 2.0 運用の大原則（改訂で追加）

進行中アプリ（Team Works / Academy / MarketNote）の「別部屋・別ライン」進行を廃止し、**全アプリをこの1本の実行ラインに統合する**。実装者はcodexに一本化し、このdocsと設計レビューdocsのWP/BP番号を契約として進める。

理由: 別部屋方式の分岐はすでにコードに現れている（Team Worksの `.tw-app` 独自CSS上書き、Academyの独自コンポーネント群）。部屋を分けたまま進むと「後で揃える対象」が増え続け、UI統一のコストが雪だるまになる。

別部屋を使ってよいのは次の2つだけ:

```text
- docsだけ書く作業（仕様抽出BP-x-a など。コードを触らないので衝突しない）
- Mikkeruu-codexの本番運用（OSとは別製品として併存が確定しているもの）
```

### 2.1 進行中アプリが今日から守る凍結ルール

WP-2/3（共通部品）が届くまでの間、進行中アプリの機能実装は止めなくてよい。ただし:

```text
1. 新しい色・独自CSS上書きを追加しない（.tw-app方式の拡大禁止）
2. 新画面の色はWP-1のトークンだけを使う
3. ヘッダー・メニューは仮のままでよい（WP-2のMikkeAppShellが来たら差し替え）
4. 新しいカード・一覧の形を発明しない（Storyの既存の形に似せておく）
```

### 2.2 実行順（需要優先: Team Works / MarketNote / Event / Academy を先に）

```text
基盤（直列・最優先）:
  WP-1 トークン統一（codex着手済み）
  → WP-2 MikkeAppShell + MikkeOwnerMenu
  → WP-3 基本部品5つ
  → /apps と /apps/* へ適用（部品の実地テスト）

需要優先ブロック（基盤完了後、この順で直列）:
  P1: Team Works UI統一パス
      12ページのヘッダー・カード・一覧・詳細を共通部品へ。
      .tw-app上書きを解消。機能・保存処理は触らない。
      機能追加が残っていれば、統一パス後は共通部品で作る。
  P2: MarketNote 完成
      WP-6（見た目差し替え）＋ SPEC_00〜10の残機能を共通部品で実装。
  P3: Event MVP実装（BP-2-b）
      仕様抽出BP-2-aは基盤と並行して今すぐ依頼可（docsのみ）。
  P4: Academy 合流
      raw event方式・別ラインの成果はそのまま活かすが、
      以後の新画面は本線で共通部品を使って作る。
      既存Academy画面の統一パスはP4で実施。

後続ブロック（需要ブロック完了後）:
  DESK（WP-5）→ Order（BP-1）→ Item Studio（BP-3）
  → Session / Fund（Order派生）→ Community（Academy連動）

補足（2026-07-12 Fable承認）: P4のうち「Academy既存画面のUI統一パス」と、
「OS中心画面（/os /log /desk /settings）の統一＋文言掃除（Phase UI-0相当）」は
設計判断が不要な機械的作業のため、P2-b/P3の実装判断を待つ間に前倒し実行してよい。
実行順の入れ替えはこの2件のみ（他の順序変更はチェックリスト6章によりFable相談）。
```

### 2.3 この改訂のトレードオフ（承知の上で進む）

```text
- Order・Fundが後ろへずれる。Fundの利用希望者（2026-07-04）は待たせる。
  待たせる間にヒアリングだけ済ませておくと、着手時に速い。
- DESKも後ろへずれる。共通部品の実地テストはDESKの代わりに /apps で行う。
- Team Works / Academyの機能进行は一時的に「凍結ルール付き」になるが、
  停止はしない。
```

### 2.4 未構築アプリ間の順序（元の確定順・変更なし）

```text
Order → Event → Item Studio → Session → Fund → Community
```

ただしEventのみ需要優先ブロック（P3）へ繰り上げ。OrderがEventより後になるが、EventはOrder構造に依存しないため問題ない（依存するのはSession/Fund）。

理由:

- **Orderが要石。** SessionもFundもOrderの派生として設計済み（FUND_APP_CONCEPT.md 3章）。Orderの「LP → 申込 → 顧客情報 → 金額 → ステータス」構造を最初に固めると、後続2アプリの実装が「Orderの改造」で済む。
- Fundには実利用希望者がいる（2026-07-04）が、先にFundを単発で作るとOrderと二重構造になる。Order完成後にFundへ派生する方が総工数が小さい。
- EventはMikkeruu-codexという完成した手本があるため、仕様の迷いが少なく2番目に適する。
- Item Studioは台帳（データ）中心でUI量が少なく、共通部品が枯れた頃に速く作れる。
- CommunityはAcademyの進行に依存するため最後。

---

## 3. 旧アプリをモデルにする時の共通ルール（全ブリーフ共通・厳守）

```text
1. 旧アプリのHTML/JSコードを直接コピー・移植しない。
   まず「仕様抽出docs」（画面一覧・データ項目・フロー図）を作り、
   それを元にmikke共通部品（WP-2/3）で新規実装する。

2. 旧アプリの色・フォント・装飾は持ち込まない。
   色はglobals.cssのトークン＋apps.tsのaccentのみ。
   持ち込むのは「画面構成・フロー・言葉づかい・思想」。

3. 旧アプリ本体は変更しない。稼働中のものは稼働し続ける。

4. Activity Log接続はWP-4の規約
   （adapter一本化・金額は強制private・source_record_id一意）に従う。

5. DB migration / Supabase本接続 / RLS / 決済実装はしない。
   保存はlocalStorage（既存activity-client-storeの形）で建てる。
```

---

## 4. アプリ別設計

### 4.1 Order（モデル: 旧miraco）

miracoの本質は「デザイン受注アプリではなく、相談できる場所」。この思想をOrderの性格として引き継ぐ。

引き継ぐもの:

```text
- メニュー選択 → 申込フォーム → 確認 → 完了 の遷移フロー
- 管理側のメニュー追加・編集（受付メニューを自分で作れる）
- 申込一覧とステータス管理
- 「相談から始まる」導線（いきなり注文させない。まず相談でもよい）
- 上品で事務的すぎない言葉づかい（「ご依頼」「ご相談」）
```

捨てるもの:

```text
- ユーワード固有の文言・メニュー内容
- ベージュ／ブラウンの独自カラー（--accent: #B8896F 等）
- 単一HTML構造・data-nav遷移・miraco_* localStorageキー
- チャットデモ・支払いデモ（デモ実装は引き継がない）
```

Order MVPの画面:

```text
公開側: 受付メニュー一覧 / メニュー詳細 / 申込フォーム / 確認 / 完了
管理側: 申込一覧（ステータス: 相談中→見積→制作中→納品済み）/
        メニュー管理 / 申込詳細（メモ・金額・支払い状態）
```

Activity Log出力（変換ルール表に追加する行）:

```text
依頼受付・納品完了       → Story候補（storyEnabled、金額なし）
受注金額・入金確認       → DESK対象（deskEnabled、強制private）
```

**Fund/Sessionへの派生を最初から意識する設計上の一点:**
「メニュー（何を頼めるか）」「申込（誰が・何を・いくらで）」「ステータス」の3つを型として分離しておく。Fundは「メニュー→応援プラン」「申込→支援」、Sessionは「メニュー→予約枠」に読み替えるだけで済む形にする。

### 4.2 Event（モデル: 旧Mikkeruu / Mikkeruu-codex）

**最重要判断: Mikkeruu-codexは移植しない。併存させる。**

Mikkeruu-codexは79万字の単一HTMLで、Supabase接続・メール送信・アルバム・アンケート・交流会まで持つ完成品として実運用中。これをOS内へ移植するのは数ヶ月級の工事で、UI統一の目的に対して割に合わない。

方針:

```text
- Mikkeruu-codex = 大規模バザール運営の本番ツールとして単体継続。
- OS内Event = Mikkeruuの中核サブセットだけをmikke部品で新規実装。
  「小さなイベントを1人で立てて申込を受ける」に絞る。
- 将来、MikkeruuのデータをActivity Logへ流す外部接続は別フェーズで検討
  （source_service: mikkeruu として。今は設計しない）。
```

Event MVPで引き継ぐ画面構成（Mikkeruuから仕様だけ抽出）:

```text
公開側: イベント一覧 / イベント詳細LP / 出店・参加申込フォーム
管理側: イベント作成（ウィザード形式を踏襲・ただし簡略化）/
        申込一覧（ステータス: 申込→承認→確定）/ 開催後メモ
```

Event MVPに入れないもの（Mikkeruuにあるが見送り）:

```text
アルバム / アンケート / 交流会 / お礼メール一括送信 /
アイキャッチ提出 / タスク逆算 / 領収書発行
```

Activity Log出力:

```text
イベント作成・開催完了   → Story候補
参加費売上・会場費       → DESK対象（強制private）
```

### 4.3 Item Studio（モデル: item-studio_2）

item-studio_2は「写真補正（API・Vercel）＋商品管理」の2つの顔を持つ。OS内では**台帳を主・写真補正を従**にする。

方針:

```text
- OS内Item Studio MVP = 商品台帳（作品・在庫・出品先・販売記録）。
- 写真補正はMVPに入れない。当面は item-studio_2 への外部リンクを
  メニューに置く（「写真をきれいにする」→既存アプリを開く）。
- 補正APIのOS統合は台帳が定着してからの第2段階。
```

Item Studio MVPの画面:

```text
作品・商品一覧（写真グリッド）/ 商品詳細（写真・価格・在庫・出品先）/
商品登録 / 販売記録（どこで・いくらで売れたか）
```

Activity Log出力:

```text
作品登録・出品           → Story候補（作品ポートフォリオの供給源）
販売記録・材料費         → DESK対象（強制private）
```

Storyの「作品」タブの供給源はItem Studioにする。Story側に別の作品登録を作らない（二重管理禁止）。

### 4.4 Session（構想段階 → Orderの派生）

単体設計しない。Order完成後、Orderの読み替えで作る。

```text
メニュー   → 予約メニュー（60分相談、レッスン等）＋時間枠
申込       → 予約（日時選択が加わる）
ステータス → 予約確定 → 実施済み → キャンセル
```

Order MVPとの差分は「日時枠の管理」だけ。カレンダーUIはMarketNoteのカレンダー実装（SPEC_01）を参考にできる。着手はOrder完成後に判断。

### 4.5 Fund（正式構想・F3完成・F4-a schemaレビュー完了 → F4-b1承認待ち）

2026-07-14に `G:/Musubiプロジェクト/Mikke OS/MikkeOS Fund 正式構想書.md` が完成した。
repo内の実装順・型・ルート・検収条件は `MIKKEOS_FUND_IMPLEMENTATION_PLAN.md` を正典とする。
`FUND_APP_CONCEPT.md` は初期構想の履歴資料へ変更した。

```text
- Order完成後に着手（Orderの読み替え: メニュー→応援プラン、申込→支援）。
- Order MVPは完成済み。正式構想をF1〜F5へ分割して実装する。
- F1はlocalStorage、外部申込・外部決済リンク、単一目標、公開ページまで完了。
- F2は応援者手動登録、活動報告、提供管理、除外集計まで完了。
- F3は挑戦の軌跡、Story入口、local Activity Log、引き継ぎ候補まで完了。
- F4の本人同定・双方同意・RLS設計は `MIKKEOS_FUND_F4_IDENTITY_AND_CONSENT_PLAN.md` に分離済み。
- F4-aはDB変更なしの読み取り確認・schemaレビューまで完了。結果は `MIKKEOS_FUND_F4_SCHEMA_AND_RLS_REVIEW.md`。
- Fund本体がlocalStorageのままでは所有者をRLSで検証できないため、F4-bを所有基盤のb1と招待・同意のb2へ再編した。
- F4-b1以降のmigration / RLS / 本接続は別承認とする。
- 言葉のルール厳守: 「出資・投資・配当」禁止、「応援・支援・予約購入」を使う。
- アプリ名は Fund 単体。Mikke Fundとしない（Branding Policyと一致）。
```

Activity Log出力:

```text
プロジェクト公開・達成   → Story候補
支援金・リターン原価     → DESK対象（強制private）
```

### 4.6 Community（構想段階・Academy連動）

最後に着手。理由: Academyのraw event方式（`academy_activity_events` → OS側変換）が先に固まると、Communityも同じ型で作れる。単体で設計を先行させない。

```text
- 会員・月会費の構造はAcademyの受講者・受講料と共通化できる可能性が高い。
- Academy側の会員モデルが見えてから設計する。
```

---

## 5. 型の追加（WP-4への追記事項)

`lib/mikkeos/types.ts` の `AppKey` に、`team_works` に加えて `fund` を追加する。
`apps.ts` に Fund の `MikkeAppDefinition` を追加（status: "planned"、accentは未使用色から選ぶ）。
Sessionは既にAppKeyにあるため追加不要。

---

## 6. アプリ構築ブリーフ（BP）— 他モデルへの依頼単位

各アプリは必ず2段階で依頼する。**1段階目と2段階目を同じ依頼にまとめない**（仕様抽出を飛ばして実装に入るのを防ぐため）。

### 段階1: 仕様抽出（BP-x-a）

旧アプリを読み、以下をdocs 1枚にまとめる。コードは書かない。

```text
- 画面一覧（公開側・管理側）
- 各画面のデータ項目
- 状態遷移（ステータスの流れ）
- 引き継ぐ言葉づかいの例
- 4章の「捨てるもの」に該当する箇所の確認
```

### 段階2: 実装（BP-x-b）

仕様抽出docsとmikke共通部品（WP-2/3完了後）だけを見て実装する。旧アプリのコードは開かない。

### ブリーフ一覧

```text
BP-1-a: Order仕様抽出（読む対象: miraco/preview (2).html, MIRACO開発方針.md）
BP-1-b: Order MVP実装（4.1章 + 派生を意識した3分離）
BP-2-a: Event仕様抽出（読む対象: Mikkeruu-codex/githubtest/index.html の画面と
        Mikke-ruu_画面目的と機能配置.md。※コード79万字を全部読まず、
        画面目的docsを主にする）
BP-2-b: Event MVP実装（4.2章のサブセットのみ）
BP-3-a: Item Studio仕様抽出（読む対象: item-studio_2/item-studio.html, 引き継ぎ書）
BP-3-b: Item Studio MVP実装（台帳のみ・写真補正は外部リンク）
BP-4:   Session実装（BP-1-b完了後に判断。単独の仕様抽出は不要）
BP-5:   Fund実装（BP-1-b完了済み。MIKKEOS_FUND_IMPLEMENTATION_PLAN.mdのF1から段階実装）
BP-6:   Community（Academyの会員モデル確定後に仕様化）
```

依頼の前提条件:

```text
BP-x-a（仕様抽出）はいつでも依頼可（WP完了を待たない。docsを書くだけなので）
BP-x-b（実装）は WP-1〜3（トークン・AppShell・基本部品）完了後
BP-2-b（Event実装）は需要優先ブロックP3として先行（2.2章の改訂による）
Session / Fund の実装は BP-1-b（Order）がレビューを通ってから（Order構造に依存するため）
```

---

## 7. このdocsで決めないこと

```text
決済（Stripe等）の実装方式      → 各アプリのSupabase本接続フェーズで
Mikkeruu-codexのActivity Log接続 → 別フェーズで検討
Fundの料金確定・法務文言・本部運用 → F5前に別途判断
Communityの詳細設計              → Academy会員モデル確定後
```

## 8. Event後続フェーズ（2026-07-13追記）

Event MVP第1パス（BP-2-b）完了後の計画として、イベントポータルとMarketNote自動連携を
`docs/MIKKEOS_EVENT_PORTAL_AND_MARKETNOTE_LINK_PLAN.md` に記録済み（設計のみ・実装未着手）。
Phase E1（Supabase移行）〜E5（MarketNote自動登録）の5段階。着手は別途指示を受けてから。
