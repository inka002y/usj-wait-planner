import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { fetchLiveWaits, fetchParkSchedule } from "./services/waitApi";
import { buildWaitAnalyses, summarizePark } from "./services/waitAnalytics";
import {
  appendLiveWaitSamples,
  clearWaitSamples,
  getDatabaseStats,
  loadWaitSamples,
  mergeWaitSamples,
  persistWaitSamples,
} from "./services/waitDatabase";
import { fetchRemoteWaitSamples } from "./services/remoteWaitDatabase";
import {
  AttractionAnalysis,
  ColorMode,
  DatabaseStats,
  LiveWait,
  ParkSchedule,
  PlanOptions,
  Priority,
  SavedPlan,
  SelectedAttraction,
  UsjPlan,
  WaitSample,
} from "./types";
import { getTokyoDateISO } from "./utils/time";

const COLOR_MODE_KEY = "usj_color_mode_v1";
const SAVED_PLANS_KEY = "usj_saved_plans_v1";

interface AppContextValue {
  colorMode: ColorMode;
  setColorMode: (mode: ColorMode) => void;
  liveRows: LiveWait[];
  samples: WaitSample[];
  analyses: AttractionAnalysis[];
  schedule: ParkSchedule | null;
  isRefreshing: boolean;
  refreshError: string | null;
  lastRefreshAt: string | null;
  refreshLiveData: () => Promise<void>;
  clearDatabase: () => Promise<void>;
  databaseStats: DatabaseStats;
  parkSummary: ReturnType<typeof summarizePark>;
  selectedAttractions: SelectedAttraction[];
  setSelectedAttractions: React.Dispatch<React.SetStateAction<SelectedAttraction[]>>;
  toggleAttraction: (attractionId: string) => void;
  setAttractionPriority: (attractionId: string, priority: Priority) => void;
  planOptions: PlanOptions;
  setPlanOptions: React.Dispatch<React.SetStateAction<PlanOptions>>;
  savedPlans: SavedPlan[];
  savePlan: (name: string, plan: UsjPlan) => Promise<void>;
  deletePlan: (planId: string) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

const defaultPlanOptions: PlanOptions = {
  startMinute: 9 * 60,
  endMinute: 20 * 60,
  pace: "balanced",
  lunchMinute: 12 * 60 + 20,
};

function normalizeSavedPlan(raw: unknown): SavedPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const plan = raw as Partial<SavedPlan>;
  if (typeof plan.id !== "string" || typeof plan.name !== "string" || typeof plan.createdAt !== "string") return null;
  if (!plan.options || !Array.isArray(plan.items) || !Array.isArray(plan.selectedAttractions)) return null;
  return {
    ...(plan as SavedPlan),
    totalTravelMinutes: typeof plan.totalTravelMinutes === "number" ? plan.totalTravelMinutes : 0,
  };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [colorMode, setColorModeState] = useState<ColorMode>("light");
  const [liveRows, setLiveRows] = useState<LiveWait[]>([]);
  const [samples, setSamples] = useState<WaitSample[]>([]);
  const [schedule, setSchedule] = useState<ParkSchedule | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);
  const [selectedAttractions, setSelectedAttractions] = useState<SelectedAttraction[]>([]);
  const [planOptions, setPlanOptions] = useState<PlanOptions>(defaultPlanOptions);
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);

  const analyses = useMemo(() => buildWaitAnalyses(liveRows, samples), [liveRows, samples]);
  const databaseStats = useMemo(() => getDatabaseStats(samples), [samples]);
  const parkSummary = useMemo(() => summarizePark(liveRows, analyses), [liveRows, analyses]);

  const setColorMode = useCallback((mode: ColorMode) => {
    setColorModeState(mode);
    AsyncStorage.setItem(COLOR_MODE_KEY, mode).catch(() => {});
  }, []);

  const refreshLiveData = useCallback(async () => {
    setIsRefreshing(true);
    setRefreshError(null);
    try {
      const [nextLiveRows, nextSchedule] = await Promise.all([
        fetchLiveWaits(),
        fetchParkSchedule(getTokyoDateISO()),
      ]);
      setLiveRows(nextLiveRows);
      setSchedule(nextSchedule);
      setPlanOptions((current) => ({
        ...current,
        startMinute: nextSchedule.openMinute,
        endMinute: nextSchedule.closeMinute,
      }));
      const nextSamples = await appendLiveWaitSamples(nextLiveRows);
      const remoteSamples = await fetchRemoteWaitSamples().catch(() => []);
      const mergedSamples = mergeWaitSamples([...nextSamples, ...remoteSamples]);
      if (remoteSamples.length > 0) {
        await persistWaitSamples(mergedSamples);
      }
      setSamples(mergedSamples);
      setLastRefreshAt(new Date().toISOString());
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : "待ち時間の取得に失敗しました");
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const clearDatabase = useCallback(async () => {
    await clearWaitSamples();
    setSamples([]);
  }, []);

  const toggleAttraction = useCallback((attractionId: string) => {
    setSelectedAttractions((current) => {
      if (current.some((row) => row.attractionId === attractionId)) {
        return current.filter((row) => row.attractionId !== attractionId);
      }
      return [...current, { attractionId, priority: "normal" }];
    });
  }, []);

  const setAttractionPriority = useCallback((attractionId: string, priority: Priority) => {
    setSelectedAttractions((current) =>
      current.map((row) => (row.attractionId === attractionId ? { ...row, priority } : row)),
    );
  }, []);

  const savePlan = useCallback(
    async (name: string, plan: UsjPlan) => {
      const trimmedName = name.trim() || `USJプラン ${savedPlans.length + 1}`;
      const nextPlan: SavedPlan = {
        id: `plan-${Date.now()}`,
        name: trimmedName.slice(0, 18),
        createdAt: new Date().toISOString(),
        options: planOptions,
        selectedAttractions,
        items: plan.items,
        totalExpectedWaitMinutes: plan.totalExpectedWaitMinutes,
        totalTravelMinutes: plan.totalTravelMinutes,
        unscheduledNames: plan.unscheduledNames,
      };
      const nextPlans = [nextPlan, ...savedPlans].slice(0, 8);
      setSavedPlans(nextPlans);
      await AsyncStorage.setItem(SAVED_PLANS_KEY, JSON.stringify(nextPlans));
    },
    [planOptions, savedPlans, selectedAttractions],
  );

  const deletePlan = useCallback(
    async (planId: string) => {
      const nextPlans = savedPlans.filter((plan) => plan.id !== planId);
      setSavedPlans(nextPlans);
      await AsyncStorage.setItem(SAVED_PLANS_KEY, JSON.stringify(nextPlans));
    },
    [savedPlans],
  );

  useEffect(() => {
    let mounted = true;
    Promise.all([
      AsyncStorage.getItem(COLOR_MODE_KEY),
      AsyncStorage.getItem(SAVED_PLANS_KEY),
      loadWaitSamples(),
      fetchRemoteWaitSamples().catch(() => []),
    ])
      .then(([storedColorMode, storedPlans, storedSamples, remoteSamples]) => {
        if (!mounted) return;
        if (storedColorMode === "dark" || storedColorMode === "light") {
          setColorModeState(storedColorMode);
        }
        if (storedPlans) {
          try {
            const parsed = JSON.parse(storedPlans);
            if (Array.isArray(parsed)) {
              setSavedPlans(parsed.map(normalizeSavedPlan).filter((row): row is SavedPlan => row !== null));
            }
          } catch {
            setSavedPlans([]);
          }
        }
        const mergedSamples = mergeWaitSamples([...storedSamples, ...remoteSamples]);
        setSamples(mergedSamples);
        if (remoteSamples.length > 0) {
          persistWaitSamples(mergedSamples).catch(() => {});
        }
      })
      .finally(() => {
        if (mounted) {
          refreshLiveData().catch(() => {});
        }
      });

    return () => {
      mounted = false;
    };
  }, [refreshLiveData]);

  const value = useMemo<AppContextValue>(
    () => ({
      colorMode,
      setColorMode,
      liveRows,
      samples,
      analyses,
      schedule,
      isRefreshing,
      refreshError,
      lastRefreshAt,
      refreshLiveData,
      clearDatabase,
      databaseStats,
      parkSummary,
      selectedAttractions,
      setSelectedAttractions,
      toggleAttraction,
      setAttractionPriority,
      planOptions,
      setPlanOptions,
      savedPlans,
      savePlan,
      deletePlan,
    }),
    [
      analyses,
      clearDatabase,
      colorMode,
      databaseStats,
      isRefreshing,
      lastRefreshAt,
      liveRows,
      parkSummary,
      planOptions,
      refreshError,
      refreshLiveData,
      samples,
      savedPlans,
      savePlan,
      schedule,
      selectedAttractions,
      setAttractionPriority,
      setColorMode,
      toggleAttraction,
      deletePlan,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used inside AppProvider");
  }
  return context;
}
