export type WaitStatus = "operating" | "closed" | "down" | "unknown";

export type ColorMode = "light" | "dark";

export type PlanPace = "efficient" | "distance" | "balanced" | "family";

export type Priority = "must" | "high" | "normal";

export interface Attraction {
  id: string;
  name: string;
  area: string;
  durationMinutes: number;
  typicalWaitMinutes: number;
  thrillLevel: 1 | 2 | 3 | 4 | 5;
  familyScore: 1 | 2 | 3 | 4 | 5;
  tags: string[];
  accentColor: string;
  aliases?: string[];
}

export interface LiveWait {
  id: string;
  name: string;
  area: string;
  waitMinutes: number | null;
  status: WaitStatus;
  isOpen: boolean;
  lastUpdated: string | null;
  observedAt: string;
  source: "queue-times";
  staleMinutes: number | null;
}

export interface ParkSchedule {
  date: string;
  openingTime: string | null;
  closingTime: string | null;
  openMinute: number;
  closeMinute: number;
  source: "themeparks.wiki" | "fallback";
}

export interface WaitSample {
  attractionId: string;
  name: string;
  area: string;
  waitMinutes: number | null;
  status: WaitStatus;
  sampledAt: string;
  source: "queue-times";
}

export interface HourlyWaitPoint {
  hour: number;
  minuteOfDay: number;
  waitMinutes: number | null;
  sampleCount: number;
  source: "database" | "baseline";
}

export interface AttractionAnalysis {
  id: string;
  name: string;
  area: string;
  currentWaitMinutes: number | null;
  currentStatus: WaitStatus;
  averageWaitMinutes: number;
  minWaitMinutes: number | null;
  maxWaitMinutes: number | null;
  sampleCount: number;
  trend: "up" | "down" | "flat" | "unknown";
  bestHour: number | null;
  bestTimeLabel: string;
  hourlyProfile: HourlyWaitPoint[];
  dataSource: "live+database" | "live+baseline" | "baseline";
}

export interface DatabaseStats {
  sampleCount: number;
  attractionCount: number;
  oldestSampleAt: string | null;
  newestSampleAt: string | null;
}

export interface PlanOptions {
  startMinute: number;
  endMinute: number;
  pace: PlanPace;
  lunchMinute: number | null;
}

export interface SelectedAttraction {
  attractionId: string;
  priority: Priority;
}

export interface PlanItem {
  id: string;
  type: "ride" | "meal" | "free";
  name: string;
  area?: string;
  startMinute: number;
  endMinute: number;
  expectedWaitMinutes?: number;
  rideDurationMinutes?: number;
  travelMinutes?: number;
  note?: string;
}

export interface PlanOptimizationStats {
  algorithm: "exact-dp";
  candidateCount: number;
  theoreticalFullRouteCount: string;
  theoreticalRouteCount: string;
  evaluatedStates: number;
  transitionCount: number;
}

export interface SavedPlan {
  id: string;
  name: string;
  createdAt: string;
  options: PlanOptions;
  selectedAttractions: SelectedAttraction[];
  items: PlanItem[];
  totalExpectedWaitMinutes: number;
  totalTravelMinutes: number;
  unscheduledNames: string[];
  optimizationStats?: PlanOptimizationStats;
}

export interface UsjPlan {
  items: PlanItem[];
  totalExpectedWaitMinutes: number;
  totalTravelMinutes: number;
  unscheduledNames: string[];
  optimizationStats: PlanOptimizationStats;
}
