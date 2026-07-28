# Team Works 引継ぎ（2026-07-28）

## 作業場所・現在地

- Repository: `G:\Musubiプロジェクト\mikke-os-mvp`
- Branch: `master`
- Latest verified commit: `908edcb Team Works: client roster group UX, calendar overflow badge, project detail follow-ups`
- `origin/master` も `908edcb`
- Team Works対象ファイルはコミット済みでclean。AI Office / Story / MarketNote等の未コミット変更は別作業なので触らない。

## 今回までに完了した内容

- プロジェクトの予定追加に「今回のみ／毎週」を復旧。
- 毎週は選択日を初回として、契約終了日まで（未設定なら12週間）生成。
- カレンダーは時刻2件まで＋3件以上を「全3件」のように表示。
- クライアント側の各予定（12:30〜、13:40〜等）を時間単位で折り畳み。
- 開いた予定内は「すべて／A／B／C」タブで絞り込み。
- 選んだ順に「今回の出席順」へ追加し、名前の行ごと上下移動して保存。
- 各予定に分かりやすい単発削除を追加。
- 毎週ルールと本日以降の未実施予定をまとめて取消する「毎週分を一括削除」を追加。
- 過去の実施済み記録は一括削除の対象外。

## 検証

- `npm.cmd run lint` 成功。
- `npm.cmd run build` 成功（99 routes）。
- `git diff --check` 成功。
- 本番Supabaseは読み取り確認のみ実施。`team_works_op_sessions.generated_from_rule_id` と、予定・週次ルールのUPDATE policyが存在することを確認。
- 今回の削除機能に新しいmigrationは不要。

## Supabase確認事項

`a3225cd` に次のmigrationが含まれる。企業設定の締め日保存などで失敗する場合は、本番適用状況を確認する。

- `20260728070657_team_works_organization_deadlines.sql`
- `20260728072555_team_works_invite_state_repair.sql`

## 次の安全な作業

1. 本番またはローカルで、1日に3予定ある画面を確認。
2. 各時間の折り畳み、グループタブ、選択順保存を実操作。
3. 単発削除と毎週分一括削除をテスト用予定で確認。
4. 問題があればTeam Works対象ファイルだけ修正し、他アプリのdirty変更を混ぜない。

## 次の部屋への開始文

```text
G:\Musubiプロジェクト\mikke-os-mvp で Team Works の続きをお願いします。
最初に docs/MIKKEOS_TEAM_WORKS_HANDOFF_2026-07-28.md を読んでください。
最新のTeam Worksコミットは 908edcb（origin/master同一）です。
AI Office / Story / MarketNote等の未コミット変更は別作業なので、触らず・戻さず・混ぜないでください。
まず今回追加した「予定単位の折り畳み／すべて・A・B・Cタブ／選択順名簿／単発削除／毎週分一括削除」の実画面確認から続けてください。
```
