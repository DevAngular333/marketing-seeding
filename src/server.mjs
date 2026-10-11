import http from "node:http";
import path from "node:path";
import { timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { JsonStore } from "./store.mjs";
import { SeedingService } from "./service.mjs";
import { appRoot, autoGtmFeedFile, browserAutomationFile, dailyAutomationFile, dailyAutomationReceiptFile, publicRoot, stateFile } from "./paths.mjs";
import { FixtureWorkerBridge } from "./fixture-worker-bridge.mjs";
import { readAutoGtmFeed } from "./auto-gtm-feed.mjs";

async function loadLocalEnv() {
  try {
    const text = await readFile(path.join(appRoot, ".env"), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match || match[1].startsWith("#") || process.env[match[1]] !== undefined) continue;
      process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

await loadLocalEnv();

// Keep loopback as the safe local default; VPS deployments can set SEEDING_HOST
// explicitly (usually 127.0.0.1 behind nginx, or 0.0.0.0 with a firewall).
const host = String(process.env.SEEDING_HOST || "127.0.0.1").trim() || "127.0.0.1";
const port = Number(process.env.SEEDING_PORT || 4318);
const operatorToken = String(process.env.SEEDING_OPERATOR_TOKEN || "").trim();
const automationToken = String(process.env.SEEDING_AUTOMATION_TOKEN || "").trim();
const trafficPollMinutes = Number(process.env.SEEDING_TRAFFIC_POLL_MINUTES || 0);
if (operatorToken.length < 32) {
  throw new Error("SEEDING_OPERATOR_TOKEN must contain at least 32 characters");
}
if (automationToken.length < 32) {
  throw new Error("SEEDING_AUTOMATION_TOKEN must contain at least 32 characters");
}
if (automationToken === operatorToken) throw new Error("Operator and automation tokens must be different");
if (!Number.isFinite(trafficPollMinutes) || trafficPollMinutes < 0 || (trafficPollMinutes > 0 && trafficPollMinutes < 15)) {
  throw new Error("SEEDING_TRAFFIC_POLL_MINUTES must be 0 (disabled) or at least 15");
}
const store = new JsonStore(stateFile, { requireLease: true });
await store.acquireWriterLease();
const service = new SeedingService(store);
let initializedState;
try {
  initializedState = await service.init();
} catch (error) {
  await store.releaseWriterLease();
  throw error;
}
const trafficIntervalMs = trafficPollMinutes * 60_000;
const lastCollectorAt = [...(initializedState.collectorRuns || [])]
  .map((run) => Date.parse(run.at || ""))
  .filter(Number.isFinite)
  .sort((left, right) => right - left)[0] || null;
const trafficRuntime = {
  enabled: trafficPollMinutes > 0,
  intervalMinutes: trafficPollMinutes || null,
  running: false,
  lastStartedAt: null,
  lastCompletedAt: lastCollectorAt ? new Date(lastCollectorAt).toISOString() : null,
  nextRunAt: null,
  lastSummary: null
};
const fixtureWorker = new FixtureWorkerBridge({ service });
let trafficTimer = null;
let shuttingDown = false;

function scheduleTrafficCollection(delayMs = trafficIntervalMs) {
  if (!trafficRuntime.enabled || shuttingDown) return;
  if (trafficTimer) clearTimeout(trafficTimer);
  const boundedDelay = Math.max(1_000, delayMs);
  trafficRuntime.nextRunAt = new Date(Date.now() + boundedDelay).toISOString();
  trafficTimer = setTimeout(() => {
    runTrafficCollection("scheduled-official-collector").catch(() => undefined);
  }, boundedDelay);
  trafficTimer.unref();
}

async function readDailyProductionAutomation() {
  for (const receiptPath of [dailyAutomationReceiptFile, dailyAutomationFile]) {
    try {
      const payload = JSON.parse((await readFile(receiptPath, "utf8")).replace(/^\uFEFF/, ""));
      const receipt = payload.production || payload;
      return {
        configured: true,
        id: String(receipt.id || receipt.automationId || ""),
        name: String(receipt.name || "Daily Blender artifact and seeding drafts"),
        enabled: receipt.enabled !== false,
        timezone: String(receipt.timezone || "Asia/Saigon"),
        rrule: String(receipt.rrule || ""),
        nextRunAt: receipt.nextRunAt || null,
        workspaceId: String(receipt.workspaceId || "")
      };
    } catch (error) {
      if (error.code === "ENOENT" || error instanceof SyntaxError) continue;
      throw error;
    }
  }
  return { configured: false, enabled: false, nextRunAt: null };
}

async function readBrowserTrafficAutomation() {
  try {
    const receipt = JSON.parse((await readFile(browserAutomationFile, "utf8")).replace(/^\uFEFF/, ""));
    return {
      configured: true,
      id: String(receipt.id || ""),
      name: String(receipt.name || "Browser verified traffic tracking"),
      enabled: receipt.enabled !== false,
      timezone: String(receipt.timezone || "Asia/Saigon"),
      rrule: String(receipt.rrule || ""),
      nextRunAt: receipt.nextRunAt || null,
      workspaceId: String(receipt.workspaceId || ""),
      mode: "browser_verified"
    };
  } catch (error) {
    if (error.code === "ENOENT" || error instanceof SyntaxError) {
      return { configured: false, enabled: false, nextRunAt: null, mode: "browser_verified" };
    }
    throw error;
  }
}

async function runTrafficCollection(actor = "scheduled-official-collector") {
  if (!trafficRuntime.enabled) throw new Error("Traffic collector is disabled");
  if (trafficRuntime.running) return { skipped: true, reason: "collector_already_running" };
  trafficRuntime.running = true;
  trafficRuntime.lastStartedAt = new Date().toISOString();
  try {
    const results = await service.collectAllMetrics(actor);
    trafficRuntime.lastSummary = {
      total: results.length,
      succeeded: results.filter((item) => item.ok === true).length,
      failed: results.filter((item) => item.ok === false).length,
      unknown: results.filter((item) => item.ok === null).length
    };
    return results;
  } finally {
    trafficRuntime.running = false;
    trafficRuntime.lastCompletedAt = new Date().toISOString();
    scheduleTrafficCollection();
  }
}

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml"
};

function sendJson(response, status, body, headers = {}) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers
  });
  response.end(payload);
}

