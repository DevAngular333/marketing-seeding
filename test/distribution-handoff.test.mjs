import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { JsonStore } from "../src/store.mjs";
import { SeedingService } from "../src/service.mjs";
import { legacyHandoffIdentity, validateDistributionHandoff } from "../src/distribution-handoff.mjs";

async function fixture() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "handoff-")); const repo = path.join(dir, "repo"); await mkdir(repo); await writeFile(path.join(repo, "README.md"), "evidence");
  const stateFile = path.join(dir, "state.json");
  const service = new SeedingService(new JsonStore(stateFile)); await service.init();
  const campaign = await service.createCampaign({ name: "C", objective: "O", productRepo: repo });
  const target = await service.createTarget({ channel: "threads", name: "T", url: "https://threads.net/x", accountId: "a", status: "active" });
  const content = "Grounded content"; const candidate = { contentId: "content-1", contentIdentity: "identity-1", targetId: target.id, content };
  await service.store.mutate("fixture", "candidate_seeded", state => { const row = state.campaigns.find(c => c.id === campaign.id); row.contentCandidates = [candidate]; return row; });
  const artifact = await service.registerArtifact(campaign.id, { path: "README.md", name: "README", mediaType: "text/plain", evidence: "fixture evidence" });
  return { service, stateFile, campaign, target, candidate, content, artifact };
}
function input(f, extra = {}) { return { mode: "DRY_RUN", campaignId: f.campaign.id, productId: f.campaign.id, content: { contentId: f.candidate.contentId, contentIdentity: f.candidate.contentIdentity, sha256: createHash("sha256").update(f.content).digest("hex") }, platform: { targetId: f.target.id }, ...extra }; }
function canonicalInput(f, extra = {}) {
  return {
    mode: "DRY_RUN", campaignId: f.campaign.id, handoffVersion: 1, productRun: { productId: f.campaign.id, objective: "O", status: "COMPLETED", pipelineIds: ["pipeline-1"], artifactRefs: ["product-1"], mediaRefs: [f.artifact.id], contentVariantRefs: [f.candidate.contentId], campaignRefs: [f.campaign.id], distributionIntentRefs: ["intent-1"], metadata: {}, createdAt: "2026-10-17T00:00:00Z" },
    productArtifacts: [{ artifactId: "product-1", productId: f.campaign.id, producerModuleId: "fixture", producerStepId: "step-1", pipelineId: "pipeline-1", productType: "text", files: ["README.md"], previewAssets: [], metadata: {}, technicalSpecs: {}, createdAt: "2026-10-17T00:00:00Z" }],
    mediaArtifacts: [{ mediaArtifactId: f.artifact.id, productId: f.campaign.id, pipelineId: "pipeline-1", producerModuleId: "fixture", producerStepId: "step-1", mediaType: f.artifact.mediaType, fileRef: "README.md", metadata: { sha256: f.artifact.sha256 }, sourceArtifactRefs: ["product-1"], createdAt: "2026-10-17T00:00:00Z" }],
    contentVariants: [{ contentVariantId: f.candidate.contentId, productId: f.campaign.id, pipelineId: "pipeline-1", sourceArtifactRefs: ["product-1"], sourceMediaRefs: [f.artifact.id], format: "text", angle: "evidence", audience: "general", platformHints: ["threads"], text: f.content, mediaRefs: [f.artifact.id], metadata: { contentIdentity: f.candidate.contentIdentity }, provenance: {}, producerModuleId: "fixture", producerStepId: "step-1", createdAt: "2026-10-17T00:00:00Z" }],
    contentPackage: { contentPackageId: "package-1", productId: f.campaign.id, contentVariantRefs: [f.candidate.contentId], mediaVariantRefs: [f.artifact.id], sourceArtifactRefs: ["product-1"], metadata: {}, createdAt: "2026-10-17T00:00:00Z", pipelineId: "pipeline-1", producerModuleId: "fixture", producerStepId: "step-1" },
    distributionIntent: { distributionIntentId: "intent-1", productId: f.campaign.id, contentVariantRefs: [f.candidate.contentId], mediaRefs: [f.artifact.id], objective: "O", audienceHints: [], platformHints: ["threads"], metadata: {}, createdAt: "2026-10-17T00:00:00Z", pipelineId: "pipeline-1", producerModuleId: "fixture", producerStepId: "step-1", contentPackageRef: "package-1" },
    platform: { targetId: f.target.id }, ...extra
  };
}

