# mikkeOS Order Spec Extract

作成日: 2026-07-13
対象: BP-1-a（仕様抽出）。旧miracoの仕様をOrder MVP向けに抽出する。miraco本体は変更しない。

一次資料:

- `G:\Musubiプロジェクト\miraco\MIRACO開発方針.md`

マスタープラン境界（`MIKKEOS_APP_PORTFOLIO_MASTER_PLAN_2026-07-12.md` 4.1章に従う）:

- miracoのコード（`preview (2).html` / `index.html`）は直接移植しない。仕様・思想だけを引き継ぐ。
- Session / Fund は将来Orderから派生する前提のため、「メニュー・申込・ステータス」を型として分離しておく。

## 1. プロダクトの役割

miracoの本質は「デザイン受注アプリではなく、相談できる場所」。この思想をOrderの性格として引き継ぐ。

「何を頼めばいいかわからない」人が、いきなり注文するのではなく、まず相談から始められる入口にする。

## 2. 引き継ぐもの

```text
- メニュー選択 → 申込フォーム → 確認 → 完了 の遷移フロー
- 管理側のメニュー追加・編集（受付メニューを自分で作れる）
- 申込一覧とステータス管理（新着/対応中/納品済みのようなフィルタ思想）
- 「相談から始まる」導線・言葉づかい（「ご依頼」「ご相談」、事務的すぎない）
- 見積り内訳の考え方（基本料金＋オプション加算）は概念として引き継ぐが、
  最初のMVPでは固定金額のみとし、自動見積りはWave 2以降で検討
- 進捗ステッパー（ヒアリング→見積り→制作→確認→納品）という段階思考
```

## 3. 捨てるもの

```text
- miraco固有の文言・メニュー内容（名刺づくり等ユーワード文脈）
- ベージュ／ブラウンの独自カラー（--accent: #B8896F 等）
- 単一HTML構造・data-nav遷移・miraco_* / miraco.db のキー設計
- チャット風メッセージ機能（デモ実装は引き継がない。連絡は既存の
  外部手段＝メール等を案内する形にする。将来必要なら別途設計）
- LINE連携・マジックリンクログイン・IndexedDB同期・Supabase即時接続
- 支払い方法選択・支払いデモ・レビュー公開機能（MVP外）
- カラーテーマ切り替え機能（Storyのテーマ機能と重複するため、
  Order単体では持たない）
```

## 4. 画面構成（Order MVP）

miracoの11画面（ユーザー側）+ 2画面（管理者側）から、MVPに必要な最小構成へ絞る。

| miraco画面 | Order MVPでの扱い |
|---|---|
| ホーム | 持たない（`/apps/order` ダッシュボードが代わり） |
| メニュー一覧 | `/order`（公開） |
| メニュー詳細 | `/order/[id]`（公開、LP形式） |
| 申込みフォーム | `/order/[id]/apply`（公開） |
| 確認画面 | apply内のステップとして扱う（別ルートにしない） |
| 完了画面 | `/order/[id]/apply/complete`（公開） |
| マイページ | MVP外（Event同様、推測可能URLでの個人情報露出リスクのため見送り） |
| チャット風画面 | MVP外 |
| お見積り画面 | MVP外（固定金額のみのため不要） |
| 支払い方法選択 | MVP外 |
| 納品ページ | MVP外 |
| 管理画面トップ | `/apps/order`（ダッシュボード） |
| メニュー追加 | `/order/admin/new` `/order/admin/[id]`（作成・編集は共有フォーム） |
| （新設）申込一覧 | `/order/admin/[id]/applications`（Event同様、メニュー単位ではなく
  Order全体の申込一覧が実用的なため `/order/admin/applications` に変更） |

Order MVPの最終画面構成（7画面、Eventと対称）:

```text
公開側:
  /order                      受付メニュー一覧
  /order/[id]                 メニュー詳細LP
  /order/[id]/apply           申込フォーム（確認ステップ込み）
  /order/[id]/apply/complete  完了

管理側:
  /apps/order                       ダッシュボード
  /order/admin/new, /order/admin/[id]   メニュー作成・編集（共有フォーム）
  /order/admin/applications             申込一覧・ステータス管理・メモ
```

