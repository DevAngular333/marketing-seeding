import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { JsonStore } from "../src/store.mjs";
import { SeedingService } from "../src/service.mjs";
import { FixtureWorkerBridge } from "../src/fixture-worker-bridge.mjs";

test("fixture worker bridge records a dry-run receipt without publishing", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "seeding-fixture-bridge-"));
  const store = new JsonStore(path.join(dataDir, "state.json"), { requireLease: true });
  await store.acquireWriterLease();
  try {
    const service = new SeedingService(store);
    await service.init();
    await store.mutate("test", "fixture_seed", (state) => {
      state.targets.push({ id: "target-1", channel: "threads", url: "https://www.threads.net/", accountId: "fixture", status: "active", rulesStatus: "not_required", readiness: { state: "ready" } });
      state.posts.push({ id: "post-1", campaignId: "campaign-1", targetId: "target-1", content: "fixture content", assetPath: null, status: "queued", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    });
    const bridge = new FixtureWorkerBridge({ service, enabled: true, cdpEnabled: false, endpoint: "http://127.0.0.1:9222" });
    const first = await bridge.runOnce();
    assert.equal(first.processed, 1);
    const after = await store.read();
    assert.equal(after.posts[0].status, "queued");
    assert.equal(after.posts[0].publicationUrl, undefined);
    assert.equal(after.fixtureAutomationRuns.length, 1);
    assert.equal(after.fixtureAutomationRuns[0].externalSideEffects, false);
    assert.match(after.fixtureAutomationRuns[0].fixturePublicationUrl, /^https:\/\/fixture\.local\//);
    const second = await bridge.runOnce();
    assert.equal(second.processed, 0);
  } finally {
    await store.releaseWriterLease();
  }
});

test("CDP mode rejects non-fixture domains before launching a browser", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "seeding-fixture-cdp-"));
  const store = new JsonStore(path.join(dataDir, "state.json"), { requireLease: true });
  await store.acquireWriterLease();
  try {
    const service = new SeedingService(store);
    await service.init();
    await store.mutate("test", "fixture_seed", (state) => {
      state.targets.push({ id: "target-1", channel: "threads", url: "https://www.threads.net/", accountId: "fixture", status: "active", rulesStatus: "not_required", readiness: { state: "ready" } });
      state.posts.push({ id: "post-1", campaignId: "campaign-1", targetId: "target-1", content: "fixture content", assetPath: null, status: "queued", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    });
    const bridge = new FixtureWorkerBridge({ service, enabled: true, cdpEnabled: true });
    await assert.rejects(() => bridge.runOnce(), /fixture\.local mock domains/);
  } finally {
    await store.releaseWriterLease();
  }
});

test("E2E live flag records a read-only DOM timeout and never publishes", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "seeding-fixture-e2e-"));
  const store = new JsonStore(path.join(dataDir, "state.json"), { requireLease: true });
  await store.acquireWriterLease();
  try {
    const service = new SeedingService(store);
    await service.init();
    await store.mutate("test", "fixture_seed", (state) => {
      state.targets.push({ id: "target-1", channel: "threads", url: "https://example.test/mock", accountId: "fixture", status: "active", rulesStatus: "not_required", readiness: { state: "ready" } });
      state.posts.push({ id: "post-1", campaignId: "campaign-1", targetId: "target-1", content: "fixture content", assetPath: null, status: "queued", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    });
    const bridge = new FixtureWorkerBridge({ service, enabled: true, e2eLive: true, cdpEnabled: false });
    const result = await bridge.runOnce();
    assert.equal(result.processed, 1);
    const after = await store.read();
    assert.equal(after.posts[0].status, "queued");
    assert.equal(after.fixtureAutomationRuns[0].e2eStatus, "e2e_dom_timeout");
    assert.equal(after.fixtureAutomationRuns[0].publicationUrl, null);
    assert.equal(after.fixtureAutomationRuns[0].externalSideEffects, false);
  } finally {
    await store.releaseWriterLease();
  }
});

test("E2E adapter reports network errors without publishing", async () => {
  const { FixtureAutomation } = await import(pathToFileURL(path.join(process.env.MARKETING_FIXTURE_ROOT || "D:\\build-agentic-AI\\marketing-seeding-fixture", "src", "automation.mjs")).href);
  const page = { async goto() { throw new Error("simulated network error"); } };
  const result = await new FixtureAutomation({ page }).publishMock({ id: "network-1", platform: "fixture", targetUrl: "https://fixture.local/network", content: "x", e2eLive: true });
  assert.equal(result.status, "e2e_network_error");
  assert.equal(result.externalSideEffects, false);
});
