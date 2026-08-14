import { isMarketNoteGuestProfile } from "@/lib/marketnote-guest";
import { supabase } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

export type MarketEventTypeItem = {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
};

export type MarketEventTypeSettings = {
  items: MarketEventTypeItem[];
};

const storageKey = "mikke-marketnote-event-types-v1";
const cloudMigrationKeyPrefix = "mikke-marketnote-event-types-cloud-v1";

export const marketEventTypePalette = ["#f9d3d2", "#ffd370", "#3f4eb5", "#8bc7ad", "#f75a3b"] as const;

const defaultNames = ["出店", "営業日", "打ち合わせ", "制作", "納品", "仕入れ", "レッスン・施術", "休み", "その他"];

export const defaultMarketEventTypeSettings: MarketEventTypeSettings = {
  items: defaultNames.map((name, index) => ({
    id: `event-type-${index + 1}`,
    name,
    color: marketEventTypePalette[index % marketEventTypePalette.length],
    isDefault: true,
    isActive: true,
    sortOrder: index + 1
  }))
};

type MarketEventTypeRow = {
  id: string;
  user_id: string;
  profile_id: string;
  name: string;
  color: string;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
};

function cloneDefaultSettings(): MarketEventTypeSettings {
  return { items: defaultMarketEventTypeSettings.items.map((item) => ({ ...item })) };
}

function readStoredMarketEventTypeSettings() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as MarketEventTypeSettings;
    if (!Array.isArray(parsed?.items) || parsed.items.length === 0) return null;
    return normalizeSettings(parsed);
  } catch {
    return null;
  }
}

function normalizeSettings(settings: MarketEventTypeSettings): MarketEventTypeSettings {
  return {
    items: settings.items.map((item, index) => ({
      ...item,
      name: item.name.trim(),
      color: normalizeMarketEventTypeColor(item.color, index),
      sortOrder: Math.max(0, item.sortOrder)
    }))
  };
}

function rowToItem(row: MarketEventTypeRow): MarketEventTypeItem {
  return {
    id: row.id,
    name: row.name,
    color: normalizeMarketEventTypeColor(row.color),
    isDefault: row.is_default,
    isActive: row.is_active,
    sortOrder: row.sort_order
  };
}

async function fetchMarketEventTypeRows(profileId: string) {
  const { data, error } = await supabase
    .from("market_event_types")
    .select("id,user_id,profile_id,name,color,is_default,is_active,sort_order")
    .eq("profile_id", profileId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as MarketEventTypeRow[];
}

export function loadMarketEventTypeSettings(): MarketEventTypeSettings {
  return readStoredMarketEventTypeSettings() ?? cloneDefaultSettings();
}

export function saveMarketEventTypeSettings(settings: MarketEventTypeSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(normalizeSettings(settings)));
}

export async function loadMarketEventTypeSettingsForProfile(profile: Profile) {
  if (isMarketNoteGuestProfile(profile)) return loadMarketEventTypeSettings();

  const remoteRows = await fetchMarketEventTypeRows(profile.id);
  const storedSettings = readStoredMarketEventTypeSettings();
  const migrationKey = `${cloudMigrationKeyPrefix}:${profile.id}`;
  const migrationFinished = typeof window !== "undefined" && window.localStorage.getItem(migrationKey) === "done";

  if (remoteRows.length === 0) {
    const seeded = await saveMarketEventTypeSettingsForProfile(profile, storedSettings ?? cloneDefaultSettings());
    if (typeof window !== "undefined") window.localStorage.setItem(migrationKey, "done");
    return seeded;
  }

  const onlyBackfilledRows = remoteRows.every((row) => !row.is_default);
  if (!migrationFinished && onlyBackfilledRows) {
    const sourceSettings = storedSettings ?? cloneDefaultSettings();
    const remoteItems = remoteRows.map(rowToItem);
    const localNames = new Set(sourceSettings.items.map((item) => item.name.trim()));
    const merged = {
      items: [
        ...sourceSettings.items,
        ...remoteItems.filter((item) => !localNames.has(item.name.trim()))
      ]
    };
    const migrated = await saveMarketEventTypeSettingsForProfile(profile, merged);
    if (typeof window !== "undefined") window.localStorage.setItem(migrationKey, "done");
    return migrated;
  }

  if (typeof window !== "undefined") window.localStorage.setItem(migrationKey, "done");
  return { items: remoteRows.map(rowToItem) };
}

