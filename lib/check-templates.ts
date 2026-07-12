export type CheckDueRule = "event_day" | "previous_day" | "three_days_before" | "seven_days_before" | "custom" | "none";

export type CheckTemplateItem = {
  id: string;
  title: string;
  isDefault: boolean;
  sortOrder: number;
  dueRule: CheckDueRule;
  isActive: boolean;
};

export type CheckTemplate = {
  id: string;
  name: string;
  items: CheckTemplateItem[];
};

const storageKey = "mikke-marketnote-check-template-v1";

export const dueRuleOptions: Array<{ label: string; value: CheckDueRule }> = [
  { label: "開催日当日", value: "event_day" },
  { label: "開催日前日", value: "previous_day" },
  { label: "開催日の3日前", value: "three_days_before" },
  { label: "開催日の7日前", value: "seven_days_before" },
  { label: "自由設定", value: "custom" },
  { label: "期限なし", value: "none" }
];

export const defaultCheckTemplate: CheckTemplate = {
  id: "event-prep",
  name: "出店準備テンプレート",
  items: [
    { id: "pay-fee", title: "出店料を支払う", isDefault: true, sortOrder: 1, dueRule: "event_day", isActive: true },
    { id: "check-booth", title: "ブース位置を確認", isDefault: true, sortOrder: 2, dueRule: "previous_day", isActive: true },
    { id: "prepare-items", title: "持ち物を準備", isDefault: true, sortOrder: 3, dueRule: "previous_day", isActive: true },
    { id: "check-loadin", title: "搬入時間を確認", isDefault: true, sortOrder: 4, dueRule: "previous_day", isActive: true },
    { id: "post-notice", title: "告知文を投稿", isDefault: true, sortOrder: 5, dueRule: "three_days_before", isActive: true }
  ]
};

export function getDueRuleLabel(value: CheckDueRule) {
  return dueRuleOptions.find((option) => option.value === value)?.label ?? "期限なし";
}

export function loadCheckTemplate() {
  if (typeof window === "undefined") return defaultCheckTemplate;

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return defaultCheckTemplate;

  try {
    const parsed = JSON.parse(raw) as CheckTemplate;
    if (!parsed?.items?.length) return defaultCheckTemplate;
    return parsed;
  } catch {
    return defaultCheckTemplate;
  }
}

export function saveCheckTemplate(template: CheckTemplate) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(template));
}

export function getActiveCheckTitles(template: CheckTemplate) {
  return [...template.items]
    .filter((item) => item.isActive && item.title.trim())
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => item.title.trim());
}

export function getActiveCheckItems(template: CheckTemplate) {
  return [...template.items]
    .filter((item) => item.isActive && item.title.trim())
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

// custom/none には確定した期日ルールがないため null を返す。
// 表示側は due_date が null の場合、開催日を仮の期限として扱う（MVPフォールバック）。
export function resolveDueDate(rule: CheckDueRule, eventDate: string): string | null {
  if (!eventDate) return null;

  const offsetDays: Partial<Record<CheckDueRule, number>> = {
    event_day: 0,
    previous_day: -1,
    three_days_before: -3,
    seven_days_before: -7
  };

  const offset = offsetDays[rule];
  if (offset === undefined) return null;

  const base = new Date(`${eventDate}T00:00:00`);
  base.setDate(base.getDate() + offset);
  const year = base.getFullYear();
  const month = String(base.getMonth() + 1).padStart(2, "0");
  const day = String(base.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
