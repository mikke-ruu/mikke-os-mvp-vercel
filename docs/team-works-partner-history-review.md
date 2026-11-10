# Team Works パートナー履歴・報酬

2026-11-09。専用worktree: mikke-os-mvp-team-works-partner-history-20261106。

## 2026-11-10 反映状況

ユーザーが既存public GitHubへの今回ソース送信を明示承認。PR117作成。全体webpack buildは型チェック・静的生成を含めexit 0、Vercel/Netlify previewともsuccess。

本番DBへ適用成功。実version `20261110063929`、name `team_works_partner_lesson_history`、SQL SHA256 `9d88ab6945909fbfb14e15f036053b8b9b75d6d8f801cbfac0150d9dabdbab55`。履歴8件、時給設定済み0件、RLS有効、anonのRPC実行不可・authenticated可を確認。security advisorは適用前と件数同じ。CLIの今後の比較で二重適用されないよう、Git内のmigration名を実versionへ合わせた（本文は変更なし）。当初draft名20261106133009からのrename。

本番画面はこれから配備。実行直前のProductionは `dpl_2UrrZvKkSje9fU51ZVaqoh95LJLJ` / `de033632b777d20e8ed666e5cf492549d7d20626` / READY、production branch master。Team Works先行、Academy後続で調整済み。以下は準備時点の記録。

## 承認内容と導線

ユーザーがローカル画面を確認し、配置・表示・計算を承認。「ローカルでOKなら本番」も依頼済み。本部はパートナー管理から対象の方の「実施履歴・時給」を開く。本人はパートナーポータルの「自分の実施履歴・報酬」。クライアントには追加しない。

## 仕様

- 時給と計算方法はパートナー×プロジェクト単位。今後の担当分の設定と各回の完了時点の記録を分ける。基本設定の変更は記録済み金額に遡及しない。
- 予定時間方式は完了時点の予定分数×時給÷60。実稼働方式は本部が登録した開始・終了（翌日指定可）から休憩などを引いてDBで分数を計算。24時間以内、分単位。1回ごとに円単位で四捨五入。
- ログイン時間・待機時刻からの自動算出はしない。旧ローカル記録の分数は保持し、時刻を推測して付けない。
- 本人には担当日時と報酬を表示し、内部計算方法・設定欄は表示しない。本人は編集不可。
- 導入前・研修・後日完了にした過去分の時給は推測せず未設定。本部が確認して入力する。
- 未実施・中止・元予定削除・再開した記録は集計対象外。未設定の金額も合計に含めない。支払処理・税計算は対象外。

## 本番互換性の確認

本番 Supabase nttqpprkqbynxyldbnjs の既存schema、権限関数、RLS、テーブルgrantを読み取り確認。既存の本部管理権限と個別project管理権限は異なるため、新履歴RLSは本部所属権限に統一した。既存の予定/設定テーブルや権限は変更しない。本番への新migrationは未適用。

## 検証

- 計算単体テスト：予定/実働、休憩、翌日、無効時刻、旧記録の時刻を捏造しないこと。
- PGlite DBテスト：draft migration、履歴snapshot、設定変更で過去金額保持、研修/過去分未設定、丸め、開始終了からの分数導出、時刻改変の権限、個人×projectの設定分離。
- 本番と同じ構造の本部/個別project権限関数で、project管理者ではない本部managerの保存、owner閲覧、worker自己閲覧と更新拒否、client/別本部拒否を検証。
- 対象TypeScriptチェック合格。Chromeで本部と本人画面を確認済み。本人画面に内部計算方法が出ないことを静的描画でも検査。
- ローカル http://127.0.0.1:4192/staff と /self は実コンポーネント＋架空データ専用PGlite。通常Authと全体動線を含まない確認用ハーネス。保存先はartifacts/partner-history/local/database。ユーザーの確認用入力は保持。
- 全体webpack buildは2026-11-09実行中。結果は別途追記。

## 残るゲート

通常アプリ統合、本番migration、Git/PR、本番デプロイ、実アカウントでの保存/本人表示。共有checkout・実顧客データの直接編集・実メール送信は行わない。最新origin/masterはfetch時de03363。docs/共通ルール.mdはremoteに存在せず正本を取得できなかった。統制室へ配備競合と手順を直接照会済み。
