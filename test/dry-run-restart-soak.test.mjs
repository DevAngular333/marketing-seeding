import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { JsonStore } from "../src/store.mjs";
import { SeedingService } from "../src/service.mjs";
import { buildProductIntelligence } from "../src/product-intelligence.mjs";
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
        gates: { fixtureReady: true }
      };
    },
    async reconcile() {
      throw new Error("dry-run soak must not reconcile");
    }
  });
  return registry;
}

async function createSoakFixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "seeding-dry-run-soak-"));
  const stateFile = path.join(directory, "state.json");
  const productRepo = path.join(directory, "product");
  await mkdir(productRepo);
  const groundingText = "A bounded product runtime validates output before acceptance.\n";
  await writeFile(path.join(productRepo, "README.md"), groundingText, "utf8");

  const service = new SeedingService(new JsonStore(stateFile));
  await service.init();
  const campaign = await service.createCampaign({
    name: "Dry-run restart soak",
    objective: "Prove restart-safe local orchestration",
    productRepo
  }, "operator");
  const target = await service.createTarget({
    channel: "threads",
    name: "Fixture audience",
    url: "https://www.threads.net/@fixture",
    accountId: "threads_fixture",
    status: "active"
  }, "operator");
  const profileId = "dry-run-soak-profile";
  await service.registerExecutionAccount({
    platform: "threads",
    accountId: target.accountId,
    profileId,
    status: "enabled",
    health: "healthy"
  }, "operator");
  await service.updateTarget(target.id, {
    profileId,
    status: "active",
    readiness: {
      state: "ready",
      checkedAt: new Date().toISOString(),
      checks: { sessionValid: true, composerCapable: true, platformAvailable: true }
    }
  }, "operator");

  const document = buildProductIntelligence({
    productId: "dry-run-soak-product",
    evidence: [{ id: "readme", sourceType: "README", locator: "README.md", content: "A bounded product runtime." }],
    claims: [{ id: "what", field: "WHAT_IS_IT", text: "A bounded product runtime.", evidenceRefs: ["readme"] }]
  });
  await service.attachProductIntelligence(campaign.id, {
    document,
    sourceRepository: await realpath(productRepo),
    readinessStatus: "READY"
  }, "automation");
  const story = await service.createStory(campaign.id, {
    title: "Evidence first",
    angle: "Proof",
    audience: "builders",
    callToAction: "Learn more",
    groundingSources: ["README.md"],
    claimIds: ["what"]
  }, "automation");
  const sourceHash = createHash("sha256").update(groundingText).digest("hex");
  const authorization = await service.authorizeCampaign(campaign.id, {
    id: "dry-run-soak-authorization",
    validFrom: new Date(Date.now() - 60_000).toISOString(),
    validUntil: new Date(Date.now() + 60 * 60_000).toISOString(),
    destinations: [{ platform: "threads", accountId: target.accountId, profileId, targetId: target.id }],
    approvedAssets: [],
    contentBoundary: {
      mode: "approved_template_set",
      approvedClaims: [{ id: "what", text: "A bounded product runtime.", sourceRefs: [{ relativePath: "README.md", sha256: sourceHash }] }],
      templates: [{ id: "template-1", platform: "threads", template: "{{claim:what}}" }]
    },
    audienceRules: { allowedAudiences: ["builders"] },
    publicationVisibilityRules: { allowedVisibilities: ["PUBLIC"] },
    schedule: { timezone: "UTC", weekdays: [new Date().getUTCDay()], startLocal: "00:00", endLocal: "23:59" },
    rateLimits: { maxJobsPerAccountPerDay: 3, maxJobsPerCampaignPerDay: 3, maxConcurrency: 1, minIntervalMinutes: 0 },
    allowLiveExecution: true,
    executionMode: "standing_autonomous",
    standingAuthorizationReference: "dry-run-soak-standing"
  }, "operator");
  const [candidate] = await service.deriveTemplateContentCandidates(campaign.id, {
    storyId: story.id,
    templateId: "template-1"
  }, "automation");
  await service.store.mutate("test", "mark_rehearsal_candidate", (state) => {
    const currentCampaign = state.campaigns.find((item) => item.id === campaign.id);
    const currentCandidate = currentCampaign.contentCandidates.find((item) => item.contentId === candidate.contentId);
    currentCandidate.rehearsalMetadata = {
      enabled: true,
      campaignId: campaign.id,
      storyId: candidate.storyId,
      templateId: candidate.templateId,
      candidateId: candidate.contentId,
      contentId: candidate.contentId,
      contentIdentity: candidate.contentIdentity,
      contentHash: candidate.contentHash,
      targetId: candidate.targetId,
      authorizationId: authorization.id
    };
    return state;
  });

  // Keep an isolated immutable UNKNOWN fixture alongside the rehearsal row.
  // It proves the dry-run-only path never reconciles or rewrites uncertainty.
  await service.store.mutate("test", "seed_unknown_fixture", (state) => {
    state.executionRequests.push({
      executionId: "protected-unknown-fixture",
      jobId: "protected-unknown-job",
      state: "SUBMIT_RESULT_UNKNOWN",
      submitState: "UNKNOWN",
      dryRun: false,
      request: { executionId: "protected-unknown-fixture", dryRun: false }
    });
    state.submissionUncertainties.push({
      id: "protected-unknown-uncertainty",
      executionId: "protected-unknown-fixture",
      jobId: "protected-unknown-job",
      status: "UNKNOWN",
      reasonCode: "fixture_protected"
    });
    return state;
  });

  return { directory, stateFile, service, campaign, target, candidate };
}

