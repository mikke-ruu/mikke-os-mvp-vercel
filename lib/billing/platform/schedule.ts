/**
 * Calendar-only projection of the 2026-09-01 approved monthly renewal rule.
 * Input is the ORIGINAL paid-start JST day from a verified server record, never
 * checkout return parameters, trial expiry, webhook receipt time or last renewal.
 * Does not authenticate payment, start a subscription, grant access or charge.
 * Times, provider reconciliation and all other contract terms are separate gates.
 */
export const MONTHLY_SCHEDULE_DECISION = Object.freeze({
  id: "platform-monthly-start-renewal-2026-09-01",
  explicitPaidApplicationRequired: true,
  verifiedPaymentRequired: true,
  autoChargeAtTrialEnd: false,
  interval: "calendar_month",
  missingAnchorDay: "month_end",
  preserveOriginalAnchor: true,
} as const);

export type MonthlyBillingPeriod = Readonly<{
  originalPaidStartDay: string;
  periodIndex: number;
  startsOn: string;
  nextRenewalOn: string;
}>;

type DayParts = Readonly<{ year: number; month: number; day: number }>;

function daysInMonth(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function parseDay(value: unknown): DayParts | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

function anchoredDay(original: DayParts, offset: number): string | null {
  // All calculations start at the original anchor, not a previously clamped day.
  const absoluteMonth = (original.year - 1) * 12 + original.month - 1 + offset;
  if (!Number.isSafeInteger(absoluteMonth) || absoluteMonth < 0 || absoluteMonth >= 9999 * 12) return null;
  const year = Math.floor(absoluteMonth / 12) + 1;
  const month = absoluteMonth % 12 + 1;
  const day = Math.min(original.day, daysInMonth(year, month));
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Index 0 is the first paid month. Null means invalid/unsupported, never free. */
export function getMonthlyBillingPeriod(originalPaidStartDay: unknown, periodIndex: unknown): MonthlyBillingPeriod | null {
  const original = parseDay(originalPaidStartDay);
  if (!original || typeof periodIndex !== "number" || !Number.isSafeInteger(periodIndex) || periodIndex < 0) return null;
  const startsOn = anchoredDay(original, periodIndex);
  const nextRenewalOn = anchoredDay(original, periodIndex + 1);
  if (!startsOn || !nextRenewalOn) return null;
  return Object.freeze({ originalPaidStartDay: originalPaidStartDay as string, periodIndex, startsOn, nextRenewalOn });
}
