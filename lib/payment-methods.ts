export type PaymentMethodItem = {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  isFavorite: boolean;
  sortOrder: number;
};

export type PaymentMethodSettings = {
  items: PaymentMethodItem[];
};

const storageKey = "mikke-marketnote-payment-methods-v1";
const defaults = ["現金", "QR", "カード", "ポイント", "振込", "その他"];

export const defaultPaymentMethodSettings: PaymentMethodSettings = {
  items: defaults.map((name, index) => ({
    id: `payment-${index + 1}`,
    name,
    isDefault: true,
    isActive: true,
    isFavorite: index < 3,
    sortOrder: index + 1
  }))
};

export function loadPaymentMethodSettings() {
  if (typeof window === "undefined") return defaultPaymentMethodSettings;

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return defaultPaymentMethodSettings;

  try {
    const parsed = JSON.parse(raw) as PaymentMethodSettings;
    if (!parsed?.items?.length) return defaultPaymentMethodSettings;
    return parsed;
  } catch {
    return defaultPaymentMethodSettings;
  }
}

export function savePaymentMethodSettings(settings: PaymentMethodSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(settings));
}

export function getPaymentMethods(settings: PaymentMethodSettings) {
  return [...settings.items]
    .filter((item) => item.isActive && item.name.trim())
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getPaymentMethodNames(settings: PaymentMethodSettings) {
  return getPaymentMethods(settings).map((item) => item.name.trim());
}

