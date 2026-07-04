export type ReminderTargetKey = "paymentDue" | "checkItemDue" | "eventPreviousDay" | "eventDay";
export type ReminderTimingKey = "sameDay" | "oneDayBefore" | "threeDaysBefore" | "sevenDaysBefore";
export type ReminderTime = "09:00" | "12:00" | "18:00" | "21:00";

export type ReminderSettings = {
  enabled: boolean;
  targets: Record<ReminderTargetKey, boolean>;
  timings: Record<ReminderTimingKey, boolean>;
  time: ReminderTime;
  updatedAt: string | null;
};

export const reminderTargets: Array<{ key: ReminderTargetKey; label: string; description: string }> = [
  {
    key: "paymentDue",
    label: "支払い期限",
    description: "未払いの出店料などをやること表示へつなげます"
  },
  {
    key: "checkItemDue",
    label: "チェック項目の期限",
    description: "チェックテンプレートの期限ルールと合わせます"
  },
  {
    key: "eventPreviousDay",
    label: "出店日前日",
    description: "持ち物・搬入時間・ブース位置などを確認します"
  },
  {
    key: "eventDay",
    label: "出店当日",
    description: "集合時間や未完了チェックの確認に使います"
  }
];

export const reminderTimings: Array<{ key: ReminderTimingKey; label: string }> = [
  { key: "sameDay", label: "当日" },
  { key: "oneDayBefore", label: "1日前" },
  { key: "threeDaysBefore", label: "3日前" },
  { key: "sevenDaysBefore", label: "7日前" }
];

export const reminderTimes: ReminderTime[] = ["09:00", "12:00", "18:00", "21:00"];

const storageKey = "mikke-marketnote-reminder-settings-v1";

export const defaultReminderSettings: ReminderSettings = {
  enabled: true,
  targets: {
    paymentDue: true,
    checkItemDue: true,
    eventPreviousDay: true,
    eventDay: true
  },
  timings: {
    sameDay: true,
    oneDayBefore: true,
    threeDaysBefore: false,
    sevenDaysBefore: false
  },
  time: "09:00",
  updatedAt: null
};

export function loadReminderSettings() {
  if (typeof window === "undefined") return defaultReminderSettings;

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return defaultReminderSettings;

  try {
    const parsed = JSON.parse(raw) as Partial<ReminderSettings>;
    return normalizeReminderSettings(parsed);
  } catch {
    return defaultReminderSettings;
  }
}

export function saveReminderSettings(settings: ReminderSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify({
    ...settings,
    updatedAt: new Date().toISOString()
  }));
}

export function normalizeReminderSettings(settings: Partial<ReminderSettings>): ReminderSettings {
  return {
    enabled: typeof settings.enabled === "boolean" ? settings.enabled : defaultReminderSettings.enabled,
    targets: {
      ...defaultReminderSettings.targets,
      ...settings.targets
    },
    timings: {
      ...defaultReminderSettings.timings,
      ...settings.timings
    },
    time: reminderTimes.includes(settings.time as ReminderTime) ? settings.time as ReminderTime : defaultReminderSettings.time,
    updatedAt: settings.updatedAt ?? null
  };
}

