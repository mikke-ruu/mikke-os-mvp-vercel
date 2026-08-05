# mikke COMMUNITY 汎用アプリ 8月7日版 実装計画

作成日: 2026-08-02  
改訂日: 2026-08-03  
実装リポジトリ: `G:/Musubiプロジェクト/mikke-os-mvp`  
期限: **2026-08-07**  
状態: **汎用化P0基盤・本番DB反映済み**

### 2026-08-03 実装進捗

- `/community` に参加中・運営中Communityの汎用ハブを実装。
- `/community/create` にCommunity新規作成を実装。作成者はownerとなり、汎用的な初期Room 3件と `paid:member` 権限を自動作成。
- `/community/c/[communitySlug]` 配下の汎用Community routeを実装。
- Community名・説明・参加方式のowner設定を実装。
- Roomの `free / entitlement / staff` 設定と新規作成を実装。
- entitlement定義、参加者への手動付与・停止を実装。
- Room、Post、CommentをSupabase RLSで保護。無料参加者・権限保有者・運営者の取得範囲を分離。
- 追加migration 4件を本番Supabaseへ適用。RLSロールバックテスト、Community作成テスト、Security/Performance AdvisorのCommunity関連警告なしを確認。
- COMMUNITY対象TypeScriptチェック、`git diff --check`、HTTP 200、390 / 768 / PCレイアウトを確認。

---

## 0. 最重要の結論

作るものは `Official Academy COMMUNITY` という専用アプリではない。

作るものは、誰でも単独でCommunityを作成・運営できる **mikke COMMUNITY** である。Official Academyは、その汎用COMMUNITYを利用する最初の1運営者・1Communityとして扱う。

```text
mikke ID / 共通認証
  └─ mikke COMMUNITY（汎用アプリ）
       ├─ 一般運営者のCommunity A
       ├─ 一般運営者のCommunity B
       └─ Official Academy COMMUNITY（最初の利用例）
```

以後の仕様・UI・DBは、必ず汎用COMMUNITYとして成立するかで判断する。Official Academyにしか使えない固定文言、データ構造、権限名はCOMMUNITY本体に入れない。

---

## 1. プロダクトの責任境界

### 1-1. COMMUNITY本体が持つもの

- Communityの作成・設定・公開・休止
- Communityへの無料登録・参加
- Roomの作成・並べ替え・公開範囲設定
- 無料Room、課金Room、運営限定Room、権限限定Room
- Post、Comment、Event、Library、Profile
- owner / moderator / participantの運営権限
- Community単位の会員権限付与・停止
- 外部決済や外部アプリから権限を受け取る汎用的な接続口

### 1-2. COMMUNITY本体が持たないもの

- Academyの講座、受講、認定、Trainerの業務ロジック
- `Official Partner` や `Official Trainer` の意味判定
- Academy専用の画面・メニュー・文言
- Story、DESK、Activity Logへの必須接続
- 特定決済サービスに強く依存した会員判定

Academyなどの外部アプリは、COMMUNITYに汎用的な `entitlement key`（利用権限キー）を渡す。COMMUNITYはそのキーでRoomを開放するだけとする。

---

## 2. ユーザーと権限の分離

「Community内の運営権限」と「有料・資格による利用権限」を混ぜない。

### 2-1. 運営権限

```text
owner       Community設定と全運営機能
moderator   投稿・Room・会員の運営補助
participant 一般参加者
```

現行DBの `member` roleは後方互換のため当面残してもよいが、UIと新しい設計文言では「一般参加者」と扱う。有料会員の `Member`と同じ意味にしない。

### 2-2. 利用権限（entitlement）

例:

```text
paid:standard
paid:premium
credential:official_partner
credential:official_trainer
custom:regional_leader
```

これらはCOMMUNITYが意味を固定せず、Room入室判定に使える文字列キーとして扱う。付与元は `manual`、`subscription`、`external`などに分ける。認可判定にユーザーが編集できる `user_metadata` は使わない。

---

## 3. Roomの公開範囲

8月7日版で、各Roomは少なくとも次の公開範囲を持つ。

| access type | 利用できる人 |
| --- | --- |
| `free` | 対象Communityのactiveな無料参加者 |
| `entitlement` | 指定された有効なentitlementを持つ参加者 |
| `staff` | owner / moderator |

将来の `public`（未登録でも閲覧可）は、認証前ランディングとRLSを分けて安全に設計できた後に追加する。

Roomごとに次を設定できるようにする。

