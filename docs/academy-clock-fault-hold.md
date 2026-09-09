# Academy時計異常の取消希望記録

新規候補。既存の無料168時間、JWT本人確認、XID直後のDB時計、期限内取消優先は変えない。epoch承認やpolicy有効化は行わない。

## 検出と保存

本人確認後、XID採番前にsnapshotを取り、その直後にXID、独立文のclock_timestampを実行する。snapshotで既にcommit済みと証明できる同一runtime signatureのbarrierだけを比較する。XIDの大小だけを時刻とみなさない。並行barrierや別epochを後退証拠にしない。

時計がそのbarrierより前なら、取消意思、本人、HQ、再送キー、XID、生時計、entry snapshot、runtime signature、barrierのID/XID/時刻、理由を一つのimmutable台帳へ保存する。台帳行が恒久holdそのものとなる。成功receiptや受付連番は作らず、例外を投げずにclock_fault DTOを返してcommitする。外側transactionがrollbackした場合まで耐久とは呼ばず、応答不明時はstatusを別transactionで確認する。

同じキーの再送は元のfaultを返す。新しい試行の時計で元の意思を置換しない。別HQ/actorは参照できず、匿名・service roleは取消受付できない。生時計と内部barrierはbrowser DTOへ出さない。

利用者には「受付時刻を確定できないため課金を停止し、取消希望を記録しました。確認後に結果を通知します」と表示する。取消成功と表示しない。再送や後段commandを自動実行せず、再操作を権利維持条件にしない。

## 停止範囲と限界

共有scope lock後のdispatch checkは一件でもfaultがあれば、全Academyの新規有料移行start_paidをclock_fault_holdで拒否する。既存有料契約の金額や権利は変更しない。取消など課金を止める処理は既存ルールへ委譲する。

これは検出可能な因果矛盾の停止であり、時計の絶対精度を証明しない。比較barrier以前の時計誤差、検出前に完了したdispatch、DB外でprovider送信中の処理は取り消せない。後退を発見した受付と他HQの既に進行中のdispatchにもraceが残る。本候補だけでruntime_epoch_approvalsをapprovedにしてはならない。

hold解除APIは意図的に作らない。時計の復旧、再起動、policy切替、service role操作で解除できない。原記録をUPDATE/DELETE/TRUNCATEして解除する運用も禁止。別権限の監査・解決イベント設計と試験が別ゲートである。

## 有効化前に必要な運用

1. 異常検出時に新規dispatchを停止し、影響HQ・XID・未解決transactionとprovider送信中/送信済みを照合する担当を決める。
2. 元の意思が期限内と確認できれば取消優先。期限外と証明できない場合もholdを維持する。
3. 送信中はproviderの最終状態をidempotency keyで確認し、成功・失敗・不明を記録する。不明のまま再請求しない。
4. 課金済みなら通知・返金・権利復旧を個別監査し、二重返金を防ぐ。金額、担当、対応期限、手数料負担は承認済み扱いにしない。
5. 別権限者がprovider dispatch不在、未解決transaction解消、正常watermark再成立と全fault解決を監査して明示解除する。自動解除は禁止。

本人判断の集約案は「時計異常で取消期限を確定できない課金は保留し、既課金が確認された場合の返金・権利復旧を担当者の個別監査で処理する方針と、運用責任者を確定する」の1件。返金条件の既存承認があるか法務で照合してから提示する。取得できないNTP管理証明を待つ代わりに、この検出・停止・照合・復旧責任と実試験を有効化条件にする。

## 検証の境界

専用の一時PostgreSQLコンテナで合成fixtureを使用する。実Auth、全baseline、実Stripe、実UI、課金後raceを代替しない。既存academy-release-auth-20260909は変更しない。本番DDL、push、deploy、有効化はこの担当では実施しない。

2026-09-09の検証結果: PostgreSQL 17.6で30 checksと専用コンテナ削除確認が成功しexit 0。実2接続でentry snapshot後の並行barrierを異常扱いしないこと、未commit faultと同じHQ scopeで待ったdispatchがcommit後のholdを読むことを確認した。恒久台帳、本人/匿名/他人/サービス権限、迂回禁止、rollback、再送、DTO、連番不変も検査した。fixtureは既存ingressの受付table/append/ack/statusと既存fenceの実SQLを使用し、周辺業務schemaのみ合成している。

新規client状態負例、既存取消client18件、既存UI状態検査、tsc --noEmit --incremental false、node --check、git diff --checkも成功。Supabase advisorsはこのvanilla PGの最小fixtureでは実行しておらず、全baseline/実Supabaseでの適用前確認に残す。
