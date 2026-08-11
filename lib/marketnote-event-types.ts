export type MarketEventTypeItem = {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
};

export type MarketEventTypeSettings = {
  items: MarketEventTypeItem[];
};

const storageKey = "mikke-marketnote-event-types-v1";

const defaultNames = ["出店", "営業日", "打ち合わせ", "制作", "納品", "仕入れ", "レッスン・施術", "休み", "その他"];

export const defaultMarketEventTypeSettings: MarketEventTypeSettings = {
  items: defaultNames.map((name, index) => ({
    id: `event-type-${index + 1}`,
    name,
    isDefault: true,
    isActive: true,
    sortOrder: index + 1
  }))
};

export function loadMarketEventTypeSettings(): MarketEventTypeSettings {
  if (typeof window === "undefined") return defaultMarketEventTypeSettings;
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return defaultMarketEventTypeSettings;

  try {
    const parsed = JSON.parse(raw) as MarketEventTypeSettings;
    if (!Array.isArray(parsed?.items) || parsed.items.length === 0) return defaultMarketEventTypeSettings;
    return parsed;
  } catch {
    return defaultMarketEventTypeSettings;
  }
}

export function saveMarketEventTypeSettings(settings: MarketEventTypeSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(settings));
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