- Room名・説明・種別
- `free / entitlement / staff`
- 必要entitlement key（`entitlement` の場合）
- 投稿可能者・コメント可否
- 表示順・固定・アーカイブ

閲覧制御はUIで隠すだけでなく、Supabase RLSでPost・Comment・Event・Resourceまで一貫して保護する。

---

## 4. Academyなど外部アプリとの将来接続

Academy側から「既存のCommunity」を選び、Academyが管理する資格をCOMMUNITYのentitlement keyへ対応付ける。

```text
Academy側の資格判定
  → 汎用integration adapter
    → Communityユーザーにentitlementを付与
      → 対応する限定Roomを開放
```

接続をOFFにしても、Communityの無料Room、手動で付与した権限、投稿データは単独で維持できること。

Academy連携自体は8月7日版の必須範囲に入れない。8月7日版で実装するのは、将来連携を受けられる汎用entitlement構造までとする。

---

## 5. 8月7日版の必須スコープ

### P0: 必ず完了させる

1. Official Academy固定文言と固定slugをコア実装から外す。
2. Community名、説明、slug、参加方式をCommunityデータから表示する。
3. ownerがCommunityの基本設定を編集できる。
4. Communityごとに参加・閲覧・運営権限を分離する。
5. Roomを `free / entitlement / staff` に設定できる。
6. ownerが参加者へentitlementを手動付与・停止できる。
7. 無料参加者が無料Roomの投稿・コメント・イベント・資料を利用できる。
8. entitlement非保有者が課金Roomの中身を取得できないことをRLSで保証する。
9. PC、タブレット、スマホで主要操作が成立する。
10. Official Academy COMMUNITYを「汎用アプリ上の最初のCommunity」として登録・表示できる。

### P1: P0完了後に着手

- Communityの新規作成UI
- 複数Communityの切り替え・一覧
- 有料プラン作成UI
- 外部決済URLからの申込み導線
- 画像・ファイルアップロード
- メール通知・プッシュ通知

### 8月7日版に入れない

- Stripe本決済とWebhookによる自動開通
- Academyテーブルの参照・更新
- Official Partner / Official Trainerの資格判定
- Story、DESK、Activity Log連携
- DM、リアルタイムチャット
- 高度な分析・自動モデレーション

---

## 6. 画面構成

### 汎用アプリ入口

| Route | 画面 |
| --- | --- |
| `/community` | ログイン中ユーザーのCommunity入口 |
| `/community/login` | mikke IDログイン・無料登録 |
| `/community/create` | Community作成（P1。P0では運営者初期設定で代替可） |

### Community内

実装ではCommunityをslugまたはidで識別し、固定の `DEFAULT_SLUG` に依存しない。導入時は `/community/c/[communitySlug]` 配下へ段階移行する。

| Route | 画面 |
| --- | --- |
| `/community/c/[communitySlug]` | HOME |
| `/community/c/[communitySlug]/join` | 無料参加 |
| `/community/c/[communitySlug]/rooms` | Room一覧 |
| `/community/c/[communitySlug]/rooms/[roomId]` | Room詳細・Post・Comment |
| `/community/c/[communitySlug]/events` | Event |
| `/community/c/[communitySlug]/library` | Library |
| `/community/c/[communitySlug]/profile` | Community内Profile |
| `/community/c/[communitySlug]/owner` | 運営ホーム |
| `/community/c/[communitySlug]/owner/settings` | Community設定 |
| `/community/c/[communitySlug]/owner/rooms` | Room・公開範囲設定 |
| `/community/c/[communitySlug]/owner/members` | 会員・entitlement管理 |

現行の `/community/*` ルートは、Official Academy固定の画面として残さず、汎用入口または新routeへの互換リダイレクトにする。

---

## 7. データモデルの改訂

既に本番適用済みの `community_*` migrationは書き換えたり削除したりしない。汎用化は必ず新しい追加migrationで行う。

### 継続利用する主テーブル

- `community_communities`
- `community_memberships`
- `community_member_profiles`
- `community_rooms`
- `community_posts`
- `community_comments`
- `community_events`
- `community_event_attendees`
- `community_resources`

### 追加・拡張する構造

```text
community_rooms
  access_type free | entitlement | staff

community_entitlement_definitions
  id
  community_id
  key
  name
  description
  status

community_member_entitlements
  id
  community_id
  user_id
  entitlement_key
  source manual | subscription | external
  source_reference
  status active | revoked | expired
  starts_at
  ends_at
  granted_by_user_id
  created_at
  updated_at

community_room_entitlement_rules
  room_id
  entitlement_key
```

