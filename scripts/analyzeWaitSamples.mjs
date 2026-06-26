import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const INPUT_PATH = path.join(process.cwd(), "docs", "wait-samples-local.json");
const OUTPUT_PATH = path.join(process.cwd(), "docs", "wait-analysis-local.json");

function minuteOfDayTokyo(iso) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

function average(values) {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function groupBy(rows, keyFn) {
  const grouped = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    const bucket = grouped.get(key) ?? [];
    bucket.push(row);
    grouped.set(key, bucket);
  }
  return grouped;
}

async function main() {
  const raw = await readFile(INPUT_PATH, "utf8");
  const samples = JSON.parse(raw).filter((row) => typeof row.wait_minutes === "number");
  const byAttraction = groupBy(samples, (row) => row.attraction_id);

  const analysis = [...byAttraction.entries()]
    .map(([attractionId, rows]) => {
      const waits = rows.map((row) => row.wait_minutes);
      const byHour = groupBy(rows, (row) => Math.floor(minuteOfDayTokyo(row.sampled_at) / 60));
      return {
        attraction_id: attractionId,
        name: rows[0]?.name ?? attractionId,
        sample_count: rows.length,
        avg_wait: average(waits),
        min_wait: Math.min(...waits),
        max_wait: Math.max(...waits),
        hourly_avg_waits: [...byHour.entries()]
          .sort(([left], [right]) => left - right)
          .map(([hour, hourRows]) => ({
            hour,
            avg_wait: average(hourRows.map((row) => row.wait_minutes)),
            sample_count: hourRows.length,
          })),
      };
    })
    .sort((left, right) => (right.avg_wait ?? 0) - (left.avg_wait ?? 0));

  await writeFile(OUTPUT_PATH, `${JSON.stringify(analysis, null, 2)}\n`, "utf8");
  console.log(`Analyzed ${samples.length} numeric samples across ${analysis.length} attractions.`);
  console.log(`Saved: ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