export async function saveMarketEventTypeSettingsForProfile(profile: Profile, settings: MarketEventTypeSettings) {
  if (isMarketNoteGuestProfile(profile)) {
    saveMarketEventTypeSettings(settings);
    return normalizeSettings(settings);
  }

  const normalized = normalizeSettings(settings);
  const names = normalized.items.map((item) => item.name.toLocaleLowerCase("ja-JP"));
  if (normalized.items.some((item) => !item.name)) throw new Error("予定の種類名を入力してください。");
  if (new Set(names).size !== names.length) throw new Error("同じ名前の予定の種類があります。");

  const existingRows = await fetchMarketEventTypeRows(profile.id);
  const existingById = new Map(existingRows.map((row) => [row.id, row]));
  const existingByName = new Map(existingRows.map((row) => [row.name, row]));
  const retainedIds = new Set<string>();
  const payload = normalized.items.map((item) => {
    const existing = existingById.get(item.id) ?? existingByName.get(item.name);
    if (existing) retainedIds.add(existing.id);
    return {
      id: existing?.id ?? crypto.randomUUID(),
      user_id: profile.user_id,
      profile_id: profile.id,
      name: item.name,
      color: item.color,
      is_default: item.isDefault,
      is_active: item.isActive,
      sort_order: item.sortOrder
    };
  });

  const { data, error } = await supabase
    .from("market_event_types")
    .upsert(payload, { onConflict: "id" })
    .select("id,user_id,profile_id,name,color,is_default,is_active,sort_order");
  if (error) throw error;

  const omittedIds = existingRows.filter((row) => !retainedIds.has(row.id)).map((row) => row.id);
  if (omittedIds.length > 0) {
    const { error: hideError } = await supabase
      .from("market_event_types")
      .update({ is_active: false })
      .eq("profile_id", profile.id)
      .in("id", omittedIds);
    if (hideError) throw hideError;
  }

  const savedRows = (data ?? []) as MarketEventTypeRow[];
  for (const row of savedRows) {
    const { error: eventUpdateError } = await supabase
      .from("market_events")
      .update({ genre: row.name })
      .eq("profile_id", profile.id)
      .eq("event_type_id", row.id);
    if (eventUpdateError) throw eventUpdateError;
  }

  return { items: savedRows.map(rowToItem).sort((a, b) => a.sortOrder - b.sortOrder) };
}

export async function findMarketEventTypeId(profileId: string, name: string) {
  const { data, error } = await supabase
    .from("market_event_types")
    .select("id")
    .eq("profile_id", profileId)
    .eq("name", name.trim())
    .maybeSingle();
  if (error) throw error;
  return data?.id as string | undefined;
}

export function getMarketEventTypeNames(settings = loadMarketEventTypeSettings()) {
  return [...settings.items]
    .filter((item) => item.isActive && item.name.trim())
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => item.name.trim());
}

export function getMarketEventType(event: { genre: string | null }) {
  return event.genre?.trim() || "出店";
}

export function getMarketEventTypeColor(name: string, settings = loadMarketEventTypeSettings()) {
  const normalizedName = name.trim() || "出店";
  const item = settings.items.find((candidate) => candidate.name.trim() === normalizedName);
  const index = Math.max(0, settings.items.indexOf(item ?? settings.items[0]));
  return normalizeMarketEventTypeColor(item?.color, index);
}

export function normalizeMarketEventTypeColor(color: string | undefined, fallbackIndex = 0) {
  return color && /^#[0-9a-f]{6}$/i.test(color)
    ? color.toLowerCase()
    : marketEventTypePalette[fallbackIndex % marketEventTypePalette.length];
}

export function readableTextColor(background: string) {
  const color = normalizeMarketEventTypeColor(background);
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  return red * 0.299 + green * 0.587 + blue * 0.114 > 160 ? "#222222" : "#ffffff";
}