Roomに必要なentitlementを1つに限定する簡易版から開始してもよいが、将来の複数資格に耐えられるよう別テーブル化を優先する。

`community_plans`、`community_subscriptions`、`community_payment_events` は決済実装時に追加する。`community_memberships` に課金状態やAcademy資格を直接詰め込まない。

---

## 8. Supabase / RLSの必須条件

- public schemaの全 `community_*` テーブルでRLSを有効化する。
- `authenticated` だけで許可せず、必ず対象Communityのactive membershipを確認する。
- RoomコンテンツはRoomの `access_type` と有効entitlementをRLSで検証する。
- owner / moderator権限とentitlementを別テーブル・別ロジックで扱う。
- 認可に `user_metadata` を使わない。
- service role keyをブラウザへ渡さない。
- UPDATE policyに `USING` と `WITH CHECK` を設定し、対応するSELECT policyを用意する。
- RLS判定に使う `community_id`、`user_id`、`room_id`、`entitlement_key`、`status`に必要なindexを付ける。
- 新テーブルのData API公開設定と `anon` / `authenticated` へのGRANTをRLSと別に確認する。

### 必須の否定テスト

1. 非会員はCommunity内データを読めない。
2. Community Aの会員はCommunity Bのデータを読めない。
3. activeな無料参加者は `free` Roomを読める。
4. entitlement非保有者は `entitlement` RoomとそのPost・Commentを読めない。
5. 有効entitlement保有者は対応Roomを読める。
6. 期限切れ・取り消しentitlementでは読めない。
7. participantは `staff` Roomを読めない。
8. participantは自分にentitlementを付与できない。
9. moderatorはownerに自己昇格できない。
10. suspended / leftの参加者は閲覧・投稿できない。

---

## 9. 現在実装からの修正リスト

現在の実装は、汎用化の土台として利用するが完成扱いにしない。

### 残すもの

- Supabase Authを使ったmikke ID共通認証
- `community_*` に分離したデータ構造
- Community → Room → Post → Commentの基本構造
- Event、Library、Profile
- `MikkeAppShell theme="yellow"`
- PC左サイドバーとモバイル下部ナビ

### 修正するもの

- `Official Academy COMMUNITY` 固定見出し・説明文
- `DEFAULT_SLUG = official-academy-community` 依存
- Official Academy前提の初期Room名と資料
- Community説明をコードに直書きしている状態
- Community設定を編集できないOWNER画面
- Room単位の無料・課金・運営限定判定がない状態
- 実数でない会員数表示

Official Academyのseedデータは削除せず、「最初のCommunityデータ」として残す。ただし、アプリコードはそのslugや文言に依存しない。

---

## 10. 8月3日から8月7日の実装順

### 8月3日: 設計固定と固定依存の解除

- 本計画を実装の正典にする。
- 現在のCommunity差分と本番migration状態を保存する。
- 汎用routeとCommunity contextの受け渡しを実装する。
- Official Academy固定文言をDBデータ駆動に変える。

### 8月4日: Community設定とRoom公開範囲

- owner settingsを実装する。
- Room管理画面を実装する。
- `free / entitlement / staff` 設定を追加する。
- 追加migrationとRLSを作成する。

### 8月5日: entitlementと会員管理

- entitlement定義・手動付与・停止。
- 無料参加者と権限保有者の表示分け。
- Room、Post、Comment、Event、Resourceの閲覧判定。

### 8月6日: 運営CRUDとレスポンシブ仕上げ

- Community・Room・Post・Event・Library・Memberの必要CRUD。
- エラー、空状態、ロック中Roomの表示。
- 390px、768px、1440pxで操作確認。

### 8月7日: セキュリティ検証と試験運用

- RLS否定テスト10項目。
- 無料参加 → 無料Room → 手動権限付与 → 課金Room開放を実アカウントで確認。
- COMMUNITY対象のTypeScript・lint・build確認。
- PC・タブレット・スマホの最終確認。
- Official Academyを1Communityとして設定し、一般的なCommunityと同じ機能だけで運用できることを確認。

---

## 11. 受け入れ基準

### 汎用性

- Official Academyという名前を使わないCommunityを同じコードで運用できる。
- Community名・説明・Room構成をownerが変更できる。
- Academyのデータと接続しなくても全P0機能が動く。
- Official Academyは特殊処理なしの1Communityとして動く。

### 無料・課金エリア

- active participantは無料Roomを利用できる。
- entitlement非保有者は課金Roomの内容をAPIから取得できない。
- ownerが権限を付与すると対象Roomを利用できる。
- 権限の取り消し・期限切れ後は再び取得できない。
- 権限名はAcademy固有名に限定されない。

