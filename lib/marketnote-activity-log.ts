import { supabase } from "@/lib/supabase/client";
import type { MarketEvent, Profile } from "@/types/database";

type MarketEventActivityStatus = "draft" | "confirmed" | "completed" | "cancelled";

export function getMarketEventActivityStatus(status: MarketEvent["status"]): MarketEventActivityStatus {
  if (status === "preparing") return "confirmed";
  if (status === "completed") return "completed";
  if (status === "cancelled") return "cancelled";
  return "draft";
}

export function toMarketEventActivityLogPayload(
  profile: Profile,
  event: MarketEvent,
  countsTowardSummary = false
) {
  const status = getMarketEventActivityStatus(event.status);

  return {
    user_id: profile.user_id,
    profile_id: profile.id,
    activity_type: "market_event",
    category: "event",
    source_service: "marketnote",
    source_record_id: event.id,
    occurred_at: `${event.event_date}T00:00:00.000Z`,
    ended_at: event.event_date,
    subject_type_key: event.event_type_id,
    title: event.title,
    description: null,
    visibility: "private",
    status,
    display_on_story: false,
    display_in_timeline: false,
    display_as_achievement: false,
    counts_toward_summary: status === "cancelled" ? false : countsTowardSummary,
    has_financial_value: false,
    amount: null,
    transaction_type: "none",
    payment_status: "not_required"
  };
}

export async function syncMarketEventActivityLog(
  profile: Profile,
  event: MarketEvent,
  countsTowardSummary = false
) {
  const payload = toMarketEventActivityLogPayload(profile, event, countsTowardSummary);
  const { error } = await supabase.from("activity_logs").upsert(payload, {
    onConflict: "profile_id,source_service,source_record_id"
  });

  if (error) throw error;
}
