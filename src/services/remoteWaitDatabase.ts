import { appEnv, hasSupabaseReadConfig } from "../config/env";
import { WaitSample, WaitStatus } from "../types";

type RemoteAttractionRow = {
  id?: string;
  name?: string;
  area?: string;
};

type RemoteWaitSampleRow = {
  attraction_id?: string;
  sampled_at?: string;
  wait_minutes?: number | string | null;
  status?: string | null;
  source?: string | null;
};

const RECENT_DAYS = 14;
const SAMPLE_LIMIT = 3000;

function getHeaders() {
  return {
    Accept: "application/json",
    apikey: appEnv.supabaseAnonKey,
    Authorization: `Bearer ${appEnv.supabaseAnonKey}`,
  };
}

function normalizeStatus(value: unknown): WaitStatus {
  const status = String(value ?? "unknown").toLowerCase();
  if (status === "operating" || status === "closed" || status === "down" || status === "unknown") {
    return status;
  }
  return "unknown";
}

function normalizeWait(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(600, Math.round(numeric)));
}

async function fetchRest<T>(path: string): Promise<T> {
  const base = appEnv.supabaseUrl.replace(/\/$/, "");
  const response = await fetch(`${base}/rest/v1/${path}`, {
    headers: getHeaders(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase REST error ${response.status}: ${text}`);
  }

  return (await response.json()) as T;
}

export async function fetchRemoteWaitSamples(): Promise<WaitSample[]> {
  if (!hasSupabaseReadConfig()) {
    return [];
  }

  const since = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const [attractions, samples] = await Promise.all([
    fetchRest<RemoteAttractionRow[]>("usj_attractions?select=id,name,area&is_active=eq.true"),
    fetchRest<RemoteWaitSampleRow[]>(
      `usj_wait_samples?select=attraction_id,sampled_at,wait_minutes,status,source&sampled_at=gte.${encodeURIComponent(
        since,
      )}&order=sampled_at.desc&limit=${SAMPLE_LIMIT}`,
    ),
  ]);

  const attractionById = new Map(
    attractions
      .filter((row) => typeof row.id === "string")
      .map((row) => [
        row.id as string,
        {
          name: row.name ?? row.id ?? "USJ",
          area: row.area ?? "USJ",
        },
      ]),
  );

  return samples
    .filter((row) => typeof row.attraction_id === "string" && typeof row.sampled_at === "string")
    .map((row) => {
      const attraction = attractionById.get(row.attraction_id as string);
      return {
        attractionId: row.attraction_id as string,
        name: attraction?.name ?? row.attraction_id ?? "USJ",
        area: attraction?.area ?? "USJ",
        waitMinutes: normalizeWait(row.wait_minutes),
        status: normalizeStatus(row.status),
        sampledAt: row.sampled_at as string,
        source: "queue-times",
      };
    });
}
