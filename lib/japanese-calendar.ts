export type JapanDayOff = {
  isDayOff: boolean;
  isWeekend: boolean;
  isNationalHoliday: boolean;
  label: string | null;
};

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

function nthMonday(year: number, monthIndex: number, nth: number): Date {
  const first = new Date(year, monthIndex, 1);
  const offset = (8 - first.getDay()) % 7;
  return new Date(year, monthIndex, 1 + offset + (nth - 1) * 7);
}

function vernalEquinoxDay(year: number): number {
  return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function autumnalEquinoxDay(year: number): number {
  return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function setHoliday(map: Map<string, string>, date: Date, name: string) {
  map.set(dateKey(date), name);
}

function buildBaseHolidays(year: number): Map<string, string> {
  const holidays = new Map<string, string>();
  setHoliday(holidays, new Date(year, 0, 1), "元日");
  setHoliday(holidays, nthMonday(year, 0, 2), "成人の日");
  setHoliday(holidays, new Date(year, 1, 11), "建国記念の日");
  if (year >= 2020) setHoliday(holidays, new Date(year, 1, 23), "天皇誕生日");
  setHoliday(holidays, new Date(year, 2, vernalEquinoxDay(year)), "春分の日");
  setHoliday(holidays, new Date(year, 3, 29), "昭和の日");
  setHoliday(holidays, new Date(year, 4, 3), "憲法記念日");
  setHoliday(holidays, new Date(year, 4, 4), "みどりの日");
  setHoliday(holidays, new Date(year, 4, 5), "こどもの日");

  if (year === 2020) {
    setHoliday(holidays, new Date(year, 6, 23), "海の日");
    setHoliday(holidays, new Date(year, 6, 24), "スポーツの日");
    setHoliday(holidays, new Date(year, 7, 10), "山の日");
  } else if (year === 2021) {
    setHoliday(holidays, new Date(year, 6, 22), "海の日");
    setHoliday(holidays, new Date(year, 6, 23), "スポーツの日");
    setHoliday(holidays, new Date(year, 7, 8), "山の日");
  } else {
    setHoliday(holidays, nthMonday(year, 6, 3), "海の日");
    setHoliday(holidays, new Date(year, 7, 11), "山の日");
    setHoliday(holidays, nthMonday(year, 9, 2), "スポーツの日");
  }

  setHoliday(holidays, nthMonday(year, 8, 3), "敬老の日");
  setHoliday(holidays, new Date(year, 8, autumnalEquinoxDay(year)), "秋分の日");
  setHoliday(holidays, new Date(year, 10, 3), "文化の日");
  setHoliday(holidays, new Date(year, 10, 23), "勤労感謝の日");
  return holidays;
}

const holidayCache = new Map<number, Map<string, string>>();

function holidaysForYear(year: number): Map<string, string> {
  const cached = holidayCache.get(year);
  if (cached) return cached;
  const holidays = buildBaseHolidays(year);

  for (let month = 0; month < 12; month += 1) {
    const lastDay = new Date(year, month + 1, 0).getDate();
    for (let day = 2; day < lastDay; day += 1) {
      const current = new Date(year, month, day);
      const key = dateKey(current);
      if (current.getDay() === 0 || current.getDay() === 6 || holidays.has(key)) continue;
      if (holidays.has(dateKey(addDays(current, -1))) && holidays.has(dateKey(addDays(current, 1)))) {
        holidays.set(key, "国民の休日");
      }
    }
  }

  for (const [key] of [...holidays]) {
    const holiday = new Date(`${key}T00:00:00`);
    if (holiday.getDay() !== 0) continue;
    let substitute = addDays(holiday, 1);
    while (holidays.has(dateKey(substitute))) substitute = addDays(substitute, 1);
    holidays.set(dateKey(substitute), "振替休日");
  }

  holidayCache.set(year, holidays);
  return holidays;
}

export function getJapanDayOff(date: Date): JapanDayOff {
  const holidayName = holidaysForYear(date.getFullYear()).get(dateKey(date)) ?? null;
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  return {
    isDayOff: isWeekend || Boolean(holidayName),
    isWeekend,
    isNationalHoliday: Boolean(holidayName),
    label: holidayName ?? (date.getDay() === 0 ? "日曜" : date.getDay() === 6 ? "土曜" : null)
  };
}

export function getJapanDayOffByKey(value: string): JapanDayOff {
  return getJapanDayOff(new Date(`${value}T00:00:00`));
}

export function isJapanDayOffKey(value: string): boolean {
  return getJapanDayOffByKey(value).isDayOff;
}
