import { createActivityLog } from "@/lib/activity-log";
import { supabase } from "@/lib/supabase/client";
import type {
  ActivityLog,
  MarketCheckItem,
  MarketEvent,
  MarketFinancialRecord,
  MarketReflection,
  Profile
} from "@/types/database";

export async function listMarketEvents(profileId: string) {
  const { data, error } = await supabase
    .from("market_events")
    .select("*")
    .eq("profile_id", profileId)
    .order("event_date", { ascending: false });

  if (error) throw error;
  return (data ?? []) as MarketEvent[];
}

export async function getMarketEvent(profileId: string, id: string) {
  const { data, error } = await supabase
    .from("market_events")
    .select("*")
    .eq("profile_id", profileId)
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as MarketEvent;
}

export async function getMarketEventBundle(profileId: string, id: string) {
  const [event, checks, finances, reflection] = await Promise.all([
    getMarketEvent(profileId, id),
    listCheckItems(profileId, id),
    listFinancialRecords(profileId, id),
    getReflection(profileId, id)
  ]);

  return { event, checks, finances, reflection };
}

export async function createMarketEvent(
  profile: Profile,
  input: {
    title: string;
    eventDate: string;
    venueName: string;
    area: string;
    genre: string;
    publicNote: string;
    privateNote?: string;
    status?: "planned" | "preparing";
  }
) {
  const { data, error } = await supabase
    .from("market_events")
    .insert({
      user_id: profile.user_id,
      profile_id: profile.id,
      title: input.title,
      event_date: input.eventDate,
      venue_name: input.venueName || null,
      area: input.area || null,
      genre: input.genre || null,
      status: input.status ?? "planned",
      visibility: "public",
      display_on_story: true,
      public_note: input.publicNote || null,
      private_note: input.privateNote || null
    })
    .select("*")
    .single();

  if (error) throw error;
  const event = data as MarketEvent;

  await createActivityLog({
    userId: profile.user_id,
    profileId: profile.id,
    activityType: "market_event_added",
    sourceRecordId: event.id,
    title: `${event.title}を出店予定に追加しました`,
    description: [event.venue_name, event.area, event.genre].filter(Boolean).join(" / ") || null,
    occurredAt: event.event_date,
    visibility: "public",
    displayOnStory: true,
    displayInTimeline: true,
    countsTowardSummary: true
  });

  return event;
}

export async function listCheckItems(profileId: string, marketEventId: string) {
  const { data, error } = await supabase
    .from("market_check_items")
    .select("*")
    .eq("profile_id", profileId)
    .eq("market_event_id", marketEventId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []) as MarketCheckItem[];
}

