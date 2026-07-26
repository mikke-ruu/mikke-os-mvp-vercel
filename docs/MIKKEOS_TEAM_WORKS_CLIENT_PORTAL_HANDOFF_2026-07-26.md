# Team Works クライアントポータル 引継ぎ（2026-07-26）

作業場所: `G:\Musubiプロジェクト\mikke-os-mvp`

## 今回完了したこと

- クライアントポータルを、運営型プロジェクト専用の4画面へ整理した。
  - ホーム: 実施日、選択日の詳細、担当者、未確定の出席、メッセージ概要
  - 名簿: 対象者の登録・編集
  - 実施予定: 出席者だけを選び、上下ボタンで実施順を確定
  - メッセージ: 本部窓口・担当パートナーとの個別メッセージ
- クライアントには、パートナー向けの報告・マニュアル・引継ぎを表示しない。
- 旧「共有プロジェクト（納品型）」導線をクライアントポータルから外した。
  - `/apps/team-works/portal/client/projects` はクライアントホームへリダイレクトする。
- 本部のプロジェクト設定に「クライアント招待」を追加した。
  - メールアドレスを入力し、招待URLを作成・コピーできる。
  - クライアント側には招待操作を表示しない。

## Supabase 適用済みの前提

ユーザーが SQL Editor で成功を確認済み:

- `supabase/migrations/20260726103000_team_works_client_portal_roster_and_messages.sql`

この migration は、クライアントの名簿作成・編集、セッション出席順の全置換、クライアント発の個別メッセージ、および同一プロジェクトの連絡先表示に必要な RLS を追加する。

## 主な変更ファイル

- `components/team-works/operations/TeamWorksOperationsClientPortal.tsx`
- `components/team-works/client-projects/TeamWorksClientProjectsShell.tsx`
- `app/apps/team-works/portal/client/projects/page.tsx`
- `components/team-works/operations/TeamWorksOperationsProjectDetail.tsx`
- `lib/team-works-operations-client.ts`
- `lib/team-works-operations-project.ts`
- `lib/team-works-operations-partner.ts`
- `supabase/migrations/20260726103000_team_works_client_portal_roster_and_messages.sql`

## 次の確認手順

1. 本部で対象プロジェクトを開く。
2. `プロジェクト設定` からクライアント担当者の招待URLを作成する。
3. 招待URLで担当者アカウントをログイン・受諾する。
4. `/apps/team-works/portal/client` で対象プロジェクトが表示されることを確認する。
5. 名簿登録、実施予定の出席順保存、メッセージ送信を順に確認する。
6. 本部・担当パートナーに保存した出席順が表示されることを確認する。

## 未着手・次の実装候補

- クライアント実機での上記一連フロー確認と、表示・文言調整。
- パートナーポータルで、各出席者について「今回のマニュアル」と前回引継ぎを見せる画面の設計・実装。
  - クライアント・本部には引継ぎ本文を出さない。
- クライアント招待の再発行・停止・招待中一覧の管理UI。

## 守ること

- `components/ai-office/*`、`app/apps/ai-office/*`、`lib/ai-office/*` を変更しない。
- service_role をブラウザへ出さない。
- 実在の曜日、時刻、担当者名、学校担当者名を仮入力しない。
- 稼働中の `npm run dev` と `npm run build` を並行しない。
- 検証は `npm.cmd run lint` とユーザー実機確認。ユーザー確認前にコミットしない。

## 最終検証

- `npm.cmd run lint` 成功（2026-07-26）
- 未コミット。既存の dirty worktree を保持している。
