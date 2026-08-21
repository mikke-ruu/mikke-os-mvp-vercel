import type {
  MarketCheckItem,
  MarketEvent,
  MarketFinancialRecord,
  MarketReflection,
  Profile
} from "@/types/database";

export const MARKETNOTE_GUEST_USER_ID = "marketnote-guest-user";
export const MARKETNOTE_GUEST_PROFILE_ID = "marketnote-guest-profile";

export const marketNoteGuestProfile: Profile = {
  id: MARKETNOTE_GUEST_PROFILE_ID,
  user_id: MARKETNOTE_GUEST_USER_ID,
  display_name: "MarketNote Guest",
  handle: "marketnote-guest",
  bio: null,
  area: null,
  avatar_url: null,
  website_url: null,
  instagram_url: null,
  member_number: null,
  joined_at: "2026-08-03T00:00:00.000Z",
  created_at: "2026-08-03T00:00:00.000Z",
  updated_at: "2026-08-03T00:00:00.000Z"
};

export type GuestMarketNoteStore = {
  events: MarketEvent[];
  checks: MarketCheckItem[];
  finances: MarketFinancialRecord[];
  reflections: MarketReflection[];
};

const STORAGE_KEY = "mikke.marketnote.guest.v1";

const emptyStore: GuestMarketNoteStore = {
  events: [],
  checks: [],
  finances: [],
  reflections: []
};

export function isMarketNoteGuestProfile(profileOrId: Profile | string) {
  return (typeof profileOrId === "string" ? profileOrId : profileOrId.id) === MARKETNOTE_GUEST_PROFILE_ID;
}

export function readGuestMarketNoteStore() {
  return readStore();
}

export function clearGuestMarketNoteStore() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("mikke:marketnote-guest-updated"));
}

export function getGuestMarketNoteStats() {
  const store = readStore();
  return {
    events: store.events.length,
    checks: store.checks.length,
    finances: store.finances.length,
    reflections: store.reflections.length,
    total: store.events.length + store.checks.length + store.finances.length + store.reflections.length
  };
}

export function listGuestMarketEvents() {
  return readStore().events.sort((a, b) => b.event_date.localeCompare(a.event_date));
}

export function getGuestMarketEvent(id: string) {
  const event = readStore().events.find((item) => item.id === id);
  if (!event) throw new Error("MarketNoteの記録が見つかりません。");
  return event;
}

export function getGuestMarketEventBundle(id: string) {
  return {
    event: getGuestMarketEvent(id),
    checks: listGuestCheckItems(id),
    finances: listGuestFinancialRecords(id),
    reflection: getGuestReflection(id)
  };
}

export function createGuestMarketEvent(input: {
  title: string;
  eventDate: string;
  venueName: string;
  area: string;
  genre: string;
  publicNote: string;
  privateNote?: string;
  status?: "planned" | "preparing";
}) {
  const now = timestamp();
  const event: MarketEvent = {
    id: createId("market_event"),
    user_id: MARKETNOTE_GUEST_USER_ID,
    profile_id: MARKETNOTE_GUEST_PROFILE_ID,
    title: input.title,
    event_date: input.eventDate,
    venue_name: input.venueName || null,
    area: input.area || null,
    genre: input.genre || null,
    event_type_id: null,
    status: input.status ?? "planned",
    visibility: "private",
    display_on_story: false,
    public_note: input.publicNote || null,
    private_note: input.privateNote || null,
    created_at: now,
    updated_at: now
  };

  writeStore((store) => ({ ...store, events: [event, ...store.events] }));
  return event;
}

export function updateGuestMarketEventDetails(eventId: string, input: {
  title: string;
  eventDate: string;
  venueName: string;
  area: string;
  genre: string;
  status: MarketEvent["status"];
  publicNote: string;
  privateNote: string;
}) {
  let updated: MarketEvent | null = null;
  writeStore((store) => ({
    ...store,
    events: store.events.map((event) => {
      if (event.id !== eventId) return event;
      updated = {
        ...event,
        title: input.title,
        event_date: input.eventDate,
        venue_name: input.venueName || null,
        area: input.area || null,
        genre: input.genre || "出店",
        status: input.status,
        public_note: input.publicNote || null,
        private_note: input.privateNote || null,
        updated_at: timestamp()
      };
      return updated;
    })
  }));
  if (!updated) throw new Error("MarketNoteの記録が見つかりません。");
  return updated;
}

