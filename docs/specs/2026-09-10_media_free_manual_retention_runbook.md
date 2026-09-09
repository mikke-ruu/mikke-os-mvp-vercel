# Media Free 初期手動運用runbook

更新日: 2026-09-10

対象: Media Free初期公開

責任者: 通報と公開停止の最終判断はあゆみさん
状態: ローカル実装。公開フラグ、本番DB、production service keyには未接続

## このrunbookの目的

初期の低件数運用で、次の約束を手動で履行する。

- 記事またはMediaの削除後は30日間復旧でき、その後に通常データを削除する
- Mediaに関するアクセス、認証、操作、エラー、セキュリティログを90日間保存する
- 同意と公開の監査記録をMediaまたはアカウント終了後3年間保存する
- 通報、判断、措置、通知、異議申立ての記録を案件終了後3年間保存する
- 公開停止の必要性を90日ごとに見直す

自動workerと運用画面は初期公開の必須条件にしない。ただし、private台帳、service_role専用RPC、定期確認、実行記録、代理担当、バックアップ復元手順は省略しない。

## 権限

- 最終判断担当: final_decider
- 技術実行担当: technical
- 緊急の公開停止は両担当が実行できる
- holdの解除、通報案件の終了、3年監査の終了処理はfinal_deciderだけが実行する
- operator登録は本番適用後の別migrationで行い、あゆみさんの確定済みAuth user IDだけを登録する
- service role keyはVercelのserver環境だけに置く。ブラウザ、ログ、相談記録、Gitへ出さない
- 通常のSQL UPDATEやDELETEで処理せず、必ずmedia_ops_* RPCを使う

## 削除依頼

1. musubi.aroma@gmail.comで依頼を受ける。
2. 登録メールとの一致、またはログイン済み本人との別経路確認により本人確認する。身分証は必要な場合だけ最小限を受け取る。
3. media_ops_request_removalを実行する。
4. 公開記事、公開一覧、公開画像が見えないことを別セッションで確認する。
5. 返却されたcase ID、受付日時、復旧期限を依頼者へ案内する。
6. 30日以内に本人から復旧依頼があればmedia_ops_restore_removalを実行する。
7. 復旧後も自動公開しない。本人が最新の権利・個人情報・公開範囲を確認して再公開する。
8. 復旧期限を過ぎた案件はStorage削除とDB削除の二段階で処理する。

## 期限後の削除

1. media_ops_prepare_purgeで削除対象のbucket、storage path、object ID、SHA-256を確定する。
2. manifestをcase IDと結び付けて権限制限された運用証跡へ保存する。
3. Supabase Storage Admin APIでmanifestのobjectだけを削除する。
4. objectが存在しないことを確認し、その結果のSHA-256を作る。
5. media_ops_complete_purgeへcase ID、担当者、結果SHA-256を渡す。
6. 対象のsite、article、version、公開token、専用画像が残っていないことを確認する。
7. 他のMedia、記事、共有画像が変わっていないことを確認する。
8. 失敗時は公開停止を維持し、caseを完了扱いにしない。

Storage objectが残っている間、DBのpurgeは拒否される。記事間で共有されている画像は、他の記事が参照している間は記事単位のpurgeへ含めない。

## 通報とhold

1. 受信日時、canonical URL、理由、連絡先、証拠参照を確認し、media_ops_open_reportで受付IDを作る。
2. 権利侵害、個人情報、なりすまし、違法・危険、安全上の緊急性を確認する。
3. 公開を止める必要があればmedia_ops_apply_holdを実行する。
4. 投稿者への通知、回答、追加資料、判断を同じcaseへ記録する。
5. あゆみさんが最終判断し、holdを継続または解除する。
6. 継続時はnext_review_atが判断時から90日後になったことを確認する。
7. 解除しても公開は戻らない。投稿者本人による再確認と再公開が必要になる。
8. 案件終了時はmedia_ops_close_reportを実行し、終了から3年の保存期限を確定する。
9. 受信メールと添付資料も同じ案件番号で管理し、案件終了から3年後に削除する。

