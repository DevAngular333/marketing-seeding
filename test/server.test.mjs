import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createInitialState } from "../src/store.mjs";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("HTTP mutations require the local operator bearer token", async (context) => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "seeding-server-test-"));
  await writeFile(path.join(dataDir, "daily-automation.json"), JSON.stringify({
    id: "automation-fixture",
    enabled: true,
    timezone: "Etc/GMT-7",
    rrule: "FREQ=DAILY;BYHOUR=9;BYMINUTE=0",
    nextRunAt: "2026-10-07T02:00:00.000Z",
    workspaceId: "fixture-workspace"
  }));
  await writeFile(path.join(dataDir, "daily-product-seeding-automations.json"), JSON.stringify({
    production: {
      id: "full-receipt-fixture",
      name: "Daily Blender artifact and seeding drafts",
      enabled: true,
      timezone: "Etc/GMT-7",
      rrule: "FREQ=DAILY;BYHOUR=6;BYMINUTE=0",
      nextRunAt: "2026-10-07T00:00:00.000Z",
      workspaceId: "full-fixture-workspace"
    }
  }));
  await writeFile(path.join(dataDir, "browser-automation.json"), JSON.stringify({
    id: "browser-automation-fixture", enabled: true, timezone: "Asia/Saigon",
    rrule: "30 23 * * *", nextRunAt: "2026-10-07T12:00:00.000Z", workspaceId: "fixture-workspace"
  }));
  const autoGtmFeed = path.join(dataDir, "auto-gtm-feed.json");
  await writeFile(autoGtmFeed, JSON.stringify({
    schemaVersion: 1, source: "auto-gtm", status: "ready",
    generatedAt: new Date().toISOString(), campaignId: "campaign_r19_gt_course_validation",
    portfolioProduct: "course.example", leads: [{ leadId: "lead-fixture", segment: "artists",
      fit: 0.8, whyNow: 0.7, reach: null, privateEmail: "must-not-leak", evidence: [{
        signalId: "signal-fixture", source: "github", kind: "issue_pain",
        occurredAt: "2026-10-10T12:00:00Z", url: "https://github.com/org/repo/issues/1",
        snippet: "Public source evidence", secret: "must-not-leak"
      }] }]
  }));
  const initialState = createInitialState();
  initialState.collectorRuns.push({ id: "prior-cycle", postId: "fixture", channel: "threads", status: "unknown", at: new Date(Date.now() - 60 * 60_000).toISOString() });
  await writeFile(path.join(dataDir, "state.json"), JSON.stringify(initialState));
  const token = randomBytes(32).toString("hex");
  const automationToken = randomBytes(32).toString("hex");
  const child = spawn(process.execPath, ["src/server.mjs"], {
    cwd: appRoot,
    env: { ...process.env, OPENSSL_CONF: "", SEEDING_DATA_DIR: dataDir, SEEDING_AUTO_GTM_FEED_FILE: autoGtmFeed, SEEDING_PORT: "0", SEEDING_OPERATOR_TOKEN: token, SEEDING_AUTOMATION_TOKEN: automationToken, SEEDING_TRAFFIC_POLL_MINUTES: "240" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  context.after(() => child.kill());
  const baseUrl = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Fixture server did not start")), 10_000);
    child.once("error", reject);
    child.stderr.on("data", (chunk) => reject(new Error(chunk.toString())));
    child.stdout.on("data", (chunk) => {
      const match = chunk.toString().match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (match) { clearTimeout(timer); resolve(`http://127.0.0.1:${match[1]}`); }
    });
  });
  assert.equal((await fetch(`${baseUrl}/health`)).status, 200);
  assert.equal((await fetch(`${baseUrl}/api/dashboard`)).status, 200);
  const leadFeedResponse = await fetch(`${baseUrl}/api/leads`);
  assert.equal(leadFeedResponse.status, 200);
  const leadFeed = await leadFeedResponse.json();
  assert.equal(leadFeed.status, "ready");
  assert.equal(leadFeed.leads[0].leadId, "lead-fixture");
  assert.equal("privateEmail" in leadFeed.leads[0], false);
  assert.equal("secret" in leadFeed.leads[0].evidence[0], false);
  const dashboardWithLeads = await (await fetch(`${baseUrl}/api/dashboard`)).json();
  assert.equal(dashboardWithLeads.autoGtm.leadCount, 1);
  assert.equal((await fetch(`${baseUrl}/api/flow-graph`)).status, 200);
  assert.equal((await fetch(`${baseUrl}/..%2Fpackage.json`)).status, 404);
  assert.equal((await fetch(`${baseUrl}/api/operator/session`)).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/state`)).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/automation/collect-now`, { method: "POST" })).status, 401);
  const operatorSession = await fetch(`${baseUrl}/api/operator/session`, {
    headers: { authorization: `Bearer ${token}`, "x-agentic-actor": "test-operator" }
  });
  assert.equal(operatorSession.status, 200);
  assert.deepEqual(await operatorSession.json(), { ok: true, actor: "local-human-operator" });
  assert.equal((await fetch(`${baseUrl}/api/operator/session`, { headers: { authorization: `Bearer ${automationToken}` } })).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/state`, { headers: { authorization: `Bearer ${automationToken}` } })).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/state`, { headers: { authorization: `Bearer ${token}` } })).status, 200);
  const body = JSON.stringify({ name: "Fixture", objective: "Auth test", productRepo: appRoot });
  assert.equal((await fetch(`${baseUrl}/api/campaigns`, {
    method: "POST", headers: { "content-type": "application/json" }, body
  })).status, 401);
  const authorized = await fetch(`${baseUrl}/api/campaigns`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "x-agentic-actor": "test-operator" },
    body
  });
  assert.equal(authorized.status, 201);
  assert.equal((await authorized.json()).name, "Fixture");
  const automationDraftCampaign = await fetch(`${baseUrl}/api/campaigns`, {
    method: "POST",
    headers: { authorization: `Bearer ${automationToken}`, "content-type": "application/json" },
    body: JSON.stringify({ name: "Automation fixture", objective: "Draft only", productRepo: appRoot })
  });
  assert.equal(automationDraftCampaign.status, 201);
  assert.equal((await fetch(`${baseUrl}/api/bootstrap/r19`, {
    method: "POST", headers: { authorization: `Bearer ${automationToken}`, "content-type": "application/json" }, body: "{}"
  })).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/posts/missing/browser-observations`, {
    method: "POST", headers: { "content-type": "application/json" }, body: "{}"
  })).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/posts/missing/browser-observations`, {
    method: "POST", headers: { authorization: `Bearer ${automationToken}`, "content-type": "application/json" }, body: "{}"
  })).status, 400);
  const health = await (await fetch(`${baseUrl}/health`)).json();
  assert.equal(health.trafficCollector.enabled, true);
  assert.equal(health.trafficCollector.intervalMinutes, 240);
  assert.ok(health.trafficCollector.nextRunAt);
  const resumedDelayMinutes = (Date.parse(health.trafficCollector.nextRunAt) - Date.now()) / 60_000;
  assert.ok(resumedDelayMinutes > 178 && resumedDelayMinutes < 181, `expected persisted cadence, got ${resumedDelayMinutes} minutes`);
  assert.equal(health.dailyProduction.id, "full-receipt-fixture");
  assert.equal(health.dailyProduction.rrule, "FREQ=DAILY;BYHOUR=6;BYMINUTE=0");
  assert.equal(health.dailyProduction.enabled, true);
  assert.equal(health.browserTracking.id, "browser-automation-fixture");
  assert.equal(health.browserTracking.mode, "browser_verified");
  const dashboard = await (await fetch(`${baseUrl}/api/dashboard`)).json();
  assert.equal(dashboard.automation.dailyProduction.rrule, "FREQ=DAILY;BYHOUR=6;BYMINUTE=0");
  assert.equal(dashboard.automation.browserTracking.rrule, "30 23 * * *");
});
