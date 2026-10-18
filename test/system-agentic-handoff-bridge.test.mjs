import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { JsonStore } from "../src/store.mjs";
import { SeedingService } from "../src/service.mjs";
import { createSystemAgenticHandoffEnvelope, consumeSystemAgenticHandoff, validateSystemAgenticHandoffEnvelope } from "../src/system-agentic-handoff-bridge.mjs";

async function fixture() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "system-agentic-handoff-bridge-"));
  const repo = path.join(dir, "repo");
  await mkdir(repo);
  await writeFile(path.join(repo, "README.md"), "bridge evidence\n");
  const stateFile = path.join(dir, "state.json");
  const service = new SeedingService(new JsonStore(stateFile));
  await service.init();
  const campaign = await service.createCampaign({ name: "Bridge", objective: "Dry-run bridge", productRepo: repo });
  const target = await service.createTarget({ channel: "threads", name: "Fixture", url: "https://threads.net/fixture", accountId: "fixture", status: "active" });
  const content = "Bridge content grounded in local evidence";
  const candidate = { contentId: "bridge-content", contentIdentity: "bridge-identity", targetId: target.id, content };
  await service.store.mutate("fixture", "bridge_candidate_seeded", (state) => {
    state.campaigns.find((item) => item.id === campaign.id).contentCandidates = [candidate];
    return candidate;
  });
  const artifact = await service.registerArtifact(campaign.id, { path: "README.md", name: "README", mediaType: "text/plain", evidence: "local fixture" });
  const payload = {
    mode: "DRY_RUN", campaignId: campaign.id, handoffVersion: 1,
    productRun: { productId: campaign.id, objective: campaign.objective, status: "COMPLETED", pipelineIds: ["bridge-pipeline"], artifactRefs: ["product-artifact"], mediaRefs: [artifact.id], contentVariantRefs: [candidate.contentId], campaignRefs: [campaign.id], distributionIntentRefs: ["bridge-intent"], metadata: {}, createdAt: "2026-10-18T00:00:00Z" },
    productArtifacts: [{ artifactId: "product-artifact", productId: campaign.id, producerModuleId: "fixture", producerStepId: "bridge-step", pipelineId: "bridge-pipeline", productType: "text", files: ["README.md"], metadata: {}, technicalSpecs: {}, createdAt: "2026-10-18T00:00:00Z" }],
    mediaArtifacts: [{ mediaArtifactId: artifact.id, productId: campaign.id, pipelineId: "bridge-pipeline", producerModuleId: "fixture", producerStepId: "bridge-step", mediaType: artifact.mediaType, fileRef: "README.md", metadata: { sha256: artifact.sha256 }, sourceArtifactRefs: ["product-artifact"], createdAt: "2026-10-18T00:00:00Z" }],
    contentVariants: [{ contentVariantId: candidate.contentId, productId: campaign.id, pipelineId: "bridge-pipeline", sourceArtifactRefs: ["product-artifact"], sourceMediaRefs: [artifact.id], format: "text", angle: "evidence", audience: "general", platformHints: ["threads"], text: content, mediaRefs: [artifact.id], metadata: { contentIdentity: candidate.contentIdentity }, provenance: {}, producerModuleId: "fixture", producerStepId: "bridge-step", createdAt: "2026-10-18T00:00:00Z" }],
    contentPackage: { contentPackageId: "bridge-package", productId: campaign.id, contentVariantRefs: [candidate.contentId], mediaVariantRefs: [artifact.id], sourceArtifactRefs: ["product-artifact"], metadata: {}, createdAt: "2026-10-18T00:00:00Z", pipelineId: "bridge-pipeline", producerModuleId: "fixture", producerStepId: "bridge-step" },
    distributionIntent: { distributionIntentId: "bridge-intent", productId: campaign.id, contentVariantRefs: [candidate.contentId], mediaRefs: [artifact.id], objective: campaign.objective, audienceHints: ["general"], platformHints: ["threads"], metadata: {}, createdAt: "2026-10-18T00:00:00Z", pipelineId: "bridge-pipeline", producerModuleId: "fixture", producerStepId: "bridge-step", contentPackageRef: "bridge-package" },
    platform: { targetId: target.id }
  };
  return { dir, stateFile, service, campaign, target, candidate, artifact, payload, envelope: createSystemAgenticHandoffEnvelope(payload, { emittedAt: "2026-10-18T00:00:00Z" }) };
}

