import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";

import { PLAN_TEMPLATES } from "../src/data/planTemplates.ts";
import { buildUsjPlan } from "../src/services/planner.ts";
import { buildWaitAnalyses } from "../src/services/waitAnalytics.ts";

function readEnv() {
  const entries = {};
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=\s]+)=(.*)$/);
    if (match) {
      entries[match[1]] = match[2].trim();
    }
  }
  return entries;
}

function normalizeStatus(value) {
  const status = String(value ?? "unknown").toLowerCase();
  return ["operating", "closed", "down", "unknown"].includes(status) ? status : "unknown";
}

function normalizeWait(value) {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(600, Math.round(numeric)));
}

async function fetchRest(path, env) {
  const base = env.EXPO_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
  const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const response = await fetch(`${base}/rest/v1/${path}`, {
    headers: {
      Accept: "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Supabase REST error ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

function toPlanOptions(template, pace) {
  return {
    startMinute: 9 * 60,
    endMinute: 20 * 60,
    pace,
    lunchMinute: 12 * 60 + 20,
    ...template.options,
    pace,
  };
}

const env = readEnv();
if (!env.EXPO_PUBLIC_SUPABASE_URL || !env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error(".env must contain EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY");
}

const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
const [attractions, sampleRows] = await Promise.all([
  fetchRest("usj_attractions?select=id,name,area&is_active=eq.true", env),
  fetchRest(
    `usj_wait_samples?select=attraction_id,sampled_at,wait_minutes,status,source&sampled_at=gte.${encodeURIComponent(
      since,
    )}&order=sampled_at.desc&limit=5000`,
    env,
  ),
]);

const attractionById = new Map(
  attractions.map((row) => [
    row.id,
    {
      name: row.name ?? row.id,
      area: row.area ?? "USJ",
    },
  ]),
);

const samples = sampleRows.map((row) => {
  const attraction = attractionById.get(row.attraction_id);
  return {
    attractionId: row.attraction_id,
    name: attraction?.name ?? row.attraction_id,
    area: attraction?.area ?? "USJ",
    waitMinutes: normalizeWait(row.wait_minutes),
    status: normalizeStatus(row.status),
    sampledAt: row.sampled_at,
    source: "queue-times",
  };
});

const latestById = new Map();
for (const sample of samples) {
  if (!latestById.has(sample.attractionId)) {
    latestById.set(sample.attractionId, sample);
  }
}

const liveRows = [...latestById.values()].map((sample) => ({
  id: sample.attractionId,
  name: sample.name,
  area: sample.area,
  waitMinutes: sample.waitMinutes,
  status: sample.status,
  isOpen: sample.status === "operating",
  lastUpdated: sample.sampledAt,
  observedAt: new Date().toISOString(),
  source: "queue-times",
  staleMinutes: null,
}));

const analyses = buildWaitAnalyses(liveRows, samples);
const paces = ["efficient", "distance"];
const results = [];

for (const template of PLAN_TEMPLATES) {
  for (const pace of paces) {
    const options = toPlanOptions(template, pace);
    const startedAt = performance.now();
    const plan = buildUsjPlan({
      selectedAttractions: template.selectedAttractions,
      analyses,
      options,
    });
    const generationMs = Math.max(1, Math.round(performance.now() - startedAt));
    const rideItems = plan.items.filter((item) => item.type === "ride");
    results.push({
      template: template.label,
      pace,
      selected: template.selectedAttractions.length,
      scheduled: rideItems.length,
      waitMinutes: plan.totalExpectedWaitMinutes,
      travelMinutes: plan.totalTravelMinutes,
      unscheduled: plan.unscheduledNames,
      generationMs,
    });
  }
}

const statusSummary = liveRows.reduce((summary, row) => {
  summary[row.status] = (summary[row.status] ?? 0) + 1;
  return summary;
}, {});

console.log(
  JSON.stringify(
    {
      sampleCount: samples.length,
      attractionCount: attractionById.size,
      statusSummary,
      results,
    },
    null,
    2,
  ),
);
