import { supabase } from "@/lib/supabase/client";

type ActivityInput = {
  userId: string;
  profileId: string;
  activityType: string;
  sourceRecordId: string;
  title: string;
  description?: string | null;
  occurredAt?: string;
  visibility?: "public" | "private" | "limited";
  displayOnStory?: boolean;
  displayInTimeline?: boolean;
  displayAsAchievement?: boolean;
  countsTowardSummary?: boolean;
  hasFinancialValue?: boolean;
  amount?: number | null;
  transactionType?: "revenue" | "expense" | "none";
  paymentStatus?: "unpaid" | "paid" | "not_required";
};

export async function createActivityLog(input: ActivityInput) {
  const hasFinancialValue = input.hasFinancialValue ?? false;
  const payload = {
    user_id: input.userId,
    profile_id: input.profileId,
    activity_type: input.activityType,
    category: "event",
    source_service: "marketnote",
    source_record_id: input.sourceRecordId,
    occurred_at: input.occurredAt ?? new Date().toISOString(),
    title: input.title,
    description: input.description ?? null,
    visibility: input.visibility ?? "private",
    status: "completed",
    display_on_story: input.displayOnStory ?? false,
    display_in_timeline: input.displayInTimeline ?? false,
    display_as_achievement: input.displayAsAchievement ?? false,
    counts_toward_summary: input.countsTowardSummary ?? false,
    has_financial_value: hasFinancialValue,
    amount: hasFinancialValue ? input.amount ?? 0 : null,
    transaction_type: hasFinancialValue ? input.transactionType ?? "revenue" : "none",
    payment_status: hasFinancialValue ? input.paymentStatus ?? "paid" : "not_required"
  };

  const { error } = await supabase.from("activity_logs").upsert(payload, {
    onConflict: "profile_id,source_service,source_record_id"
  });

  if (error) throw error;
}
