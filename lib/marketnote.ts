import { createActivityLog } from "@/lib/activity-log";
import {
  addGuestCheckItem,
  addGuestFinancialRecord,
  clearGuestMarketNoteStore,
  createGuestMarketEvent,
  deleteGuestCheckItem,
  deleteGuestFinancialRecord,
  getGuestMarketEvent,
  getGuestMarketEventBundle,
  getGuestMarketNoteStats,
  getGuestReflection,
  isMarketNoteGuestProfile,
  listGuestCheckItems,
  listGuestFinancialRecords,
  listGuestMarketEvents,
  listGuestReflections,
  readGuestMarketNoteStore,
  saveGuestReflection,
  toggleGuestCheckItem,
  updateGuestFinancialRecord,
  updateGuestMarketEventDetails,
  updateGuestMarketEventStatus,
  upsertGuestEventPaymentRecord
} from "@/lib/marketnote-guest";
import { supabase } from "@/lib/supabase/client";
import { importGuestMarketNotePhotos } from "@/lib/marketnote-photos";
import type {
  ActivityLog,
  MarketCheckItem,
  MarketEvent,
  MarketFinancialRecord,
  MarketReflection,
  Profile
} from "@/types/database";

export type MarketNoteImportResult = {
  events: number;
  checks: number;
  finances: number;
  reflections: number;
  photos: number;
};

// DBのstatus列は create経路で planned/preparing のみ許容のため、
// 「申込済み」は private_note の「入力ステータス:」行が正となる（DB変更は別フェーズ）。
export function hasAppliedEntryStatus(privateNote: string | null | undefined) {
  return Boolean(privateNote && privateNote.includes("入力ステータス: 申込済み"));
}

export function getGuestMarketNoteImportStats() {
  return getGuestMarketNoteStats();
}

export async function importGuestMarketNoteRecords(profile: Profile): Promise<MarketNoteImportResult> {
  if (isMarketNoteGuestProfile(profile)) {
    throw new Error("クラウドへ保存するにはログインが必要です。端末内の記録はこのブラウザに残っています。");
  }

  const store = readGuestMarketNoteStore();
  if (store.events.length === 0) {
    return { events: 0, checks: 0, finances: 0, reflections: 0, photos: 0 };
  }

  const eventIdMap = new Map<string, string>();

  for (const event of store.events) {
    const guestImportMarker = `guest_import_id: ${event.id}`;
    const privateNote = [event.private_note, guestImportMarker].filter(Boolean).join("\n") || null;
    const { data: existing, error: existingError } = await supabase
      .from("market_events")
      .select("id")
      .eq("profile_id", profile.id)
      .eq("private_note", privateNote)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing?.id) {
      eventIdMap.set(event.id, existing.id);
      continue;
    }

    const { data, error } = await supabase
      .from("market_events")
      .insert({
        user_id: profile.user_id,
        profile_id: profile.id,
        title: event.title,
        event_date: event.event_date,
        venue_name: event.venue_name,
        area: event.area,
        genre: event.genre,
        status: event.status,
        visibility: "private",
        display_on_story: false,
        public_note: event.public_note,
        private_note: privateNote
      })
      .select("*")
      .single();

    if (error) throw error;
    eventIdMap.set(event.id, (data as MarketEvent).id);
  }

  let importedChecks = 0;
  for (const item of store.checks) {
    const marketEventId = eventIdMap.get(item.market_event_id);
    if (!marketEventId) continue;
    const inserted = await ensureImportedGuestCheckItem(profile, marketEventId, item);
    if (inserted) importedChecks += 1;
  }

  let importedFinances = 0;
  for (const record of store.finances) {
    const marketEventId = record.market_event_id ? eventIdMap.get(record.market_event_id) ?? null : null;
    if (record.market_event_id && !marketEventId) continue;
    const inserted = await ensureImportedGuestFinancialRecord(profile, marketEventId, record);
    if (inserted) importedFinances += 1;
  }

  let importedReflections = 0;
  for (const reflection of store.reflections) {
    const marketEventId = eventIdMap.get(reflection.market_event_id);
    if (!marketEventId) continue;
    const inserted = await ensureImportedGuestReflection(profile, marketEventId, reflection);
    if (inserted) importedReflections += 1;
  }

  const importedPhotos = await importGuestMarketNotePhotos(profile, eventIdMap);

  clearGuestMarketNoteStore();

  return {
    events: eventIdMap.size,
    checks: importedChecks,
    finances: importedFinances,
    reflections: importedReflections,
    photos: importedPhotos
  };
}

async function ensureImportedGuestCheckItem(profile: Profile, marketEventId: string, item: MarketCheckItem) {
  const { data: existing, error: existingError } = await supabase
    .from("market_check_items")
    .select("id,due_date,is_done")
    .eq("profile_id", profile.id)
    .eq("market_event_id", marketEventId)
    .eq("title", item.title)
    .eq("sort_order", item.sort_order);

  if (existingError) throw existingError;
  if ((existing ?? []).some((row) => row.due_date === item.due_date && row.is_done === item.is_done)) return false;

  const { error } = await supabase.from("market_check_items").insert({
    user_id: profile.user_id,
    profile_id: profile.id,
    market_event_id: marketEventId,
    title: item.title,
    is_done: item.is_done,
    due_date: item.due_date,
    sort_order: item.sort_order
  });

  if (error) throw error;
  return true;
}