function tokenMatches(request, expectedToken) {
  const authorization = String(request.headers.authorization || "");
  if (!authorization.startsWith("Bearer ")) return false;
  const provided = Buffer.from(authorization.slice(7).trim());
  const expected = Buffer.from(expectedToken);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

function requestRole(request) {
  if (tokenMatches(request, operatorToken)) return "operator";
  if (tokenMatches(request, automationToken)) return "automation";
  return null;
}

function automationCanMutate(method, pathname) {
  if (method === "PATCH" && /^\/api\/campaigns\/[^/]+$/.test(pathname)) return true;
  if (method !== "POST") return false;
  return [
    /^\/api\/campaigns$/,
    /^\/api\/posts$/,
    /^\/api\/automation\/collect-now$/,
    /^\/api\/campaigns\/[^/]+\/artifacts$/,
    /^\/api\/campaigns\/[^/]+\/stories$/,
    /^\/api\/stories\/[^/]+\/channel-drafts$/,
    /^\/api\/schedules\/[^/]+\/runs$/,
    /^\/api\/posts\/[^/]+\/collect-metrics$/,
    /^\/api\/posts\/[^/]+\/browser-observations$/,
    /^\/api\/posts\/[^/]+\/interactions$/,
    /^\/api\/interactions\/[^/]+\/reply-draft$/
  ].some((pattern) => pattern.test(pathname));
}

async function readJson(request) {
  let payload = "";
  for await (const chunk of request) {
    payload += chunk;
    if (payload.length > 1_000_000) throw new Error("Request body too large");
  }
  return payload ? JSON.parse(payload) : {};
}

async function serveStatic(response, pathname) {
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const resolvedPublicRoot = path.resolve(publicRoot);
  const filePath = path.resolve(resolvedPublicRoot, relative);
  const relativeToPublic = path.relative(resolvedPublicRoot, filePath);
  if (relativeToPublic.startsWith("..") || path.isAbsolute(relativeToPublic)) return false;
  try {
    const payload = await readFile(filePath);
    response.writeHead(200, { "content-type": contentTypes[path.extname(filePath)] || "application/octet-stream" });
    response.end(payload);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      if (!path.extname(pathname)) {
        const indexPath = path.join(resolvedPublicRoot, "index.html");
        try {
          const indexPayload = await readFile(indexPath);
          response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
          response.end(indexPayload);
          return true;
        } catch (indexError) {
          if (indexError.code !== "ENOENT") throw indexError;
        }
      }
      return false;
    }
    throw error;
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || `${host}:${port}`}`);
  const role = requestRole(request);
  const actor = role === "operator" ? "local-human-operator" : role === "automation" ? "local-draft-automation" : "read-only-client";
  try {
    if (!["GET", "HEAD"].includes(request.method) && (!role || (role === "automation" && !automationCanMutate(request.method, url.pathname)))) {
      return sendJson(response, 401, { ok: false, error: "operator_token_required" }, {
        "www-authenticate": "Bearer realm=\"global-seeding\""
      });
    }
    if (request.method === "GET" && url.pathname === "/health") {
      return sendJson(response, 200, {
        ok: true, service: "global-seeding", stateFile,
        trafficCollector: trafficRuntime,
        dailyProduction: await readDailyProductionAutomation(),
        browserTracking: await readBrowserTrafficAutomation(),
        fixtureWorker: fixtureWorker.runtime()
      });
    }
    if (request.method === "GET" && url.pathname === "/api/operator/session") {
      if (role !== "operator") {
        return sendJson(response, 401, { ok: false, error: "operator_token_required" }, {
          "www-authenticate": "Bearer realm=\"global-seeding\""
        });
      }
      return sendJson(response, 200, { ok: true, actor });
    }
    if (request.method === "GET" && url.pathname === "/api/state") {
      if (role !== "operator") {
        return sendJson(response, 401, { ok: false, error: "operator_token_required" }, {
          "www-authenticate": "Bearer realm=\"global-seeding\""
        });
      }
      return sendJson(response, 200, await service.snapshot());
    }
    if (request.method === "GET" && url.pathname === "/api/dashboard") {
      return sendJson(response, 200, {
        ...(await service.dashboard()),
        autoGtm: await readAutoGtmFeed(autoGtmFeedFile),
        automation: {
          trafficCollector: trafficRuntime,
          dailyProduction: await readDailyProductionAutomation(),
          browserTracking: await readBrowserTrafficAutomation(),
          fixtureWorker: fixtureWorker.runtime()
        }
      });
    }
    if (request.method === "GET" && url.pathname === "/api/leads") {
      return sendJson(response, 200, await readAutoGtmFeed(autoGtmFeedFile));
    }
    if (request.method === "GET" && url.pathname === "/api/flow-graph") {
      return sendJson(response, 200, await service.flowGraph());
    }
    if (request.method === "POST" && url.pathname === "/api/bootstrap/r19") {
      return sendJson(response, 200, await service.bootstrapR19(actor));
    }
    if (request.method === "POST" && url.pathname === "/api/automation/collect-now") {
      return sendJson(response, 200, await runTrafficCollection(actor));
    }
    if (request.method === "POST" && url.pathname === "/api/campaigns") {
      return sendJson(response, 201, await service.createCampaign(await readJson(request), actor));
    }
    if (request.method === "POST" && url.pathname === "/api/targets") {
      return sendJson(response, 201, await service.createTarget(await readJson(request), actor));
    }
    if (request.method === "POST" && url.pathname === "/api/community-memberships") {
      return sendJson(response, 201, await service.createCommunityMembership(await readJson(request), actor));
    }
    if (request.method === "POST" && url.pathname === "/api/posts") {
      return sendJson(response, 201, await service.createPost(await readJson(request), actor));
    }
    let match = url.pathname.match(/^\/api\/campaigns\/([^/]+)$/);
    if (request.method === "PATCH" && match) {
      return sendJson(response, 200, await service.updateCampaign(match[1], await readJson(request), actor));
    }
    match = url.pathname.match(/^\/api\/campaigns\/([^/]+)\/artifacts$/);
    if (request.method === "POST" && match) {
      return sendJson(response, 201, await service.registerArtifact(match[1], await readJson(request), actor));
    }
    match = url.pathname.match(/^\/api\/campaigns\/([^/]+)\/stories$/);
    if (request.method === "POST" && match) {
      return sendJson(response, 201, await service.createStory(match[1], await readJson(request), actor));
    }
    match = url.pathname.match(/^\/api\/stories\/([^/]+)\/channel-drafts$/);
    if (request.method === "POST" && match) {
      return sendJson(response, 201, await service.createChannelDrafts(match[1], await readJson(request), actor));
    }
    match = url.pathname.match(/^\/api\/campaigns\/([^/]+)\/schedules$/);
    if (request.method === "POST" && match) {
      return sendJson(response, 201, await service.createSchedule(match[1], await readJson(request), actor));
    }
    match = url.pathname.match(/^\/api\/schedules\/([^/]+)$/);
    if (request.method === "PATCH" && match) {
      return sendJson(response, 200, await service.updateSchedule(match[1], await readJson(request), actor));
    }
    match = url.pathname.match(/^\/api\/schedules\/([^/]+)\/runs$/);
    if (request.method === "POST" && match) {
      return sendJson(response, 201, await service.recordScheduleRun(match[1], await readJson(request), actor));
    }
    match = url.pathname.match(/^\/api\/campaigns\/([^/]+)\/keywords\/metrics$/);
    if (request.method === "POST" && match) {
      return sendJson(response, 201, await service.recordKeywordMetrics(match[1], await readJson(request), actor));
    }
    match = url.pathname.match(/^\/api\/targets\/([^/]+)$/);
    if (request.method === "PATCH" && match) {
      return sendJson(response, 200, await service.updateTarget(match[1], await readJson(request), actor));
    }
    match = url.pathname.match(/^\/api\/community-memberships\/([^/]+)$/);
    if (request.method === "PATCH" && match) {
      return sendJson(response, 200, await service.updateCommunityMembership(match[1], await readJson(request), actor));
    }
    match = url.pathname.match(/^\/api\/posts\/([^/]+)$/);
    if (request.method === "PATCH" && match) {
      return sendJson(response, 200, await service.updatePost(match[1], await readJson(request), actor));
    }
    match = url.pathname.match(/^\/api\/posts\/([^/]+)\/approve$/);
    if (request.method === "POST" && match) {
      return sendJson(response, 200, await service.approvePost(match[1], actor));
    }
    match = url.pathname.match(/^\/api\/posts\/([^/]+)\/transition$/);
    if (request.method === "POST" && match) {
      return sendJson(response, 200, await service.transitionPost(match[1], await readJson(request), actor));
    }
    match = url.pathname.match(/^\/api\/posts\/([^/]+)\/metrics$/);
    if (request.method === "POST" && match) {
      return sendJson(response, 201, await service.recordMetrics(match[1], await readJson(request), actor));
    }
    match = url.pathname.match(/^\/api\/posts\/([^/]+)\/collect-metrics$/);
    if (request.method === "POST" && match) {
      return sendJson(response, 201, await service.collectMetrics(match[1], actor));
    }
    match = url.pathname.match(/^\/api\/posts\/([^/]+)\/browser-observations$/);
    if (request.method === "POST" && match) {
      return sendJson(response, 201, await service.recordBrowserObservation(match[1], await readJson(request), actor));
    }
    match = url.pathname.match(/^\/api\/posts\/([^/]+)\/interactions$/);
    if (request.method === "POST" && match) {
      return sendJson(response, 201, await service.addInteraction(match[1], await readJson(request), actor));
    }
    match = url.pathname.match(/^\/api\/interactions\/([^/]+)\/reply-draft$/);
    if (request.method === "POST" && match) {
      return sendJson(response, 201, await service.draftReply(match[1], await readJson(request), actor));
    }
    match = url.pathname.match(/^\/api\/replies\/([^/]+)\/approve$/);
    if (request.method === "POST" && match) {
      return sendJson(response, 200, await service.approveReply(match[1], actor));
    }
    match = url.pathname.match(/^\/api\/replies\/([^/]+)\/sent$/);
    if (request.method === "POST" && match) {
      return sendJson(response, 200, await service.markReplySent(match[1], await readJson(request), actor));
    }
    match = url.pathname.match(/^\/api\/campaigns\/([^/]+)\/conversions$/);
    if (request.method === "POST" && match) {
      return sendJson(response, 201, await service.recordConversion(match[1], await readJson(request), actor));
    }
    if (request.method === "GET" && await serveStatic(response, url.pathname)) return;
    sendJson(response, 404, { ok: false, error: "not_found" });
  } catch (error) {
    sendJson(response, 400, { ok: false, error: error.message });
  }
});

server.listen(port, host, () => {
  const address = server.address();
  process.stdout.write(`Jang Global Seeding dashboard: http://${host}:${address.port}\n`);
  fixtureWorker.start();
});

if (trafficPollMinutes > 0) {
  const initialDelay = lastCollectorAt
    ? Math.max(1_000, lastCollectorAt + trafficIntervalMs - Date.now())
    : trafficIntervalMs;
  scheduleTrafficCollection(initialDelay);
}

function shutdown() {
  shuttingDown = true;
  if (trafficTimer) clearTimeout(trafficTimer);
  fixtureWorker.stop();
  server.close(() => {
    store.releaseWriterLease().finally(() => process.exit(0));
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export { server, service };