対応日数は利用者へ保証しない。緊急の公開停止と、最終的な削除判断は分けて記録する。

## 定期確認

### 毎日

- 09:00 JSTにmedia_ops_daily_checkを実行する
- 30日経過の削除案件を処理する
- 90日経過のログをmedia_ops_purge_expired_logsで削除する
- 期限超過holdと失敗案件を確認する
- 対象が0件でもdaily checkの実行記録を残す
- 17:00 JSTに失敗案件だけを再確認する

### 毎週

- 通報受信箱、迷惑メール、送信失敗通知を確認する
- 削除・hold・通報案件に担当者未設定や証拠参照切れがないか確認する
- 代理担当がservice role keyへ直接触れず、承認済みserver手順を実行できることを確認する

### 毎月

- 次の30日以内に見直し期限が来るholdを確認する
- あゆみさんが継続または解除を判断する
- 終了済み通報の3年期限が正しく設定されているか確認する

### 3か月ごと

- Supabase、Vercel、メール、監視サービスの実際のログ保存設定を確認する
- バックアップ世代交代の設定と証拠を更新する
- 隔離環境へバックアップを復元し、一般接続前に削除済み対象を再削除できることを試験する
- provider確認の結果SHA-256をmedia_retention_runsへ記録する

## バックアップからの復元

削除済み対象の最小台帳を本番DBとは別の権限制限された保管先にも保存する。保管項目はcase ID、対象内部ID、purge日時、結果SHA-256だけとし、記事本文や画像を含めない。

バックアップは直接通常環境へ復元しない。

1. ネットワーク分離した復元先を作る。
2. 外部の削除済み台帳を読み込む。
3. バックアップ作成後にpurgeされた全対象を再削除する。
4. hold対象が公開されないことを確認する。
5. public RPC、公開画像token、RLSの負例を確認する。
6. 合格後だけ通常環境へ切り替える。

実際のprovider設定と復元試験の証拠がない間は、公開フラグを有効にしない。

## アカウント終了

Auth userを先に削除しない。

1. 所有Mediaを公開停止する。
2. 削除依頼を作り、30日間の復旧期間を確保する。
3. MediaデータとStorageを期限後にpurgeする。
4. media_ops_anchor_owner_auditで、まだ起算日がない同意・公開監査へ3年期限を設定する。
5. Media以外のアプリに残る本人データを各担当手順で処理する。
6. 最後にAuth sessionを無効化し、Auth userを削除する。

## 公開前の一巡試験

- 別の通常ユーザー、匿名ユーザー、Supabase匿名セッションがprivate台帳とops RPCを読めない
- ownerがdeleted_at、moderation_hold、hard DELETEを直接変更できない
- 削除受付直後に公開DTOと公開画像が無効になる
- 30日以内だけ復旧でき、復旧しても自動公開されない
- 30日前purge、hold中purge、期限後復旧を拒否する
- Storage削除失敗時にDBだけ削除されない
- 共有画像と別ownerのデータを削除しない
- 通常のversion UPDATE・DELETEは不変制約で拒否される
- 承認済みpurge案件に含まれるversionだけ削除できる
- 90日前のログは残り、90日経過ログだけ削除される
- 通報終了とMedia終了を起点に3年期限が設定される
- hold解除で自動再公開されない
- migrationと負例をPostgreSQL 17.6のnetworkなし、portなし、tmpfs containerで実行し、ROLLBACK後の残存が0

## 初期公開で後回しにできるもの

- 自動削除worker
- 専用の運用管理画面
- 通報フォームと自動受付メール
- owner向け削除ボタン

後回しにできないものは、private台帳、service role専用RPC、operator登録、日次確認、代理担当、Storage二段階削除、外部の削除済み台帳、provider設定確認、隔離復元試験である。
