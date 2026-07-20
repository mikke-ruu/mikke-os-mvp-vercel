# Academy ブラッシュアップ計画（2026-07-20）

作成: Claude (Fable) — 設計判断担当
実装: Sonnetサブエージェント（AC-B番号で依頼。Pageと同方式）
背景: あゆみが実際に認定講座構築（CACM）を運用しながら触った上でのFB14件。
認定講座構築を早く回したい優先度に合わせ、ここから着手する。

## 0. 全体の方向性

Pageの時と同じく「使いやすい・見やすい・オシャレ」を目指す。加えて今回は
Academy固有の論点として、**Pageで作ったブロックビルダーの資産を横展開できないか**
という視点が要望に何度も出てきた（LP・講師ページ・フロントの3箇所）。

## 1. Wave A（機械的・低リスク・すぐ着手可）

```text
AC-1 モバイル下部ナビをAcademy専用に
  現状: components/academy/AcademyShell.tsx のモバイル下部ナビが
  OS共通フッター（Academy/Manager/Apps）になっている。
  修正: 単体アプリとして使う人が大半という前提で、下部ナビをAcademy自身の
  主要機能（ダッシュボード/講座管理/講師管理/申込管理 等、既存タブの中で
  優先度が高いもの4〜5個）に差し替える。OS共通ナビへの導線はハンバーガー
  メニュー側に残す。

AC-2 PC表示を左サイドバー化
  現状: HonbuShell/KoushiShellの横スクロールタブ（PC表示でもスクロール式）。
  修正: PC（md以上）では左サイドバー固定リスト表示に変更。モバイルは
  現状の横スクロールタブのままでよい（AC-1のモバイル下部ナビと役割分担：
  下部ナビ=最重要4-5個、横スクロールタブ=全項目）。

AC-3 タブのハイライトバグ修正
  講師ページ編集画面(instructor-page)を開いているのに「講座管理」タブが
  active表示（赤）になっている。アクティブ判定ロジック（pathnameの前方一致
  範囲）を修正。

AC-4 余白・情報密度の調整
  ダッシュボード等がスマホ表示をそのまま引き伸ばしたように間延びして見える。
  PC表示時はカードのグリッド密度を上げる、統計カードの周りに補助情報
  （グラフ・最近の活動リストの拡張等）を足す、又は最大幅を絞ってレイアウトを
  締める、のいずれかで対応（Page Wave1のダッシュボード刷新と同じ発想）。

AC-5 本部側・講師編集画面に写真＋自由記述を追加
  講師詳細編集（本部側）で写真が入れられない。MikkeMediaPicker
  （components/media/MikkeMediaPicker.tsx・sourceApp="academy"）を使って
  講師写真欄を追加。自由記述欄（bio）も追加。
```

## 2. Wave B（Mikke Media移行・既存MM-3/MM-4計画と統合）

既に `docs/MIKKEOS_MEDIA_FOUNDATION_AND_HTML_POLICY_2026-07-19.md` にMM-3/MM-4として
記録済みの内容。Academy着手のこのタイミングでまとめて実施する。

```text
MM-3: CourseForm.tsx の「メイン画像URL」／front/page.tsx の「メイン画像URL」を
      MikkeMediaPickerへ置換
MM-4: courses/[id]/lp/page.tsx・courses/[id]/instructor-page/page.tsx の
      画像ブロックをMikkeMediaPickerへ置換
```

## 3. Wave C（LP・講師ページ・フロントのブロックビルド強化）

**Page式ブロックビルダーの簡易版をAcademyへ横展開する。** ただしPageほど自由な
積み上げ式にはしない（Academyは講座構築という決まった目的があるため）。

```text
現状の問題:
- 講座LP(courses/[id]/lp)・講師専用ページ(courses/[id]/instructor-page)の
  ブロックエディタは「見出し/文章/画像」の3種類のみ（lib/page/typesのような
  リッチなブロック体系がない）。結果、掲載できる内容が薄く、既存の外部LP
  （CACM本番ページ、あゆみ提示のスクリーンショット8枚目）に比べて簡素に見える。
- フロントページ(academy/front)も同様に単一ヒーロー+講座カード程度で薄い。

方針:
- 講座の基本情報（受講料・時間・キット内容・カリキュラム・FAQ・申込導線）は
  既にCourseForm側の構造化フィールドとして持っている（academy-app記憶より）。
  これは変更しない・壊さない。LP builderは「基本情報だけでは伝えきれない
  補足コンテンツ」を組み立てる場所という位置づけを保つ。
- ブロック種類をPageから一部輸入する: 見出し/文章/画像に加えて
  「画像と文章（2カラム）」「画像グリッド」「CTA」を追加。company/cms/
  html/embed等Page固有の複雑なブロックは持ち込まない（Academyの目的に
  対して過剰）。
- 実装は lib/page/types.ts の型・components/page/PageBlockEditor.tsx の
  UIパターンを参考にしつつ、Academy専用の型（例: AcademyLpBlock拡張）と
  して別実装する（Page側のコードは変更しない・依存させない）。
- フロントページ(academy/front)も同じブロック体系で作り替え、
  「わたしらしい学びで…」のような単一ヒーローだけでなく、複数セクションを
  積み上げられるようにする。

教材・資料タブの扱い（要判断・次回確認）:
- あゆみ要望: 「教材・資料は講師ページに入る内容なので削除、講師ページも
  page式ビルドにしてほしい」。
- 解釈が2通りある: ①ナビの独立タブをやめて講師ページビルダーの中に
  「教材」ブロックとして統合するだけ（データ(academy_materials)は温存）
  ②教材データそのものを講師ページのブロック（画像/ファイルリンク）に
  置き換えて académy_materialsテーブルを使わなくする。
  → ①を推奨（データ構造の破壊的変更を避けつつ要望を満たせる）。次回の
  着手前に一言確認できると安全。
```

## 4. Wave D（申込・決済・キット注文フローの整理）— 実コード確認済み・設計確定

`lib/academy/applications.ts`・`lib/academy/kits.ts`・`lib/academy/lp.ts` を読んだ結果、
想定より土台は良好だった。**大きなスキーマ再設計は不要**、小さな追加2点で要件を満たせる。

### 実コードで判明した現状（誤解していた点の訂正）