async function ensureImportedGuestFinancialRecord(profile: Profile, marketEventId: string | null, record: MarketFinancialRecord) {
  let query = supabase
    .from("market_financial_records")
    .select("id,category,memo,payment_status")
    .eq("profile_id", profile.id)
    .eq("record_type", record.record_type)
    .eq("title", record.title)
    .eq("amount", record.amount)
    .eq("occurred_at", record.occurred_at);

  query = marketEventId ? query.eq("market_event_id", marketEventId) : query.is("market_event_id", null);

  const { data: existing, error: existingError } = await query;
  if (existingError) throw existingError;
  if ((existing ?? []).some((row) =>
    row.category === record.category &&
    row.memo === record.memo &&
    row.payment_status === record.payment_status
  )) return false;

  const { error } = await supabase.from("market_financial_records").insert({
    user_id: profile.user_id,
    profile_id: profile.id,
    market_event_id: marketEventId,
    record_type: record.record_type,
    title: record.title,
    amount: record.amount,
    occurred_at: record.occurred_at,
    category: record.category,
    payment_status: record.payment_status,
    memo: record.memo
  });

  if (error) throw error;
  return true;
}

async function ensureImportedGuestReflection(profile: Profile, marketEventId: string, reflection: MarketReflection) {
  const { data: existing, error: existingError } = await supabase
    .from("market_reflections")
    .select("id")
    .eq("profile_id", profile.id)
    .eq("market_event_id", marketEventId)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing?.id) return false;

  const { error } = await supabase.from("market_reflections").insert({
    user_id: profile.user_id,
    profile_id: profile.id,
    market_event_id: marketEventId,
    public_summary: reflection.public_summary,
    private_note: reflection.private_note,
    good_points: reflection.good_points,
    next_actions: reflection.next_actions
  });

  if (error) throw error;
  return true;
}

export async function listMarketEvents(profileId: string) {
  if (isMarketNoteGuestProfile(profileId)) return listGuestMarketEvents();

  const { data, error } = await supabase
    .from("market_events")
    .select("*")
    .eq("profile_id", profileId)
    .order("event_date", { ascending: false });

  if (error) throw error;
  return (data ?? []) as MarketEvent[];
}

export async function getMarketEvent(profileId: string, id: string) {
  if (isMarketNoteGuestProfile(profileId)) return getGuestMarketEvent(id);

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
  if (isMarketNoteGuestProfile(profileId)) return getGuestMarketEventBundle(id);

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
  if (isMarketNoteGuestProfile(profile)) return createGuestMarketEvent(input);

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
      visibility: "private",
      display_on_story: false,
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
    visibility: "private",
    displayOnStory: false,
    displayInTimeline: false,
    countsTowardSummary: false
  });

  return event;
}

export async function updateMarketEventDetails(
  profile: Profile,
  eventId: string,
  input: {
    title: string;
    eventDate: string;
    venueName: string;
    area: string;
    status: MarketEvent["status"];
    publicNote: string;
    privateNote: string;
  }
) {
  if (isMarketNoteGuestProfile(profile)) return updateGuestMarketEventDetails(eventId, input);

  const { data, error } = await supabase
    .from("market_events")
    .update({
      title: input.title,
      event_date: input.eventDate,
      venue_name: input.venueName || null,
      area: input.area || null,
      status: input.status,
      public_note: input.publicNote || null,
      private_note: input.privateNote || null
    })
    .eq("id", eventId)
    .eq("profile_id", profile.id)
    .select("*")
    .single();

  if (error) throw error;
  return data as MarketEvent;
}

export async function listCheckItems(profileId: string, marketEventId: string) {
  if (isMarketNoteGuestProfile(profileId)) return listGuestCheckItems(marketEventId);

  const { data, error } = await supabase
    .from("market_check_items")
    .select("*")
    .eq("profile_id", profileId)
    .eq("market_event_id", marketEventId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []) as MarketCheckItem[];
}

