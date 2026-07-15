# Fund F4-c Handoff

作成日: 2026-07-15

対象repo: `G:/Musubiプロジェクト/mikke-os-mvp`

状態: F4-c検収完了・F4-d未着手・F5未着手

## 1. 完了した導線

- 実行者が手動登録した応援から、14日間有効のMikke ID招待を発行できる
- 発行済み招待を実行者が取り消せる
- 再読み込み後も「招待中」「受取済み」「応援者の公開設定」を確認できる
- 応援者はログイン後に招待へ戻り、自分のMikke IDで受け取れる
- 応援者は `/fund/me` で公開名・匿名・非公開・公開取消を管理できる
- 受取時にprivate・非金額・Story非表示のActivity Logを同一transactionで作成する

## 2. 実DB

適用済みmigration:

```text
20260714070637_fund_f4_b1_ownership_foundation.sql
20260714222029_fund_f4_b2_claims_and_participations.sql
20260715124228_fund_f4_c_participation_activity.sql
```

Local / Remoteの3履歴は一致しています。

F4-c追加migrationは `accept_fund_support_claim` を更新し、参加作成と `fund_participation_recorded` のprivate Activity Log作成を原子的にします。すでに受取済みの参加には同じ安全条件で1件だけ補完します。

## 3. 検収結果

- 2つのMikke IDで、招待発行・受取・匿名同意を実画面確認
- 公開投影は `is_anonymous=true`、`supporter_profile_id=null`、表示名は「匿名の応援者」
- 本人画面は「公開設定済み」
- private Activity Logは1件だけで、`visibility=private`、Story表示・集計・金額はすべて無効
- `fund_f4_b2_rls.sql` を実DBで再実行し、owner / supporter / anon境界とActivity Log非公開を確認、全fixtureはROLLBACK
- Fundの4 RPCはanonから実行不可、authenticatedのみ、`search_path` は空に固定
- Database AdvisorのFund警告は、認証ユーザー専用として意図したSECURITY DEFINER RPCの一般警告のみ。anon実行不可と関数内actor検証を実確認済み

## 4. F4-cの境界

F4-cでSupabaseへ同期するのは、招待発行対象の最小project/support情報です。F1〜F3のFund本文、活動報告、提供管理、完成記録は引き続きlocalStorage中心です。

そのため、F4-c完了は「Mikke ID招待・本人同意の完成」であり、Fund全体の本接続完了ではありません。

## 5. 次の実行手順

次はF4-dを別コミットで進めます。

1. 公開済み `fund_public_participations` をStoryの既存活動一覧へ小さな参加行として接続
2. 実行者がowner同意を解除・再許可できるUIを応援者一覧へ追加
3. owner/supporterどちらかが取消したらStory行が消えることを実DB確認
4. Fund本体がprivate/unlistedならStoryへ伝播しないことを確認
5. lint / build / 375・768・1280px / RLS否定test
6. F4-dだけをコミットして停止

F5の全Fund本接続、通知、通報、CSV、会員限定公開、Webhookへはまだ進みません。

## 6. 同時に存在する別作業

Manager / Page / Team Works関連docsの未コミット変更はFundコミットへ混ぜません。削除・revertもせず、そのまま保持します。