```text
- academy_applications には既に honbu_revenue/instructor_revenue の分離、
  intake_source("honbu"|"koushi")、instructor_id が存在する。
- academy_kit_orders は createKitOrder(profile, instructor, input) で
  instructor_id: instructor.id が最初から入る＝「注文者=講師」は
  **既に正しくモデル化されている**。誤解していたのはここではない。
- 実際に欠けているのは2点だけ:
  ① academy_kit_orders に academy_applications への紐づけが無い
    （instructor_idはあるがapplication_idが無い。キット注文が「どの受講者の分か」
    を構造的に持てず、講師がtitleに自由記述するしかない状態）。
  ② 送り先住所を持つ列がどこにも無い（applications・kit_ordersどちらにも無い）。
- ディプロマ用の追加質問は、**既に汎用の仕組みがある**。
  CourseFormの申込項目エディタ（AcademyFormField型・text/textarea/email/tel/
  select/checkbox）で講座ごとにカスタム質問を定義でき、公開申込フォームの
  submitPublicApplication(lib/academy/lp.ts)で form_answers(jsonb想定)に
  回答が保存される。→ **コード変更不要**。ディプロマを発行する講座側で
  申込項目エディタから必要な質問（例: 本名・送付先住所・生年月日等）を
  追加するだけで、あゆみ自身が今すぐ設定できる。今回のWave Dでは触らない。
- app/academy/portal/applications/page.tsx 39行目の文言
  「あなたの営業用URLから入った申込（担当申込）の一覧です。
  ステータスの更新は本部が行います。」自体は、
  「本部がステータスを更新する」という部分は現状の設計として正しい
  （講師は閲覧のみ・honbu側で一元管理、というのは意図した設計）。
  問題は「ここからキットを注文する」という導線が無く、文言もそれに触れて
  いないこと。
```

### 実装タスク（AC-D番号）

```text
AC-D1: スキーマ追加（要SQL投入・あゆみが実行）
  academy_kit_orders に以下を追加:
    application_id uuid null references academy_applications(id)
    shipping_address text null
  （既存行はnullのままで問題ない。破壊的変更ではない）

AC-D2: 講師ポータルのキット注文フローを「申込から選ぶ」形に変更
  app/academy/portal/kits/page.tsx の発注フォームを、自由記述titleではなく
  「自分が担当した申込（自分のinstructor_idが付いたacademy_applications）」
  から選択する形に変更。選択すると:
    - course_id・受講者名（表示用）が自動セット
    - 送り先セレクタ（受講者へ／自分（講師）へ／その他=自由入力）を出し、
      shipping_addressへ保存。もしその申込のform_answersに住所らしき
      回答があれば初期値として提示してよい（キー名の厳密突合は不要、
      「参考情報として表示するだけ」でよい＝壊れにくい実装にする）。
    - lib/academy/kits.ts の createKitOrder に application_id/shipping_address
      を渡せるよう引数拡張。

AC-D3: 本部側キット注文一覧・申込詳細に相互リンクを追加
  app/academy/kits/page.tsx（本部キット一覧）: application_idがある注文には
  「申込を見る」リンクを追加。
  app/academy/applications/[id]/page.tsx（本部申込詳細）: その申込に紐づく
  キット注文があれば表示（無ければ「まだキット注文はありません」）。

AC-D4: portal/applications/page.tsxの文言修正＋キット注文導線追加
  39行目の文言を実態に合わせて修正（例:「あなたの営業用URLから入った申込の
  一覧です。ステータスの更新は本部が行います。受講に必要なキットは、
  ここから注文してください。」）。各行に「キットを注文する」ボタンを追加し、
  押すとAC-D2のフォームへ該当applicationを渡した状態で遷移する。

AC-D5: 申込ステータスのインライン変更
  app/academy/applications/page.tsx（本部・申込一覧）の各行にステータスの
  <select>を直接置き、詳細画面へ遷移せずに更新できるようにする
  （lib/academy/applications.ts の updateApplication を流用）。

AC-D6: 外部決済リンクへの事前入力（可能な範囲で・必須ではない）
  申込完了画面から外部決済URLへ遷移する際、対応していれば
  ?prefilled_email=... 等のクエリパラメータを付与する（Stripe Payment Links
  はprefilled_emailに対応）。決済サービス側の対応可否はまちまちなので、
  「付けられる時だけ付ける」努力目標とし、無条件の前提にしない。
```

対象外（今回やらない）:

```text
- キット注文フォームでのform_answers自動転記の完全一致マッチング
  （キー名規約が定まっていないため、参考表示までに留める）
- 決済ステータスの外部サービスとの自動同期（Webhook等）は本接続フェーズ送り
```

## 5. Academyの位置づけの再確認（あゆみ発言・訂正なし）

```text
- 講師ポータルの「復習」ページ = 講師専用ページの閲覧画面（既存理解と一致・
  変更不要）。
```

## 6. 追加提案（Fableより）

```text
- 講座が複数になった時のための検索・絞り込みは今は不要だが、ダッシュボードの
  「講座管理」一覧がカード1枚だけの現状デザインのままだと数十件になった時に
  厳しくなる。Wave A/Cのタイミングで一覧をテーブル/グリッド切替できる
  余地だけ作っておくと後が楽（今回は作り込まない、レイアウトの逃げ道だけ
  意識する）。
- Wave Cでブロック種類を増やす際、Mikke Media側の使用量トラッキング
  （sync_mikke_media_usages）にAcademyのLP/講師ページ/フロントの各画像を
  必ず登録する（既存Mikke Media方針の徹底。忘れるとゴミ箱機能実装時に
  「実は使用中」の画像を誤って消せてしまう）。
- Wave D着手前に、キット注文の「送り先」を選ぶ主体（本部が固定で決めるのか、
  講師が申込ごとに選ぶのか）を実データモデルと合わせて1つだけ確認できると
  設計が速い（次回冒頭でまとめて確認する）。
```

## 7. 実行順序（推奨）

```text
Wave A → Wave B（MM-3/4と同時） → Wave C → Wave D
```

Wave A/Bは依存なし・すぐ着手可。Wave Cは中規模（新ブロック型追加）。
Wave Dは業務フロー再設計のため、次回セッション冒頭でのデータモデル確認と
1点の確認事項（送り先の決め方）を経てから着手する。

## 8. Wave A実装メモ（2026-07-20 Sonnet実装）

AC-1〜AC-5実装済み。詳細は各ACの実装コミット参照。特記事項:

- AC-5の「自由記述欄（bio）」は新規カラムを追加せず、既存の `academy_instructors.self_intro`
  （もともと講師本人が編集する自己紹介欄で、`/academy/i/[id]` の公開ページに既に表示されている）
  を本部側編集画面からも編集できるようにする形で実装した。列レベル保護トリガ
  （`guard_academy_instructor_columns`）は「本部オーナー以外がUPDATEした場合に本部管理列を
  戻す」方向の保護のみで、本部が営業列（self_intro含む）を書くこと自体は元々許可されている
  ため、この使い方はスキーマ上安全。新規カラムを増やさずに要望を満たせるため、こちらを採用した。
- 講師写真は既存カラムが無いため `photo_url` を新規追加（下記「要SQL投入」参照）。

## 9. 要SQL投入（あゆみ本人がSupabase側で実行）

Wave A (AC-5) の講師写真欄のために、`academy_instructors` に列を1つ追加する必要がある。
コード側（`types/database.ts` の `AcademyInstructor` 型、`lib/academy/instructors.ts` の
`updateInstructor` patch型、`app/academy/instructors/[id]/page.tsx` のUI）は実装済み。
以下のSQLをSupabase側で実行するまでは、写真欄の保存が失敗する（DBに列が無いため）。

