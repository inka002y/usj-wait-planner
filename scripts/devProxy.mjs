import http from "node:http";

const PORT = Number(process.env.USJ_DEV_PROXY_PORT ?? 8787);
const QUEUE_TIMES_URL = "https://queue-times.com/parks/284/queue_times.json";
const SCHEDULE_URL =
  "https://api.themeparks.wiki/v1/entity/47f61fac-7586-41ac-ae80-61c9257cf33e/schedule";

const ROUTES = new Map([
  ["/queue-times", QUEUE_TIMES_URL],
  ["/schedule", SCHEDULE_URL],
]);

function send(res, status, body, contentType = "application/json") {
  res.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Cache-Control": "no-store",
    "Content-Type": contentType,
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    send(res, 204, "");
    return;
  }

  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const upstream = ROUTES.get(url.pathname);
  if (!upstream) {
    send(res, 404, JSON.stringify({ error: "unknown route" }));
    return;
  }

  try {
    const upstreamResponse = await fetch(upstream, {
      headers: {
        Accept: "application/json",
        "User-Agent": "USJWaitPlannerDevProxy/1.0",
      },
    });
    const text = await upstreamResponse.text();
    send(res, upstreamResponse.status, text, upstreamResponse.headers.get("content-type") ?? "application/json");
  } catch (error) {
    send(res, 502, JSON.stringify({ error: error instanceof Error ? error.message : "proxy failed" }));
  }
});

server.listen(PORT, () => {
  console.log(`USJ dev proxy listening on http://localhost:${PORT}`);
});
