import { VisitDayType } from "../types";

const FIXED_HOLIDAYS: Array<[number, number]> = [
  [1, 1],
  [2, 11],
  [2, 23],
  [4, 29],
  [5, 3],
  [5, 4],
  [5, 5],
  [8, 11],
  [11, 3],
  [11, 23],
];

export function getVisitDayType(dateISO: string): VisitDayType {
  const date = fromISODateLocal(dateISO);
  return isWeekend(date) || isJapanPublicHoliday(date) ? "holiday" : "weekday";
}

export function formatVisitDayType(dayType: VisitDayType): string {
  return dayType === "holiday" ? "休日・祝日" : "平日";
}

export function isJapanPublicHoliday(date: Date): boolean {
  return getJapanPublicHolidayKeys(date.getFullYear()).has(toDateKey(date));
}

function getJapanPublicHolidayKeys(year: number): Set<string> {
  const base = new Set<string>();

  for (const [month, day] of FIXED_HOLIDAYS) {
    base.add(key(year, month, day));
  }

  base.add(key(year, 1, nthMonday(year, 1, 2)));
  base.add(key(year, 7, nthMonday(year, 7, 3)));
  base.add(key(year, 9, nthMonday(year, 9, 3)));
  base.add(key(year, 10, nthMonday(year, 10, 2)));
  base.add(key(year, 3, springEquinoxDay(year)));
  base.add(key(year, 9, autumnEquinoxDay(year)));

  const withSubstitutes = new Set(base);
  for (const holidayKey of [...base].sort()) {
    const holiday = fromISODateLocal(holidayKey);
    if (holiday.getDay() !== 0) continue;

    const substitute = new Date(holiday);
    do {
      substitute.setDate(substitute.getDate() + 1);
    } while (withSubstitutes.has(toDateKey(substitute)));

    if (substitute.getFullYear() === year) {
      withSubstitutes.add(toDateKey(substitute));
    }
  }

  for (let month = 1; month <= 12; month += 1) {
    const days = new Date(year, month, 0).getDate();
    for (let day = 2; day < days; day += 1) {
      const date = new Date(year, month - 1, day, 12, 0, 0, 0);
      if (isWeekend(date)) continue;

      const dateKey = toDateKey(date);
      if (withSubstitutes.has(dateKey)) continue;

      const previous = new Date(date);
      previous.setDate(date.getDate() - 1);
      const next = new Date(date);
      next.setDate(date.getDate() + 1);
      if (withSubstitutes.has(toDateKey(previous)) && withSubstitutes.has(toDateKey(next))) {
        withSubstitutes.add(dateKey);
      }
    }
  }

  return withSubstitutes;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function nthMonday(year: number, month: number, nth: number): number {
  const first = new Date(year, month - 1, 1, 12, 0, 0, 0);
  const offset = (8 - first.getDay()) % 7;
  return 1 + offset + (nth - 1) * 7;
}

function springEquinoxDay(year: number): number {
  return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function autumnEquinoxDay(year: number): number {
  return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function key(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function toDateKey(date: Date): string {
  return key(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function fromISODateLocal(dateISO: string): Date {
  const [year, month, day] = dateISO.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
}
