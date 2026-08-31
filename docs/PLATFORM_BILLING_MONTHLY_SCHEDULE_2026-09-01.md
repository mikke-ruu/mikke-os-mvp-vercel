# Academy / Community 有料開始・更新日

## 本人承認済みの範囲

2026-09-01、統制室が「本人の有料申込み・決済成功から1か月利用開始、毎月同日更新、該当日なしは月末」でよいかを具体的に質問し、本人が「はい」と回答。

- 無料期間終了だけで自動課金・自動有料転換しない。
- Academy7日、Community30日の既承認条件は変更しない。
- 日付は既存見積契約と同じ日本時間の暦日を使用。1か月を30日で代用しない。
- 1/31開始→2/28（うるう年2/29）→3/31。短い月を経由しても元の31日を保持する。4/30開始→5/30であり、常に月末契約にはしない。

## ローカル実装

`lib/billing/platform/schedule.ts` の `getMonthlyBillingPeriod(originalPaidStartDay, periodIndex)` は元の有料開始日と0始まりの月番号から当該開始日・次更新日を返す。入力不正はnull。日程計算だけで料金・権利・請求を作らない。

原本の有料開始日は将来のserver側で検証済み決済イベントから取得する。successクエリ、Webhook到着時刻、試用期限、前月の短縮日を原本にしない。ブラウザからの日付指定を契約確定に使わない。

今回は共通関数と単体試験のみ。HTTP/既存quote validator/DB migration/アプリUIには未接続。providerの秒単位時刻・遅延決済との照合・署名イベント・最終確認表示は後続実装で照合する。この関数単体をpaid確認や請求成功の証明にしない。

検証: schedule 50 checks（400年周期106,485ケース）、既存quote 73 checks、全体lint/tsc exit0、diff check成功。純粋関数追加のみのため全体buildは今回は再実行せず、前commit f1a9ff4のbuild成功と区別する。

## 未承認・未適用

解約/返金、未払猶予、保持/削除、事業者表示、購入特典、Community無料開始時のカード要否等を今回の「はい」で承認扱いしない。決定IDは日程だけの識別子で、全規約のapproved flagとして使わない。

本番DB・実Stripe・実請求・push/PR/deploy/公開は未実施。mikkeOSメニュー/HP非掲載維持。origin/masterの共通ルール未収録は既知gapのまま変更しない。