## 5. データ項目

### メニュー（miracoの"menu"に相当）

| 項目 | 用途 | 備考 |
|---|---|---|
| id | 識別子 | |
| title | メニュー名 | 必須 |
| summary | 一覧・LP用の短い説明 | |
| description | 詳細説明 | |
| priceLabel | 料金の見せ方 | 例:「一律」「〜から」 |
| price | 金額 | 固定金額のみ（MVP） |
| leadTimeLabel | 納期の目安 | 例:「1週間程度」 |
| recommendedFor | おすすめ理由・対象 | |
| published | 公開/非公開 | miracoのmenu.hidden相当 |
| createdAt / updatedAt | 監査用 | |

### 申込（miracoの"order"に相当）

| 項目 | 用途 | 備考 |
|---|---|---|
| id | 識別子 | |
| menuId | メニュー関連 | 必須 |
| applicantName | 依頼者名 | 必須 |
| contactEmail | 連絡先 | 必須 |
| contactNote | 連絡方法の補足 | 例:電話番号・LINE等、自由記述 |
| requestDetail | 相談・依頼内容 | |
| desiredDueDate | 希望納期 | 任意 |
| status | ステータス | 下記参照 |
| organizerMemo | 管理者メモ（非公開） | |
| deliveryNote | 納品に関するメモ（テキストのみ、MVP） | ファイル納品は見送り |
| createdAt / updatedAt | 監査用 | |

## 6. 状態遷移

### 申込ステータス

miracoの「ヒアリング中→見積もり中→制作中→確認中→納品済み」を、Order MVPでは簡略化する。

```text
new -> in_progress -> delivered
new -> declined
in_progress -> declined
```

```text
new         新規（受付済み・未対応）
in_progress 対応中（ヒアリング〜制作〜確認を一括りにする。MVPでは細分化しない）
delivered   納品済み
declined    見送り・辞退
```

理由: miracoの5段階ステータスは実運用で洗練されたものだが、Order MVPの初期段階では管理側の負担を減らすため3〜4段階に圧縮する。細分化が必要になったらWave 2で検討する。

## 7. Activity Logマッピング候補（設計候補のみ・BP-1-bでは実装しない）

| Order操作 | Story | DESK | 可視性 | 備考 |
|---|---:|---:|---|---|
| 依頼受付 | 候補 | No | private | 個人情報を含むため非公開 |
| 納品完了 | 候補 | No | private初期 | 主催者が選べば実績として公開できる余地を残す |
| 受注金額確定 | No | Yes | 強制private | 金額ログは公開しない |

## 8. Session / Fundへの派生を見越した設計

Order派生の型分離（マスタープラン4.1章より）:

```text
メニュー（何を頼めるか） → Fundでは「応援プラン」、Sessionでは「予約メニュー」に読み替え
申込（誰が・何を・いくらで） → Fundでは「支援」、Sessionでは「予約」に読み替え
ステータス → 概ね共通（new/in_progress/delivered/declined の型を流用可能）
```

Sessionの差分は「日時枠」が申込に加わる点のみ。Fundの差分はFUND_APP_CONCEPT.mdの言葉遣い制約（出資/投資/配当を使わない）のみ。データ構造はOrderの型をそのまま複製・改名して使える設計にする。

## 9. Fable Sign-off（2026-07-13 承認）

この仕様抽出をBP-1-bの正典として承認する。

```text
- 7画面構成（5章）で確定。マイページ・チャット・見積り画面はMVP外。
- ステータスは4値（new/in_progress/delivered/declined）に圧縮。
- 保存はlocalStorage（Eventと同じ activity-client-store方式）。
- 管理側は全ページAuthGate必須（Event実装時に見つかった抜けと同じ轍を踏まない）。
- Activity Log書き込みはBP-1-bでは実装しない。adapter接続フェーズで別途。
- miraco本体（G:\Musubiプロジェクト\miraco）には一切触れない。
- 色はStory基準トークンのみ。ベージュ/ブラウンは持ち込まない。
```