```sql
-- academy_instructors.photo_url 追加（Wave A / AC-5: 本部側・講師写真欄）
alter table public.academy_instructors
  add column if not exists photo_url text;

comment on column public.academy_instructors.photo_url is
  '講師写真の公開URL（Mikke Media）。本部が講師詳細編集画面から設定。将来的に講師本人が
   ポータルから編集する可能性あり（Wave D想定・今回は本部専用として実装）。';
```

備考: `photo_url` は既存の「本部管理列保護トリガ」（`guard_academy_instructor_columns`）の
保護対象リストに含めていない。今回は本部側からのみ書き込む実装だが、将来Wave Dで講師本人が
自分の写真を編集できるようにする場合も、このトリガ定義の変更は不要（保護対象に追加したい場合は
別途トリガ関数の更新が必要）。

Wave D (AC-D1) のために、`academy_kit_orders` に列を2つ追加する必要がある。
コード側（`types/database.ts` の `AcademyKitOrder` 型、`lib/academy/kits.ts` の
`createKitOrder` の insert文、`lib/academy/kits.ts` の `listKitOrdersByApplication`、
講師ポータルのキット注文フォーム、本部側キット一覧・申込詳細の表示）は実装済み。
以下のSQLをSupabase側で実行するまでは、application_id・shipping_addressを渡すinsertが
失敗する（DBに列が無いため）。

```sql
-- academy_kit_orders.application_id / shipping_address 追加
-- (Wave D / AC-D1: キット注文を申込に紐づけ、送り先を持てるようにする)
alter table public.academy_kit_orders
  add column if not exists application_id uuid references public.academy_applications(id);
alter table public.academy_kit_orders
  add column if not exists shipping_address text;

comment on column public.academy_kit_orders.application_id is
  'このキット注文がどの申込（受講者）向けかを示す。null許容＝申込を選ばない自由記述の注文も引き続き可能。';
comment on column public.academy_kit_orders.shipping_address is
  '送り先（受講者へ／自分（講師）へ／その他自由入力）。構造化した住所ではなくテキスト。';
```

備考: 既存のキット注文データはどちらの列もnullのまま読み込め、既存の一覧・履歴表示はそのまま
動作する（破壊的変更ではない）。ただし `createKitOrder` の insert文は application_id・
shipping_address を常に送るよう実装したため（値がnullの場合も含む）、**このSQLを実行するまでは
「申込から選ぶ」を使わない従来通りの自由記述注文も含め、キット新規注文が全件失敗する**
（PostgRESTは未知の列を含むinsertを列の値に関わらず拒否するため）。あゆみに向けて: Wave D
のキット注文機能を使う前に、必ずこのSQLを先に実行すること。

### Wave E (AC-E1〜AC-E6) 追加分

**重要（あゆみへ）**: `createApplication`・`submitPublicApplication`・`createKitOrder` は
いずれも新しい列を常に送るよう実装した（値がnullの場合を含む）。そのため、下記SQLを
実行するまでは **申込の新規作成（公開申込フォーム・本部受付フォームどちらも）と
キット注文の新規作成が全件失敗する**（PostgRESTは未知の列を含むinsertを列の値に
関わらず拒否するため）。Wave Eの機能を使う前に、必ず以下を先に実行すること。

```sql
-- ============================================================
-- AC-E1: 講師の配送先住所帳（新規テーブル）
-- ============================================================
create table if not exists public.academy_instructor_addresses (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.academy_instructors(id) on delete cascade,
  label text not null,
  address_text text not null,
  created_at timestamptz not null default now()
);

alter table public.academy_instructor_addresses enable row level security;

-- 講師本人（academy_instructors.user_id = auth.uid()）だけが自分の住所帳を操作できる
create policy "academy_instructor_addresses_owner_all"
  on public.academy_instructor_addresses
  for all
  to authenticated
  using (
    exists (
      select 1 from public.academy_instructors i
      where i.id = academy_instructor_addresses.instructor_id
        and i.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.academy_instructors i
      where i.id = academy_instructor_addresses.instructor_id
        and i.user_id = auth.uid()
    )
  );

comment on table public.academy_instructor_addresses is
  'Wave E (AC-E1): 講師の配送先住所帳。対面キットの送り先候補（自宅に限らず、職場・レンタルサロン等を複数登録可、上限目安5件）。';

-- ============================================================
-- AC-E2: academy_applications に列を3つ追加
-- ============================================================
alter table public.academy_applications
  add column if not exists diploma_name_en text;
alter table public.academy_applications
  add column if not exists applicant_shipping_address text;
alter table public.academy_applications
  add column if not exists community_interest boolean not null default false;

comment on column public.academy_applications.diploma_name_en is
  'ディプロマに入れる氏名（英語表記）。公開申込フォーム・本部受付フォームどちらも入力欄を追加済み。';
comment on column public.academy_applications.applicant_shipping_address is
  'オンライン受講(format=online)時のみ、申込者本人が入力する配送先情報。対面時は使わない。';
comment on column public.academy_applications.community_interest is
  'Wave E (AC-E7): 受講後の「communityに参加する」チェックの意思表示。Community本体が無いため、フラグを立てるだけで実処理はしない。';

-- ============================================================
-- AC-E4: academy_kit_orders に列を4つ追加
-- ============================================================
alter table public.academy_kit_orders
  add column if not exists desired_date date;
alter table public.academy_kit_orders
  add column if not exists diploma_name_en text;
alter table public.academy_kit_orders
  add column if not exists contact_email text;
alter table public.academy_kit_orders
  add column if not exists instructor_note text;

comment on column public.academy_kit_orders.desired_date is
  '講師が「受講日を確定してキットを仕入れる」操作で入力した受講日。academy_applications.event_dateとは別に持つ。';
comment on column public.academy_kit_orders.diploma_name_en is
  'ディプロマに入れる氏名（英語表記）。キット仕入れ時に申込のdiploma_name_enを自動で引き継ぐ。';
comment on column public.academy_kit_orders.contact_email is
  '受講者の連絡先メール。申込のapplicant_emailを自動で引き継ぐ。academy_kit_ordersには
   applicant_name・applicant_phoneに相当する列は意図的に追加していない（本部への非開示を構造的に保証するため）。';
comment on column public.academy_kit_orders.instructor_note is
  '講師から本部へのメッセージ（任意）。既存のtitle列とは別に持つ（titleは講座名ベースで自動生成する運用に変更）。';
```

### AC-E6: academy_applications のSELECT/UPDATE RLS変更（実ポリシー確認済み・確定版）

あゆみがSupabase SQL Editorで `pg_policies` を実際に照会し、既存の全ポリシーを確認した
（2026-07-20）。既存ポリシーは以下の5本のみ（migrationファイルには記録されておらず、
Supabaseダッシュボード側で直接作成されたもの）:

