import { Platform } from "react-native";

import { getAttractionOrFallback } from "../data/attractions";
import { LiveWait, ParkSchedule, WaitStatus } from "../types";
import { formatMinuteOfDay, getTokyoDateISO, minuteOfDayFromISO, minutesBetween } from "../utils/time";

const QUEUE_TIMES_URL = "https://queue-times.com/parks/284/queue_times.json";
const THEMEPARKS_USJ_PARK_ID = "47f61fac-7586-41ac-ae80-61c9257cf33e";
const THEMEPARKS_SCHEDULE_URL = `https://api.themeparks.wiki/v1/entity/${THEMEPARKS_USJ_PARK_ID}/schedule`;
const LOCAL_WEB_PROXY_BASE = "http://localhost:8787";
const STALE_WAIT_MAX_MINUTES = 90;

interface QueueTimesRide {
  id?: number | string;
  name?: string;
  is_open?: boolean;
  wait_time?: number | null;
  last_updated?: string | null;
}

interface QueueTimesLand {
  rides?: QueueTimesRide[];
}

interface QueueTimesResponse {
  rides?: QueueTimesRide[];
  lands?: QueueTimesLand[];
}

interface ThemeParksScheduleEntry {
  date?: string;
  type?: string;
  openingTime?: string | null;
  closingTime?: string | null;
}

interface ThemeParksScheduleResponse {
  schedule?: ThemeParksScheduleEntry[];
}

function statusFromQueueTimes(ride: QueueTimesRide): WaitStatus {
  if (ride.is_open === true) return "operating";
  if (ride.is_open === false) return "closed";
  return "unknown";
}

function isStaleWait(staleMinutes: number | null): boolean {
  return staleMinutes !== null && staleMinutes > STALE_WAIT_MAX_MINUTES;
}

function normalizeWaitMinutes(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(600, Math.round(value)));
}

function flattenQueueTimes(response: QueueTimesResponse): QueueTimesRide[] {
  const direct = Array.isArray(response.rides) ? response.rides : [];
  const fromLands = Array.isArray(response.lands)
    ? response.lands.flatMap((land) => (Array.isArray(land.rides) ? land.rides : []))
    : [];
  return [...direct, ...fromLands];
}

function isLocalWebPreview(): boolean {
  return (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  );
}

function getQueueTimesUrl(): string {
  return isLocalWebPreview() ? `${LOCAL_WEB_PROXY_BASE}/queue-times` : QUEUE_TIMES_URL;
}

function getScheduleUrl(): string {
  return isLocalWebPreview() ? `${LOCAL_WEB_PROXY_BASE}/schedule` : THEMEPARKS_SCHEDULE_URL;
}

export async function fetchLiveWaits(): Promise<LiveWait[]> {
  const response = await fetch(getQueueTimesUrl(), {
    headers: {
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`Queue-Times API error: ${response.status}`);
  }

  const json = (await response.json()) as QueueTimesResponse;
  const observedAt = new Date().toISOString();

  return flattenQueueTimes(json)
    .filter((ride) => ride.id !== undefined && typeof ride.name === "string" && ride.name.trim().length > 0)
    .map((ride) => {
      const id = String(ride.id);
      const attraction = getAttractionOrFallback(id, ride.name ?? id);
      const waitMinutes = normalizeWaitMinutes(ride.wait_time);
      const rawStatus = statusFromQueueTimes(ride);
      const staleMinutes = minutesBetween(ride.last_updated ?? null);
      const stale = isStaleWait(staleMinutes);
      const status: WaitStatus = stale && rawStatus !== "operating" ? "unknown" : rawStatus;

      return {
        id: attraction.id,
        name: attraction.name,
        area: attraction.area,
        waitMinutes: status === "operating" && !stale ? waitMinutes : null,
        status,
        isOpen: status === "operating",
        lastUpdated: ride.last_updated ?? null,
        observedAt,
        source: "queue-times" as const,
        staleMinutes,
      };
    })
    .sort((left, right) => {
      const leftWait = left.waitMinutes ?? -1;
      const rightWait = right.waitMinutes ?? -1;
      return rightWait - leftWait;
    });
}

function parseScheduleMinute(value: string | null | undefined, fallback: number): number {
  return minuteOfDayFromISO(value) ?? fallback;
}

export async function fetchParkSchedule(dateISO = getTokyoDateISO()): Promise<ParkSchedule> {
  try {
    const response = await fetch(getScheduleUrl(), {
      headers: {
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      throw new Error(`ThemeParks.wiki schedule error: ${response.status}`);
    }

    const json = (await response.json()) as ThemeParksScheduleResponse;
    const picked = json.schedule?.find((entry) => entry.date === dateISO && entry.type === "OPERATING");
    if (picked) {
      return {
        date: dateISO,
        openingTime: picked.openingTime ?? null,
        closingTime: picked.closingTime ?? null,
        openMinute: parseScheduleMinute(picked.openingTime, 9 * 60),
        closeMinute: parseScheduleMinute(picked.closingTime, 21 * 60),
        source: "themeparks.wiki",
      };
    }
  } catch {
    // Fall back to conservative hours below.
  }

  return {
    date: dateISO,
    openingTime: null,
    closingTime: null,
    openMinute: 9 * 60,
    closeMinute: 21 * 60,
    source: "fallback",
  };
}

export function formatScheduleLabel(schedule: ParkSchedule | null): string {
  if (!schedule) return "営業時間 未取得";
  return `${formatMinuteOfDay(schedule.openMinute)}-${formatMinuteOfDay(schedule.closeMinute)}`;
}