export async function addCheckItem(profile: Profile, marketEventId: string, title: string) {
  const existing = await listCheckItems(profile.id, marketEventId);
  const { data, error } = await supabase
    .from("market_check_items")
    .insert({
      user_id: profile.user_id,
      profile_id: profile.id,
      market_event_id: marketEventId,
      title,
      sort_order: existing.length + 1
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as MarketCheckItem;
}

export async function toggleCheckItem(profile: Profile, item: MarketCheckItem, nextValue: boolean) {
  const { error } = await supabase
    .from("market_check_items")
    .update({ is_done: nextValue })
    .eq("id", item.id)
    .eq("profile_id", profile.id);

  if (error) throw error;

  await createActivityLog({
    userId: profile.user_id,
    profileId: profile.id,
    activityType: "market_event_prepared",
    sourceRecordId: `${item.id}:${nextValue ? "done" : "todo"}`,
    title: nextValue ? "出店準備を完了しました" : "出店準備を更新しました",
    description: item.title,
    visibility: "private",
    displayOnStory: false
  });
}

export async function listFinancialRecords(profileId: string, marketEventId?: string) {
  let query = supabase
    .from("market_financial_records")
    .select("*")
    .eq("profile_id", profileId)
    .order("occurred_at", { ascending: false });

  if (marketEventId) query = query.eq("market_event_id", marketEventId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as MarketFinancialRecord[];
}

export async function addFinancialRecord(
  profile: Profile,
  input: {
    marketEventId: string;
    recordType: "revenue" | "expense";
    title: string;
    amount: number;
    occurredAt: string;
    category: string;
    memo: string;
    paymentStatus?: "unpaid" | "paid" | "not_required";
  }
) {
  const { data, error } = await supabase
    .from("market_financial_records")
    .insert({
      user_id: profile.user_id,
      profile_id: profile.id,
      market_event_id: input.marketEventId,
      record_type: input.recordType,
      title: input.title,
      amount: input.amount,
      occurred_at: input.occurredAt,
      category: input.category || null,
      payment_status: input.paymentStatus ?? "paid",
      memo: input.memo || null
    })
    .select("*")
    .single();

  if (error) throw error;
  const record = data as MarketFinancialRecord;

  await createActivityLog({
    userId: profile.user_id,
    profileId: profile.id,
    activityType: input.recordType === "revenue" ? "market_sales_recorded" : "market_expense_recorded",
    sourceRecordId: record.id,
    title: input.recordType === "revenue" ? "出店売上を記録しました" : "出店経費を記録しました",
    description: record.title,
    occurredAt: record.occurred_at,
    visibility: "private",
    hasFinancialValue: true,
    amount: record.amount,
    transactionType: record.record_type,
    paymentStatus: input.paymentStatus ?? "paid"
  });

  return record;
}

export async function getReflection(profileId: string, marketEventId: string) {
  const { data, error } = await supabase
    .from("market_reflections")
    .select("*")
    .eq("profile_id", profileId)
    .eq("market_event_id", marketEventId)
    .maybeSingle();

  if (error) throw error;
  return data as MarketReflection | null;
}

export async function listReflections(profileId: string) {
  const { data, error } = await supabase
    .from("market_reflections")
    .select("*")
    .eq("profile_id", profileId);

  if (error) throw error;
  return (data ?? []) as MarketReflection[];
}

export async function saveReflection(
  profile: Profile,
  input: {
    marketEventId: string;
    publicSummary: string;
    privateNote: string;
    goodPoints: string;
    nextActions: string;
  }
) {
  const { data, error } = await supabase
    .from("market_reflections")
    .upsert(
      {
        user_id: profile.user_id,
        profile_id: profile.id,
        market_event_id: input.marketEventId,
        public_summary: input.publicSummary || null,
        private_note: input.privateNote || null,
        good_points: input.goodPoints || null,
        next_actions: input.nextActions || null
      },
      { onConflict: "market_event_id" }
    )
    .select("*")
    .single();

  if (error) throw error;
  const reflection = data as MarketReflection;

  await createActivityLog({
    userId: profile.user_id,
    profileId: profile.id,
    activityType: "market_reflection_created",
    sourceRecordId: reflection.id,
    title: "出店の振り返りを記録しました",
    description: reflection.public_summary,
    visibility: reflection.public_summary ? "public" : "private",
    displayOnStory: Boolean(reflection.public_summary),
    displayInTimeline: Boolean(reflection.public_summary),
    countsTowardSummary: Boolean(reflection.public_summary)
  });

  return reflection;
}

export async function completeMarketEvent(profile: Profile, event: MarketEvent) {
  const { data, error } = await supabase
    .from("market_events")
    .update({ status: "completed" })
    .eq("id", event.id)
    .eq("profile_id", profile.id)
    .select("*")
    .single();

  if (error) throw error;
  const updated = data as MarketEvent;

  await createActivityLog({
    userId: profile.user_id,
    profileId: profile.id,
    activityType: "market_event_completed",
    sourceRecordId: `${event.id}:completed`,
    title: `${event.title}に出店しました`,
    description: [event.venue_name, event.area, event.genre].filter(Boolean).join(" / ") || null,
    occurredAt: event.event_date,
    visibility: "public",
    displayOnStory: true,
    displayInTimeline: true,
    displayAsAchievement: true,
    countsTowardSummary: true
  });

  return updated;
}

export async function listActivityLogs(profileId: string, storyOnly = false) {
  let query = supabase
    .from("activity_logs")
    .select("*")
    .eq("profile_id", profileId)
    .order("occurred_at", { ascending: false });

  if (storyOnly) {
    query = query.eq("visibility", "public").eq("display_on_story", true);
  }

  const { data, error } = await query.limit(50);
  if (error) throw error;
  return (data ?? []) as ActivityLog[];
}