```text
applications delete hq            DELETE  USING: academy_owns_hq(headquarters_id)
applications insert hq or instructor  INSERT  WITH CHECK: (user_id = auth.uid()) AND
    (academy_owns_hq(headquarters_id) OR ((intake_source = 'koushi') AND
     academy_is_instructor_self(instructor_id)))
applications read hq or instructor    SELECT  USING: academy_owns_hq(headquarters_id) OR
    academy_is_instructor_self(instructor_id)
applications update hq or instructor  UPDATE  USING/WITH CHECK: 同上のSELECTと同じ条件
public can submit applications        INSERT  （匿名の公開申込フォーム用。is_published等の
    講座側条件で判定。変更不要）
```

判明した通り、SELECT/UPDATEどちらも「本部かどうか／担当講師かどうか」だけで判定しており
`intake_source`の区別が無い（本部が講師受付分も含め全件見えてしまう）。また「申込者本人が
自分の申込を見る」ポリシーがそもそも存在しない（AC-E7の受講後フローが動かない原因）。

以下が確定版SQL。DROP対象のポリシー名・条件は上記で確認済みの実物なので、
そのまま上から順に実行すればよい。

```sql
-- ============================================================
-- SELECT: 本部はintake_source='honbu'のみ。担当講師は自分の担当分（変更なし）。
--         申込者本人も自分の行を見られるようにする（user_id一致、または
--         匿名申込(user_id null)の場合はログイン中のメールアドレスと照合）。
-- ============================================================
drop policy "applications read hq or instructor" on public.academy_applications;

create policy "applications read hq or instructor or self"
  on public.academy_applications
  for select
  to authenticated
  using (
    (academy_owns_hq(headquarters_id) and intake_source = 'honbu')
    or academy_is_instructor_self(instructor_id)
    or user_id = auth.uid()
    or (user_id is null and applicant_email = (auth.jwt() ->> 'email'))
  );

-- ============================================================
-- UPDATE: 本部・担当講師の既存の更新権限はそのまま維持しつつ（本部は
--         honbu受付分のみに絞る）、申込者本人にも許可を広げる。
--         ただし本人による更新は community_interest 以外の列を変更できないよう
--         トリガーで強制する（下のguard_academy_application_self_columns参照。
--         academy_instructorsの既存のguard_academy_instructor_columnsと同じ考え方）。
-- ============================================================
drop policy "applications update hq or instructor" on public.academy_applications;

create policy "applications update hq or instructor or self"
  on public.academy_applications
  for update
  to authenticated
  using (
    (academy_owns_hq(headquarters_id) and intake_source = 'honbu')
    or academy_is_instructor_self(instructor_id)
    or user_id = auth.uid()
    or (user_id is null and applicant_email = (auth.jwt() ->> 'email'))
  )
  with check (
    (academy_owns_hq(headquarters_id) and intake_source = 'honbu')
    or academy_is_instructor_self(instructor_id)
    or user_id = auth.uid()
    or (user_id is null and applicant_email = (auth.jwt() ->> 'email'))
  );

create or replace function public.guard_academy_application_self_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 本部（honbu受付分）または担当講師による更新は従来通り無制限に許可
  if (academy_owns_hq(new.headquarters_id) and new.intake_source = 'honbu')
     or academy_is_instructor_self(new.instructor_id) then
    return new;
  end if;

  -- それ以外（=申込者本人によるセルフ更新）は community_interest 以外を
  -- 元の値へ戻す。ステータス・金額・受講者情報などを本人が書き換えられないようにする。
  new.status := old.status;
  new.payment_status := old.payment_status;
  new.certification_status := old.certification_status;
  new.price := old.price;
  new.kit_cost := old.kit_cost;
  new.honbu_revenue := old.honbu_revenue;
  new.instructor_revenue := old.instructor_revenue;
  new.applicant_name := old.applicant_name;
  new.applicant_email := old.applicant_email;
  new.applicant_phone := old.applicant_phone;
  new.applicant_note := old.applicant_note;
  new.instructor_id := old.instructor_id;
  new.intake_source := old.intake_source;
  new.diploma_name_en := old.diploma_name_en;
  new.applicant_shipping_address := old.applicant_shipping_address;
  new.form_answers := old.form_answers;
  new.event_date := old.event_date;
  new.format := old.format;
  new.display_on_story := old.display_on_story;
  new.reflect_on_desk := old.reflect_on_desk;
  return new;
end;
$$;

drop trigger if exists guard_academy_application_self_columns on public.academy_applications;
create trigger guard_academy_application_self_columns
  before update on public.academy_applications
  for each row
  execute function public.guard_academy_application_self_columns();

-- ============================================================
-- academy_instructors: 受講者本人による「認定講師登録する」のセルフINSERTを許可
-- （既存のINSERTポリシーは変更しない・新規ポリシーを追加するだけなので安全）
-- ============================================================
create policy "academy_instructors_self_register"
  on public.academy_instructors
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and profile_id in (select id from public.profiles where user_id = auth.uid())
  );
```

適用後の影響（設計通りの副作用）: `app/academy/applications/page.tsx`・
`app/academy/applications/[id]/page.tsx`（本部側の申込一覧・詳細）は、
`intake_source='koushi'` の申込を返さなくなる。本部は koushi 申込の件数・存在を
`academy_kit_orders` 経由（§12の方針通り）で把握する。

**INSERT（本部/講師）・DELETEポリシーは変更不要**（既存のまま。本部/講師が新規作成・
削除する場合の条件は現状で問題ない）。

## 10. Wave C実装メモ（2026-07-20 Sonnet実装・夜間実行）

AC-C1〜AC-C5実装済み。新規Supabaseスキーマ変更なし（すべて既存のjsonb列 `academy_courses.lp_blocks` /
`academy_instructor_pages.blocks` の中身の型拡張のみ）。判断に迷って止めた箇所はなし。

