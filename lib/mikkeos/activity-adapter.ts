import { shouldCountTowardSummary } from "./activity-summary";
import type { UnifiedActivityLog } from "./types";

type ActivityLogCategory =
  | "consultation"
  | "production"
  | "product"
  | "event"
  | "workshop"
  | "review"
  | "profile"
  | "other";

export type ActivityLogAdapter = {
  list(profileId: string): Promise<UnifiedActivityLog[]>;
  create(log: UnifiedActivityLog, context: ActivityAdapterContext): Promise<UnifiedActivityLog>;
};

export type ActivityAdapterContext = {
  userId: string;
  profileId: string;
};

export type SupabaseActivityLogInsert = {
  user_id: string;
  profile_id: string;
  activity_type: string;
  category: string;
  source_service: string;
  source_record_id: string;
  occurred_at: string;
  title: string;
  description: string | null;
  visibility: "public" | "private" | "limited";
  status: "draft" | "confirmed" | "completed" | "cancelled";
  display_on_story: boolean;
  display_in_timeline: boolean;
  display_as_achievement: boolean;
  counts_toward_summary: boolean;
  has_financial_value: boolean;
  amount: number | null;
  transaction_type: "revenue" | "expense" | "none";
  payment_status: "unpaid" | "paid" | "not_required";
};

export function toSupabaseActivityLogInsert(
  log: UnifiedActivityLog,
  context: ActivityAdapterContext
): SupabaseActivityLogInsert {
  const hasFinancialValue = log.deskEnabled && log.amountType !== "none" && typeof log.amount === "number";
  const forcePrivateStory = shouldForcePrivateStory(log, hasFinancialValue);
  const storyEnabled = forcePrivateStory ? false : log.storyEnabled;
  const countsTowardSummary = forcePrivateStory ? false : shouldCountTowardSummary(log);

  return {
    user_id: context.userId,
    profile_id: context.profileId,
    activity_type: log.eventType,
    category: toSupabaseActivityCategory(log),
    source_service: toSupabaseSourceService(log.appKey),
    source_record_id: log.sourceId,
    occurred_at: log.occurredAt,
    title: log.title,
    description: log.description ?? null,
    visibility: forcePrivateStory ? "private" : log.visibility,
    status: "completed",
    display_on_story: storyEnabled,
    display_in_timeline: storyEnabled,
    display_as_achievement: storyEnabled,
    counts_toward_summary: countsTowardSummary,
    has_financial_value: hasFinancialValue,
    amount: hasFinancialValue ? log.amount ?? 0 : null,
    transaction_type: hasFinancialValue ? toSupabaseTransactionType(log.amountType) : "none",
    payment_status: hasFinancialValue ? log.metadata?.paymentStatus ?? "paid" : "not_required"
  };
}

function shouldForcePrivateStory(log: UnifiedActivityLog, hasFinancialValue: boolean) {
  if (hasFinancialValue) return true;

  return (
    log.eventType === "market_sales_recorded" ||
    log.eventType === "market_expense_recorded" ||
    log.eventType === "event_expense_recorded" ||
    log.eventType === "community_fee_recorded" ||
    log.eventType === "payment_method_updated" ||
    log.eventType === "team_works_invoice_created" ||
    log.eventType === "team_works_invoice_paid" ||
    log.eventType === "team_works_partner_reward_recorded"
  );
}

export function toSupabaseSourceService(appKey: UnifiedActivityLog["appKey"]) {
  if (appKey === "market_note") return "marketnote";
  return appKey;
}

export function toSupabaseActivityCategory(log: UnifiedActivityLog): ActivityLogCategory {
  const category = log.metadata?.category;
  if (isActivityLogCategory(category)) return category;

  if (log.appKey === "market_note" || log.appKey === "event") return "event";
  if (log.appKey === "order") return "production";
  if (log.appKey === "item_studio") return "product";
  if (log.appKey === "academy") return "workshop";
  if (log.appKey === "session") return "consultation";
  if (log.appKey === "team_works") return "other";
  if (log.appKey === "fund") return "production";
  return "other";
}

function isActivityLogCategory(value: string | undefined): value is ActivityLogCategory {
  return (
    value === "consultation" ||
    value === "production" ||
    value === "product" ||
    value === "event" ||
    value === "workshop" ||
    value === "review" ||
    value === "profile" ||
    value === "other"
  );
}

function toSupabaseTransactionType(amountType: UnifiedActivityLog["amountType"]) {
  if (amountType === "income") return "revenue";
  if (amountType === "expense") return "expense";
  return "none";
}
