import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { JsonStore } from "../src/store.mjs";
import { SeedingService } from "../src/service.mjs";

test("runProductFactory executes local evidence only and does not persist", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "factory-runtime-"));
  await fs.writeFile(path.join(root, "package.json"), "{}\n");
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
  assert.equal(result.persisted, false);
  const after = await service.snapshot();
  assert.equal(after.revision, before.revision);
});

test("runProductFactory rejects unknown campaign", async () => {
  const service = new SeedingService({ read: async () => ({ campaigns: [] }) });
  await assert.rejects(() => service.runProductFactory("missing"), /Campaign not found/);
});
