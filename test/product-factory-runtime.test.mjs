import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { JsonStore } from "../src/store.mjs";
import { SeedingService } from "../src/service.mjs";

test("runProductFactory executes local evidence only and persists bounded run lineage", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "factory-runtime-"));
  await fs.writeFile(path.join(root, "package.json"), "{}\n");
  await fs.mkdir(path.join(root, "media"));
  await fs.writeFile(path.join(root, "media", "demo.mp4"), "fixture-video");
  const stateFile = path.join(root, "state.json");
  const store = new JsonStore(stateFile);
  const service = new SeedingService(store);
  await service.init();
  const campaign = await service.createCampaign({ name: "Factory", objective: "Local proof", productRepo: root });
  const before = await service.snapshot();
  const result = await service.runProductFactory(campaign.id, {});
  assert.equal(result.classification.kind, "node");
  assert.equal(result.execution.externalSideEffects, false);
  assert.equal(result.externalSideEffects, false);
  assert.equal(result.persisted, true);
  const after = await service.snapshot();
  assert.equal(after.revision, before.revision + 1);
  const saved = after.campaigns.find((item) => item.id === campaign.id);
  assert.equal(saved.productFactoryRuns.length, 1);
  assert.equal(saved.productFactoryRuns[0].id, result.id);
  assert.equal(saved.productFactoryRuns[0].externalSideEffects, false);
  assert.deepEqual(saved.productFactoryRuns[0].artifactDiscovery.candidates.map((item) => item.path), ["media/demo.mp4"]);
  assert.equal(saved.productFactoryRuns[0].artifacts.artifacts[0].sha256.length, 64);
});

test("runProductFactory rejects unknown campaign", async () => {
  const service = new SeedingService({ read: async () => ({ campaigns: [] }) });
  await assert.rejects(() => service.runProductFactory("missing"), /Campaign not found/);
});

test("factory run lineage is bounded and survives a new store instance", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "factory-lineage-") );
  await fs.writeFile(path.join(root, "package.json"), "{}\n");
  const stateFile = path.join(root, "state.json");
  const store = new JsonStore(stateFile);
  const service = new SeedingService(store);
  await service.init();
  const campaign = await service.createCampaign({ name: "Factory history", objective: "Bound history", productRepo: root });
  for (let index = 0; index < 26; index += 1) await service.runProductFactory(campaign.id, { artifactPaths: [] }, "automation");
  const restarted = new SeedingService(new JsonStore(stateFile));
  await restarted.init();
  const saved = (await restarted.snapshot()).campaigns.find((item) => item.id === campaign.id);
  assert.equal(saved.productFactoryRuns.length, 24);
  assert.equal(saved.productFactoryRuns.every((run) => run.externalSideEffects === false), true);
});