export function deleteGuestMarketEvent(eventId: string) {
  const store = readStore();
  if (!store.events.some((event) => event.id === eventId)) {
    throw new Error("MarketNoteの記録が見つかりません。");
  }

  writeStore((current) => ({
    events: current.events.filter((event) => event.id !== eventId),
    checks: current.checks.filter((item) => item.market_event_id !== eventId),
    reflections: current.reflections.filter((item) => item.market_event_id !== eventId),
    finances: current.finances.map((record) => record.market_event_id === eventId
      ? { ...record, market_event_id: null, updated_at: timestamp() }
      : record)
  }));
}

export function listGuestCheckItems(marketEventId: string) {
  return readStore().checks
    .filter((item) => item.market_event_id === marketEventId)
    .sort((a, b) => a.sort_order - b.sort_order);
}

export function addGuestCheckItem(marketEventId: string, title: string, dueDate?: string | null) {
  const now = timestamp();
  const existing = listGuestCheckItems(marketEventId);
  const item: MarketCheckItem = {
    id: createId("market_check"),
    user_id: MARKETNOTE_GUEST_USER_ID,
    profile_id: MARKETNOTE_GUEST_PROFILE_ID,
    market_event_id: marketEventId,
    title,
    is_done: false,
    due_date: dueDate ?? null,
    sort_order: existing.length + 1,
    created_at: now,
    updated_at: now
  };

  writeStore((store) => ({ ...store, checks: [...store.checks, item] }));
  return item;
}

export function toggleGuestCheckItem(itemId: string, nextValue: boolean) {
  writeStore((store) => ({
    ...store,
    checks: store.checks.map((item) => item.id === itemId ? { ...item, is_done: nextValue, updated_at: timestamp() } : item)
  }));
}

export function deleteGuestCheckItem(itemId: string) {
  writeStore((store) => ({
    ...store,
    checks: store.checks.filter((item) => item.id !== itemId)
  }));
}

export function listGuestFinancialRecords(marketEventId?: string) {
  return readStore().finances
    .filter((record) => !marketEventId || record.market_event_id === marketEventId)
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
}

export function addGuestFinancialRecord(input: {
  marketEventId: string;
  recordType: "revenue" | "expense";
  title: string;
  amount: number;
  occurredAt: string;
  category: string;
  memo: string;
  paymentStatus?: "unpaid" | "paid" | "not_required";
  paymentMethod?: string;
  entryKind?: MarketFinancialRecord["entry_kind"];
}) {
  const now = timestamp();
  const record: MarketFinancialRecord = {
    id: createId("market_finance"),
    user_id: MARKETNOTE_GUEST_USER_ID,
    profile_id: MARKETNOTE_GUEST_PROFILE_ID,
    market_event_id: input.marketEventId,
    record_type: input.recordType,
    title: input.title,
    amount: input.amount,
    occurred_at: input.occurredAt,
    category: input.category || null,
    payment_status: input.paymentStatus ?? "paid",
    payment_method: input.paymentMethod || null,
    entry_kind: input.entryKind ?? "manual",
    memo: input.memo || null,
    created_at: now,
    updated_at: now
  };

  writeStore((store) => ({ ...store, finances: [record, ...store.finances] }));
  return record;
}

export function updateGuestFinancialRecord(recordId: string, input: {
  recordType: "revenue" | "expense";
  title: string;
  amount: number;
  occurredAt: string;
  category: string;
  memo: string;
  paymentStatus?: "unpaid" | "paid" | "not_required";
  paymentMethod?: string;
  entryKind?: MarketFinancialRecord["entry_kind"];
}) {
  let updated: MarketFinancialRecord | null = null;
  writeStore((store) => ({
    ...store,
    finances: store.finances.map((record) => {
      if (record.id !== recordId) return record;
      updated = {
        ...record,
        record_type: input.recordType,
        title: input.title,
        amount: input.amount,
        occurred_at: input.occurredAt,
        category: input.category || null,
        memo: input.memo || null,
        payment_status: input.paymentStatus ?? "paid",
        payment_method: input.paymentMethod || null,
        entry_kind: input.entryKind ?? record.entry_kind ?? "manual",
        updated_at: timestamp()
      };
      return updated;
    })
  }));
  if (!updated) throw new Error("MarketNoteの会計記録が見つかりません。");
  return updated;
}

export function deleteGuestFinancialRecord(recordId: string) {
  writeStore((store) => ({
    ...store,
    finances: store.finances.filter((record) => record.id !== recordId)
  }));
}

export function getGuestReflection(marketEventId: string) {
  return readStore().reflections.find((item) => item.market_event_id === marketEventId) ?? null;
}

export function listGuestReflections() {
  return readStore().reflections;
}

