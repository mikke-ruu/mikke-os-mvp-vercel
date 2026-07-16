# Fund F5-f Operations Decision

作成日: 2026-07-16

対象repo: `G:/Musubiプロジェクト/mikke-os-mvp`

状態: F5-f判断完了

## 1. 判断の目的

F5-fでは運営機能を一括実装しません。Fund MVPを安全に完了するため、今必要な境界だけを固定し、共通基盤や実運用量が必要な機能は後続へ分離します。

判断軸:

- 個人情報や公開漏れを今すぐ防ぐ必要があるか
- Fund単独で作るよりMikke OS共通基盤として作るべきか
- 現在の実運用量で手作業では扱えないか
- 外部送信、secret管理、再送、監査を伴うか

## 2. 結論

| 項目 | 判断 | F5-fでの対応 |
| --- | --- | --- |
| 通知 | 後回し | Activity Log、Fund一覧、応援者・提供状況画面を現時点の確認口とする |
| 通報・問い合わせ | 後回し | Fund単独フォームは作らず、Mikke OS共通の問い合わせ・moderation導線と管理責任者を決めてから実装 |
| CSV出力 | 後回し | 応援者名・メール・金額を含むため、export権限、mask、監査、削除方針を決めてから実装 |
| Webhook | MVP不要 | 安定したevent contract、secret保管、署名、再送、失敗監視が必要になる連携phaseまで作らない |
| 削除・保全 | 今必要 | ownerのhard deleteを止め、archive / private / draft / invalid / cancelled / refundedで履歴を保全 |
| unlisted | 機能は後回し・安全境界は今必要 | token方式完成まで選択不可。public投影とlocal fallbackの両方をfail closedにする |

## 3. 通知

Fund専用通知は実装しません。

理由:

- 通知設定、既読、配信先、失敗処理はOS共通基盤にすべき
- 現状はActivity Log、Fund一覧、応援者一覧、提供状況で状態を確認できる
- メールやpushをFundだけで先行すると、同じユーザーへ重複通知する可能性がある

再開条件:

- OS共通notification modelと設定画面がDB正本になる
- 発火event、受信者、既読、配信失敗の責任範囲が決まる

## 4. 通報・問い合わせ

Fund単独の通報tableや管理画面は実装しません。

理由:

- 公開コンテンツ全体のmoderation、受付窓口、対応担当、期限、証跡が必要
- Fundだけに作るとStory、Order、Eventなどで受付が分散する
- 現時点の限定運用では、projectの `contactNote` と運営窓口で代替可能

再開条件:

- Mikke OS共通の問い合わせ・通報分類と担当者が決まる
- 公開ページ共通の導線が決まる

## 5. CSV出力

CSVは実装しません。

理由:

- `fund_supports` は氏名、メール、金額、管理メモを含むowner-privateデータ
- download後はRLSで保護できず、端末や共有先で複製される
- 現在の件数は画面で管理でき、exportを急ぐ運用量ではない

再開条件:

- export対象列、mask、権限、操作履歴、文字コード、削除期限を決める
- 実運用量が画面管理の上限を超える

## 6. Webhook

WebhookはMVP不要です。

再開時に必要なもの:

- version付きevent contract
- secretのserver-side保管
- payload署名
- retry / dead letter / idempotency
- delivery logと失敗通知

これらがない状態で外部送信を始めません。

## 7. 削除・保全

ownerのData API hard deleteを次の正本表から削除しました。

- `fund_projects`
- `fund_supports`
- `fund_updates`
- `fund_challenge_records`
- `fund_app_links`

代替状態:

- project: `archived` または `private`
- support: `invalid`、`cancelled`、`refunded`
- update: `draft`
- completion: `private`
- app link: `cancelled`

`fund_plans` のDELETE権限は、`save_fund_project_content` がownerのplan集合を同一transactionで差し替えるため維持します。

service roleによる実削除は残し、本人からの削除依頼、法的要請、運営保守はブラウザowner操作とは別の管理手順で扱います。具体的な保全日数は利用規約・プライバシーポリシーと合わせて後続で固定します。

## 8. unlisted

現在の `unlisted` は安全な共有機能として提供しません。

F5-fで固定した動作:

- owner formでは `限定URL（準備中）` として選択不可
- public routeのlocal fallbackは `visibility=public` だけを表示
- DB public projectionは従来どおり `visibility=public` だけを作成
- unlisted保存済みデータはowner画面には残るが、外部公開・Story伝播しない

将来のtoken方式で必要な条件:

- 十分なentropyを持つrandom token
- DBにはtoken原文ではなくhashを保存
- 有効期限、失効、再発行
- raw owner-private表を直接公開しないpublic-safe projection
- token照合RPCのrate limitと監査

## 9. F5-f完了条件

- owner hard delete 5表のDELETE grantが0件
- plan差替えに必要なDELETE grantは維持
- ownerの直接削除が拒否される
- archive / invalid / draft / private / app linkが保全される
- unlistedのpublic投影が0件
- public local fallbackがunlistedを表示しない
- F4-b1からF5-eまでの全回帰test成功
- Advisor、lint、build成功
