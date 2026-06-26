import { getAttractionById } from "../data/attractions";
import {
  AttractionAnalysis,
  PlanItem,
  PlanOptions,
  Priority,
  SelectedAttraction,
  UsjPlan,
} from "../types";

type Candidate = {
  id: string;
  name: string;
  area: string;
  durationMinutes: number;
  priority: Priority;
  analysis: AttractionAnalysis | null;
};

const PRIORITY_BONUS: Record<Priority, number> = {
  must: 28,
  high: 14,
  normal: 0,
};

const PACE_BUFFER: Record<PlanOptions["pace"], number> = {
  efficient: 8,
  balanced: 13,
  family: 18,
};

function expectedWaitAtMinute(analysis: AttractionAnalysis | null, minute: number, fallback: number): number {
  if (!analysis) return fallback;
  const nearest = [...analysis.hourlyProfile].sort(
    (left, right) => Math.abs(left.minuteOfDay - minute) - Math.abs(right.minuteOfDay - minute),
  )[0];
  return Math.max(0, Math.round(nearest?.waitMinutes ?? analysis.currentWaitMinutes ?? analysis.averageWaitMinutes ?? fallback));
}

function travelMinutes(fromArea: string | null, toArea: string, pace: PlanOptions["pace"]): number {
  if (!fromArea) return pace === "family" ? 10 : 7;
  if (fromArea === toArea) return pace === "family" ? 6 : 4;
  if (
    (fromArea.includes("Nintendo") && toArea.includes("Donkey")) ||
    (fromArea.includes("Donkey") && toArea.includes("Nintendo"))
  ) {
    return pace === "family" ? 8 : 5;
  }
  return pace === "family" ? 16 : 12;
}

function candidateScore(candidate: Candidate, minute: number, currentArea: string | null, options: PlanOptions): number {
  const attraction = getAttractionById(candidate.id);
  const fallback = attraction?.typicalWaitMinutes ?? 40;
  const wait = expectedWaitAtMinute(candidate.analysis, minute, fallback);
  const travel = travelMinutes(currentArea, candidate.area, options.pace);
  return wait + travel - PRIORITY_BONUS[candidate.priority];
}

function makeFreeTime(startMinute: number, endMinute: number): PlanItem | null {
  if (endMinute - startMinute < 15) return null;
  return {
    id: `free-${startMinute}`,
    type: "free",
    name: "ショップ・写真・移動",
    startMinute,
    endMinute,
    note: "余白",
  };
}

export function buildUsjPlan(params: {
  selectedAttractions: SelectedAttraction[];
  analyses: AttractionAnalysis[];
  options: PlanOptions;
}): UsjPlan {
  const analysisById = new Map(params.analyses.map((row) => [row.id, row]));
  const remaining: Candidate[] = params.selectedAttractions
    .map((selected) => {
      const attraction = getAttractionById(selected.attractionId);
      const analysis = analysisById.get(selected.attractionId) ?? null;
      if (!attraction && !analysis) return null;
      return {
        id: selected.attractionId,
        name: attraction?.name ?? analysis?.name ?? selected.attractionId,
        area: attraction?.area ?? analysis?.area ?? "USJ",
        durationMinutes: attraction?.durationMinutes ?? 8,
        priority: selected.priority,
        analysis,
      };
    })
    .filter((row): row is Candidate => row !== null);

  const items: PlanItem[] = [];
  const unscheduledNames: string[] = [];
  let minute = params.options.startMinute;
  let currentArea: string | null = null;
  let lunchInserted = params.options.lunchMinute === null;
  let totalExpectedWaitMinutes = 0;
  const buffer = PACE_BUFFER[params.options.pace];

  while (remaining.length > 0 && minute < params.options.endMinute) {
    if (!lunchInserted && params.options.lunchMinute !== null && minute >= params.options.lunchMinute - 20) {
      const lunchStart = Math.max(minute, params.options.lunchMinute);
      const lunchEnd = Math.min(lunchStart + 50, params.options.endMinute);
      if (lunchEnd > lunchStart) {
        items.push({
          id: "meal-lunch",
          type: "meal",
          name: "ランチ",
          startMinute: lunchStart,
          endMinute: lunchEnd,
          note: "混む前後に調整",
        });
        minute = lunchEnd + buffer;
        lunchInserted = true;
        currentArea = null;
        continue;
      }
      lunchInserted = true;
    }

    remaining.sort(
      (left, right) =>
        candidateScore(left, minute, currentArea, params.options) -
        candidateScore(right, minute, currentArea, params.options),
    );

    const next = remaining.shift();
    if (!next) break;

    const attraction = getAttractionById(next.id);
    const expectedWait = expectedWaitAtMinute(next.analysis, minute, attraction?.typicalWaitMinutes ?? 40);
    const travel = travelMinutes(currentArea, next.area, params.options.pace);
    const start = Math.max(params.options.startMinute, minute + travel);
    const end = start + expectedWait + next.durationMinutes;

    if (end + buffer > params.options.endMinute) {
      unscheduledNames.push(next.name);
      continue;
    }

    const previous = items[items.length - 1];
    if (previous && start - previous.endMinute >= 20) {
      const free = makeFreeTime(previous.endMinute, start);
      if (free) items.push(free);
    }

    items.push({
      id: `ride-${next.id}-${start}`,
      type: "ride",
      name: next.name,
      area: next.area,
      startMinute: start,
      endMinute: end,
      expectedWaitMinutes: expectedWait,
      rideDurationMinutes: next.durationMinutes,
      travelMinutes: travel,
      note: next.priority === "must" ? "優先" : undefined,
    });
    totalExpectedWaitMinutes += expectedWait;
    minute = end + buffer;
    currentArea = next.area;
  }

  for (const leftover of remaining) {
    unscheduledNames.push(leftover.name);
  }

  if (items.length > 0) {
    const last = items[items.length - 1];
    const free = makeFreeTime(last.endMinute, params.options.endMinute);
    if (free) items.push(free);
  }

  return {
    items,
    totalExpectedWaitMinutes,
    unscheduledNames,
  };
}