### 品質・分離

- Academy、Story、DESK、Activity Logテーブルを参照・更新しない。
- 別Community間のデータ漏れがない。
- 390 / 768 / 1440pxで主要導線が成立する。
- COMMUNITY対象のTypeScriptチェックが通る。
- 本番適用済みmigrationを履歴から消さない。
- 既存の無関係な未コミット変更を戻さず、COMMUNITY差分に混ぜない。

---

## 12. 実装時の固定ルール

1. この計画書を8月7日版COMMUNITYの正典とする。
2. 「Official Academyに必要か」ではなく、「一般のCommunity運営者にも成立するか」で判断する。
3. Academy固有の要望は、将来のintegration adapterまたはAcademy側の仕様として分離する。
4. 課金・資格・運営roleを同じ列に混ぜない。
5. 画面を隠すだけで認可とせず、RLSでデータ取得を防ぐ。
6. 期限内はP0に集中し、StripeやAcademy実連携でスコープを広げない。
7. `app/globals.css`、`app/layout.tsx`、`MikkeAppShell.tsx`、`types/database.ts`は必要性を確認せずに変更しない。
8. 汚れたworktreeのAcademy、AI OFFICE、Story、MarketNote、Team Works差分を戻さない。

---

## 13. 実装開始判定

- 汎用COMMUNITYがプロダクト本体: **確定**
- Official Academyは最初の1利用者・1Community: **確定**
- Community単独利用: **必須**
- 無料Room・課金Room・運営限定Room: **8月7日版P0**
- 課金Roomの手動権限付与: **8月7日版P0**
- Stripe実決済: **後続**
- Academy実連携: **後続**
- Academyなどから受け取れる汎用entitlement構造: **8月7日版P0**
- PC・タブレット・スマホ対応: **必須**

実装者はこの境界を再確認するために作業を停めず、次の安全なP0実装へ進む。

---

## 14. 2026-08-03 継続実装メモ

### 追加完了

- OWNERにコンテンツ管理導線を追加。
- owner / moderator向けに、告知投稿、固定表示、非表示操作を追加。
- owner / moderator向けに、イベント作成、受付終了、受付再開、中止を追加。
- owner / moderator向けに、資料リンク追加、公開停止を追加。
- owner / moderator向けに、Room公開停止を追加。
- owner / moderator向けに、参加者role変更、参加停止、復帰を追加。
- join_modeに応じた参加導線を安全化。`open_free`のみ自己参加でき、`invite_only / paid` は受付外表示にする。
- owner / moderatorは、非表示投稿・中止イベント・公開停止資料も管理画面で確認できるようにした。
- 投稿の再表示、資料リンクの再公開を追加。
- owner / moderator向けに、告知投稿、イベント、資料リンクのinline編集UIを追加。
- owner / moderator向けに、Room名、説明、種類、投稿可否、コメント可否、並び順のinline編集UIを追加。
- owner / moderator向けに、公開停止中Roomの表示と再公開UIを追加。
- owner管理画面のボタン列、Room設定列、権限付与フォーム、コメントフォームを狭い画面で折り返せるよう調整。
- mobile bottom navのkey衝突警告を防ぐため、`MikkeAppShell`のbottom nav keyを `label + href` に変更。
- 本番Supabaseへ `community_staff_hidden_post_read` migrationを適用。
- 本番Supabaseへ `community_staff_archived_room_read` migrationを適用。
- `/community/c/[communitySlug]/owner/content` を追加。
- 旧互換URL `/community/owner/content` から最初のCommunityへredirect。
- COMMUNITY範囲のTypeScriptチェックを実施し、通過。

### 8月7日までの残工程

- 実アカウントで、無料参加、owner引き受け、Room公開範囲変更、権限付与、限定Room閲覧を通し確認。
- ownerコンテンツ管理の実操作確認。特に告知投稿、イベント作成、資料追加。
- owner参加者管理の実操作確認。特にmoderator付与、参加停止、復帰。
- 390px、768px、PC幅で、HOME / ROOMS / OWNER / CONTENTの表示確認。
- COMMUNITY対象の最終TypeScriptチェック、差分チェック、必要に応じた限定lint。
- 本番DBに対する追加migrationが必要になった場合だけ、RLS advisor確認後に適用。

### 後続工程

- Stripeなどの実決済接続。
- Academy側からCommunity entitlementを付与するadapter。
- 招待コード、メール配信、member / officialpartner / officialtrainerの自動同期。
- 投稿・イベント・資料の並び替え。