```text
AC-C1: LPビルダーのブロック拡張
  types/database.ts の AcademyLpBlock に image-text/gallery/cta を追加
  （AcademyGalleryImage型を新設し images: AcademyGalleryImage[] で共有）。
  app/academy/courses/[id]/lp/page.tsx を、instructor-page.tsx と同じ
  BlockEditor(block, onChange)コンポーネント方式に揃えてリファクタし、
  3種→6種のブロック追加ボタンに拡張。
  あわせて公開LP側 app/academy/c/[id]/page.tsx の描画分岐（従来
  「heading ? : text ? : url ? : null」の3値三項）を書き直し、
  image-text/gallery/ctaの表示を追加（ここを直さないと新ブロックが
  公開LPに出ないため、プロンプト指定範囲に加えて対応した）。

AC-C2: 講師専用ページビルダーのブロック拡張
  AcademyPageBlock に image-text/gallery/cta（AC-C1と同形）を追加。
  app/academy/courses/[id]/instructor-page/page.tsx のBlockEditorに
  同じ編集UIを追加。

AC-C5: 画像入力のMikkeMediaPicker統一
  components/academy/AcademyImageUploader.tsx を新設（sourceApp="academy"の
  薄いラッパー。PageImageUploader.tsxを参考にしたが、Academyのブロック型は
  画像URLを単純文字列で持つ方針のため、mediaAssetIdは保持せずpublicUrlのみ
  onUploadedへ返す設計にした）。
  CourseForm.tsx(mainImageUrl)・front/page.tsx(hero_image_url)・LP/instructor-page
  ビルダーのimage・image-text・galleryブロックの画像欄をすべて置換。
  既存の文字列URLはcurrentUrlとしてそのまま表示され、選び直すと上書きされる
  （プロンプト指定通り「単純に上書き」の段階移行。mikke_media_usagesへの
  使用量トラッキング登録は実装していない — AC-C5本文が「単純な上書きで
  問題ない」と明記しており、トラッキングにはmediaAssetIdの保持が必要で
  スコープ外の設計変更になるため見送った。Wave Cの§6提案にある使用量
  トラッキングの徹底は次回以降の課題として残る）。

AC-C3: 教材リストブロック
  AcademyPageBlockに materials-list（設定項目なし）を追加。
  instructor-page.tsxのビルダーに追加ボタンを追加（設定欄は「自動表示され
  ます」という説明文のみ）。
  components/academy/PageBlocks.tsx を拡張し、materials(AcademyMaterial[])を
  propで受け取ってmaterials-listブロックの位置にレンダリングするように変更。
  あわせて pageBlocksHasMaterialsList() ヘルパーを追加。
  app/academy/portal/study/page.tsx（講師が復習ページを見る画面）を更新し、
  PageBlocksにcourseMaterialsを渡すように変更。旧データ（materials-list
  ブロックを含まないページ）との互換のため、ブロックが無い場合だけ従来通り
  ページ末尾に別枠で教材一覧を表示する分岐を残した（二重表示を回避）。

AC-C4: 教材・資料を独立ナビから除去
  components/academy/AcademyShell.tsx の honbuNav から
  「教材・資料」(/academy/materials) の項目を削除（FolderOpenのimportも
  未使用化したため削除）。app/academy/materials/page.tsx自体・
  academy_materialsのCRUDは変更していない。
  代わりにinstructor-page.tsxビルダー画面の上部に「教材・資料はこの講座
  専用の管理画面で編集します」という案内ブロックを追加し、
  「教材・資料を編集すると、教材リストブロックに自動で反映されます」という
  説明文と「この講座の教材を管理する」リンク(/academy/materials?course=[id])
  を設置。
  app/academy/materials/page.tsx はもともと ?course= クエリパラメータに
  対応していなかったため、useSearchParamsで読み取ってcourseFilterの初期値に
  する対応を追加（Next.jsのCSR bailout制約によりuseSearchParamsを使う
  コンポーネントをSuspenseで包む必要があったため、default exportに
  Suspense境界を追加した）。
```

検証: `npm run lint`（tsc --noEmit）成功・`npm run build` 成功（全93ルート生成、
/academy/courses/[id]/lp・/academy/courses/[id]/instructor-page・/academy/c/[id]・
/academy/materials 含む）。既存データ互換は、新ブロック型をすべて既存unionへの
追加のみで実装し、旧ブロック配列（heading/text/image/video/linksのみ）が
BlockEditor・PageBlocks・公開LP描画のどの分岐にも従来通り到達する形で確認した
（型を壊す変更・必須フィールド追加は行っていない）。

未実装・妥協点:
- Mikke Media使用量トラッキング（sync_mikke_media_usages）へのAcademy画像登録は
  今回見送り（上記AC-C5参照）。
- 教材追加ページ(app/academy/materials/new/page.tsx)への?course=引き継ぎ（新規
  作成時に講座を自動選択させる）はプロンプト指定範囲外のため未実装。

## 11. Wave D実装メモ（2026-07-20 Sonnet実装・夜間実行）

AC-D1〜AC-D6すべて実装済み（AC-D6も対象箇所が見つかったため実施）。判断に迷って
止めた箇所はなし。

```text
AC-D1: スキーマ追加（コードのみ）
  types/database.ts の AcademyKitOrder に shipping_address: string | null を追加
  （application_id は実装前から型に存在していたが insert文に配線されていなかったため
  今回配線した）。
  lib/academy/kits.ts の createKitOrder の input型に applicationId・shippingAddress
  （どちらも省略可・省略時はnull）を追加し、insert文に application_id・shipping_address
  を含めた。あわせて listKitOrdersByApplication(headquartersId, applicationId) を新設
  （AC-D3の申込詳細での相互リンク表示に使用）。
  実際のSQLは本ファイル §9 に追記済み（このSQLを実行するまでキット新規注文が全件失敗する
  点も明記した。理由はPostgRESTが未知列を含むinsertを値に関わらず拒否するため）。

AC-D2: 講師ポータルのキット注文フローを「申込から選ぶ」形に
  app/academy/portal/kits/page.tsx を書き換え。
  - 「申込から選ぶ（任意）」<select> を追加（lib/academy/instructor-portal.ts の
    listMyApplications を利用。既存関数がそのまま講師視点の担当申込一覧として使えた
    ため新規追加は不要だった）。
  - 選択すると受講者の所属講座に一致する講師レコードを自動でinstructorIdにセットし
    （講座<select>は選択中disabledにして矛盾を防止）、受講者名を読み取り専用の
    案内ボックスに表示。
  - 申込のform_answersからキー名またはvalueに「住所」/"address"を含む回答があれば
    「参考情報」として表示するのみに留めた（設計方針通り、自動転記・厳密突合はしない）。
  - 送り先<select>（受講者へ／自分（講師）へ／その他=自由入力）を追加。「その他」の
    ときだけ自由入力欄を出し、選択結果をshippingAddressとしてcreateKitOrderへ渡す。
  - 申込を選ばない自由記述の注文（application_id=null）は従来通り可能（デフォルト
    「選択しない」）。
  - AC-D4のクエリパラメータ(?application=)をuseSearchParamsで読み取り、該当申込が
    一覧に含まれていれば初期選択に反映（useSearchParams使用のためdefault exportに
    Suspense境界を追加＝Wave CのAC-C4と同じパターン）。

AC-D3: 本部側キット注文一覧・申込詳細に相互リンク
  app/academy/kits/page.tsx: application_idがある注文のカードに「申込を見る →」
  リンク(/academy/applications/[application_id])を追加。あわせてshipping_addressが
  あれば表示。
  app/academy/applications/[id]/page.tsx: listKitOrdersByApplicationで取得した
  キット注文一覧セクションを追加（品目・金額・送り先・ステータスを表示）。0件のときは
  「まだキット注文はありません。」と表示。「キット発注管理で見る →」リンクも添えた。

AC-D4: portal/applications/page.tsxの文言修正＋キット注文導線
  39行目付近の文言を指定通り修正（「受講に必要なキットは、ここから注文してください。」
  を追記）。各申込カードに「キットを注文する」ボタンを追加し、
  /academy/portal/kits?application=[id] へ遷移するようにした（AC-D2側の
  useSearchParams読み取りと対で動作）。

AC-D5: 申込ステータスのインライン変更
  app/academy/applications/page.tsx（本部・申込一覧）の各カードに<select>を追加。
  カード全体を包んでいたLinkを内側のヘッダー部分だけに絞り、<select>はLink外に配置
  （onClickでstopPropagationも付与し、クリックでの誤遷移を二重に防止）。
  lib/academy/applications.ts の updateApplication をstatusのみpatchする形で呼び出す。
  変更中はbusyIdで対象行の<select>をdisabled、失敗時はカード上部にエラー文言を表示
  （他の一覧画面のインライン編集パターン=app/academy/kits/page.tsxのbusyId方式に揃えた）。
  なお申込詳細画面(app/academy/applications/[id]/page.tsx)には元々同種のステータス
  <select>が実装済みだったため、そちらは変更していない。

AC-D6: 外部決済リンクへの事前入力（実施した）
  対応箇所が見つかった: app/academy/apply/[id]/page.tsx の申込完了画面
  （done===trueの分岐）。academy_courses.payment_url（CourseFormの「受講料 決済URL
  （外部）」欄。既存カラムで元々ある）が、これまでどの画面にも表示・リンクされていな
  かったため、完了画面に「お支払い手続きへ進む」ボタンとして新規に配置し、
  buildPaymentUrl()ヘルパーで ?prefilled_email=<申込者のメール> を付与した
  （URLのパースに失敗した場合や空メールの場合はprefilled_emailを付けず元のURLを
  そのまま使う=壊れにくさ優先）。Stripe Payment Linksのprefilled_email対応を想定した
  実装だが、他の決済サービスでも同名クエリパラメータが無視されるだけで実害はない設計。
```

