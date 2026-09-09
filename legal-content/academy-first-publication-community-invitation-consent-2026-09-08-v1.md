# Academy連携Community招待 本人同意文案

- Community policy key: `academy_first_publication_community_invitation_v1`
- Community consentRevision: `academy-first-publication-community-invitation-consent-2026-09-08-v1`
- 対応するAcademy policyVersion: `academy-first-publication-trial-2026-09-08-v1`
- 状態: 本人承認済み条件を反映。未seed、未有効化、未公開

## 招待画面の必須表示

- 招待先Community名
- 対象Room名
- 招待元Academy本部名
- Academy由来の利用権であること
- 利用権の終了日時とタイムゾーン
- AcademyとCommunityは別契約であること
- 招待を断ってもAcademy契約やCommunityの既存権利へ影響しないこと
- Academy由来の権利が終了しても、Communityの直接契約、通常参加、手動付与、運営権限は変更されないこと
- 適用するCommunity規約、Communityルール、プライバシーの名称、版、本文または確認リンク
- Community policy keyとCommunity consentRevision

## 受信者本人の確認文

> 招待先Community、対象Room、招待元Academy本部、Academy由来の利用期限を確認しました。AcademyとCommunityは別契約であり、この招待を承諾した場合だけ、表示されたRoomへAcademy由来の利用権で参加することに同意します。Academy由来の利用権が終了しても、私が別に保有するCommunityの直接契約や通常の権利は変更されないことを確認しました。

次の3項目は、招待発行時にsnapshotした版を個別に表示して同意を取得する。

- 表示された版のCommunity規約に同意します
- 表示された版のCommunityルールに同意します
- 表示された版のプライバシーに同意します

承諾ボタンは `内容に同意して参加する` とする。3項目のうち一つでも未同意の場合、招待同意revisionが一致しない場合、招待時snapshotと承諾時の現行版が一致しない場合は利用権を付与しない。文書版が変わった場合は、最新内容を表示して改めて本人同意を取得する。

## 保存する証跡

- Community policy key
- Community consentRevision
- 対応するAcademy policyVersion
- 招待ID、Community ID、Academy本部ID、対象Room ID
- 招待したAcademy本部owner兼Community owner
- 招待を受けた本人のuser ID
- Community規約、ルール、プライバシーの各snapshot版
- 各同意値、同意サーバー時刻、招待の利用終了時刻

Academy owner、Community owner、運営者または法務担当は、招待を受けた本人の同意を代行しない。
