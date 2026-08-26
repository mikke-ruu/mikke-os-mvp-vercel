export type MarketEventRecurrence = "none" | "daily" | "weekly" | "biweekly" | "monthly";

export const marketEventRecurrenceOptions: Array<{ value: MarketEventRecurrence; label: string }> = [
  { value: "daily", label: "毎日" },
  { value: "weekly", label: "毎週" },
  { value: "biweekly", label: "2週間ごと" },
  { value: "monthly", label: "毎月" }
];

export const MAX_RECURRING_EVENTS = 60;

export function buildRecurringEventDates(startDate: string, repeatUntil: string, recurrence: MarketEventRecurrence, limit = MAX_RECURRING_EVENTS) {
  if (!isDateKey(startDate)) return [];
  if (recurrence === "none") return [startDate];
  if (!isDateKey(repeatUntil) || repeatUntil < startDate) return [];

  const dates: string[] = [];
  for (let index = 0; index < limit + 1; index += 1) {
    const next = occurrenceDate(startDate, recurrence, index);
    if (next > repeatUntil) break;
    dates.push(next);
  }
  return dates;
}

export function recurringEventDatesExceedLimit(startDate: string, repeatUntil: string, recurrence: MarketEventRecurrence, limit = MAX_RECURRING_EVENTS) {
  if (recurrence === "none" || !isDateKey(startDate) || !isDateKey(repeatUntil) || repeatUntil < startDate) return false;
  return occurrenceDate(startDate, recurrence, limit) <= repeatUntil;
}

export function addDaysToDateKey(dateKey: string, days: number) {
  const date = parseDateKey(dateKey);
  if (!date) return dateKey;
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateKey(date);
}

export function daysBetweenDateKeys(startDate: string, endDate: string) {
  const start = parseDateKey(startDate);
  const end = parseDateKey(endDate);
  if (!start || !end) return 0;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
}

function occurrenceDate(startDate: string, recurrence: Exclude<MarketEventRecurrence, "none">, index: number) {
  const start = parseDateKey(startDate);
  if (!start) return startDate;
  if (recurrence === "monthly") {
    const targetMonth = start.getUTCMonth() + index;
    const year = start.getUTCFullYear() + Math.floor(targetMonth / 12);
    const month = ((targetMonth % 12) + 12) % 12;
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return formatDateKey(new Date(Date.UTC(year, month, Math.min(start.getUTCDate(), lastDay))));
  }
  const interval = recurrence === "daily" ? 1 : recurrence === "weekly" ? 7 : 14;
  start.setUTCDate(start.getUTCDate() + interval * index);
  return formatDateKey(start);
}

function parseDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return formatDateKey(date) === value ? date : null;
}

function formatDateKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function isDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
