# COMMUNITY 課金・連携・契約・個人情報整理（2026-08-14）

## 1. お金は2種類に分ける

### A. Communityアプリ利用料

- 支払う人: Communityを作成・運営する本部
- 受け取る人: mikke側のサービス提供事業者
- 対価: Communityアプリ、保存容量、管理機能、サポート等
- 決済: mikke側のStripe Billing等（料金確定後に接続）
- 必要書類: Community運営者向け利用規約、料金・解約条件、プライバシー/データ処理条項

### B. 参加者の会費

- 支払う人: 各Communityの参加者
- 受け取る人: 各Communityの運営本部
- 対価: 各本部が提供する会員サービス・コンテンツ
- 決済: 各本部自身のStripe、Square、STORES等
- mikkeの役割: 決済URLと支払い確認状態をCommunity権限へ結び付ける
- 必要書類: 各本部の特商法表示、会員規約、返金・解約条件、プライバシーポリシー

mikkeが参加者会費を代理受領・分配する方式は、会計・返金・チャージバック・本人確認・規約責任が大きく変わるため、現段階では採用しない。

## 2. Academy連携と他業種連携

継続会費を持つ元サービスを「アクセス提供元」として扱い、Community固有の処理にしない。

1. Academy、協会、スクール、ファンクラブ等で会員商品を作る
2. Community側で「どの商品が、どの利用権限を与えるか」を1回設定する
3. 会費の開始・継続・未払い・解約は元サービス側で管理する
4. その状態をCommunityの entitlement（利用権限）へ同期する
5. Roomは entitlement を参照して閲覧可否を決める

Official Academyの場合、日々の会員操作はAcademy側だけでよい。ただし初回にCommunity側で「Academy商品 → Community権限」の対応付けが必要。一般の業種も同じ `provider_type / source_product_key / entitlement_key` の組み合わせで対応する。

## 3. 今回実装した範囲

- 個別Communityの招待URL表示・コピー
- mikke ID招待（メールアドレスを運営へ公開しない）
- 招待者も氏名・電話・規約同意の参加手続きを通す
- 外部決済URLを持つ有料会員プラン
- 参加者の支払い確認申請と運営承認による権限付与
- 汎用アクセス提供元マッピングのDB土台
- MY PAGE（プロフィール、権限、会員プラン、データ開示・削除申請、退会）
- 運営者・契約情報（法人/屋号、代表者、所在地、連絡先、特商法・規約等URL）
- Communityアプリ利用契約・課金状態を保持するDB土台
- 添付ファイルの閲覧をRoom権限に連動させるStorageポリシー修正

## 4. 土台のみで、販売開始前に残るもの

- mikke側Communityアプリ利用料の価格決定とStripe Billing接続
- 外部決済サービスのWebhookによる自動付与・停止（現在は運営確認方式）
- Academy subscription とCommunity entitlementの自動同期処理
- 支払い失敗、猶予期間、返金、解約、プラン変更の状態遷移
- 運営者本人/法人確認と契約承認フロー
- データ開示・削除申請を処理する本部管理画面と期限管理
- CSVエクスポート、監査ログ、障害/漏えい時の運用手順
- 本番メール（独自SMTP）、MFA、バックアップ/PITR、Bot対策等の本番設定確認
- 利用規約、プライバシーポリシー、特商法表示、運営者規約の最終リーガルレビュー

## 5. 競合の料金・機能（公式公開情報）

| サービス | 公開料金 | 決済 | 主な特徴 |
| --- | --- | --- | --- |
| CAMPFIRE Community | 初期・年額0円、売上手数料15%（手数料に消費税） | プラットフォーム決済 | 複数特典、会員管理、メッセージ、分析、外部ツール連携 |
| DMMオンラインサロン | 専用Communityはオーナー報酬80%（実質20%）、Facebook型は90% | プラットフォーム決済 | 集客支援、審査、複数支払期間、専用Community |
| Circle Professional | 89米ドル/月、取引手数料2%（別途Stripe） | 運営者のStripe連携 | 無制限メンバー、Room、イベント、コース、ブランド、分析 |
| Circle Business | 199米ドル/月、取引手数料1%（別途Stripe） | 運営者のStripe連携 | API、ワークフロー、セグメント、カスタムプロフィール |
| FANTS | 初期・月額は個別見積 | プラットフォーム決済 | 専用アプリ、複数会員プラン、ライブ、通知、EC、セグメント |

出典:

- CAMPFIRE: https://camp-fire.jp/legal
- DMM: https://lab.lounge.dmm.com/chapters/introduction/faq
- Circle: https://circle.so/pricing
- Circle取引手数料: https://help.circle.so/p/payments/paywall-setup/paywall-transaction-fees
- FANTS: https://community.fants.jp/

## 6. 料金のたたき台

参加者会費から15〜20%を取る国内型より、Communityアプリ利用料を固定し、各本部の会費は各本部へ直接入る設計を価値にする。

- Free/Trial: 0円、少人数・短期試用、機能/容量制限
- Standard: 月額4,980円前後、基本Community機能、複数会員ランク
- Pro: 月額9,800〜14,800円前後、自動連携、容量増、分析、優先サポート
- 初期設定/移行支援: 別料金

正式価格は、保存容量、メール/通知費、サポート工数、決済自動化の有無、想定参加人数で原価試算してから決定する。

## 7. 一般企業が揃える文書と運用

### mikke側

- サービス利用規約
- Community運営者向け契約/特約
- プライバシーポリシー
- データ処理・委託先一覧
- 料金、更新、解約、返金条件
- 禁止事項・利用停止基準
- セキュリティ/事故対応方針
- データ保存期間・削除方針

### 各Community運営本部側

- 運営者情報
- Community利用規約・ルール
- プライバシーポリシー
- 有料の場合の特商法表示
- 会費、更新、解約、返金条件
- 問い合わせ・通報窓口
- 禁止ワード・投稿削除・利用停止基準

参考にする一次情報:

- 個人情報保護委員会ガイドライン: https://www.ppc.go.jp/personalinfo/legal/guidelines_tsusoku/
- 消費者庁 通信販売の申込み段階表示: https://www.caa.go.jp/notice/assets/consumer_transaction_cms203_230628_03.pdf
- 消費者庁 通信販売Q&A: https://www.no-trouble.caa.go.jp/qa/advertising.html
- Supabase本番チェックリスト: https://supabase.com/docs/guides/deployment/going-into-prod

テンプレートは一般例を基に作成できるが、サービス固有の責任分担、返金条件、個人情報の共同利用/委託、未成年対応等は最終的に専門家レビューを受ける。
