# Fund F4-d Handoff

作成日: 2026-07-15

対象repo: `G:/Musubiプロジェクト/mikke-os-mvp`

状態: F4検収完了・F5未着手

## 1. 完了した導線

- 公開条件を満たす公開名参加が、応援者本人のStory既存一覧へ小さなFund行として表示される
- Story行には公開プロジェクト名、公開Fund経路、参加状態だけを渡す
- 実行者は応援者一覧で、自分のStory公開同意を許可・停止・再許可できる
- owner/supporterのどちらかが取消すと公開投影が削除され、Story行も消える
- private / unlisted FundはStoryへ伝播しない
- 匿名参加はFund公開投影では匿名表示を維持し、個人Storyには紐づけない

## 2. 実DB

適用済みF4-d migration:

```text
20260715132817_fund_f4_d_story_projection.sql
20260715135018_fund_f4_d_profile_handle_paths.sql
```

Local / Remote migration履歴は一致しています。

1本目は公開投影へ `project_title` を追加し、プロジェクト名変更時も再同期します。2本目は自動生成Mikke IDの `_` を公開Fund経路で許容し、handle変更時も公開経路を再同期します。

## 3. 検収結果

- `fund_f4_b2_rls.sql` を実DBで再実行し、全fixtureをROLLBACK
- public + valid + 双方granted + public_nameの場合だけ、Story安全列を公開
- private / unlisted / owner revoke / supporter revokeでは公開投影0件
- anonymousは `supporter_profile_id=null`、`display_name=匿名の応援者`
- `_` を含むowner handleと、handle変更後の公開経路再同期を確認
- anonは公開投影だけを読め、private Activity Logは読めない
- Database AdvisorのFund警告は、actor検証・固定search_path・anon実行不可を持つ既知の認証ユーザー専用RPC 4件のみ
- lint / build成功
- 実データでStory参加行をブラウザ確認し、検証用データは0件まで削除

## 4. F4完了の境界

F4の完成範囲は、Mikke ID招待、本人受取、双方同意、公開安全投影、Story入口までです。

Fund本文、活動報告、提供管理、完成記録はまだlocalStorage中心です。そのため、StoryのFundリンク先を別端末で開いて本文まで読める状態はF5で成立します。F4-dの公開投影へ本文・金額・メール・管理メモを追加してはいけません。

## 5. 次の案内

次はF5の実装計画を先に確定します。推奨順序:

1. localStorageの `FundProject` / plan / update / fulfillment / challenge recordを、private列とpublic projectionへ分離
2. 既存F4の `fund_projects` / `fund_supports` を拡張し、二重データ源を解消する移行方針を決める
3. 別端末で読める公開Fund本文を先に接続
4. owner管理CRUD、活動報告、提供管理、完成記録を順に接続
5. RLS・移行・公開否定testを完走してから、通知・通報・CSV・Webhookを判断

F5を開始するまで、F4の公開投影へ個人情報や金額を足しません。

## 6. 同時に存在する別作業

Manager / Page / Team Works関連docsの未コミット変更はFundコミットへ混ぜません。削除・revertもせず、そのまま保持します。
