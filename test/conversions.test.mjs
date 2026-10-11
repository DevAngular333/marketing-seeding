import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { JsonStore } from "../src/store.mjs";
import { SeedingService } from "../src/service.mjs";

test("organic conversion events require consent metadata and deduplicate source event IDs", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "seeding-conversion-test-"));
  const productRepo = path.join(directory, "repo");
  await mkdir(productRepo);
  const service = new SeedingService(new JsonStore(path.join(directory, "state.json")));
  await service.init();
  const campaign = await service.createCampaign({ name: "Fixture", objective: "Organic leads", productRepo });
  const input = {
    eventId: "lead-001", source: "organic-landing-page", name: "qualified_lead", valueMinor: 25000,
    currency: "VND", occurredAt: "2026-10-06T08:00:00.000Z", consentBasis: "first-party form consent"
  };
  const conversion = await service.recordConversion(campaign.id, input);
  assert.equal(conversion.valueMinor, 25000);
  await assert.rejects(service.recordConversion(campaign.id, input), /Duplicate conversion/);
});
