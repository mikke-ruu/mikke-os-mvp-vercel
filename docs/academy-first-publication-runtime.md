# 初公開制度の接続候補

2026-09-08。先行commit `a84a6aa` に続くCLI生成migrationは `20260908084409_academy_first_publication_runtime.sql`。Supabase未適用、PGlite最小fixtureへ適用して検証する。policyのseedとactivationは含めない。

## 認証ユーザーの契約

- `academy_first_publication_create_preparation(p_name text,p_policy_version text)` は非匿名owner本人、profile、本部・利用履歴・旧課金権利を再検査し、新しい非公開HQと新制度準備行を同時作成する。旧trial/access ledgerは作らず時計を開始しない。返却は `{headquarters_id,scheme}`。
- `academy_first_publication_quote` と `academy_first_publication_command` は先行と同じ署名。初回公開と契約はownerだけ。開始後の公開もcommand経由で、直接UPDATEに戻さない。
- `academy_first_publication_access(p_headquarters_id uuid)` は既存の認可済HQ roleに対し `{scheme,policyVersion,active,inviteAllowed,endsAt,phase,cancellationAcceptedAt}` を返す。未登録はnull、無権限はexception。schemeは `first_publication_168h_v1`、登録済policyVersionはnon-null。phaseは prepared/sync_pending/trialing/cancelled/attention/expired/paid。
- 未同意準備時は新accessがpreparedだが、詳細command statusはnull。無料取消後は元期限までactive。新招待はintentが保存された時点で不可。期限後はworker未実行でもactive=false。verified paid windowの期限内だけpaid。
- `academy_first_publication_record_cancel(hq)` は受理statement時刻を永続化する。HTTPはこのRPCをcommitしてからcommand cancelを呼ぶ。commandは保存済受理時刻を使い、処理待ちで期限を越えても受付を維持する。

## サービス専用の契約

すべてservice_roleだけにEXECUTEを付与する。ブラウザはprivate tableへアクセスできない。

- `academy_first_publication_setup_reserve(p_owner_user_id uuid,p_headquarters_id uuid,p_quote_id uuid)` はscope/期限/有効policyを確認して固定attemptを返す。返却はattempt_id,owner_user_id,headquarters_id,quote_id,idempotency_key,started_at,provider_customer_id,checkout_session_id,setup_intent_id,payment_method_id,status,amount_yen,policy_version。
- `academy_first_publication_setup_attach(p_attempt_id uuid,p_provider_customer_id text,p_checkout_session_id text,p_setup_intent_id text=null)` は生成直後のprovider bindingを保存する。customerだけ先に保存でき、checkout_session_idはnull可。既存bindingの差替え不可。
- `academy_first_publication_setup_complete(p_attempt_id uuid,p_provider_customer_id text,p_setup_intent_id text,p_payment_method_id text)` はサーバーがCheckout/SetupIntent成功を実確認した後だけ呼ぶ。元quoteのscope/期限/料金帯/規約/pricing revisionを確認しproof保存。返却に原quoteのcamelCase DTOを含める。quote再発行ではない。
- `academy_first_publication_outbox_claim(p_worker_id text,p_lease_seconds integer=60)` はlease付きeventかnull。proofにsetup attemptを含む。全DBworkerはowner→HQ→enrollment→outboxの順でlockする。
- `academy_first_publication_outbox_dispatch_check(p_event_key text,p_lease_token uuid)` はallowed/reason。期限同時刻で初回請求不可、取消intent優先、未activation不可。
- `academy_first_publication_outbox_checkpoint(p_event_key text,p_lease_token uuid,p_step text,p_provider_id text=null)` はstep別operation_key/started_at/provider_id/blocked。invoice_create/invoice_item/finalize/pay/subscription_createを固定し、23時間超のID不明POSTはblockedにする。lease不一致とprovider ID差替えを拒否。
- `academy_first_publication_outbox_finish(p_event_key text,p_lease_token uuid,p_result jsonb)` はoutcome trial_ready/cancelled/paid/attention。trial_readyは非課金でtrialingへ同期し、期限後start_paidを作成する。paidはprivate paid_windowsへ初回の確認済windowを保存する。共有platformへの接続完了とは扱わない。

## 既存DB機能との境界

新制度に該当しないHQは名前を保存した旧access関数へ委譲する。既存guardがlive操作能力の意味で使う `access_mode='paid'` を新active期間にも返すが、実課金状態は新access projectionで判定する。`academy_get_my_headquarters_access` も新制度の能力を返す。新trialを課金済みと表示するのは禁止。旧本部を新schemeへbackfillしない。

現行料金見積は `20260830143000_academy_limited_pilot_access_controls.sql` の現在の除外適用後人数と `private.academy_catalog_monthly_price_yen` のみ。`lib/billing/platform/academy-plan.ts` も同じ料金帯を照合する。HQ plan列や割引引数を見積計算に使っていない。月末snapshotのcharge_price_yenは初公開見積には使わない。同一料金帯の人数差は許容し、quote時人数は監査snapshotとして保持する。policy/quoteにpricing_revisionを固定し、将来plan/discount setterや価格表を導入する際は必ずrevisionを変更する。

## 検証と未解決のリリースゲート

`ACADEMY_RUNTIME_TEST=1` を環境に設定し `node supabase/tests/academy_first_publication_pglite.mjs` を実行する。PGlite依存パスは既存メモの `ACADEMY_PGLITE_PATH` 設定を使う。最小fixtureはprofile/HQ/既存role/access関数も簡略再現する。実Auth、全RLS、全既存guardの実schema統合、多接続競合は検証していない。

最終実行はexit 0で37チェック成功（先行16＋後続21）。新HQ準備で旧trial ledgerが増えないこと、サービスproofのauthenticated拒否、元quote返却、同一料金帯の人数増加後公開、lease差替え拒否、取消直後の招待禁止と無料期間内編集、期限後停止、dispatch未activation拒否、取消優先、checkpointのprovider差替え拒否、模擬paid windowと再公開を確認した。provider呼出しはなく、paid結果と時計移動は明記したテスト用直接fixtureである。

未commitの取消受付が期限内statement時刻を持つ場合、DBworkerから不可視になる競合は未解決。受理時刻をlock後へ無断変更せず、`dispatch_enabled=false` のままにした。これを解消しない限り実請求を有効化しない。

共通platform subscriptions/event/portal/retentionへの正規bridgeは別の後続migration担当。private paid_windowsを既存台帳と二重正本のままリリースしない。顧客データ・実招待・Stripe・公開Gitには変更なし。
