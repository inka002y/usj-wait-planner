export const DAY_MINUTES = 24 * 60;

const TOKYO_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function getTokyoParts(date: Date) {
  const parts = TOKYO_FORMATTER.formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: Number(value("hour")),
    minute: Number(value("minute")),
    second: Number(value("second")),
  };
}

export function getTokyoDateISO(date = new Date()): string {
  const parts = getTokyoParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function getTokyoMinuteOfDay(date = new Date()): number {
  const parts = getTokyoParts(date);
  return parts.hour * 60 + parts.minute;
}

export function minuteOfDayFromISO(value: string | null | undefined): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return getTokyoMinuteOfDay(date);
}

export function minutesBetween(leftISO: string | null | undefined, right = new Date()): number | null {
  if (!leftISO) return null;
  const left = new Date(leftISO);
  if (Number.isNaN(left.getTime())) return null;
  return Math.max(0, Math.round((right.getTime() - left.getTime()) / 60000));
}

export function formatMinuteOfDay(minuteOfDay: number): string {
  const clamped = Math.max(0, Math.min(DAY_MINUTES - 1, Math.round(minuteOfDay)));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function parseClock(value: string, fallback: number): number {
  const match = value.trim().match(/^(\d{1,2}):?(\d{2})?$/);
  if (!match) return fallback;
  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? "0");
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return fallback;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return fallback;
  return hours * 60 + minutes;
}

export function formatRelativeTime(iso: string | null | undefined): string {
  const diff = minutesBetween(iso);
  if (diff === null) return "未取得";
  if (diff < 1) return "たった今";
  if (diff < 60) return `${diff}分前`;
  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;
  if (minutes === 0) return `${hours}時間前`;
  return `${hours}時間${minutes}分前`;
}

export function clampMinute(value: number, min = 7 * 60, max = 23 * 60): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}
