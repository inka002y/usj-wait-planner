import AsyncStorage from "@react-native-async-storage/async-storage";

import { DatabaseStats, LiveWait, WaitSample } from "../types";

const STORAGE_KEY = "usj_wait_samples_v1";
const MAX_SAMPLE_AGE_DAYS = 21;
const MAX_SAMPLES = 4500;

function sampleKey(sample: WaitSample): string {
  return `${sample.attractionId}:${sample.sampledAt}:${sample.source}`;
}

function normalizeSample(raw: unknown): WaitSample | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Partial<WaitSample>;
  if (typeof row.attractionId !== "string" || typeof row.name !== "string") return null;
  if (typeof row.area !== "string" || typeof row.sampledAt !== "string") return null;
  if (row.source !== "queue-times") return null;
  const status = row.status ?? "unknown";
  if (!["operating", "closed", "down", "unknown"].includes(status)) return null;
  const waitMinutes =
    typeof row.waitMinutes === "number" && Number.isFinite(row.waitMinutes)
      ? Math.max(0, Math.min(600, Math.round(row.waitMinutes)))
      : null;

  return {
    attractionId: row.attractionId,
    name: row.name,
    area: row.area,
    waitMinutes,
    status,
    sampledAt: row.sampledAt,
    source: "queue-times",
  };
}

function pruneSamples(samples: WaitSample[]): WaitSample[] {
  const minTime = Date.now() - MAX_SAMPLE_AGE_DAYS * 24 * 60 * 60 * 1000;
  return samples
    .filter((sample) => {
      const time = new Date(sample.sampledAt).getTime();
      return Number.isFinite(time) && time >= minTime;
    })
    .sort((left, right) => new Date(right.sampledAt).getTime() - new Date(left.sampledAt).getTime())
    .slice(0, MAX_SAMPLES);
}

export async function loadWaitSamples(): Promise<WaitSample[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return pruneSamples(parsed.map(normalizeSample).filter((row): row is WaitSample => row !== null));
  } catch {
    return [];
  }
}

export async function persistWaitSamples(samples: WaitSample[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(pruneSamples(samples)));
}

export function mergeWaitSamples(samples: WaitSample[]): WaitSample[] {
  const merged = new Map<string, WaitSample>();
  for (const sample of samples) {
    merged.set(sampleKey(sample), sample);
  }
  return pruneSamples([...merged.values()]);
}

export async function appendLiveWaitSamples(liveRows: LiveWait[]): Promise<WaitSample[]> {
  const existing = await loadWaitSamples();
  const nextSamples = liveRows.map<WaitSample>((row) => ({
    attractionId: row.id,
    name: row.name,
    area: row.area,
    waitMinutes: row.waitMinutes,
    status: row.status,
    sampledAt: row.lastUpdated ?? row.observedAt,
    source: row.source,
  }));

  const next = mergeWaitSamples([...existing, ...nextSamples]);
  await persistWaitSamples(next);
  return next;
}

export async function clearWaitSamples(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export function getDatabaseStats(samples: WaitSample[]): DatabaseStats {
  const times = samples
    .map((sample) => new Date(sample.sampledAt).getTime())
    .filter((time) => Number.isFinite(time))
    .sort((left, right) => left - right);
  const attractions = new Set(samples.map((sample) => sample.attractionId));

  return {
    sampleCount: samples.length,
    attractionCount: attractions.size,
    oldestSampleAt: times.length > 0 ? new Date(times[0]).toISOString() : null,
    newestSampleAt: times.length > 0 ? new Date(times[times.length - 1]).toISOString() : null,
  };
}