検証: `npm run lint`（tsc --noEmit）成功・`npm run build` 成功（全93ルート生成、
/academy/applications・/academy/applications/[id]・/academy/apply/[id]・/academy/kits・
/academy/portal/applications・/academy/portal/kits 含む）。

既存データ互換の保証方法: application_id・shipping_addressは両方nullable。
createKitOrderは値未指定時にnullを送るためコード上は既存データ形と整合するが、
DBに列自体が無い間はinsert自体が失敗する（§9に明記・あゆみのSQL投入が前提）。
読み取り側（listKitOrders・listMyKitOrders・listKitOrdersByApplication）は
`as AcademyKitOrder[]`キャストのみで、旧データ（列が無い状態でSELECTした場合に
Supabaseが単に該当キーを返さない/undefinedになるケース）でも、UI側は
`order.shipping_address ?`・`order.application_id ?`という条件分岐でしか参照しない
ため、undefinedでも例外にならず「表示しない」に落ちる形にしてある。

未実装・妥協点:
- なし（AC-D1〜AC-D6すべて実装。AC-D6は「見つからなければスキップ可」の努力目標
  だったが、対象箇所(academy/apply/[id]/page.tsx)が見つかったため実装した）。
- 送り先(shipping_address)は構造化した住所ではなく、選択結果を表すテキスト
  （「受講者へ（氏名）」「講師（自分）へ」または自由入力文字列）として保存する設計とした。
  実住所そのものを構造化して持つ列は今回追加していない（§6の申込項目エディタで
  講座ごとに住所質問を追加する既存の仕組みと役割分担する前提）。

## 12. Wave E（2026-07-20・業務フロー再訂正・実コード確認済み・設計確定）

Wave D完了後、あゆみから実際の業務フローの訂正が入った。**Wave Dの前提が一部
誤っていた**ため、キット注文の扱いを作り直す。誤りと訂正は本会話に記録済み、
ここには確定した設計だけをまとめる。

### 訂正された業務フロー

```text
1申込 = 1キット（まとめ買いなし・確定）。講師受付の申込が来たら:
  ① 受講者が講師へ講座代金を支払う（講師の決済リンク・既存のinstructor_revenueのまま）
  ② 講師が受講日を決定し、送り先を選び、本部にキットを仕入れる
     （※「別画面で申込を選び直す」二度手間をやめ、申込の確認と同じ流れの中で行う）
  ③ 本部は「受講日・デュプロマ名(英語)・メール・配送先・講師の備考」だけを受け取り、
     指定住所へ発送する。受講者の氏名(日本語)・電話・申込備考は本部に渡さない
     （個人情報トラブル回避のため、あゆみ確定事項）。

送り先の自動振り分け:
  対面(format="in_person") → 講師が事前登録した配送先住所（2-3件登録可・職場や
    レンタルサロン等、講師の自宅に限定しない）から選ぶ。
  オンライン(format="online") → 受講者が申込時に入力した配送先情報をそのまま使う。

受講後の任意フロー（確定）:
  受講者が申込時メールで講師ページにログイン
  → □認定講師登録する／□communityに参加する（両方任意・独立チェック）
  → 講師登録にチェックした場合のみ営業ページ解放・本部の認定講師一覧に掲載
  → community参加チェックは、Community本体が無いため今回は「予約枠」として
    保存だけする（実際の参加処理はCommunity構築後）
```

### 技術設計（確定）

