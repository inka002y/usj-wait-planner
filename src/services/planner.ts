import { getAttractionById } from "../data/attractions";
import {
  AttractionAnalysis,
  PlanFixedBlockType,
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
  selectionIndex: number;
};

type FixedBlock = {
  id: string;
  type: PlanFixedBlockType | "meal";
  name: string;
  startMinute: number;
  endMinute: number;
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

const OPTIONAL_FIXED_WAIT_CANDIDATE_LIMIT = 10;
const OPTIONAL_FIXED_WAIT_MAX_GAP_MINUTES = 45;
const EXACT_DP_CANDIDATE_LIMIT = 13;

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
      type: "fixed";
      id: string;
      blockType: FixedBlock["type"];
      name: string;
      startMinute: number;
      endMinute: number;
    };

type RouteState = {
  mask: number;
  lastIndex: number;
  blockIndex: number;
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

function stateKey(state: Pick<RouteState, "mask" | "lastIndex" | "blockIndex">): string {
  return `${state.mask}|${state.lastIndex}|${state.blockIndex}`;
}

function dominates(left: RouteState, right: RouteState): boolean {
  return (
    left.minute <= right.minute &&
    left.totalScore <= right.totalScore &&
    left.totalExpectedWaitMinutes <= right.totalExpectedWaitMinutes &&
    left.totalTravelMinutes <= right.totalTravelMinutes
  );
}

function insertState(states: Map<string, RouteState[]>, next: RouteState): boolean {
  const key = stateKey(next);
  const current = states.get(key) ?? [];
  if (current.some((state) => dominates(state, next))) return false;
  const pruned = current.filter((state) => !dominates(next, state));
  pruned.push(next);
  states.set(key, pruned);
  return true;
}

function normalizeFixedBlocks(options: PlanOptions): FixedBlock[] {
  const blocks: FixedBlock[] = [];
  if (options.lunchMinute !== null) {
    blocks.push({
      id: "meal-lunch",
      type: "meal",
      name: "ランチ",
      startMinute: options.lunchMinute,
      endMinute: options.lunchMinute + 50,
    });
  }

  for (const block of options.fixedBlocks ?? []) {
    blocks.push({
      id: block.id,
      type: block.type,
      name: block.name.trim() || (block.type === "show" ? "ショー" : "休憩"),
      startMinute: block.startMinute,
      endMinute: block.endMinute,
    });
  }

  return blocks
    .map((block) => ({
      ...block,
      startMinute: Math.max(options.startMinute, Math.min(options.endMinute, block.startMinute)),
      endMinute: Math.max(options.startMinute, Math.min(options.endMinute, block.endMinute)),
    }))
    .filter((block) => block.endMinute > block.startMinute)
    .sort((left, right) => left.startMinute - right.startMinute || left.endMinute - right.endMinute);
}

function appendNextFixedBlock(state: RouteState, blocks: FixedBlock[], buffer: number): RouteState {
  const block = blocks[state.blockIndex];
  if (!block) return state;
  const startMinute = Math.max(state.minute, block.startMinute);
  const endMinute = Math.max(startMinute, block.endMinute);
  return {
    ...state,
    lastIndex: -1,
    blockIndex: state.blockIndex + 1,
    minute: endMinute + buffer,
    steps: [
      ...state.steps,
      {
        type: "fixed",
        id: block.id,
        blockType: block.type,
        name: block.name,
        startMinute,
        endMinute,
      },
    ],
  };
}

function appendRemainingFixedBlocks(state: RouteState, blocks: FixedBlock[], buffer: number): RouteState {
  let next = state;
  while (next.blockIndex < blocks.length) {
    next = appendNextFixedBlock(next, blocks, buffer);
  }
  return next;
}

function canExploreOptionalFixedWait(state: RouteState, blocks: FixedBlock[], candidateCount: number): boolean {
  const nextBlock = blocks[state.blockIndex];
  if (!nextBlock || candidateCount > OPTIONAL_FIXED_WAIT_CANDIDATE_LIMIT) return false;
  return nextBlock.startMinute - state.minute <= OPTIONAL_FIXED_WAIT_MAX_GAP_MINUTES;
}

function limitCandidatesForExactDp(
  candidates: Candidate[],
  options: PlanOptions,
): { optimizedCandidates: Candidate[]; overflowCandidates: Candidate[] } {
  if (candidates.length <= EXACT_DP_CANDIDATE_LIMIT) {
    return { optimizedCandidates: candidates, overflowCandidates: [] };
  }

  const ranked = candidates
    .map((candidate) => {
      const fallback = getAttractionById(candidate.id)?.typicalWaitMinutes ?? 40;
      const wait = expectedWaitAtMinute(candidate.analysis, options.startMinute, fallback);
      const familyBonus = options.pace === "family" ? candidate.familyScore * 120 : 0;
      const score =
        PRIORITY_COVERAGE[candidate.priority] * 10000 +
        familyBonus -
        wait * 8 -
        candidate.durationMinutes * 2 -
        candidate.selectionIndex;
      return { candidate, score };
    })
    .sort((left, right) => right.score - left.score);

  const optimizedIds = new Set(ranked.slice(0, EXACT_DP_CANDIDATE_LIMIT).map((row) => row.candidate.id));
  return {
    optimizedCandidates: candidates.filter((candidate) => optimizedIds.has(candidate.id)),
    overflowCandidates: candidates.filter((candidate) => !optimizedIds.has(candidate.id)),
  };
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

    if (step.type === "fixed") {
      items.push({
        id: step.id,
        type: step.blockType,
        name: step.name,
        startMinute: step.startMinute,
        endMinute: step.endMinute,
        note: step.blockType === "meal" ? "食事" : step.blockType === "show" ? "固定ショー" : "固定予定",
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

function scheduleCandidateFromState(params: {
  state: RouteState;
  candidate: Candidate;
  candidateIndex: number;
  candidates: Candidate[];
  blocks: FixedBlock[];
  options: PlanOptions;
  buffer: number;
}): RouteState | null {
  let baseState = params.state;

  while (true) {
    const fromArea = baseState.lastIndex >= 0 ? params.candidates[baseState.lastIndex]?.area ?? null : null;
    const travel = travelMinutes(fromArea, params.candidate.area, params.options.pace);
    const start = Math.max(params.options.startMinute, baseState.minute + travel);
    const fallback = getAttractionById(params.candidate.id)?.typicalWaitMinutes ?? 40;
    const expectedWait = expectedWaitAtMinute(params.candidate.analysis, start, fallback);
    const end = start + expectedWait + params.candidate.durationMinutes;
    const nextBlock = params.blocks[baseState.blockIndex];

    if (nextBlock && end + params.buffer > nextBlock.startMinute) {
      baseState = appendNextFixedBlock(baseState, params.blocks, params.buffer);
      continue;
    }

    if (end + params.buffer > params.options.endMinute) {
      return null;
    }

    const bit = 1 << params.candidateIndex;
    return {
      mask: baseState.mask | bit,
      lastIndex: params.candidateIndex,
      blockIndex: baseState.blockIndex,
      minute: end + params.buffer,
      totalExpectedWaitMinutes: baseState.totalExpectedWaitMinutes + expectedWait,
      totalTravelMinutes: baseState.totalTravelMinutes + travel,
      totalScore: baseState.totalScore + transitionScore(params.candidate, expectedWait, travel, params.options),
      priorityCoverage: baseState.priorityCoverage + PRIORITY_COVERAGE[params.candidate.priority],
      steps: [
        ...baseState.steps,
        {
          type: "ride",
          candidateIndex: params.candidateIndex,
          startMinute: start,
          endMinute: end,
          expectedWaitMinutes: expectedWait,
          travelMinutes: travel,
        },
      ],
    };
  }
}

export function buildUsjPlan(params: {
  selectedAttractions: SelectedAttraction[];
  analyses: AttractionAnalysis[];
  options: PlanOptions;
}): UsjPlan {
  const analysisById = new Map(params.analyses.map((row) => [row.id, row]));
  const candidates: Candidate[] = params.selectedAttractions
    .map((selected, selectionIndex) => {
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
        selectionIndex,
      };
    })
    .filter((row): row is Candidate => row !== null);
  const allAvailableCandidates = candidates.filter((candidate) => !isUnavailable(candidate));
  const { optimizedCandidates: availableCandidates, overflowCandidates } = limitCandidatesForExactDp(
    allAvailableCandidates,
    params.options,
  );
  const unscheduledNames: string[] = candidates
    .filter(isUnavailable)
    .map((candidate) => `${candidate.name}（運休/情報なし）`);
  for (const candidate of overflowCandidates) {
    unscheduledNames.push(`${candidate.name}（候補上限）`);
  }
  const buffer = PACE_BUFFER[params.options.pace];
  const fixedBlocks = normalizeFixedBlocks(params.options);

  const states = new Map<string, RouteState[]>();
  insertState(states, {
    mask: 0,
    lastIndex: -1,
    blockIndex: 0,
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
    const processedInLayer = new Set<string>();

    for (let layerIndex = 0; layerIndex < layer.length; layerIndex += 1) {
      const rawState = layer[layerIndex];
      const processKey = [
        stateKey(rawState),
        rawState.minute,
        rawState.totalExpectedWaitMinutes,
        rawState.totalTravelMinutes,
        rawState.priorityCoverage,
        Math.round(rawState.totalScore * 1000),
      ].join("|");
      if (processedInLayer.has(processKey)) continue;
      processedInLayer.add(processKey);
      evaluatedStates += 1;

      if (canExploreOptionalFixedWait(rawState, fixedBlocks, availableCandidates.length)) {
        transitionCount += 1;
        const nextBlockState = appendNextFixedBlock(rawState, fixedBlocks, buffer);
        if (insertState(states, nextBlockState) && popCount(nextBlockState.mask) === scheduledCount) {
          layer.push(nextBlockState);
        }
      }

      for (let index = 0; index < availableCandidates.length; index += 1) {
        const bit = 1 << index;
        if ((rawState.mask & bit) !== 0) continue;

        const candidate = availableCandidates[index];
        transitionCount += 1;
        const nextState = scheduleCandidateFromState({
          state: rawState,
          candidate,
          candidateIndex: index,
          candidates: availableCandidates,
          blocks: fixedBlocks,
          options: params.options,
          buffer,
        });
        if (nextState) {
          insertState(states, nextState);
        }
      }
    }
  }

  const best = [...states.values()]
    .flat()
    .map((state) => appendRemainingFixedBlocks(state, fixedBlocks, buffer))
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
