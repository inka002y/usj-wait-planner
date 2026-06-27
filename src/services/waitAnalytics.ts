import { getAttractionById, USJ_ATTRACTIONS } from "../data/attractions";
import {
  AttractionAnalysis,
  HourlyWaitPoint,
  LiveWait,
  WaitSample,
  WaitStatus,
} from "../types";
import { formatMinuteOfDay, getTokyoMinuteOfDay } from "../utils/time";

const PROFILE_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];

const BASELINE_FACTORS: Record<number, number> = {
  8: 0.52,
  9: 0.74,
  10: 0.98,
  11: 1.14,
  12: 1.1,
  13: 1.04,
  14: 1.08,
  15: 1.15,
  16: 1.05,
  17: 0.9,
  18: 0.72,
  19: 0.56,
  20: 0.42,
  21: 0.34,
};

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function getSampleMinute(sample: WaitSample): number {
  return getTokyoMinuteOfDay(new Date(sample.sampledAt));
}

function buildBaselineProfile(typicalWaitMinutes: number): HourlyWaitPoint[] {
  return PROFILE_HOURS.map((hour) => ({
    hour,
    minuteOfDay: hour * 60,
    waitMinutes: Math.max(5, Math.round(typicalWaitMinutes * (BASELINE_FACTORS[hour] ?? 1))),
    sampleCount: 0,
    source: "baseline",
  }));
}

function buildDatabaseProfile(samples: WaitSample[], typicalWaitMinutes: number): HourlyWaitPoint[] {
  const baseline = buildBaselineProfile(typicalWaitMinutes);
  if (samples.length === 0) return baseline;

  return PROFILE_HOURS.map((hour, index) => {
    const bucket = samples
      .filter((sample) => sample.waitMinutes !== null)
      .filter((sample) => Math.floor(getSampleMinute(sample) / 60) === hour)
      .map((sample) => sample.waitMinutes as number);

    if (bucket.length === 0) return baseline[index];

    return {
      hour,
      minuteOfDay: hour * 60,
      waitMinutes: Math.round(median(bucket) ?? typicalWaitMinutes),
      sampleCount: bucket.length,
      source: "database",
    };
  });
}

function trendForSamples(samples: WaitSample[], liveWait: number | null): AttractionAnalysis["trend"] {
  const numeric = samples
    .filter((sample) => typeof sample.waitMinutes === "number")
    .sort((left, right) => new Date(right.sampledAt).getTime() - new Date(left.sampledAt).getTime())
    .slice(0, 8)
    .map((sample) => sample.waitMinutes as number);

  if (numeric.length < 2 && liveWait === null) return "unknown";

  const recent = liveWait ?? numeric[0];
  const previous = average(numeric.slice(1, 5));
  if (recent === null || previous === null) return "unknown";
  if (recent >= previous + 10) return "up";
  if (recent <= previous - 10) return "down";
  return "flat";
}

function bestHourLabel(profile: HourlyWaitPoint[]): { bestHour: number | null; bestTimeLabel: string } {
  const numeric = profile.filter((point) => typeof point.waitMinutes === "number");
  if (numeric.length === 0) {
    return { bestHour: null, bestTimeLabel: "データ待ち" };
  }
  const best = [...numeric].sort((left, right) => (left.waitMinutes ?? 999) - (right.waitMinutes ?? 999))[0];
  return {
    bestHour: best.hour,
    bestTimeLabel: `${formatMinuteOfDay(best.minuteOfDay)}頃`,
  };
}

export function buildWaitAnalyses(liveRows: LiveWait[], samples: WaitSample[]): AttractionAnalysis[] {
  const liveById = new Map(liveRows.map((row) => [row.id, row]));
  const sampleIds = new Set(samples.map((sample) => sample.attractionId));
  const ids = new Set<string>([
    ...USJ_ATTRACTIONS.map((attraction) => attraction.id),
    ...liveRows.map((row) => row.id),
    ...sampleIds,
  ]);

  return [...ids]
    .map((id) => {
      const attraction = getAttractionById(id);
      const live = liveById.get(id);
      const attractionSamples = samples.filter((sample) => sample.attractionId === id);
      const numericSamples = attractionSamples
        .map((sample) => sample.waitMinutes)
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
      const typicalWait = attraction?.typicalWaitMinutes ?? live?.waitMinutes ?? 35;
      const profile = buildDatabaseProfile(attractionSamples, typicalWait);
      const waitValues = numericSamples.length > 0 ? numericSamples : profile.map((point) => point.waitMinutes ?? typicalWait);
      const best = bestHourLabel(profile);
      const currentStatus: WaitStatus = live?.status ?? "unknown";

      const dataSource: AttractionAnalysis["dataSource"] =
        live && attractionSamples.length > 0
          ? "live+database"
          : live
            ? "live+baseline"
            : "baseline";

      return {
        id,
        name: attraction?.name ?? live?.name ?? attractionSamples[0]?.name ?? id,
        area: attraction?.area ?? live?.area ?? attractionSamples[0]?.area ?? "USJ",
        currentWaitMinutes: live?.waitMinutes ?? null,
        currentStatus,
        averageWaitMinutes: Math.round(average(waitValues) ?? typicalWait),
        minWaitMinutes: numericSamples.length > 0 ? Math.min(...numericSamples) : null,
        maxWaitMinutes: numericSamples.length > 0 ? Math.max(...numericSamples) : null,
        sampleCount: attractionSamples.length,
        trend: trendForSamples(attractionSamples, live?.waitMinutes ?? null),
        bestHour: best.bestHour,
        bestTimeLabel: best.bestTimeLabel,
        hourlyProfile: profile,
        dataSource,
      };
    })
    .sort((left, right) => {
      const leftOpen = left.currentStatus === "operating" ? 0 : 1;
      const rightOpen = right.currentStatus === "operating" ? 0 : 1;
      if (leftOpen !== rightOpen) return leftOpen - rightOpen;
      return (right.currentWaitMinutes ?? right.averageWaitMinutes) - (left.currentWaitMinutes ?? left.averageWaitMinutes);
    });
}

export function summarizePark(liveRows: LiveWait[], analyses: AttractionAnalysis[]) {
  const operatingRows = liveRows.filter((row) => row.status === "operating");
  const operatingWithWait = operatingRows.filter((row) => typeof row.waitMinutes === "number");
  const waits = operatingWithWait.map((row) => row.waitMinutes as number);
  const longest = [...operatingWithWait].sort((left, right) => (right.waitMinutes ?? 0) - (left.waitMinutes ?? 0))[0] ?? null;
  const shortest = [...operatingWithWait].sort((left, right) => (left.waitMinutes ?? 999) - (right.waitMinutes ?? 999))[0] ?? null;
  const databaseBacked = analyses.filter((row) => row.sampleCount > 0).length;

  return {
    operatingCount: operatingRows.length,
    averageWaitMinutes: Math.round(average(waits) ?? 0),
    longest,
    shortest,
    databaseBacked,
  };
}