test("valid dry-run handoff persists idempotently and never dispatches", async () => {
  const f = await fixture(); const before = await f.service.snapshot(); const first = await f.service.attachDistributionHandoff(f.campaign.id, input(f)); const second = await f.service.attachDistributionHandoff(f.campaign.id, input(f));
  assert.equal(first.result.liveDispatch, false); assert.equal(first.result.publicationAttempts, 0); assert.equal(first.result.canonicalStateTouched, true); assert.equal(first.handoff.handoffHash, second.handoff.handoffHash);
  const after = await f.service.snapshot();
  assert.equal(after.posts.length, before.posts.length);
  assert.equal(after.executionRequests.length, before.executionRequests.length);
  assert.equal(after.campaignAuthorizations.length, before.campaignAuthorizations.length);
  const restarted = new SeedingService(new JsonStore(f.stateFile)); await restarted.init();
  const dash = await restarted.dashboard(); assert.equal(dash.distributionHandoffs.length, 1);
  assert.equal(dash.distributionHandoffs[0].handoffHash, first.handoff.handoffHash);
});
test("LIVE and cross-reference or integrity failures fail closed", async () => {
  const f = await fixture(); await assert.rejects(f.service.attachDistributionHandoff(f.campaign.id, input(f, { mode: "LIVE" })), /only explicit DRY_RUN/);
  await assert.rejects(f.service.attachDistributionHandoff(f.campaign.id, input(f, { productId: "other" })), /productId mismatch/);
  await assert.rejects(f.service.attachDistributionHandoff(f.campaign.id, input(f, { content: { ...input(f).content, sha256: "0".repeat(64) } })), /content sha256 mismatch/);
});
test("execution internals are rejected recursively", async () => {
  const f = await fixture(); await assert.rejects(f.service.attachDistributionHandoff(f.campaign.id, input(f, { metadata: { browserProfile: "x" } })), /forbidden/);
});
test("equivalent handoff key order has stable identity", async () => {
  const f = await fixture(); const a = input(f); const b = { platform: a.platform, content: a.content, productId: a.productId, campaignId: a.campaignId, mode: a.mode };
  assert.equal(validateDistributionHandoff(a, { state: await f.service.snapshot(), campaignId: f.campaign.id }).handoff.handoffHash, validateDistributionHandoff(b, { state: await f.service.snapshot(), campaignId: f.campaign.id }).handoff.handoffHash);
});

test("canonical provider-neutral envelope maps into the existing dry-run seam", async () => {
  const f = await fixture(); const before = await f.service.snapshot();
  const result = await f.service.attachDistributionHandoff(f.campaign.id, canonicalInput(f));
  assert.equal(result.result.liveDispatch, false); assert.equal(result.result.publicationAttempts, 0);
  assert.equal(result.handoff.content.contentId, f.candidate.contentId);
  assert.equal(result.handoff.media[0].artifactId, f.artifact.id);
  const after = await f.service.snapshot();
  assert.equal(after.posts.length, before.posts.length); assert.equal(after.executionRequests.length, before.executionRequests.length);
});

test("canonical envelope rejects identity, integrity and execution internals before persistence", async () => {
  const f = await fixture();
  await assert.rejects(f.service.attachDistributionHandoff(f.campaign.id, canonicalInput(f, { distributionIntent: { ...canonicalInput(f).distributionIntent, productId: "other" } })), /product identity mismatch/);
  await assert.rejects(f.service.attachDistributionHandoff(f.campaign.id, canonicalInput(f, { mediaArtifacts: [{ ...canonicalInput(f).mediaArtifacts[0], metadata: { sha256: "0".repeat(64) } }] })), /sha256 mismatch/);
  await assert.rejects(f.service.attachDistributionHandoff(f.campaign.id, canonicalInput(f, { productRun: { ...canonicalInput(f).productRun, metadata: { browserProfile: "forbidden" } } })), /forbidden/);
  const state = await f.service.snapshot(); assert.equal(state.campaigns.find((item) => item.id === f.campaign.id).distributionHandoffs?.length || 0, 0);
});

