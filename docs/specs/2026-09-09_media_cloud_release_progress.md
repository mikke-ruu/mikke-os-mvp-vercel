# Media Freeのクラウド接続と公開準備（2026-09-09）

本人から本番まで進める指示を受領。公開許可の再確認はしない。技術検証と法務・運用上の未決事項は承認済みと扱わない。

## 実装

- 執筆、一覧、設定、作成、読者プレビューを認証済みrepositoryへ接続。developmentのpreview=integrationだけローカル保存を維持する。
- 各操作の前後に認証主体を確認し、画面のsubjectとの不一致、匿名、A/B/Aの切替、古い応答を拒否する。プロフィールIDは所有権に使わず、ローカルデータは移行しない。
- 原稿の保存を直列化し、読者画面への遷移は保存完了を待つ。読み込み直後の無変更保存を抑止する。
- 公開中の入力と二重操作を抑止。ただし別端末との公開競合はDB側のexpected revision照合が必要であり、UIだけで解決済みとはしない。
- 公開loaderは匿名RPCのみ。画像routeは専用非公開bucketからサイズ・hash検証後に返し、配信前に公開状態を再確認する。内部locatorと元URLは返さない。
- 表記は「公開をキャンセル」。下書きは残す。

## 実際の確認

- 開発ブラウザで新規の検証用タイトルと本文を入力し、保存済み表示、記事ID付きURL、読者画面への内容反映を確認。
- 読者画面は390pxおよび320pxで確認。320px時のcontent width 305、viewport width 320で横はみ出しなし。
- PC幅の追加操作はブラウザ応答timeoutがあり、この回のPC確認完了とは扱わない。
- repository負例テスト合格。画像の負例テスト35項目合格報告。最終lint/buildは実行証拠を別途記録する。

## 残る公開条件

- 統制室所有: Media migration本番未適用、非公開assetとopaque token、hold/delete、expected draft revision、初回同意を分離する追加DB契約と負例検証。
- Media所有: 上記RPCへの接続、本人認証DBで画面E2E、最終build、PR/deploy、本番URL確認。
- 法務/本人: Media固有terms/privacy、保持期間の実値、未成年範囲、通報判断担当、最終文言。
- cloud publishは上記契約完成までrepositoryで明示拒否。production UIは404を維持し、画像もMEDIA_PUBLIC_DATABASE_ENABLEDとprivate bucket未設定時404。フラグをセットしただけで完成にはならない。
- STORY追加プロフィールのクラウド保存と各アプリへの選択記事配信は後続。課金・Stripe・有料記事・アフィリエイトは今回起動しない。
