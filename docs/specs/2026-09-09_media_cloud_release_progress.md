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

## 追加DBと公開確認（後続実装）

49805cd後、統制から追加DBの実装所有をMedia室へ移管。Media室がprivate upload/本人画像preview/初回同意/公開snapshot確認UIを実装し、統制室はレビューを担当する。

- 20260909092651追加migration SHA256: 3712057abc936a2a86336e55083c915df51dc6f5f4088b779e765c5c68956050。
- PG17.6でbaseline+foundation+追加migration+負例をBEGIN/ROLLBACK実行しexit0。ネットワークなし・ポートなし・tmpfsを確認。別接続で追加table/schema/合成role残存0、専用container削除exit0。
- 明示初回同意、active legal digest、確認snapshot revision一致、private bucket、他人asset、旧RPC迂回、合算容量、hold解除時の自動復活なし、旧版token失効を検証。
- 公開確認UIは新しいreviewed RPCを利用。旧repository publishは拒否したまま。legal registry初期空のため実利用条件が承認・登録されるまで公開できない。
- 公開記事の読者レイアウトと通報メール導線を追加。Mediaの本物の利用条件ページは未登録。local-media-test-v1はdevelopmentだけの架空規約であり実契約ではない。
- 実Auth/Storage環境はMedia専用で127.0.0.1だけに公開して実施。baseline、foundation、追加migration、法的効力がない合成termsの順で適用し、通常利用者2名、匿名拒否、他人のMedia・画像拒否、private Storage、公開DTO、初回同意、古い確認版拒否、公開、公開キャンセル、再公開、hold解除後の自動復活なしを含む13項目が合格した。
- 実Auth/Storage検証後は専用projectをno-backupで停止。合成利用者、画像、DB volume、container、network、認証keyと結果ファイルを削除し、残存0を確認した。
- `npm.cmd run lint`、公開RPC、integration、release boundary、画像35負例、本番用Webpack buildがexit 0。既存のthemeColor警告はMedia差分外であり、build失敗ではない。
- 公開、DB本番適用、課金起動は未実施。一般公開はactive法務revisionと統制最終レビューが揃うまでfail closedを維持する。
