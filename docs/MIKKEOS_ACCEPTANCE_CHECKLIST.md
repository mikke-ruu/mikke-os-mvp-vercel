# mikkeOS 検収チェックリスト（どのモデルでも実行可能）

作成日: 2026-07-12
作成: Claude (Fable)

このdocsは、WP / BP / P系パッケージの検収を、Fable以外のモデル（Sonnet等のClaude Code、またはcodex自身のセルフチェック）でも同じ品質で行うための手順書です。

検収者は以下を上から順に実行し、結果を「合格 / 条件付き合格（指摘列挙）/ 差し戻し」で報告します。

## 1. 機械チェック（コマンドはコピペで実行）

作業ディレクトリ: `G:\Musubiプロジェクト\mikke-os-mvp`

```bash
# 1. 型チェックとビルド（両方成功が必須）
npm.cmd run lint
npm.cmd run build

# 2. 対象範囲に直書き色が残っていないか（0件が必須。
#    ただしglobals.cssのトークン定義部分は直書きでよい）
grep -rnE '#[0-9a-fA-F]{6}' <今回の対象ディレクトリ>

# 3. ブランド違反が混入していないか（ユーザー向け画面のtsxで0件が必須）
grep -rn "mikkeOS\|MIKKEOS" <今回の対象ディレクトリ> --include="*.tsx"

# 4. コミットされているか（作業ツリーがクリーンであること）
git status --short
git log --oneline -3
```

## 2. 差分の形チェック（ロジック不変の確認）

UI統一系パッケージ（P1/P2-aなど「見た目だけ」の作業）では、差分にロジック変更が混ざっていないことを確認する。

```bash
# 該当コミットの差分に、以下が現れないこと:
# useState / useEffect / localStorage / 保存関数 / 関数の追加・削除
git show <コミット> | grep -E "^[-+].*(useState|useEffect|localStorage|function )" 
```

className・色・部品の置き換えだけなら空になる。何か出た場合は、その行を読んで「見た目のための変更か」を判断し、疑わしければFable行きにする。

## 3. 表示チェック

devサーバー（通常 http://localhost:3000）で対象ページを確認:

```text
- 対象ページ全てがHTTP 200
- 375px / 768px / 1280px で横はみ出しなし
- 右上ハンバーガーが開く・閉じる
- スマホ下部ナビの項目が重複していない
- フッターに「{アプリ名} by mikke」がある（公開面・アプリ面）
- 「Log」がグローバルナビに出ていない（OwnerMenu内はOK）
```

## 4. 共通部品を変更した場合の追加チェック（重要）

`components/mikkeos/Mikke*.tsx` に変更が入った場合は、変更理由に関係なく:

```text
- /story を375pxと1280pxで開き、見た目が崩れていないこと
  （Storyは全体の基準なので、部品の変更は必ずStoryで跳ね返りを確認）
- 変更内容が「特定アプリ都合の特殊化」になっていないこと
  （propsの追加はよい。既定の見た目を変える変更はFable行き）
```

## 5. 絶対禁止事項の確認（毎回）

差分に以下が含まれていたら即差し戻し（検収者の判断で通さない）:

```text
- DB migration / RLS / policy / constraint の変更
- Supabase本接続への切り替え
- lib/mikkeos/activity-adapter.ts の強制privateロジック
  （shouldForcePrivateStory / toSupabaseActivityLogInsert）を緩める変更
- 保存処理・localStorageキーの変更（UI統一系パッケージの場合）
```

## 6. Fableに戻す判断ポイント（これ以外はFable不要）

以下に該当する場合だけ、検収を通さずFableへ相談として持ち込む:

```text
1. 共通部品（Mikke*）の既定の見た目・propsの意味を変えたい時
2. 実行ライン（マスタープラン2.2章）の順番を変えたい時
3. スコープの線引き判断（どこまで作って完成とするか）
   例: P2-bのSPEC差分リストの優先順位づけ
4. activity-adapter / 型（types.ts）の設計変更
5. Storyの見た目に影響する変更
6. 新しいアプリの設計開始（BP-x-b着手前の仕様確認）
7. 検収で「疑わしいが判断できない」ものが出た時
```

## 7. 検収報告のテンプレート

```text
検収結果: 合格 / 条件付き合格 / 差し戻し
- 機械チェック: lint / build / 直書き色 / ブランド語 / コミット → 各OK/NG
- 差分の形: ロジック混入なし/あり（ありの場合は該当行）
- 表示: 対象ページ列挙 + 3幅OK/NG
- 指摘事項: （あれば番号付きで）
- Fable行き事項: （6章に該当するものがあれば）
```