function unknownSnapshot(state) {
  return {
    requests: state.executionRequests.filter((item) => item.executionId === "protected-unknown-fixture"),
    uncertainties: state.submissionUncertainties.filter((item) => item.executionId === "protected-unknown-fixture")
  };
}

test("dry-run handoff survives restart ticks and recovers an expired execution lease", async (t) => {
  const fixture = await createSoakFixture();
  t.after(() => rm(fixture.directory, { recursive: true, force: true }));
  const calls = [];
  const registry = fixtureRegistry(calls);

  const firstHandoff = await fixture.service.handoffRehearsalCandidates();
  assert.equal(firstHandoff.results.length, 1);
  assert.equal(firstHandoff.results[0].status, "REQUEST_READY");
  const firstState = await fixture.service.snapshot();
  const executionId = firstState.executionRequests.find((item) => item.dryRun === true).executionId;
  const protectedUnknown = unknownSnapshot(firstState);
  const request = firstState.executionRequests.find((item) => item.executionId === executionId);
  const target = firstState.targets.find((item) => item.id === request.request.target.targetId);

  // A worker restart sees this stale lease, removes it atomically, and acquires
  // the exact same execution lease before the dry-run dispatch.
  await fixture.service.store.mutate("test", "seed_expired_execution_lease", (state) => {
    state.executionLeases.push({
      id: "expired-soak-lease",
      token: "expired-soak-token",
      executionId,
      jobId: request.jobId,
      platform: target.channel,
      accountId: target.accountId,
      profileId: target.profileId,
      profileKey: `${target.channel}:${target.profileId}`,
      workerId: "dead-worker",
      acquiredAt: new Date(Date.now() - 120_000).toISOString(),
      expiresAt: new Date(Date.now() - 60_000).toISOString()
    });
    return state;
  });

  const firstWorker = new JevExecutionWorker({
    service: fixture.service,
    adapterRegistry: registry,
    workerId: "soak-worker-1",
    env: {}
  });
  const firstRun = await firstWorker.runReadyDryRunOnce();
  assert.equal(firstRun.length, 1);
  assert.equal(firstRun[0].status, "DRY_RUN_COMPLETE");
  assert.equal(calls.length, 1);
  let afterFirst = await fixture.service.snapshot();
  assert.equal(afterFirst.executionLeases.length, 0);
  assert.deepEqual(unknownSnapshot(afterFirst), protectedUnknown);

  // Recreate the control-plane service and worker three times. Each tick must
  // observe the terminal request and perform no second dispatch or receipt.
  for (let tick = 1; tick <= 3; tick += 1) {
    const restarted = new SeedingService(new JsonStore(fixture.stateFile));
    await restarted.init();
    const handoff = await restarted.handoffRehearsalCandidates();
    assert.equal(handoff.results.length, 1);
    assert.equal(handoff.results[0].status, "DRY_RUN_COMPLETE");
    const worker = new JevExecutionWorker({
      service: restarted,
      adapterRegistry: registry,
      workerId: `soak-worker-restart-${tick}`,
      env: {}
    });
    assert.deepEqual(await worker.runReadyDryRunOnce(), []);
    const state = await restarted.snapshot();
    assert.equal(state.posts.filter((item) => item.rehearsalHandoff === true).length, 1);
    assert.equal(state.executionRequests.filter((item) => item.dryRun === true).length, 1);
    assert.equal(state.executionReceipts.filter((item) => item.executionId === executionId).length, 1);
    assert.equal(state.executionRequests.find((item) => item.executionId === executionId).state, "DRY_RUN_COMPLETE");
    assert.equal(state.executionRequests.find((item) => item.executionId === executionId).submitState, "NOT_STARTED");
    assert.equal(state.executionReceipts.find((item) => item.executionId === executionId).receipt.publicationEvidence, null);
    assert.equal(state.oneTimeExecutionWindows.length, 0);
    assert.equal(state.liveExecutionGrants.length, 0);
    assert.deepEqual(unknownSnapshot(state), protectedUnknown);
    afterFirst = state;
  }

  assert.equal(calls.length, 1, "terminal dry-run must never execute again after restart");
  assert.equal(afterFirst.executionReceipts.length, 1);
  assert.equal(afterFirst.posts.filter((item) => item.rehearsalHandoff === true).length, 1);
  assert.equal(afterFirst.executionRequests.filter((item) => item.dryRun === true).length, 1);
  assert.equal(afterFirst.executionReceipts[0].receipt.dryRun, true);
  assert.equal(afterFirst.executionReceipts[0].receipt.submitState, "NOT_STARTED");
  assert.equal(afterFirst.executionReceipts[0].receipt.publicationUrl, null);
});
