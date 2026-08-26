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
  countsTowardSummary?: boolean
) {
  let shouldCount = countsTowardSummary;
  if (shouldCount === undefined && event.event_type_id) {
    const { data, error } = await supabase
      .from("market_event_types")
      .select("counts_toward_summary")
      .eq("profile_id", profile.id)
      .eq("id", event.event_type_id)
      .maybeSingle();

    if (error) throw error;
    shouldCount = data?.counts_toward_summary === true;
  }

  const payload = toMarketEventActivityLogPayload(profile, event, shouldCount === true);
  const { error } = await supabase.from("activity_logs").upsert(payload, {
    onConflict: "profile_id,source_service,source_record_id"
  });

  if (error) throw error;
}

export async function syncMarketEventsActivityLogs(profile: Profile, events: MarketEvent[]) {
  if (events.length === 0) return;

  const eventTypeIds = Array.from(new Set(events.map((event) => event.event_type_id).filter((id): id is string => Boolean(id))));
  const summaryByType = new Map<string, boolean>();
  if (eventTypeIds.length > 0) {
    const { data, error } = await supabase
      .from("market_event_types")
      .select("id, counts_toward_summary")
      .eq("profile_id", profile.id)
      .in("id", eventTypeIds);
    if (error) throw error;
    for (const row of data ?? []) summaryByType.set(row.id as string, row.counts_toward_summary === true);
  }

  const payloads = events.map((event) => toMarketEventActivityLogPayload(
    profile,
    event,
    event.event_type_id ? summaryByType.get(event.event_type_id) === true : false
  ));
  const { error } = await supabase.from("activity_logs").upsert(payloads, {
    onConflict: "profile_id,source_service,source_record_id"
  });
  if (error) throw error;
}

export async function syncMarketEventTypeSummaryEligibility(
  profileId: string,
  eventTypeId: string,
  countsTowardSummary: boolean
) {
  const { error: resetError } = await supabase
    .from("activity_logs")
    .update({ counts_toward_summary: false })
    .eq("profile_id", profileId)
    .eq("source_service", "marketnote")
    .eq("subject_type_key", eventTypeId);

  if (resetError) throw resetError;
  if (!countsTowardSummary) return;

  const { error: enableError } = await supabase
    .from("activity_logs")
    .update({ counts_toward_summary: true })
    .eq("profile_id", profileId)
    .eq("source_service", "marketnote")
    .eq("subject_type_key", eventTypeId)
    .neq("status", "cancelled");

  if (enableError) throw enableError;
}
