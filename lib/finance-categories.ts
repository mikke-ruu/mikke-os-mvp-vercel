export type FinanceCategoryType = "revenue" | "expense";

export type FinanceCategory = {
  id: string;
  type: FinanceCategoryType;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  isFavorite: boolean;
  sortOrder: number;
};

export type FinanceCategorySettings = {
  items: FinanceCategory[];
};

const storageKey = "mikke-marketnote-finance-categories-v1";

const revenueDefaults = ["物販", "ワークショップ", "セッション", "オーダー", "予約金", "その他"];
const expenseDefaults = ["出店料", "交通費", "お昼代", "仕入れ代", "駐車場代", "什器レンタル", "梱包材", "送料", "その他"];

export const defaultFinanceCategorySettings: FinanceCategorySettings = {
  items: [
    ...revenueDefaults.map((name, index) => ({
      id: `revenue-${index + 1}`,
      type: "revenue" as const,
      name,
      isDefault: true,
      isActive: true,
      isFavorite: index < 2,
      sortOrder: index + 1
    })),
    ...expenseDefaults.map((name, index) => ({
      id: `expense-${index + 1}`,
      type: "expense" as const,
      name,
      isDefault: true,
      isActive: true,
      isFavorite: index < 3,
      sortOrder: index + 1
    }))
  ]
};

export function loadFinanceCategorySettings() {
  if (typeof window === "undefined") return defaultFinanceCategorySettings;

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return defaultFinanceCategorySettings;

  try {
    const parsed = JSON.parse(raw) as FinanceCategorySettings;
    if (!parsed?.items?.length) return defaultFinanceCategorySettings;
    return parsed;
  } catch {
    return defaultFinanceCategorySettings;
  }
}

export function saveFinanceCategorySettings(settings: FinanceCategorySettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(settings));
}

export function getFinanceCategories(settings: FinanceCategorySettings, type: FinanceCategoryType) {
  return [...settings.items]
    .filter((item) => item.type === type && item.isActive && item.name.trim())
    .sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite) || a.sortOrder - b.sortOrder);
}

export function getFinanceCategoryNames(settings: FinanceCategorySettings, type: FinanceCategoryType) {
  return getFinanceCategories(settings, type).map((item) => item.name.trim());
}
