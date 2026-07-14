import type { UnifiedActivityLog } from "./types";

export function shouldCountTowardSummary(log: UnifiedActivityLog) {
  if (typeof log.countsTowardSummary === "boolean") return log.countsTowardSummary;

  if (summaryExcludedEventTypes.has(log.eventType)) return false;
  if (summaryIncludedEventTypes.has(log.eventType)) return true;

  if (log.visibility !== "public" || !log.storyEnabled) return false;
  if (log.appKey === "community") return false;
  return log.deskEnabled || log.amountType !== "none";
}

export function getSummaryLogs(logs: UnifiedActivityLog[]) {
  return logs.filter(shouldCountTowardSummary);
}

const summaryIncludedEventTypes = new Set([
  "market_event_added",
  "market_event_created",
  "market_event_completed",
  "event_created",
  "event_hosted",
  "academy_course_created",
  "academy_certification_completed",
  "order_received",
  "order_delivered",
  "item_created",
  "item_sold",
  "session_booked",
  "session_completed",
  "fund_project_completed"
]);

const summaryExcludedEventTypes = new Set([
  "market_event_prepared",
  "market_sales_recorded",
  "market_expense_recorded",
  "event_expense_recorded",
  "community_fee_recorded",
  "community_post_created",
  "payment_method_updated",
  "draft_created",
  "memo_updated",
  "display_setting_updated",
  "status_changed",
  "cancelled",
  "fund_project_published",
  "fund_support_recorded",
  "fund_payment_confirmed",
  "fund_fulfillment_completed"
]);
