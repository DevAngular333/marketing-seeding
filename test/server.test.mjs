import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createInitialState } from "../src/store.mjs";
import { campaignAuthorizationFingerprint, campaignContentHash, campaignScopeFingerprint, publicationIdentityKey } from "../src/campaign-authorization.mjs";

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
  const fixtureCampaign = { id: "live-grant-campaign", status: "active", productRepo: appRoot, objective: "fixture", audience: [], landingUrl: null };
  const fixtureTarget = { id: "live-grant-target", channel: "linkedin", accountId: "fixture-account", profileId: "11111111-2222-4333-8444-555555555555", url: "https://www.linkedin.com/feed/", status: "active" };
  const fixturePost = { id: "live-grant-job", campaignId: fixtureCampaign.id, targetId: fixtureTarget.id, contentId: "fixture-content", content: "Fixture approved content", audience: "public", status: "blocked", campaignAuthorizationId: "live-grant-auth",
    idempotencyKey: publicationIdentityKey({ campaignId: fixtureCampaign.id, contentId: "fixture-content", platform: "linkedin", accountId: fixtureTarget.accountId, targetId: fixtureTarget.id }) };
  const fixtureAuthorization = {
    id: "live-grant-auth", campaignId: fixtureCampaign.id, status: "active", campaignBinding: campaignScopeFingerprint(fixtureCampaign),
    validFrom: new Date(Date.now() - 60_000).toISOString(), validUntil: new Date(Date.now() + 60 * 60_000).toISOString(),
    destinations: [{ platform: "linkedin", accountId: fixtureTarget.accountId, profileId: fixtureTarget.profileId, targetId: fixtureTarget.id, targetUrl: fixtureTarget.url }],
    approvedAssets: [], contentBoundary: { mode: "approved_copy_set", contentHashes: [campaignContentHash(fixturePost.content)] },
    audienceRules: { allowedAudiences: ["public"] }, allowLiveExecution: true
  };
  fixtureAuthorization.binding = campaignAuthorizationFingerprint(fixtureAuthorization);
  fixturePost.campaignAuthorizationBinding = fixtureAuthorization.binding;
  initialState.campaigns.push(fixtureCampaign);
  initialState.targets.push(fixtureTarget);
  initialState.posts.push(fixturePost);
  initialState.executionAccounts.push({ id: "linkedin:fixture-account", platform: "linkedin", accountId: "fixture-account", profileId: fixtureTarget.profileId, status: "enabled", health: "healthy" });
  initialState.campaignAuthorizations.push(fixtureAuthorization);
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
  assert.equal((await fetch(`${baseUrl}/api/posts/fixture-job/execution-request/dry-run`, { method: "POST", headers: { authorization: `Bearer ${automationToken}` } })).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/posts/fixture-job/quarantine-unknown`, { method: "POST", headers: { authorization: `Bearer ${automationToken}`, "content-type": "application/json" }, body: JSON.stringify({}) })).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/submission-uncertainties/unknown-fixture`, { headers: { authorization: `Bearer ${automationToken}` } })).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/submission-uncertainties/unknown-fixture/reconcile`, { method: "POST", headers: { authorization: `Bearer ${automationToken}`, "content-type": "application/json" }, body: JSON.stringify({ outcome: "PROVEN_FAILED" }) })).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/execution-requests/fixture-execution/run-dry-run`, { method: "POST", headers: { authorization: `Bearer ${automationToken}` } })).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/state`, { headers: { authorization: `Bearer ${token}` } })).status, 200);
  const grantPayload = JSON.stringify({ jobId: fixturePost.id,
    validFrom: new Date(Date.now() - 30_000).toISOString(), validUntil: new Date(Date.now() + 10 * 60_000).toISOString(),
    operatorAuthorizationReference: "server-fixture-approval" });
  const grantHeaders = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  assert.equal((await fetch(`${baseUrl}/api/live-execution-grants`, { method: "POST", headers: { authorization: `Bearer ${automationToken}`, "content-type": "application/json" }, body: grantPayload })).status, 401);
  const grantResponse = await fetch(`${baseUrl}/api/live-execution-grants`, { method: "POST", headers: grantHeaders, body: grantPayload });
  assert.equal(grantResponse.status, 201);
  const liveGrant = await grantResponse.json();
  assert.equal(liveGrant.jobId, fixturePost.id);
  assert.equal((await fetch(`${baseUrl}/api/live-execution-grants/${liveGrant.grantId}`, { headers: { authorization: `Bearer ${automationToken}` } })).status, 401);
  assert.equal((await (await fetch(`${baseUrl}/api/live-execution-grants/${liveGrant.grantId}`, { headers: { authorization: `Bearer ${token}` } })).json()).status, "ACTIVE");
  assert.equal((await fetch(`${baseUrl}/api/live-execution-grants/${liveGrant.grantId}/revoke`, { method: "POST", headers: { authorization: `Bearer ${automationToken}` } })).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/live-execution-grants/${liveGrant.grantId}/revoke`, { method: "POST", headers: { authorization: `Bearer ${token}` } })).status, 200);
  assert.equal((await (await fetch(`${baseUrl}/api/live-execution-grants/${liveGrant.grantId}`, { headers: { authorization: `Bearer ${token}` } })).json()).status, "REVOKED");
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
