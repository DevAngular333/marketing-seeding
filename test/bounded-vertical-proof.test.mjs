import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { JsonStore } from "../src/store.mjs";
import { SeedingService } from "../src/service.mjs";
import { JevExecutionWorker } from "../src/jev-execution-worker.mjs";
import { PLATFORM_CAPABILITIES, PlatformAdapterRegistry } from "../src/platform-registries.mjs";

function fixtureRegistry(calls) {
  const registry = new PlatformAdapterRegistry();
  registry.register("threads", {
    contractVersion: 1,
    capabilities: Object.fromEntries(PLATFORM_CAPABILITIES.map((item) => [item, false])),
    async execute() {
      calls.push("execute");
      return {
        submitState: "NOT_STARTED",
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        errorClassification: "NONE",
        gates: { fixtureReady: true },
      };
    },
    async reconcile() { throw new Error("bounded proof must never reconcile"); },
  });
  return registry;
}

test("bounded product-to-distribution vertical is local-real and restart safe", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "bounded-vertical-proof-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const productRepo = path.join(directory, "product");
  await mkdir(productRepo);
  const readme = [
    "A bounded distribution runtime is a local campaign system.",
    "It solves unsafe repeated dispatch by validating exact evidence and identity.",
    "It is deterministic and evidence grounded for builders and operators.",
  ].join("\n");
  await writeFile(path.join(productRepo, "README.md"), readme, "utf8");
  const stateFile = path.join(directory, "state.json");
  const service = new SeedingService(new JsonStore(stateFile));
  await service.init();
  const campaign = await service.createCampaign({ name: "Bounded vertical proof", objective: "Prove local autonomous distribution composition", productRepo }, "operator");
  await service.updateCampaign(campaign.id, { status: "active" }, "operator");

  const accountId = "threads-bounded-proof";
  const profileId = "bounded-proof-profile";
  await service.registerExecutionAccount({ platform: "threads", accountId, profileId, status: "enabled", health: "healthy" }, "operator");
  const target = await service.createTarget({ channel: "threads", name: "Bounded proof audience", url: "https://www.threads.net/@bounded-proof", accountId, profileId, status: "active" }, "operator");
  await service.updateTarget(target.id, {
    status: "active",
    readiness: { state: "ready", checkedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(), checks: { sessionValid: true, composerCapable: true, platformAvailable: true } },
  }, "readiness-proof");

  const inspection = await service.inspectProductIntelligence(campaign.id, {
    allowlist: ["README.md"],
    claims: [
      { id: "what", field: "WHAT_IS_IT", text: "A bounded distribution runtime is a local campaign system.", evidenceRefs: ["repo:README.md"] },
      { id: "problem", field: "WHAT_PROBLEM_DOES_IT_SOLVE", text: "It solves unsafe repeated dispatch by validating exact evidence and identity.", evidenceRefs: ["repo:README.md"] },
      { id: "better", field: "WHY_IS_IT_BETTER", text: "It is deterministic and evidence grounded for builders and operators.", evidenceRefs: ["repo:README.md"] },
      { id: "who", field: "WHO_NEEDS_IT", text: "Builders and operators need a bounded distribution runtime.", evidenceRefs: ["repo:README.md"] },
    ],
  }, "product-intelligence");
  assert.equal(inspection.productIntelligence.handoff.readinessStatus, "READY");
  const sourceHash = createHash("sha256").update(readme).digest("hex");
  const story = await service.createStory(campaign.id, {
    title: "Evidence first distribution",
    angle: "Bounded execution",
    audience: "builders",
    callToAction: "Inspect the evidence",
    groundingSources: ["README.md"],
    claimIds: ["what", "problem", "better", "who"],
  }, "content-planner");

  const authorization = await service.authorizeCampaign(campaign.id, {
    id: "bounded-vertical-standing-authorization",
    validFrom: new Date(Date.now() - 60_000).toISOString(),
    validUntil: new Date(Date.now() + 60 * 60_000).toISOString(),
    destinations: [{ platform: "threads", accountId, profileId, targetId: target.id }],
    approvedAssets: [],
    contentBoundary: {
      mode: "approved_template_set",
      approvedClaims: [
        { id: "what", text: "A bounded distribution runtime is a local campaign system.", sourceRefs: [{ relativePath: "README.md", sha256: sourceHash }] },
        { id: "problem", text: "It solves unsafe repeated dispatch by validating exact evidence and identity.", sourceRefs: [{ relativePath: "README.md", sha256: sourceHash }] },
        { id: "better", text: "It is deterministic and evidence grounded for builders and operators.", sourceRefs: [{ relativePath: "README.md", sha256: sourceHash }] },
        { id: "who", text: "Builders and operators need a bounded distribution runtime.", sourceRefs: [{ relativePath: "README.md", sha256: sourceHash }] },
      ],
      templates: [{ id: "bounded-template", platform: "threads", template: "{{claim:what}} {{claim:problem}} {{claim:better}} {{claim:who}}" }],
    },
    audienceRules: { allowedAudiences: ["builders"] },
    publicationVisibilityRules: { allowedVisibilities: ["PUBLIC"] },
    schedule: { timezone: "UTC", weekdays: [new Date().getUTCDay()], startLocal: "00:00", endLocal: "23:59" },
    rateLimits: { maxJobsPerAccountPerDay: 1, maxJobsPerCampaignPerDay: 1, maxConcurrency: 1, minIntervalMinutes: 0 },
    allowLiveExecution: true,
    executionMode: "standing_autonomous",
    standingAuthorizationReference: "bounded-vertical-standing-reference",
  }, "operator");
  const [candidate] = await service.deriveTemplateContentCandidates(campaign.id, { storyId: story.id, templateId: "bounded-template" }, "content-planner");
  await service.store.mutate("test", "mark_bounded_rehearsal_candidate", (state) => {
    const row = state.campaigns.find((item) => item.id === campaign.id).contentCandidates.find((item) => item.contentId === candidate.contentId);
    row.rehearsalMetadata = { enabled: true, campaignId: campaign.id, storyId: story.id, templateId: "bounded-template", candidateId: candidate.contentId, contentId: candidate.contentId, contentIdentity: candidate.contentIdentity, contentHash: candidate.contentHash, targetId: target.id, authorizationId: authorization.id };
    return state;
  });
  await service.store.mutate("test", "seed_protected_unknown", (state) => {
    state.executionRequests.push({ executionId: "protected-unknown", jobId: "protected-job", state: "SUBMIT_RESULT_UNKNOWN", submitState: "UNKNOWN", dryRun: false, request: { executionId: "protected-unknown", dryRun: false } });
    state.submissionUncertainties.push({ id: "protected-unknown-record", executionId: "protected-unknown", jobId: "protected-job", status: "UNKNOWN", reasonCode: "proof_fixture" });
    return state;
  });

  const calls = [];
  const handoff = await service.handoffRehearsalCandidates();
  assert.deepEqual(handoff.results.map((item) => item.status), ["REQUEST_READY"]);
  const preRun = await service.snapshot();
  const executionId = preRun.executionRequests.find((item) => item.dryRun === true).executionId;
  assert.equal(preRun.oneTimeExecutionWindows.length, 0, "dry-run rehearsal must not derive live windows");
  assert.equal(preRun.liveExecutionGrants.length, 0, "dry-run rehearsal must not derive live grants");

  const worker = new JevExecutionWorker({ service, adapterRegistry: fixtureRegistry(calls), workerId: "bounded-proof-worker", env: {} });
  const firstRun = await worker.runReadyDryRunOnce();
  assert.equal(firstRun.length, 1);
  assert.equal(firstRun[0].status, "DRY_RUN_COMPLETE");
  assert.deepEqual(calls, ["execute"]);
  const firstState = await service.snapshot();
  const protectedUnknown = {
    request: firstState.executionRequests.find((item) => item.executionId === "protected-unknown"),
    uncertainty: firstState.submissionUncertainties.find((item) => item.executionId === "protected-unknown"),
  };
  assert.equal(firstState.executionReceipts.filter((item) => item.executionId === executionId).length, 1);
  assert.equal(firstState.posts.filter((item) => item.status === "published").length, 0);
  assert.equal(firstState.publicationAttempts.length, 0);

  const cycle = await service.runCampaignControlCycle(campaign.id, { now: new Date().toISOString() }, "control-cycle");
  assert.ok(cycle.strategy && cycle.learning);
  const restarted = new SeedingService(new JsonStore(stateFile));
  await restarted.init();
  const repeatedHandoff = await restarted.handoffRehearsalCandidates();
  assert.equal(repeatedHandoff.results[0].status, "DRY_RUN_COMPLETE");
  const restartedWorker = new JevExecutionWorker({ service: restarted, adapterRegistry: fixtureRegistry(calls), workerId: "bounded-proof-restart", env: {} });
  assert.deepEqual(await restartedWorker.runReadyDryRunOnce(), []);
  assert.deepEqual(calls, ["execute"]);
  const finalState = await restarted.snapshot();
  assert.equal(finalState.executionRequests.filter((item) => item.executionId === executionId).length, 1);
  assert.equal(finalState.posts.filter((item) => item.status === "published").length, 0);
  assert.equal(finalState.submissionUncertainties.length, 1);
  assert.deepEqual(finalState.executionRequests.find((item) => item.executionId === "protected-unknown"), protectedUnknown.request);
  assert.deepEqual(finalState.submissionUncertainties.find((item) => item.executionId === "protected-unknown"), protectedUnknown.uncertainty);
  assert.equal((await readFile(stateFile, "utf8")).includes("credential/session material exists"), false);
});
