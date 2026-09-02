/** Presentation only. Never use this model to grant access or calculate a charge.
 * A future shared-billing adapter must verify the user and selected HQ on server.
 * Course payments and construction-course purchases are not Academy subscriptions.
 */
export type AcademySubscriptionStatus =
  | "none" | "trialing" | "processing" | "active"
  | "past_due" | "cancel_scheduled" | "ended";

export type AcademyPlatformBillingState =
  | { kind: "loading" | "unavailable" | "forbidden" | "sign_in_required" | "not_configured" | "policy_pending" | "state_conflict" | "invalid_request" }
  | {
      kind: "owner";
      subscriptionStatus: AcademySubscriptionStatus;
      constructionPurchase: "unverified" | "confirmed_awaiting_monthly_contract";
      headquartersState: "unverified" | "not_created" | "preparing" | "ready";
      nextInvoice: { amountYen: number | null; date: string | null } | null;
      accessEndsAt: string | null;
      allowedActions: Array<"checkout" | "portal" | "create_resource">;
      planKey: string | null;
      snapshot: {
        cutoffAt: string;
        registeredCount: number;
        catalogPriceYen: number;
        scheduledPriceYen: number;
        chargeMonth: string;
        reconciliation: "pending" | "matched" | "mismatch";
      } | null;
    };

const statusCopy: Record<AcademySubscriptionStatus, { title: string; description: string }> = {
  none: { title: "利用開始前", description: "料金と契約条件を確認してから、Academyの利用を申し込みます。" },
  trialing: { title: "お試し利用中", description: "7日間、カード登録なしで本部設定と非公開の講座下書きを試せます。自動課金はありません。期限後は閲覧のみになります。" },
  processing: { title: "決済結果を確認中", description: "決済画面から戻っただけでは利用開始になりません。確認が終わるまで、再度申し込まないでください。" },
  active: { title: "契約中", description: "Academy利用料の契約が有効です。本部の利用準備は下の表示で確認できます。" },
  past_due: { title: "支払いの確認が必要です", description: "請求内容と支払方法を確認してください。再契約せず、現在の契約の支払いを確認します。" },
  cancel_scheduled: { title: "解約予約済み", description: "利用終了予定日を確認してください。解約予約と、すでに支払った料金の返金は別の手続きです。" },
  ended: { title: "契約終了", description: "再利用の条件を確認してください。この画面で認定履歴や受講記録は削除しません。" },
};

export function describeAcademySubscription(status: AcademySubscriptionStatus) {
  return statusCopy[status];
}

export function formatAcademyBillingYen(value: number | null | undefined) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? `${value.toLocaleString("ja-JP")}円`
    : "未確定";
}

export function formatAcademyBillingDate(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) return "未確定";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric" }).format(date)
    : "未確定";
}

export const ACADEMY_PLATFORM_PRICE_ROWS = [
  { limit: "20名まで", monthly: "5,000円", perPerson: "250円" },
  { limit: "50名まで", monthly: "10,000円", perPerson: "200円" },
  { limit: "200名まで", monthly: "20,000円", perPerson: "100円" },
  { limit: "201名以上", monthly: "20,000円 ＋ 200名を超えた人数 × 100円", perPerson: "—" },
] as const;
