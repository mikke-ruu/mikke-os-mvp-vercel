# Communityごとの30日無料

## 承認と範囲

Community室で「追加Communityもそれぞれ30日間無料で始められるようにしてよいか」に本人が「はい！」と回答した。

- task: `019fd21b-7bb1-7252-9250-b47dfcc6611c`
- turn: `01a0851c-f7d8-7c41-a243-14725cf5682a`
- userMessage: `01a0851c-fae6-7c11-8d59-32e86fcdc664`
- 基準: fetch確認後の `origin/master@c8b4812a6c1e4348387c29586ad5aa8bb4ba0b6a`

ローカル共通DB候補と隔離検証が対象。本番DB、Stripe、push、PR、merge、デプロイは行わない。Community画面は担当室が別commitで所有する。

## 契約

既存 `platform_billing_community_trial_start(actor, request)` の署名と公開DTOは変更しない。本人確認済みサーバーだけが呼べる。ブラウザへ台帳IDを返さない。

- 同じ操作の再送は同じrequest IDを使う。未消費の無料作成権なら同じ開始・終了日時を返す。
- 別requestが並行して届いても未消費の作成権を再利用する。双方のrequestと同じ作成権の対応を不変台帳へ記録する。
- 作成権を団体へ消費した後は、元requestと別名requestの再送を拒否する。次の団体は新しい明示操作と新requestで開始する。
- 既存団体の期限、メンバー、契約、権利を移し替えない。
- 未消費の有料作成権は無料へ置換しない。既存の作成フォームへ進む。
- 団体未作成のまま無料期間が切れた場合は、新しい明示操作に限り別の作成権を発行する。旧availableはexpiredへ終端化し、旧日時と旧requestを維持する。旧request再送は拒否する。
- 管理上revokedとなった未作成trialは、新requestでも解除しない。
- 既存ownerや有料契約を持つ人も、別団体の新trialを開始できる。既存有料subscriptionは更新しない。
- 30日間はサーバーの開始受付時から計算し、Community作成時に再起算しない。自動課金を行わない。

`platform_billing_status_get`は以前の実装へ委譲し、Community新規作成の`start_trial`だけを同条件へ合わせる。既存resourceへの`start_trial`は返さない。Academy投影は以前の関数へそのまま委譲する。旧関数を直接呼ぶ権限は付与しない。

HTTPの現行status gateで再送を許すため、有効な未消費trialは`create_resource`と`start_trial`を返す。UIは作成フォームへの移動を優先する。未作成expiredの場合は`ended/trial`に加えサーバーが`start_trial`を返した場合だけ、新規開始を許可する。

## 排他とセキュリティ

開始RPCは`auth.users FOR NO KEY UPDATE`を先に取得し、続いて作成権をロックする。開始同士は直列化される一方、guarded createが必要とするユーザー外部キーのKEY SHAREとは競合しない。従来のFOR UPDATEでは作成権とユーザー外部キーの逆待ちが成立し得た。

生涯1回indexを廃止するが、未消費作成権1件のunique indexは維持する。request台帳にはRLSを適用し、service_roleを含め直接操作権限を与えない。既存trialのrequest対応を移行時に補完し、既存日時を変更しない。

## 検証方法と限界

`node scripts/community-per-resource-trial-check.mjs --run-isolated`を使う。Docker実体がPATH外なら`COMMUNITY_TEST_DOCKER`に既存exeを指定する。

既存`postgres:17.6`を`--pull=never`、network none、公開ポートなし、tmpfs、固有名・ラベル付きで起動する。合成データだけを使い、終了時は自分が作成したコンテナをラベル照合後に削除する。他の環境は触らない。

7本の実migrationと、周辺Auth/Communityテーブルの最小fixtureを使用する。実guarded create、quote/attempt、subscription、creation ledgerのコードを検査するが、全schema baseline、容量・保持trigger、実Supabase Auth/PostgRESTのE2Eを代替しない。

検査は旧request移行、30日境界、同request/別request再送、2団体作成、団体別status期限、有料作成権とbound subscription不変、expiredの新操作、revoked拒否、Academy投影不変、ACL、ROLLBACK後catalog/role残存なしを含む。実2接続で開始同士の待機、開始対guarded create、先行開始rollbackを観測する。

既存masterには旧verified-payment RPCが`evt_test_`のみを許し、後続tableは`evt_`形式へ変更される不一致がある。今回はその別件を変更せず、paid fixtureは実quote/attemptと整合する合成eventを制約付きtableへ投入する。実Stripe試験の成功とは扱わない。

公開前には統合先の現schemaと適用順の再確認、全schema/実Auth/2団体の製品UI検証、本番適用の別gateが必要。旧trialの静的テストが成功しても、この新しい回帰runnerの代用にはならない。

## 今回の結果

2026年9月9日、PostgreSQL 17.6の最終runnerは49 checks、exit 0。旧requestの移行検査と実並行3ケースを含む。ROLLBACK後のschema・roles・public catalog件数は元と一致し、固有の検証コンテナも削除後の不存在を確認した。以前の失敗試行も各finallyで検証コンテナを削除した。

既存HTTP fake 256件、creation-entitlement契約8件、旧trial静的契約、runner構文検査が成功した。JavaScript/TypeScript製品コード、既存migration、UIは変更していない。全アプリbuildや本番Auth試験を新たに成功とする報告ではない。