test("canonical envelope requires the provider-neutral version contract", async () => {
  const f = await fixture(); const base = canonicalInput(f);
  await assert.rejects(f.service.attachDistributionHandoff(f.campaign.id, { ...base, handoffVersion: 2 }), /handoffVersion/);
  const result = await f.service.attachDistributionHandoff(f.campaign.id, base);
  assert.equal(result.handoff.handoffVersion, 1);
});

test("versioned replay reuses a legacy pre-version row", async () => {
  const f = await fixture(); const base = canonicalInput(f);
  const validation = validateDistributionHandoff(base, { state: await f.service.snapshot(), campaignId: f.campaign.id });
  const legacy = { ...validation.handoff }; delete legacy.handoffVersion; legacy.handoffHash = legacyHandoffIdentity(validation.handoff);
  await f.service.store.mutate("fixture", "legacy_handoff_seeded", state => {
    const campaign = state.campaigns.find(item => item.id === f.campaign.id);
    campaign.distributionHandoffs = [legacy];
    return campaign;
  });
  await f.service.attachDistributionHandoff(f.campaign.id, base);
  const state = await f.service.snapshot();
  assert.equal(state.campaigns.find(item => item.id === f.campaign.id).distributionHandoffs.length, 1);
  assert.equal(state.campaigns.find(item => item.id === f.campaign.id).distributionHandoffs[0].handoffHash, legacy.handoffHash);
});

test("canonical envelope rejects duplicate or unresolved references and bounded violations", async () => {
  const f = await fixture(); const base = canonicalInput(f);
  await assert.rejects(f.service.attachDistributionHandoff(f.campaign.id, { ...base, mediaArtifacts: [...base.mediaArtifacts, { ...base.mediaArtifacts[0] }] }), /unique|exactly/);
  await assert.rejects(f.service.attachDistributionHandoff(f.campaign.id, { ...base, distributionIntent: { ...base.distributionIntent, mediaRefs: [f.artifact.id, "missing"] } }), /exactly|does not resolve|media reference mismatch/);
  await assert.rejects(f.service.attachDistributionHandoff(f.campaign.id, { ...base, metadata: { oversized: "x".repeat(100_001) } }), /exceeds|oversized/);
  await assert.rejects(f.service.attachDistributionHandoff(f.campaign.id, { ...base, contentVariants: [{ ...base.contentVariants[0], metadata: { contentIdentity: f.candidate.contentIdentity, sha256: "0".repeat(64) } }] }), /content sha256 mismatch/);
  await assert.rejects(f.service.attachDistributionHandoff(f.campaign.id, { ...base, contentVariants: [{ ...base.contentVariants[0], sourceArtifactRefs: ["missing"] }] }), /source artifact reference mismatch/);
  await assert.rejects(f.service.attachDistributionHandoff(f.campaign.id, { ...base, contentPackage: { ...base.contentPackage, sourceArtifactRefs: ["missing"] } }), /package source artifact reference mismatch/);
  await assert.rejects(f.service.attachDistributionHandoff(f.campaign.id, { ...base, productRun: { ...base.productRun, createdAt: "" } }), /ProductRun.createdAt/);
  await assert.rejects(f.service.attachDistributionHandoff(f.campaign.id, { ...base, contentVariants: [{ ...base.contentVariants[0], producerStepId: "" }] }), /ContentVariant.producerStepId/);
  await assert.rejects(f.service.attachDistributionHandoff(f.campaign.id, { ...base, distributionIntent: { ...base.distributionIntent, metadata: undefined } }), /DistributionIntent.metadata/);
});