export function saveGuestReflection(input: {
  marketEventId: string;
  publicSummary: string;
  privateNote: string;
  goodPoints: string;
  nextActions: string;
}) {
  const now = timestamp();
  let saved: MarketReflection | null = null;

  writeStore((store) => {
    const existing = store.reflections.find((item) => item.market_event_id === input.marketEventId);
    if (existing) {
      saved = {
        ...existing,
        public_summary: input.publicSummary || null,
        private_note: input.privateNote || null,
        good_points: input.goodPoints || null,
        next_actions: input.nextActions || null,
        updated_at: now
      };
      return {
        ...store,
        reflections: store.reflections.map((item) => item.id === existing.id ? saved as MarketReflection : item)
      };
    }

    saved = {
      id: createId("market_reflection"),
      user_id: MARKETNOTE_GUEST_USER_ID,
      profile_id: MARKETNOTE_GUEST_PROFILE_ID,
      market_event_id: input.marketEventId,
      public_summary: input.publicSummary || null,
      private_note: input.privateNote || null,
      good_points: input.goodPoints || null,
      next_actions: input.nextActions || null,
      created_at: now,
      updated_at: now
    };
    return { ...store, reflections: [...store.reflections, saved] };
  });

  return saved as unknown as MarketReflection;
}

export function updateGuestMarketEventStatus(eventId: string, status: MarketEvent["status"]) {
  let updated: MarketEvent | null = null;
  writeStore((store) => ({
    ...store,
    events: store.events.map((event) => {
      if (event.id !== eventId) return event;
      updated = { ...event, status, updated_at: timestamp() };
      return updated;
    })
  }));
  if (!updated) throw new Error("MarketNoteの記録が見つかりません。");
  return updated;
}

export function upsertGuestEventPaymentRecord(input: {
  marketEventId: string;
  eventDate: string;
  amount: number;
  method: string;
  paymentStatus: "unpaid" | "paid" | "not_required";
}) {
  const advanceExisting = listGuestFinancialRecords(input.marketEventId)
    .find((row) => row.record_type === "expense" && row.entry_kind === "advance_expense");
  const existing = listGuestFinancialRecords(input.marketEventId)
    .find((row) => row.record_type === "expense" && (row.title.includes("出店") || row.category === "出店料"));

  if (advanceExisting || existing) {
    const selectedExisting = advanceExisting ?? existing!;
    return updateGuestFinancialRecord(selectedExisting.id, {
      recordType: "expense",
      title: selectedExisting.title,
      amount: input.amount,
      occurredAt: input.paymentStatus === "paid" ? dateKey(new Date()) : input.eventDate,
      category: selectedExisting.category || "事前経費",
      memo: selectedExisting.memo ?? "",
      paymentStatus: input.paymentStatus,
      paymentMethod: input.method,
      entryKind: "advance_expense"
    });
  }

  if (input.amount <= 0 && input.paymentStatus === "not_required") return null;

  return addGuestFinancialRecord({
    marketEventId: input.marketEventId,
    recordType: "expense",
    title: "出店料",
    amount: input.amount,
    occurredAt: input.paymentStatus === "paid" ? dateKey(new Date()) : input.eventDate,
    category: "事前経費",
    memo: "",
    paymentStatus: input.paymentStatus,
    paymentMethod: input.method,
    entryKind: "advance_expense"
  });
}

function readStore(): GuestMarketNoteStore {
  if (typeof window === "undefined") return emptyStore;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore;
    const parsed = JSON.parse(raw) as Partial<GuestMarketNoteStore>;
    return {
      events: Array.isArray(parsed.events) ? parsed.events.map((event) => ({ ...event, genre: event.genre || "出店", event_type_id: event.event_type_id ?? null })) : [],
      checks: Array.isArray(parsed.checks) ? parsed.checks : [],
      finances: Array.isArray(parsed.finances) ? parsed.finances.map((record) => ({
        ...record,
        payment_method: record.payment_method ?? (record.entry_kind === "advance_expense" ? record.memo : null),
        entry_kind: record.entry_kind ?? (
          record.record_type === "expense" && (record.title.includes("出店") || record.category === "出店料")
            ? "advance_expense"
            : "manual"
        )
      })) : [],
      reflections: Array.isArray(parsed.reflections) ? parsed.reflections : []
    };
  } catch {
    return emptyStore;
  }
}

function writeStore(updater: (store: GuestMarketNoteStore) => GuestMarketNoteStore) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updater(readStore())));
  window.dispatchEvent(new CustomEvent("mikke:marketnote-guest-updated"));
}

function createId(prefix: string) {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return `${prefix}_${random}`;
}

function timestamp() {
  return new Date().toISOString();
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