test("versioned upstream envelope consumes through the existing dry-run seam", async () => {
  const f = await fixture();
  const before = await f.service.snapshot();
  const first = await consumeSystemAgenticHandoff(f.service, f.envelope);
  assert.equal(first.bridge.bridgeVersion, 1);
  assert.equal(first.bridge.source.system, "SYSTEM_AGENTIC_AI");
  assert.equal(first.result.liveDispatch, false);
  assert.equal(first.result.publicationAttempts, 0);
  const after = await f.service.snapshot();
  assert.equal(after.campaigns.find((item) => item.id === f.campaign.id).distributionHandoffs.length, 1);
  assert.equal(after.posts.length, before.posts.length);
  assert.equal(after.executionRequests.length, before.executionRequests.length);
  assert.equal(after.oneTimeExecutionWindows.length, 0);
  assert.equal(after.liveExecutionGrants.length, 0);
  assert.equal(after.executionLeases.length, 0);
  assert.equal(after.publicationAttempts.length, 0);
});

test("replay after service restart is idempotent and creates no execution artifacts", async () => {
  const f = await fixture();
  const first = await consumeSystemAgenticHandoff(f.service, f.envelope);
  const restarted = new SeedingService(new JsonStore(f.stateFile));
  await restarted.init();
  const replay = await consumeSystemAgenticHandoff(restarted, f.envelope);
  assert.equal(replay.handoff.handoffHash, first.handoff.handoffHash);
  const state = await restarted.snapshot();
  assert.equal(state.campaigns.find((item) => item.id === f.campaign.id).distributionHandoffs.length, 1);
  for (const collection of ["posts", "executionRequests", "oneTimeExecutionWindows", "liveExecutionGrants", "executionLeases", "publicationAttempts", "submissionUncertainties"]) assert.equal(state[collection].length, 0, collection);
});

test("bridge rejects LIVE, version, timestamp, hash and forbidden envelope input", async () => {
  const f = await fixture();
  await assert.rejects(() => consumeSystemAgenticHandoff(f.service, { ...f.envelope, mode: "LIVE" }), /only explicit DRY_RUN/);
  await assert.rejects(() => consumeSystemAgenticHandoff(f.service, { ...f.envelope, bridgeVersion: 2 }), /unsupported/);
  await assert.rejects(() => consumeSystemAgenticHandoff(f.service, { ...f.envelope, emittedAt: "2026-10-18" }), /UTC ISO/);
  await assert.rejects(() => consumeSystemAgenticHandoff(f.service, { ...f.envelope, envelopeHash: "0".repeat(64) }), /hash mismatch/);
  await assert.rejects(() => consumeSystemAgenticHandoff(f.service, f.envelope, "fixture", { expectedCampaignId: "other-campaign" }), /does not match route/);
  await assert.rejects(() => consumeSystemAgenticHandoff(f.service, { ...f.envelope, payload: { ...f.envelope.payload, metadata: { browserProfile: "bad" } } }), /forbidden/);
  const malformed = { ...f.envelope, payload: { ...f.envelope.payload, contentVariants: [] } };
  delete malformed.envelopeHash;
  await assert.rejects(() => consumeSystemAgenticHandoff(f.service, malformed), /canonical content variant references must resolve exactly/);
  const sourceArray = { ...f.envelope, payload: { ...f.envelope.payload, source: [] } };
  delete sourceArray.envelopeHash;
  await assert.rejects(() => consumeSystemAgenticHandoff(f.service, sourceArray), /must not carry a second source envelope/);
  const state = await f.service.snapshot();
  assert.equal(state.campaigns.find((item) => item.id === f.campaign.id).distributionHandoffs?.length || 0, 0);
});

test("bridge identity is stable for equivalent payload key order", async () => {
  const f = await fixture();
  const reordered = {
    payload: { ...f.envelope.payload },
    campaignId: f.envelope.campaignId,
    mode: f.envelope.mode,
    emittedAt: f.envelope.emittedAt,
    source: { ...f.envelope.source },
    bridgeVersion: f.envelope.bridgeVersion
  };
  const first = validateSystemAgenticHandoffEnvelope(f.envelope);
  const second = validateSystemAgenticHandoffEnvelope(reordered);
  assert.equal(first.envelopeHash, second.envelopeHash);
  assert.match(createHash("sha256").update(f.candidate.content).digest("hex"), /^[a-f0-9]{64}$/);
});
