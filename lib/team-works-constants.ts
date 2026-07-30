// 本部ダッシュボード系のポーリング間隔。以前は5秒固定で、開きっぱなしにすると
// Supabaseクエリを大量消費していた(特に納品ホーム集計はプロジェクト数×4-5クエリ)。
// 45秒に伸ばし、タブが非表示の間は呼ばない(呼び出し側でdocument.visibilityStateを見る)。
export const TEAM_WORKS_POLL_INTERVAL_MS = 45_000;
