# mikkeOS Event Portal & MarketNote連携 計画

作成日: 2026-07-13
ステータス: 設計のみ。実装は着手しない。

このdocsは、EVENTモジュールの後続フェーズとして「イベントポータル」と「MarketNote自動連携」を実現するための計画である。ユーザー依頼に基づき、ロードマップへ反映する目的で作成した。今回はdocsへの記録のみで、コードは一切変更しない。

前提: `docs/MIKKEOS_EVENT_SPEC_EXTRACT.md` のFable Sign-offで確定した第1パス（localStorage・7画面・My Page除外）が完了していることが、このフェーズ着手の前提になる。

## 1. 背景・ゴール（依頼原文の要約）

ユーワードのイベント主催者がEVENTアプリを使うようになった将来、次の2つを実現する。

```text
1. イベントポータル: 各主催者が公開したイベントを1つのポータルサイトに集約表示する。
   主催者ナンバーでの絞り込み、地域別（関東だけ・関西だけ等）の絞り込みができること。
2. MarketNote自動連携: イベント申込が「確定」になったら、その出店者の
   MarketNoteに出店予定が自動で1件作成されること。
```

## 2. 現状確認済みの事実（2026-07-13時点・このdocs作成時にコードで再確認済み）

```text
- EVENTモジュールはlocalStorage保存のMVP段階（lib/event/store.tsに
  「Supabase/Activity Log接続は後続フェーズ」と明記済み）。
- MarketNoteは既にSupabase接続済み。market_events テーブルに
  profile_id単位で出店予定が入る構造（lib/marketnote.ts createMarketEvent）。
- MikkeEvent型（lib/event/types.ts）に ownerProfileId あり。
  venueAddressは自由入力テキストで、構造化された都道府県・地域フィールドはない。
- EventApplication（申込）はapplicantName / contactEmailのみで、
  出店者のmikkeOSアカウント（profile）と紐づいていない。
- Profile型（types/database.ts）に member_number: number | null が既にある。
  「主催者ナンバー」の実装先として、新規フィールドを増やすより
  この既存列を再利用できる可能性が高い（実装時に判断）。
- MarketEvent型（types/database.ts）に area: string | null が既にある
  （現状は自由入力の地域文字列）。Eventに追加する構造化都道府県フィールドと
  名称・用途が重なるため、フィールド名の衝突に注意する
  （例: Event側は venuePrefecture のような別名にするなど。実装時に判断）。
- 既存のPhase 4 adapter方針（docs/MIKKEOS_PHASE4_SUPABASE_ADAPTER_PLAN.md）は
  「金額・事務・内部ログは強制private、public Story判定はvisibility+
  display_on_storyの組み合わせのみで行われる」という安全設計を確立済み。
  Event側のSupabase移行もこの方針を継承する。
```

## 3. 実装フェーズ案（この順で計画に載せる。依頼原文通り）

### Phase E1: EVENTのSupabase移行（前提となる最大の工程）

```text
- events / event_applications テーブル設計
- RLS: 主催者は自分のイベントを管理、公開中(published)イベントは
  誰でも閲覧可
- 既存のactivity_logs RLSパターン（本docs 2章参照・Phase4確立済み）を
  踏襲する: 「auth.uid() = user_id かつ profiles経由でprofile_id所有確認」
  という書き込みガードの型を、events/event_applicationsにも適用する
- 個人情報（applicantName/contactEmail/phone等）を含む
  event_applicationsは、主催者本人以外に読み取らせない設計にする
  （申込者本人の閲覧経路が必要になった場合は、My Page実装時に
  別途トークン設計を検討。BP-2-bのFable Sign-offで見送った経緯を踏襲）
```

### Phase E2: イベントへのフィールド追加

```text
- 都道府県フィールド（select入力）＋都道府県→地域（関東/関西等）の
  自動変換ロジック
- 公開用「主催者ナンバー」（ownerProfileIdに紐づく公開ID）
  → 2章の通り、profiles.member_numberの再利用を第一候補として検討
```

### Phase E3: 申込とアカウントの紐づけ

```text
- ログインユーザーとして申し込む形にし、applicantProfileId を保存
- 出店者がmikkeOSユーザーになる導線としても機能させる
- 注意: 現行のEvent公開申込フォーム（/event/[id]/apply）はログイン不要で
  動く設計（Order/Session含め、公開側は原則ログイン不要という統一方針）。
  ログイン必須化は公開面の導線変更になるため、Story基準UIの見せ方も
  含めてPhase E3着手時に別途方針確認が必要
```

### Phase E4: ポータルページ

```text
- 公開イベントのみの読み取り専用一覧
- 絞り込み: 地域 / 都道府県 / 主催者ナンバー / 開催日
- mikkeOS内の1ページ or 同じSupabaseを読む独立サイト
  （どちらかは実装時に判断）
- UI実装時はStory基準のClean UI（docs/MIKKEOS_CLEAN_UI_ROADMAP.md）に従う。
  現行の/eventはEventPublicShellという軽量な公開シェルを使っており、
  ポータルもこの延長として設計するのが自然（実装時に判断）
```

### Phase E5: MarketNote自動登録

```text
- 申込statusがconfirmedになったタイミングで、申込者のmarket_eventsに
  予定を自動作成（イベント名・日付・会場・出店料を引き継ぐ）
- 実装はDBトリガー or アプリ側処理のどちらかを実装時に判断
- 連携時の注意点（既存のPhase4安全方針との整合）:
  - 自動作成されるMarketNoteイベントのstatusは、MarketNote側の
    createMarketEvent仕様（"planned" | "preparing"）に合わせる。
    Event側の"confirmed"とMarketNote側のstatus値は同一語彙ではないため
    マッピングが必要（例: confirmed → preparing）
  - 出店料（fee_amount）を引き継ぐ場合、MarketNote側は金額ログを
    強制privateで扱う設計（本docs2章のPhase4方針）と整合させる
  - 申込者にMarketNoteプロフィールが存在しない場合の扱い
    （Phase E3の紐づけが前提になる）を実装時に決める
```

## 4. このフェーズ全体の位置づけ

マスタープラン（`MIKKEOS_APP_PORTFOLIO_MASTER_PLAN_2026-07-12.md`）における実行ラインでは、Event MVP第1パス（BP-2-b）は完了済み。本docsの5フェーズは、Event MVPの「後続フェーズ」として、Supabase本接続フェーズ（Phase 4.5方針docs群）と足並みを揃えて着手する。

現時点で確定していること:

```text
- 今回はdocsへの反映のみ。実装着手はしない。
- 実装着手のタイミングは別途指示を受けてから。
- Phase E1（Supabase移行）が他フェーズの前提。E2〜E5はE1完了後。
- 「今すぐやらないこと」（マスタープラン・各Phase4方針docsに共通）は
  引き続き有効: DB migration即時実行・RLS変更の無断実施・
  本番データ設計の確定は、この計画docsを作った時点では行わない。
```

## 5. 未確定事項（実装時に判断するとした項目の一覧）

```text
1. 主催者ナンバー = profiles.member_number を再利用するか、新規列にするか
2. Event側の都道府県フィールド名（MarketNoteのareaとの衝突回避）
3. ポータルをmikkeOS内ページにするか独立サイトにするか
4. MarketNote自動登録をDBトリガーにするかアプリ側処理にするか
5. Event申込フォームのログイン必須化に伴う公開面UXの再設計要否
6. 申込者にMarketNoteプロフィールが存在しない場合の自動登録の扱い
```
