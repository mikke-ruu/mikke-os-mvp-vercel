import type { FirstPublicationStatus } from "./first-publication/rpc-client";
import type { FirstPublicationAccess } from "./first-publication/access-client";

/** Display only. A local clock never grants access or authorizes payment. */
export function describeFirstPublication(state: FirstPublicationStatus, now: number, access?: FirstPublicationAccess) {
  if (access?.phase === "paid") return {
    title: access.active ? "有料利用中" : "有料利用の状態を確認してください",
    description: "有料期間の状態です。講座の下書き化と利用契約の解約は別の操作です。現在の利用期限は下の表示をご確認ください。",
  };
  const ended = state.trialEndsAt !== null && Date.parse(state.trialEndsAt) <= now;
  const cancelled = state.cancellationAcceptedAt !== null;
  if (cancelled) return {
    title: ended ? "無料体験終了（有料移行取消済み）" : "有料移行取消済み",
    description: ended
      ? "無料期間は終了しました。取消の受付結果を下で確認できます。"
      : "初回請求への移行を取り消しました。現在の利用は元の無料終了日時まで続きます。新しいCommunity招待はできません。",
  };
  if (state.phase === "prepared") return {
    title: "公開準備中",
    description: "まだ無料期間は始まっていません。初めての講座公開が成功した日時から7日間（168時間）が始まります。",
  };
  if (state.phase === "attention" || ended) return {
    title: "お支払い・利用状態を確認してください",
    description: "確認が必要です。この表示だけで支払い成功や利用継続は確定しません。もう一度契約状況を確認してください。",
  };
  if (state.phase === "sync_pending") return {
    title: "公開済み・契約情報を確認中",
    description: "初公開の日時は確定しています。契約情報を確認中のため、同じ申し込みを繰り返さないでください。",
  };
  return {
    title: "7日間無料体験中",
    description: "無料終了後は確認済みの条件で有料利用へ移行します。下書きに戻しても無料期間はリセットされず、有料移行の取消にはなりません。",
  };
}

export function firstPublicationDate(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "未確定";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).format(new Date(value));
}