```text
1. academy_kit_orders を「本部が見てよい情報だけを持つ、申込のプライバシー安全な
   部分集合」として再定義する。Wave Dで追加したapplication_id/shipping_addressは
   活かしつつ、以下を追加/整理する:
     desired_date（受講日・講師が確定）
     diploma_name_en（デュプロマに入れる名前・英語表記）
     contact_email（受講者。講師登録時の照合キー）
     shipping_address（Wave Dで追加済み。対面=講師の登録住所／オンライン=
       受講者の配送先を自動で入れる。手動選択も残す）
     instructor_note（講師から本部へのメッセージ。既存titleを転用してよい）
   academy_kit_ordersにはapplicant_name・applicant_phoneに相当する列を
   絶対に持たせない（本部への非開示を構造的に保証する）。

2. academy_applications に以下を追加（講師受付フォームの必須項目に合わせる）:
     diploma_name_en text null
     applicant_shipping_address text null
       （オンライン選択時のみ申込フォームで入力・対面時は不要）

3. 講師の配送先住所帳（新規テーブル）:
     academy_instructor_addresses
       id uuid pk, instructor_id uuid references academy_instructors(id),
       label text（例:「自宅」「レンタルサロンA」）, address_text text,
       created_at timestamptz
   講師ポータルのプロフィール編集あたりに簡易CRUD（2-3件想定・上限は
   ゆるく5件程度でよい）を追加。

4. キット仕入れフローの統合（二度手間の解消）:
   app/academy/portal/applications/page.tsx（担当申込一覧）の各行、または
   その詳細画面に「受講日を確定してキットを仕入れる」という**1つの操作**を置く。
   押すと: 受講日(desired_date)入力・送り先（対面=登録住所から選択／
   オンライン=自動でapplicant_shipping_addressを使用、表示のみで変更不要）・
   講師からの備考、の3項目だけの短いフォームが開き、送信すると
   academy_kit_orders行が自動生成される（application_idの手動選択UIは廃止。
   Wave Dで作ったapp/academy/portal/kits/page.tsxの「申込から選ぶ」pickerは、
   この新フローに置き換えるか、pickerを開いた時点で自動的にすべての項目が
   埋まった状態にする形で統合する）。
   自由記述の単発キット注文（申込に紐付かない）が今後も必要な場面が万一
   出た場合に備え、application_idなしの注文経路そのものは消さずに残す
   （ただし主導線ではなくする）。

5. RLS変更（要SQL投入・あゆみ実行・重要）:
   academy_applications のSELECTポリシーを変更し、本部（headquarters owner）は
   intake_source='honbu'の行のみ閲覧可能にする。intake_source='koushi'の行は、
   担当講師本人（instructor_idが自分のprofile_idに一致）と、申込者本人
   （user_idが自分）だけが見られるようにする。本部は koushi 申込の存在や
   件数集計は academy_kit_orders 経由（プライバシー安全な部分集合）で把握する。
   **これは実際のRLSポリシー変更のためSQLのみ作成し実行しない**
   （既存のacademy_applications RLSポリシー定義を実コードで確認してから
   ALTER POLICY / DROP+CREATE POLICYを書くこと）。

6. メールの同定UX（確定: 注意書き＋フォールバック検索の併用）:
   - 公開申込フォーム(app/academy/apply/[id]/page.tsx)のメール欄近くに注意書き:
     「既にmikkeIDをお持ちの方は、そのログインメールアドレスでお申込みください。
     受講後、このメールアドレスで講師ページにログインできます。」
   - 講師ページ入口（受講後ログインする画面。新規に作る必要があれば
     app/academy/graduate等の入口を1つ作る。既存の講師ポータルログイン画面が
     流用できればそちらに追記）にも同様の注意書き。
   - フォールバック: ログイン済みプロフィールのメールで該当する申込が
     見つからない場合、「申込時と異なるメールアドレスでお申込みの場合はこちら」
     という入力欄を出し、そこに入力されたメールでacademy_applications
     （自分のuser_idの行のみ・RLSの範囲内）を再検索できるようにする。

7. 受講後の任意講師登録フロー（新規画面が必要）:
   受講者が申込時メールでログイン後に案内する画面（新規ルート、例:
   app/academy/graduate/[applicationId]/page.tsx）:
     - 受講した講座の復習内容（既存の講師専用ページblocksを流用表示）
     - □認定講師登録する（チェックすると academy_instructors 行を新規作成、
       instructor_number自動採番・certified_at記録・academy_certifiedイベント
       seam記録。既存のinstructors.tsの採番ロジックを再利用）
     - □communityに参加する（チェックした事実だけ保存。Community本体が
       無いので実処理はしない。academy_applications等に
       community_interest boolean を1列追加して保存するだけでよい）
     - 講師登録した場合のみ is_listed/accepts_applications を有効にし、
       営業ページ・認定講師一覧に反映されるようにする（既存のinstructors.ts
       のロジックに乗せる）。
```

### 対象外（今回もやらない）

```text
- Community本体の実装（参加チェックは予約のみ）
- 講師登録を取り消す/講師を降格する導線（既存のstatus管理で足りる想定）
- 配送先住所の郵便番号検索等の入力補助（自由テキストのままでよい）
```

## 13. Wave E実装メモ（2026-07-20 Sonnet実装）

AC-E1〜AC-E5・AC-E7を実装済み。AC-E6はSQL草案の作成のみ（指示通り実行はしていない）。
実SQLは本ファイル §9「Wave E (AC-E1〜AC-E6) 追加分」に追記済み。

