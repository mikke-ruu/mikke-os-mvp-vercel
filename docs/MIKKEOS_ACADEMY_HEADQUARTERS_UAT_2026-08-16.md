# Academy本部共同運営 UAT

対象は /academy/settings、Academy本部共同運営migration、およびOwner / Administrator / Course Editor / 無関係な認証ユーザー / 未ログイン。

この文書は確認手順だけを定義する。講座、本部、メンバー、サンプルデータは自動作成しない。

## 適用前

1. 対象DBのAcademy主要テーブルの列・RLS・既存policyを読み取る。
2. migrationをBEGIN内で実行し、テーブル、policy、関数、trigger、grantを確認してROLLBACKする。
3. 本部のowner_user_idとowner_profile_idが更新不能であることを確認する。
4. Security Advisorで新しい匿名実行可能な関数がないことを確認する。

## Owner

- 本部情報と機能設定を更新できる。
- mikke IDでAdministratorとCourse Editorを招待できる。
- 有効なメンバーを停止できる。
- 講座、クラス、講師依頼を従来どおり操作できる。

## Administrator

- 招待承認後、同じ本部へ入れる。
- 本部情報と機能設定を更新できる。
- Course Editorを招待・停止できる。
- 別のAdministratorは停止できない。
- Owner情報と所有権を変更できない。

## Course Editor

- 招待承認後、同じ本部へ入れる。
- 講座一覧、講座設定、講座ページを表示・編集できる。
- 本部情報、機能設定、メンバーを変更できない。
- 招待を作成・停止できない。

## 無関係な認証ユーザー

- 対象本部、内部設定、メンバー、招待を取得できない。
- 本部IDや招待IDを直接指定しても更新・承認・停止できない。

## 未ログイン

- /academy/settingsは共通ログイン境界で保護される。
- テーブルSELECTと全RPCを実行できない。

## 完了条件

- 5役の画面確認と直接API確認が一致する。
- 既存OwnerのAcademy操作に回帰がない。
- DBには検証に使用した一時データが残っていない。
- 本番URLを新しいセッションで再確認する。

## 2026-08-16 実施記録

### 第一段階: クラス日程・講師依頼

- 開発DBのmigration履歴に `academy_class_scheduling_and_instructor_requests` が存在することを確認した。
- `academy_classes` と `academy_class_instructor_requests` は存在し、RLSが有効であることを確認した。
- 講師依頼テーブルは `authenticated` のSELECT/INSERTのみ許可され、応答・取消RPCは `authenticated` のみ実行可能、`anon` はテーブルSELECTと両RPCを実行できないことを確認した。
- Owner候補、対象講師候補、無関係ユーザー候補は存在するが、対象講師候補はOwnerと同一人物だった。対象講師単独の権限境界は未検証。
- クラスと講師依頼はともに0件だった。業務データを作成しない条件を優先し、依頼作成・承認・辞退・取消の実操作UATは未実施。

### 第二段階: 本部共同運営

- migrationファイルと `/academy/settings` の実装はローカルに存在する。
- 開発DBに本部設定、メンバー、招待の3テーブルが存在しないことを確認した。migrationは未適用。
- AdministratorとCourse Editorの実アカウント状態がDBにないため、画面権限とRLSの実UATは未実施。

### データ・公開状態

- この確認では講座、本部、メンバー、招待、クラス、講師依頼、サンプルの各業務データを作成・更新していない。
- PR、統合、本番migration、デプロイは実施していない。
- Git管理領域が読み取り専用のため、対象差分のstageとcommitは未完了。

