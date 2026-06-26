type QueueTimesRide = {
  id?: number | string;
  name?: string;
  is_open?: boolean;
  wait_time?: number | null;
  last_updated?: string | null;
};

type QueueTimesLand = {
  rides?: QueueTimesRide[];
};

type QueueTimesResponse = {
  rides?: QueueTimesRide[];
  lands?: QueueTimesLand[];
};

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const QUEUE_TIMES_URL = "https://queue-times.com/parks/284/queue_times.json";
const SOURCE = "queue-times";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-collect-token",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const AREA_BY_ID: Record<string, string> = {
  "12061": "Super Nintendo World",
  "14402": "Donkey Kong Country",
  "12071": "Super Nintendo World",
  "12065": "Wizarding World",
  "12073": "Wizarding World",
  "12197": "Wizarding World",
  "7092": "Jurassic Park",
  "12067": "Jurassic Park",
  "7077": "Hollywood",
  "12070": "Hollywood",
  "12082": "Hollywood",
  "15428": "Hollywood",
  "12068": "Amity Village",
  "12066": "Minion Park",
  "12072": "Minion Park",
  "14918": "Minion Park",
  "7214": "Hollywood",
  "12091": "Hollywood",
  "13005": "Cool Japan",
  "15427": "Cool Japan",
  "7065": "Universal Wonderland",
  "7063": "Universal Wonderland",
  "12075": "Universal Wonderland",
  "14919": "Universal Wonderland",
  "12083": "Universal Wonderland",
  "12084": "Hollywood",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function flattenQueueTimes(payload: QueueTimesResponse): QueueTimesRide[] {
  const direct = Array.isArray(payload.rides) ? payload.rides : [];
  const fromLands = Array.isArray(payload.lands)
    ? payload.lands.flatMap((land) => (Array.isArray(land.rides) ? land.rides : []))
    : [];
  return [...direct, ...fromLands];
}

function normalizeWaitMinutes(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(600, Math.round(value)));
}

async function upsertRest(
  supabaseUrl: string,
  serviceRoleKey: string,
  table: string,
  onConflict: string,
  rows: Record<string, unknown>[],
) {
  if (rows.length === 0) return;

  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(rows),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${table} upsert failed: ${response.status} ${text}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const expectedToken = Deno.env.get("COLLECT_WAITS_TOKEN")?.trim();
  if (!expectedToken) {
    return jsonResponse({ error: "COLLECT_WAITS_TOKEN is not configured" }, 500);
  }

  const requestToken = req.headers.get("x-collect-token")?.trim();
  if (requestToken !== expectedToken) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Supabase service credentials are not configured" }, 500);
  }

  const observedAt = new Date().toISOString();
  const queueResponse = await fetch(QUEUE_TIMES_URL, {
    headers: {
      Accept: "application/json",
      "User-Agent": "USJWaitPlannerCollector/1.0",
    },
  });

  if (!queueResponse.ok) {
    return jsonResponse({ error: `Queue-Times API error: ${queueResponse.status}` }, 502);
  }

  const payload = (await queueResponse.json()) as QueueTimesResponse;
  const rides = flattenQueueTimes(payload).filter(
    (ride) => ride.id !== undefined && typeof ride.name === "string" && ride.name.trim().length > 0,
  );

  const attractions = rides.map((ride) => {
    const id = String(ride.id);
    return {
      id,
      name: String(ride.name).trim(),
      area: AREA_BY_ID[id] ?? "USJ",
      external_source: SOURCE,
      external_id: id,
      is_active: true,
    };
  });

  const samples = rides.map((ride) => {
    const id = String(ride.id);
    const isOpen = ride.is_open === true;
    return {
      attraction_id: id,
      sampled_at: ride.last_updated ?? observedAt,
      wait_minutes: isOpen ? normalizeWaitMinutes(ride.wait_time) : null,
      status: isOpen ? "operating" : "closed",
      source: SOURCE,
    };
  });

  await upsertRest(supabaseUrl, serviceRoleKey, "usj_attractions", "id", attractions);
  await upsertRest(supabaseUrl, serviceRoleKey, "usj_wait_samples", "attraction_id,sampled_at,source", samples);

  return jsonResponse({
    ok: true,
    observedAt,
    rideCount: rides.length,
    operatingCount: samples.filter((row) => row.status === "operating").length,
    sampleCount: samples.length,
  });
});
