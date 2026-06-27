import { getAttractionById } from "../data/attractions";
import {
  AttractionAnalysis,
  PlanItem,
  PlanOptions,
  Priority,
  SelectedAttraction,
  UsjPlan,
} from "../types";

type ScoreLevel = 1 | 2 | 3 | 4 | 5;

type Candidate = {
  id: string;
  name: string;
  area: string;
  durationMinutes: number;
  thrillLevel: ScoreLevel;
  familyScore: ScoreLevel;
  priority: Priority;
  analysis: AttractionAnalysis | null;
};

const PRIORITY_BONUS: Record<Priority, number> = {
  must: 90,
  high: 32,
  normal: 0,
};

const PRIORITY_COVERAGE: Record<Priority, number> = {
  must: 1000,
  high: 100,
  normal: 10,
};

const PACE_BUFFER: Record<PlanOptions["pace"], number> = {
  efficient: 8,
  distance: 10,
  balanced: 13,
  family: 18,
};

const SCORE_WEIGHT: Record<PlanOptions["pace"], { wait: number; travel: number }> = {
  efficient: { wait: 1.15, travel: 0.9 },
  distance: { wait: 0.6, travel: 3.4 },
  balanced: { wait: 1, travel: 1.45 },
  family: { wait: 0.8, travel: 2.1 },
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

function transitionScore(candidate: Candidate, wait: number, travel: number, options: PlanOptions): number {
  const weight = SCORE_WEIGHT[options.pace];
  const familyPenalty =
    options.pace === "family"
      ? (5 - candidate.familyScore) * 18 + Math.max(0, candidate.thrillLevel - 2) * 10
      : 0;
  return wait * weight.wait + travel * weight.travel + familyPenalty - PRIORITY_BONUS[candidate.priority];
}

function isUnavailable(candidate: Candidate): boolean {
  if (!candidate.analysis || candidate.analysis.dataSource === "baseline") return false;
  return candidate.analysis.currentStatus !== "operating";
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

type RouteStep =
  | {
      type: "ride";
      candidateIndex: number;
      startMinute: number;
      endMinute: number;
      expectedWaitMinutes: number;
      travelMinutes: number;
    }
  | {
      type: "meal";
      startMinute: number;
      endMinute: number;
    };

type RouteState = {
  mask: number;
  lastIndex: number;
  lunchInserted: boolean;
  minute: number;
  totalExpectedWaitMinutes: number;
  totalTravelMinutes: number;
  totalScore: number;
  priorityCoverage: number;
  steps: RouteStep[];
};

function popCount(value: number): number {
  let count = 0;
  let remaining = value;
  while (remaining > 0) {
    remaining &= remaining - 1;
    count += 1;
  }
  return count;
}

function factorial(value: number): bigint {
  let result = 1n;
  for (let index = 2; index <= value; index += 1) {
    result *= BigInt(index);
  }
  return result;
}

function orderedRouteCount(value: number): bigint {
  let result = 0n;
  let partial = 1n;
  for (let length = 1; length <= value; length += 1) {
    partial *= BigInt(value - length + 1);
    result += partial;
  }
  return result;
}

function stateKey(state: Pick<RouteState, "mask" | "lastIndex" | "lunchInserted">): string {
  return `${state.mask}|${state.lastIndex}|${state.lunchInserted ? 1 : 0}`;
}

function dominates(left: RouteState, right: RouteState): boolean {
  return (
    left.minute <= right.minute &&
    left.totalScore <= right.totalScore &&
    left.totalExpectedWaitMinutes <= right.totalExpectedWaitMinutes &&
    left.totalTravelMinutes <= right.totalTravelMinutes
  );
}

function insertState(states: Map<string, RouteState[]>, next: RouteState) {
  const key = stateKey(next);
  const current = states.get(key) ?? [];
  if (current.some((state) => dominates(state, next))) return;
  const pruned = current.filter((state) => !dominates(next, state));
  pruned.push(next);
  states.set(key, pruned);
}

function prepareLunch(state: RouteState, options: PlanOptions, buffer: number): RouteState {
  if (state.lunchInserted || options.lunchMinute === null || state.minute < options.lunchMinute - 20) {
    return state;
  }

  const lunchStart = Math.max(state.minute, options.lunchMinute);
  const lunchEnd = Math.min(lunchStart + 50, options.endMinute);
  if (lunchEnd <= lunchStart) {
    return {
      ...state,
      lunchInserted: true,
      lastIndex: -1,
    };
  }

  return {
    ...state,
    minute: lunchEnd + buffer,
    lunchInserted: true,
    lastIndex: -1,
    steps: [
      ...state.steps,
      {
        type: "meal",
        startMinute: lunchStart,
        endMinute: lunchEnd,
      },
    ],
  };
}

function startMinuteOptions(earliestStart: number): number[] {
  return [earliestStart];
}

function compareFinalStates(left: RouteState, right: RouteState, options: PlanOptions): number {
  const leftCount = popCount(left.mask);
  const rightCount = popCount(right.mask);
  if (leftCount !== rightCount) return rightCount - leftCount;
  if (left.priorityCoverage !== right.priorityCoverage) return right.priorityCoverage - left.priorityCoverage;
  if (options.pace === "distance") {
    return (
      left.totalTravelMinutes - right.totalTravelMinutes ||
      left.totalExpectedWaitMinutes - right.totalExpectedWaitMinutes ||
      left.minute - right.minute ||
      left.totalScore - right.totalScore
    );
  }
  return (
    left.totalScore - right.totalScore ||
    left.totalExpectedWaitMinutes - right.totalExpectedWaitMinutes ||
    left.totalTravelMinutes - right.totalTravelMinutes ||
    left.minute - right.minute
  );
}

function makePlanItems(steps: RouteStep[], candidates: Candidate[], endMinute: number): PlanItem[] {
  const items: PlanItem[] = [];

  for (const step of steps) {
    const previous = items[items.length - 1];
    if (previous && step.startMinute - previous.endMinute >= 15) {
      const free = makeFreeTime(previous.endMinute, step.startMinute);
      if (free) items.push(free);
    }

    if (step.type === "meal") {
      items.push({
        id: `meal-${step.startMinute}`,
        type: "meal",
        name: "ランチ",
        startMinute: step.startMinute,
        endMinute: step.endMinute,
        note: "混む前後に調整",
      });
      continue;
    }

    const candidate = candidates[step.candidateIndex];
    items.push({
      id: `ride-${candidate.id}-${step.startMinute}`,
      type: "ride",
      name: candidate.name,
      area: candidate.area,
      startMinute: step.startMinute,
      endMinute: step.endMinute,
      expectedWaitMinutes: step.expectedWaitMinutes,
      rideDurationMinutes: candidate.durationMinutes,
      travelMinutes: step.travelMinutes,
      note: candidate.priority === "must" ? "優先" : undefined,
    });
  }

  if (items.length > 0) {
    const last = items[items.length - 1];
    const free = makeFreeTime(last.endMinute, endMinute);
    if (free) items.push(free);
  }

  return items;
}

export function buildUsjPlan(params: {
  selectedAttractions: SelectedAttraction[];
  analyses: AttractionAnalysis[];
  options: PlanOptions;
}): UsjPlan {
  const analysisById = new Map(params.analyses.map((row) => [row.id, row]));
  const candidates: Candidate[] = params.selectedAttractions
    .map((selected) => {
      const attraction = getAttractionById(selected.attractionId);
      const analysis = analysisById.get(selected.attractionId) ?? null;
      if (!attraction && !analysis) return null;
      return {
        id: selected.attractionId,
        name: attraction?.name ?? analysis?.name ?? selected.attractionId,
        area: attraction?.area ?? analysis?.area ?? "USJ",
        durationMinutes: attraction?.durationMinutes ?? 8,
        thrillLevel: attraction?.thrillLevel ?? 2,
        familyScore: attraction?.familyScore ?? 3,
        priority: selected.priority,
        analysis,
      };
    })
    .filter((row): row is Candidate => row !== null);
  const availableCandidates = candidates.filter((candidate) => !isUnavailable(candidate));
  const unscheduledNames: string[] = candidates
    .filter(isUnavailable)
    .map((candidate) => `${candidate.name}（運休/情報なし）`);
  const buffer = PACE_BUFFER[params.options.pace];

  const states = new Map<string, RouteState[]>();
  insertState(states, {
    mask: 0,
    lastIndex: -1,
    lunchInserted: params.options.lunchMinute === null,
    minute: params.options.startMinute,
    totalExpectedWaitMinutes: 0,
    totalTravelMinutes: 0,
    totalScore: 0,
    priorityCoverage: 0,
    steps: [],
  });

  let evaluatedStates = 0;
  let transitionCount = 0;

  for (let scheduledCount = 0; scheduledCount < availableCandidates.length; scheduledCount += 1) {
    const layer = [...states.values()]
      .flat()
      .filter((state) => popCount(state.mask) === scheduledCount);

    for (const rawState of layer) {
      evaluatedStates += 1;
      const state = prepareLunch(rawState, params.options, buffer);
      const fromArea = state.lastIndex >= 0 ? availableCandidates[state.lastIndex]?.area ?? null : null;

      for (let index = 0; index < availableCandidates.length; index += 1) {
        const bit = 1 << index;
        if ((state.mask & bit) !== 0) continue;

        const candidate = availableCandidates[index];
        const travel = travelMinutes(fromArea, candidate.area, params.options.pace);
        const earliestStart = Math.max(params.options.startMinute, state.minute + travel);

        for (const start of startMinuteOptions(earliestStart)) {
          transitionCount += 1;
          const fallback = getAttractionById(candidate.id)?.typicalWaitMinutes ?? 40;
          const expectedWait = expectedWaitAtMinute(candidate.analysis, start, fallback);
          const end = start + expectedWait + candidate.durationMinutes;

          if (end + buffer > params.options.endMinute) {
            continue;
          }

          insertState(states, {
            mask: state.mask | bit,
            lastIndex: index,
            lunchInserted: state.lunchInserted,
            minute: end + buffer,
            totalExpectedWaitMinutes: state.totalExpectedWaitMinutes + expectedWait,
            totalTravelMinutes: state.totalTravelMinutes + travel,
            totalScore: state.totalScore + transitionScore(candidate, expectedWait, travel, params.options),
            priorityCoverage: state.priorityCoverage + PRIORITY_COVERAGE[candidate.priority],
            steps: [
              ...state.steps,
              {
                type: "ride",
                candidateIndex: index,
                startMinute: start,
                endMinute: end,
                expectedWaitMinutes: expectedWait,
                travelMinutes: travel,
              },
            ],
          });
        }
      }
    }
  }

  const best = [...states.values()]
    .flat()
    .sort((left, right) => compareFinalStates(left, right, params.options))[0];

  if (!best) {
    return {
      items: [],
      totalExpectedWaitMinutes: 0,
      totalTravelMinutes: 0,
      unscheduledNames: candidates.map((candidate) => candidate.name),
      optimizationStats: {
        algorithm: "exact-dp",
        candidateCount: availableCandidates.length,
        theoreticalFullRouteCount: factorial(availableCandidates.length).toString(),
        theoreticalRouteCount: orderedRouteCount(availableCandidates.length).toString(),
        evaluatedStates,
        transitionCount,
      },
    };
  }

  for (const candidate of availableCandidates) {
    const index = availableCandidates.indexOf(candidate);
    if ((best.mask & (1 << index)) === 0) {
      unscheduledNames.push(candidate.name);
    }
  }

  return {
    items: makePlanItems(best.steps, availableCandidates, params.options.endMinute),
    totalExpectedWaitMinutes: best.totalExpectedWaitMinutes,
    totalTravelMinutes: best.totalTravelMinutes,
    unscheduledNames,
    optimizationStats: {
      algorithm: "exact-dp",
      candidateCount: availableCandidates.length,
      theoreticalFullRouteCount: factorial(availableCandidates.length).toString(),
      theoreticalRouteCount: orderedRouteCount(availableCandidates.length).toString(),
      evaluatedStates,
      transitionCount,
    },
  };
}
