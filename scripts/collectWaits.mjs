import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const QUEUE_TIMES_URL = "https://queue-times.com/parks/284/queue_times.json";
const OUTPUT_PATH = path.join(process.cwd(), "docs", "wait-samples-local.json");

function flattenQueueTimes(payload) {
  const rides = Array.isArray(payload.rides) ? payload.rides : [];
  const landRides = Array.isArray(payload.lands)
    ? payload.lands.flatMap((land) => (Array.isArray(land.rides) ? land.rides : []))
    : [];
  return [...rides, ...landRides];
}

async function readExistingSamples() {
  try {
    const raw = await readFile(OUTPUT_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function sampleKey(sample) {
  return `${sample.attraction_id}:${sample.sampled_at}:${sample.source}`;
}

async function main() {
  const response = await fetch(QUEUE_TIMES_URL, {
    headers: {
      Accept: "application/json",
      "User-Agent": "USJWaitPlanner/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Queue-Times API error: ${response.status}`);
  }

  const payload = await response.json();
  const observedAt = new Date().toISOString();
  const samples = flattenQueueTimes(payload)
    .filter((ride) => ride?.id !== undefined && typeof ride?.name === "string")
    .map((ride) => ({
      park: "usj",
      attraction_id: String(ride.id),
      name: ride.name.trim(),
      sampled_at: ride.last_updated || observedAt,
      wait_minutes: ride.is_open ? Number(ride.wait_time ?? 0) : null,
      status: ride.is_open ? "operating" : "closed",
      source: "queue-times",
      inserted_at: observedAt,
    }));

  const existing = await readExistingSamples();
  const merged = new Map(existing.map((sample) => [sampleKey(sample), sample]));
  for (const sample of samples) {
    merged.set(sampleKey(sample), sample);
  }

  const sorted = [...merged.values()].sort(
    (left, right) => new Date(right.sampled_at).getTime() - new Date(left.sampled_at).getTime(),
  );

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");

  console.log(`Collected ${samples.length} rows. Local database now has ${sorted.length} rows.`);
  console.log(`Saved: ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
