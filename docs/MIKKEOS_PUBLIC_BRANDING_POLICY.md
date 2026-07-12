# mikkeOS Public Branding Policy

作成日: 2026-07-11

このdocsは、ユーザー向け画面で `mikkeOS` という言葉をどう扱うかを決める方針メモです。

## 1. 基本方針

ユーザー向けの表側では、`mikkeOS` という言葉を前面に出しません。

mikkeOSは裏側の共通基盤・シリーズ名として扱います。

使う人にとって大事なのは、以下のような具体的なアプリ名です。

```text
Story
DESK
Order
Session
Academy
Community
MarketNote
Item Studio
Event
```

ユーザーは「mikkeOSを使う」というより、まず「Storyを作る」「DESKでお金を見る」「Orderで依頼を受ける」という体験から入ります。

## 2. 表側での見せ方

公開ページやユーザーが最初に触る画面では、アプリ名を主役にします。

例:

```text
Story
DESK
Order
Academy
Community
```

必要な場合だけ、ページ下部などに小さく以下のように表示します。

```text
Story by mikke
DESK by mikke
powered by mikke
```

## 3. 出しすぎない言葉

通常ユーザー向けの表側では、以下の言葉を前面に出しすぎません。

```text
mikkeOS
Activity Log
LOG
source_service
RLS
Supabase
DB
adapter
```

これらは内部設計や管理用の言葉です。

## 4. Storyでの扱い

Storyは名刺型ミニホームページです。

公開Storyでは、本人や事業者の活動が主役です。

方針:

- ヘッダーで `mikkeOS` を大きく出さない。
- 必要ならページ下部に小さく `Story by mikke` と表示する。
- 公開相手にとって不要な内部IDやOS名を出さない。
- `Activity Log` や `LOG` を公開ページに出さない。

## 5. DESKでの扱い

DESKは単体でも使える仕事まわりの管理アプリとして扱います。

方針:

- `mikkeOSの集計画面` ではなく、`DESK` として見せる。
- 売上、経費、請求書、領収書、CSVなどを手動でも使えるようにする。
- 他アプリを繋げると、収支が自動で入って便利になる。

## 6. メニューの考え方

最初から全アプリやOS全体を見せません。

初期状態では、使い始めたアプリを中心に見せます。

Storyから始めた人:

```text
Story
Storyを編集
デザイン設定
QRコード
アプリを追加・繋げる
設定
```

DESKから始めた人:

```text
DESK
売上を追加
経費を追加
請求書
領収書
アプリを追加・繋げる
設定
```

アプリを繋げたら、そのアプリだけメニューに増えます。

例:

```text
Story
Order
DESK
設定
```

## 7. 使っていないアプリの扱い

使っていないアプリは、メニューに常時並べません。

必要なタイミングで、以下のように提案します。

```text
Orderを繋げますか
DESKを繋げますか
Communityを繋げますか
Academyを繋げますか
```

目的は、最初から大きなOSを見せることではなく、ユーザーの仕事に合わせて少しずつ便利なアプリが増える体験にすることです。

## 8. 内部設計での扱い

開発docsや内部設計では、`mikkeOS` という言葉を使ってよいです。

内部で使う言葉:

```text
mikkeOS
Activity Log
Story素材候補
DESK対象
source_service
activity_logs
adapter
```

つまり、外側と内側で言葉を分けます。

```text
外側: Story / DESK / Order
小さなブランド表示: Story by mikke
内側: mikkeOS + Activity Log
```

## 9. 次の実装方針

今後のUI調整では、以下を優先します。

```text
1. Story公開面から mikkeOS の前面表示を外す
2. ページ下部に小さく Story by mikke を置く
3. ハンバーガーメニューは現在のアプリ中心にする
4. 使っているアプリだけ表示する
5. 使っていないアプリは「繋げますか」と提案する
6. LOG / Activity Log は通常ユーザーの前面から下げる
```

## 10. まだやらないこと

```text
全画面の一括変更
DBマイグレーション
Supabase本接続
RLS / policy / constraint変更
有料テンプレート課金
アプリ所有判定の本実装
```