export async function addCheckItem(profile: Profile, marketEventId: string, title: string, dueDate?: string | null) {
  if (isMarketNoteGuestProfile(profile)) return addGuestCheckItem(marketEventId, title, dueDate);

  const existing = await listCheckItems(profile.id, marketEventId);
  const { data, error } = await supabase
    .from("market_check_items")
    .insert({
      user_id: profile.user_id,
      profile_id: profile.id,
      market_event_id: marketEventId,
      title,
      due_date: dueDate ?? null,
      sort_order: existing.length + 1
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as MarketCheckItem;
}

export async function toggleCheckItem(profile: Profile, item: MarketCheckItem, nextValue: boolean) {
  if (isMarketNoteGuestProfile(profile)) {
    toggleGuestCheckItem(item.id, nextValue);
    return;
  }

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

export async function deleteCheckItem(profile: Profile, item: MarketCheckItem) {
  if (isMarketNoteGuestProfile(profile)) {
    deleteGuestCheckItem(item.id);
    return;
  }

  const { error } = await supabase
    .from("market_check_items")
    .delete()
    .eq("id", item.id)
    .eq("profile_id", profile.id)
    .eq("market_event_id", item.market_event_id);

  if (error) throw error;
}

export async function listFinancialRecords(profileId: string, marketEventId?: string) {
  if (isMarketNoteGuestProfile(profileId)) return listGuestFinancialRecords(marketEventId);

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
  if (isMarketNoteGuestProfile(profile)) return addGuestFinancialRecord(input);

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

export async function updateFinancialRecord(
  profile: Profile,
  recordId: string,
  input: {
    recordType: "revenue" | "expense";
    title: string;
    amount: number;
    occurredAt: string;
    category: string;
    memo: string;
    paymentStatus?: "unpaid" | "paid" | "not_required";
  }
) {
  if (isMarketNoteGuestProfile(profile)) return updateGuestFinancialRecord(recordId, input);

  const { data, error } = await supabase
    .from("market_financial_records")
    .update({
      record_type: input.recordType,
      title: input.title,
      amount: input.amount,
      occurred_at: input.occurredAt,
      category: input.category || null,
      memo: input.memo || null,
      payment_status: input.paymentStatus ?? "paid"
    })
    .eq("id", recordId)
    .eq("profile_id", profile.id)
    .select("*")
    .single();

  if (error) throw error;
  return data as MarketFinancialRecord;
}

export async function deleteFinancialRecord(profile: Profile, recordId: string) {
  if (isMarketNoteGuestProfile(profile)) {
    deleteGuestFinancialRecord(recordId);
    return;
  }

  const { error } = await supabase
    .from("market_financial_records")
    .delete()
    .eq("id", recordId)
    .eq("profile_id", profile.id);

  if (error) throw error;
}

export async function saveEventPaymentRecord(
  profile: Profile,
  input: {
    marketEventId: string;
    eventDate: string;
    amount: number;
    method: string;
    paymentStatus: "unpaid" | "paid" | "not_required";
  }
) {
  if (isMarketNoteGuestProfile(profile)) return upsertGuestEventPaymentRecord(input);

  const existing = (await listFinancialRecords(profile.id, input.marketEventId))
    .find((row) => row.record_type === "expense" && (row.title.includes("出店") || row.title.includes("蜃ｺ蠎") || row.category === "出店料"));

  if (existing) {
    const { data, error } = await supabase
      .from("market_financial_records")
      .update({
        amount: input.amount,
        occurred_at: input.eventDate,
        category: "出店料",
        payment_status: input.paymentStatus,
        memo: input.method || null
      })
      .eq("id", existing.id)
      .eq("profile_id", profile.id)
      .select("*")
      .single();

    if (error) throw error;
    return data as MarketFinancialRecord;
  }

  if (input.amount <= 0 && input.paymentStatus === "not_required") return null;

  return addFinancialRecord(profile, {
    marketEventId: input.marketEventId,
    recordType: "expense",
    title: "出店料",
    amount: input.amount,
    occurredAt: input.eventDate,
    category: "出店料",
    memo: input.method,
    paymentStatus: input.paymentStatus
  });
}

export async function getReflection(profileId: string, marketEventId: string) {
  if (isMarketNoteGuestProfile(profileId)) return getGuestReflection(marketEventId);

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
  if (isMarketNoteGuestProfile(profileId)) return listGuestReflections();

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
  if (isMarketNoteGuestProfile(profile)) return saveGuestReflection(input);

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
    visibility: "private",
    displayOnStory: false,
    displayInTimeline: false,
    countsTowardSummary: false
  });

  return reflection;
}

export async function completeMarketEvent(profile: Profile, event: MarketEvent) {
  if (isMarketNoteGuestProfile(profile)) return updateGuestMarketEventStatus(event.id, "completed");

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
    visibility: "private",
    displayOnStory: false,
    displayInTimeline: false,
    displayAsAchievement: true,
    countsTowardSummary: false
  });

  return updated;
}

export async function updateMarketEventStatus(
  profile: Profile,
  event: MarketEvent,
  status: MarketEvent["status"]
) {
  if (isMarketNoteGuestProfile(profile)) return updateGuestMarketEventStatus(event.id, status);

  const { data, error } = await supabase
    .from("market_events")
    .update({ status })
    .eq("id", event.id)
    .eq("profile_id", profile.id)
    .select("*")
    .single();

  if (error) throw error;
  return data as MarketEvent;
}

export async function listActivityLogs(profileId: string, storyOnly = false) {
  if (isMarketNoteGuestProfile(profileId)) return [];

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