```text
AC-E1: 講師の配送先住所帳
  types/database.ts に AcademyInstructorAddress を追加。
  lib/academy/instructor-addresses.ts を新規作成（list/create/delete。上限5件はUI側チェック）。
  app/academy/portal/url/page.tsx（既存の「プロフィールを編集」画面。講師レコード単位で
  ループしているUIがあり、ここが最も自然な置き場所だった）の各講師レコードに
  「配送先住所帳」の<details>ブロックを追加し、AddressBookコンポーネントとしてCRUD UIを実装。

AC-E2: academy_applications にフィールド追加
  types/database.ts に diploma_name_en・applicant_shipping_address・community_interest を追加。
  app/academy/apply/[id]/page.tsx（公開申込フォーム）に、受講希望日（既存event_dateを流用・
  ラベルを「希望開催日」→「受講希望日」に変更）、ディプロマ名(英語表記・必須)、配送先情報
  （format="online"の時だけ表示・必須。textareaで実装）を追加。メール欄の下にmikkeID既存
  ユーザー向けの注意書きも追加。備考欄は既存のapplicant_note（「ご質問・ご要望」欄）をそのまま
  流用（新規追加はしていない＝指示通り）。
  lib/academy/lp.ts の submitPublicApplication の入力型・insert文に両フィールドを追加。

AC-E3: 講師受付フォーム（本部手入力）の項目を揃える
  lib/academy/applications.ts の ApplicationInput に diplomaNameEn・applicantShippingAddress
  を追加し、createApplication のinsert文に配線。
  app/academy/applications/new/page.tsx に「ディプロマに入れるお名前（英語表記）」欄
  （受講者情報セクション）と、format="online"選択時のみ表示する配送先情報欄
  （開催・金額セクション）を追加。公開フォームと異なり、本部の手入力フォームでは
  必須バリデーションを付けていない（他の任意項目＝メール・電話と同じ扱いに揃えた。
  本部が把握しきれていない段階でも申込だけ先に登録できるようにする意図）。

AC-E4: academy_kit_orders を「本部が見てよい部分集合」として整理
  types/database.ts に desired_date・diploma_name_en・contact_email・instructor_note を追加。
  applicant_name・applicant_phoneに相当する列は追加していない（意図的な非対応）。
  lib/academy/kits.ts の createKitOrder の入力型・insert文を拡張。
  あわせて app/academy/kits/page.tsx（本部キット一覧）に4項目の表示を追加した
  （プロンプト範囲外だが、本部がこの情報を実際に見られないと収集する意味が無いため対応した）。

AC-E5: キット仕入れフローを1操作に統合
  app/academy/portal/applications/page.tsx の各申込カードに「受講日を確定してキットを
  仕入れる」ボタンを追加し、押すとKitIntakeModal（同ファイル内に実装）が開く。
  モーダルは受講日(必須・application.event_dateがあれば初期値に)・送り先
  （in_person=instructor-addressesから<select>／online=applicant_shipping_addressを
  自動採用し読み取り専用表示／未設定時は案内文のみ）・講師からの備考の3項目のみ。
  送信すると createKitOrder に application_id・diploma_name_en・applicant_email
  （contactEmailとして）を自動で引き継いで1件作成する。titleは
  「{講座コード} {講座名} キット」で自動生成し、受講者名は一切渡さない
  （Wave Dのshipping_address文字列に受講者名を埋め込んでいた実装は、この新フローでは
  使っていない＝個人情報リークの是正になっている）。
  同じ申込に対してすでにキット注文がある場合はボタンの代わりに
  「キット仕入れ済み（ステータス）」の表示に切り替え、二重発注を防止する
  （1申込=1キットの業務ルールをUI側で保証）。
  app/academy/portal/kits/page.tsx は、注文履歴を主目的の一覧に縮小し、
  「申込から選ぶ」pickerと?application=クエリパラメータ処理は削除した。
  申込に紐付かない自由記述の単発注文は<details>で折りたたんだ
  「申込に紐づかない単発注文（例外対応・通常は使いません）」として存続させた
  （application_id: null、shipping_addressは自由入力メモとして保存）。

AC-E6: RLSポリシー変更（SQL草案のみ・未実行）
  supabase/migrations 配下・リポジトリ全体を検索したが、academy_applicationsの
  テーブル定義・既存RLSポリシーを記録したファイルが見つからなかった（Supabase側で
  直接作成されmigration化されていない）。本実行環境はservice_role鍵・DB接続情報を
  持たずpg_policiesへの問い合わせもできなかったため、「既存ポリシー文を引用する」
  代わりに「実DBで確認する手順」をSQLとして残した（§9参照。まずpg_policiesを
  SELECTしてポリシー名を特定してからDROP+CREATEする2段階の手順）。
  あわせて、実装中に判明したAC-E7動作に必要な追加RLS（受講者本人によるacademy_
  instructorsへのINSERT、community_interestのUPDATE、匿名申込のuser_id=null問題への
  対処としてのメールアドレス一致条件）も§9に「参考」として書き添えた
  （AC-E6の指示範囲外だが、書かないとAC-E7が機能しないまま見えてしまうため）。

AC-E7: 受講後の任意講師登録・community参加フロー
  新規ルート app/academy/graduate/[applicationId]/page.tsx を作成。
  lib/academy/graduate.ts を新規作成（getMyApplicationById・findMyApplicationsByEmail・
  setCommunityInterest・registerAsInstructorFromGraduation）。
  ログイン中プロフィールのuser.emailと対象申込のapplicant_emailを照合し、一致すれば
  復習コンテンツ（getInstructorPageForViewerで講師専用ページを試み、RLSで読めない
  場合はgetPublicCourseの基本情報にフォールバック）と、認定講師登録／community参加の
  2つの独立チェックを表示する。
  不一致の場合は「申込時と異なるメールアドレスでお申込みの場合はこちら」という
  入力欄を出し、入力されたメールで再検索する（findMyApplicationsByEmailはRLSの
  範囲内でしか行を返さないため、他人の申込を探し当てることはできない設計）。
  講師登録は lib/academy/instructors.ts の findExistingInstructorNumber
  （講師番号の引き継ぎロジック）を再利用しつつ、academy_instructorsへの新規insertは
  本関数内で直接行っている（is_certified/is_active/is_listed/accepts_applicationsを
  trueで初期化）。
```

検証: `npm run lint`（tsc --noEmit）成功・`npm run build` 成功（全94ルート生成、
新規追加の `/academy/graduate/[applicationId]` を含む）。

既存データ互換の保証方法: AC-E2/AC-E4で追加した型フィールドはすべてnullable
（community_interestのみboolean・DBデフォルトfalse想定）。読み取り側は
`as AcademyApplication[]` 等の既存キャストパターンのみで、UI側も
`order.desired_date ?`・`application.community_interest`（boolean、未定義時はundefined
がfalsyとして扱われる）という条件分岐でしか参照しないため、DBに新列が無い状態で
SELECTしても例外にはならない。ただし前述の通り、新規INSERT（申込作成・キット注文作成）は
列が存在するまで全件失敗するため、§9のSQLが実行されるまでは新規作成系の機能は使えない
（読み取り専用の既存データ表示は壊れない、という意味での「破壊的変更ではない」）。

未実装・妥協点・判断に迷って止めた箇所:
- AC-E6は「実ファイルを確認してから書く」の対象ファイルがリポジトリ内に存在しなかった
  （academy系テーブルはSupabase側で直接作成されmigration化されていない）。DB接続情報も
  無かったため、既存ポリシーを実際に読むことができず、代わりに「まずpg_policiesを
  確認してからDROP対象を特定する」手順をSQLとして用意した。既存ポリシー名を推測で
  DROPする（=間違ったポリシーを消す/消し忘れる）リスクを避けるための判断。
- AC-E7の「受講者本人がacademy_instructorsへINSERT」「受講者本人がcommunity_interestを
  UPDATE」は、既存のRLSが本部専用の書き込みしか想定していない可能性が高く、
  AC-E6の指示範囲には無かった追加のRLS変更が必要になる見込み（§9に参考として記載、未実行）。
  あゆみの確認の上、実行要否を判断してください。
- 公開申込フォーム(submitPublicApplication)はuser_id: nullで登録する匿名申込のため、
  §12で確定した「申込者本人(user_id=auth.uid())」ポリシーだけでは、受講後にログインしても
  自分の申込を見つけられない可能性が高いと判断した。§9の参考SQLで
  `applicant_email = (auth.jwt() ->> 'email')` を条件に加える代替案を提示したが、
  これも未実行・あゆみの判断待ち（新しい仕様を独断で確定させないため、コード側は
  「見つからなければメール再検索フォールバックを出す」という壊れにくい実装にとどめた）。
- app/academy/applications/[id]/page.tsx（本部申込詳細）・app/academy/applications/page.tsx
  （本部申込一覧）は、AC-E6のRLSが適用されると intake_source='koushi' の申込を
  返さなくなる（§12の設計通りの副作用）。これらの画面のUI・文言自体は今回変更していない
  （AC-E系の指示に無かったため）。RLS適用後にkoushi申込がどう見えるか（0件になるか、
  エラー表示になるか）を実際に確認し、必要であれば別途UI調整することを推奨する。
- AC-E5のKitIntakeModalで受講形式(format)が未設定の申込は、送り先を自動判定できない旨の
  案内文を出すだけで送信自体は止めていない（shippingAddressはnullのまま保存される）。
  運用上、本部受付フォームでformatが「未定」のまま申込が来るケースがあり得るため、
  ブロックせずnullを許容する設計にした。
