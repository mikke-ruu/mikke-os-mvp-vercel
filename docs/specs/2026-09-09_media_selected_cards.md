# 2026-09-09 選択記事カードのローカル接続

- lib/media-app/selected-cards.ts: destinationと明示選択を受け、fresh provider応答から公開用の4項目だけを返す。空選択0件、最大12件、重複排除、失敗/timeout/abort時非表示。revisionとpublication cycleを照合し再公開後は再選択必須。
- 初期は日本語Free・テキストカードだけ。有料記事は拒否、画像は公開配信URLの保証確定まで含めない。
- providerは本番未実装。掲載先/Media両権限をサーバーで確認し、active/両公開状態を最新で返す必要がある。cycleは毎回の公開で必ず更新するDB契約が必要。ローカル選択やレスポンス型だけでは認可にならない。
- components/media-app/MediaConnectionPreview.tsx と /apps/media/connections は既存development限定route内の架空記事見本。設定からアクセス可能。永続化/他アプリ書込なし。
- 検証: scripts/media-free-selected-cards-check.mjs PASS。ブラウザで空→選択で表示→非公開で消失→再公開でも非表示を確認。
- 他室: STORY/Pageへ独立adapter/部品実装を依頼。Academyは現在の本番リリースを優先するため未着手との返答。DB/共有route/push/公開は未実施。
