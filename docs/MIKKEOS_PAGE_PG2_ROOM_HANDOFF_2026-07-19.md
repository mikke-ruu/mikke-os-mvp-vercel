# MIKKEOS Page PG-2 完了引き継ぎ

作成日: 2026-07-19
作業場所: `G:/Musubiプロジェクト/mikke-os-mvp`

## 現在地

Page PG-0〜PG-2まで完了。

最新実装コミット:

```text
7ac9fa6 Add Page PG-2b directory content
```

今回追加したコミット:

```text
ad301bb Add Page PG-1b site creation
78e94e7 Add Page PG-1c page management
e4a1cb7 Add Page PG-1d block editor
2b33f79 Add Page PG-1e CMS blocks
cd8de37 Add Page PG-2a CMS filters
7ac9fa6 Add Page PG-2b directory content
```

## 完了した機能

```text
/apps/page/new のサイト新規作成
/apps/page/[siteId] のページ追加・削除・上下並び替え
/apps/page/[siteId]/[pageId] の積み上げ式ブロック編集
見出し / 文章 / 画像 / ボタン / フォーム枠 / 区切り
OS内下書きプレビュー
Story / Item Studio / Event / Academy / Session の自組織CMSブロック
CMS候補の個別選択、今月・承認済みフィルタ
Connect / Partners のPage内CMS項目管理
```

Pageは既存アプリへ書き込まず、参照元・選択ID・フィルタ条件だけを保存する。
原価、内部メモ、申込者、予約者情報はPage共通表示へ渡していない。

## 検収

```text
npm.cmd run lint: 成功
npm.cmd run build: 成功（90 static pages）
/apps/page/[siteId]
/apps/page/[siteId]/[pageId]
の動的ルート生成を確認
```

## 次へ進む前の設計判断

次はPG-3。ただし実装計画で、着手前にFable判断が必要とされている。

```text
公開保存方式: Supabaseサーバ保存 / 静的書き出し
公開ルート名: /p/[slug] / /site/[handle] など
localStorage下書きから公開データへ反映する操作
公開時に保持する安全な最小データ
公開停止・slug変更時の扱い
```

この判断なしに公開ルート、Supabase接続、静的書き出しを作らない。

## 引き続き守る境界

```text
他者掲載依頼はPG-4まで作らない
Manager受信箱接続はPG-4と同時
販売委託・決済は作らない
独自ドメインはPG-5まで作らない
フォーム送信処理は作らない
AI OFFICEの未コミット差分は触らない・ステージしない・コミットしない
```

## AI OFFICEの未コミット差分

AI OFFICE作業は並行して増えている。Pageコミットには一切含めていない。

```text
app/apps/ai-office/
app/api/
app/globals.css
components/ai-office/
docs/MIKKEOS_AI_OFFICE_*.md
lib/ai-office/
```

## 次部屋への開始文

```text
作業場所:
G:/Musubiプロジェクト/mikke-os-mvp

引き継ぎ:
docs/MIKKEOS_PAGE_PG2_ROOM_HANDOFF_2026-07-19.md

現在地:
- 最新実装コミット: 7ac9fa6 Add Page PG-2b directory content
- Page PG-0〜PG-2 完了
- lint / build 成功（90 static pages）
- AI OFFICE関連の未コミット差分あり。Page作業に混ぜない

次:
Page PG-3の公開方式について、実装前のFable判断を行ってください。
Supabaseサーバ保存か静的書き出しか、公開ルート名、公開データの最小範囲を確定し、
判断内容をdocsへ記録してください。判断が確定するまで公開実装は始めないでください。

注意:
他者掲載依頼、Manager受信箱接続、販売委託、決済、独自ドメイン、フォーム送信はまだ作らないでください。
AI OFFICE関連の未コミット変更は触らず、そのまま保持してください。
```
## 2026-07-19 訂正: Connect / Partners

旧PG-2-bで入れた Connect / Partners 専用のPage内CMS項目管理は、構想解釈が違っていたため撤回。
Connect / Partners は、あゆみがPageのCMSブロックを使って構築・運営していくページ構想であり、Pageアプリの組み込み機能ではない。

修正後のPage CMSは、mikkeIDを軸に Story / Item Studio / Event / Academy / Session の公開候補を選び、表示できる内容と公開条件を画面上で明確にする。
Pageには選択IDと絞り込み条件だけを保存し、元データや専用Connect/Partnersデータは保存しない。
