import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { JsonStore } from "../src/store.mjs";
import { SeedingService } from "../src/service.mjs";
import { campaignContentHash } from "../src/campaign-authorization.mjs";
import { contentSha256, validateExecutionReceiptV1, validateExecutionRequestV1 } from "../src/execution-contracts.mjs";
import { isReadinessFresh, normalizeReadinessResult } from "../src/readiness.mjs";
import { classifyLinkedInComposerState, LinkedInReadinessProvider, linkedInReadinessExpressions } from "../src/linkedin-readiness.mjs";

async function fixture({ platform = "threads", provider, readinessAgeMs = 10_000, readinessTtlMs = 5_000, maxReadinessAttempts = 2, schedule, maxConcurrency = 2, allowLiveExecution = true } = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pr2-readiness-test-"));
  const productRepo = path.join(directory, "product");
  await mkdir(productRepo);
  await writeFile(path.join(productRepo, "README.md"), "Isolated test evidence\n", "utf8");
  const service = new SeedingService(new JsonStore(path.join(directory, "state.json")), {
    readinessTtlMs, maxReadinessAttempts,
    readinessProviders: provider ? { [platform]: provider } : {}
  });
  await service.init();
  const campaign = await service.createCampaign({ name: "PR2 test", objective: "Exercise readiness", productRepo }, "operator");
  await service.updateCampaign(campaign.id, { status: "active" }, "operator");
  const accountId = `${platform}-account-1`;
  const profileId = platform === "linkedin" ? "1fe88615-ddcc-4d71-9cf6-821cf67b3b01" : "threads-profile-1";
  await service.registerExecutionAccount({
    platform, accountId, profileId,
    identityReference: platform === "linkedin" ? "https://www.linkedin.com/in/test-owner" : undefined
  }, "operator");
  const checkedAt = new Date(Date.now() - readinessAgeMs).toISOString();
  const target = await service.createTarget({
    channel: platform, name: "Test target", url: platform === "linkedin" ? "https://www.linkedin.com/feed/" : "https://www.threads.net/@owner", accountId, profileId,
    status: "active",
    readiness: { state: "ready", checkedAt, checks: { sessionValid: true, composerCapable: true, platformAvailable: true } }
  }, "operator");
  const content = "PR2 approved test content";
  const post = await service.createPost({ campaignId: campaign.id, targetId: target.id, content, audience: "public" }, "producer");
  await service.authorizeCampaign(campaign.id, {
    id: "pr2-test-auth",
    validFrom: new Date(Date.now() - 60_000).toISOString(),
    validUntil: new Date(Date.now() + 60 * 60_000).toISOString(),
    destinations: [{ platform, accountId, profileId, targetId: target.id }],
    approvedAssets: [],
    contentBoundary: { mode: "approved_copy_set", contentHashes: [campaignContentHash(content)] },
    audienceRules: { allowedAudiences: ["public"] },
    schedule: schedule || { timezone: "UTC", weekdays: [new Date().getUTCDay()], startLocal: "00:00", endLocal: "23:59" },
    rateLimits: { maxJobsPerAccountPerDay: 10, maxJobsPerCampaignPerDay: 10, maxConcurrency, minIntervalMinutes: 0 },
    allowLiveExecution
  }, "operator");
  return { directory, service, campaign, target, post, accountId, profileId, content };
}

const ready = () => ({
  state: "READY", reasonCode: "test_ready", retryable: false, recoveryClassification: "NONE",
  capabilities: { sessionAuthenticated: true, identityVerified: true, feedReachable: true, composerAvailable: true }
});

test("stale readiness refreshes automatically and prepares one versioned execution request", async () => {
  let calls = 0;
  const contextSeen = [];
  const { service, post, target, campaign } = await fixture({
    readinessAgeMs: 10_000, readinessTtlMs: 5_000,
    provider: { async checkReadiness(context) { calls += 1; contextSeen.push(context); return ready(); } }
  });
  const state = await service.snapshot();
  const job = state.posts.find((item) => item.id === post.id);
  assert.equal(calls, 1);
  assert.equal(contextSeen[0].jobId, post.id);
  assert.equal(contextSeen[0].campaignId, campaign.id);
  assert.equal(job.status, "queued");
  assert.equal(job.readinessState, "READY");
  assert.equal(job.executionState, "REQUEST_READY");
  assert.equal(state.executionRequests.length, 1);
  assert.equal(state.executionRequests[0].request.schemaVersion, 1);
  assert.equal(state.executionRequests[0].request.profileId, target.profileId);
  assert.equal(state.executionRequests[0].request.audience, "public");
  assert.equal(state.executionRequests[0].request.readiness.state, "READY");
  assert.equal((await service.readyExecutionRequests()).length, 1);
});

test("queued request refreshes stale readiness without changing execution identity", async () => {
  let calls = 0;
  const { service, post } = await fixture({ provider: { async checkReadiness() { calls += 1; return ready(); } } });
  const before = await service.snapshot();
  const executionId = before.executionRequests[0].executionId;
  await service.store.mutate("test", "expire_readiness", (state) => {
    const target = state.targets.find((item) => item.id === post.targetId);
    target.readiness.checkedAt = new Date(Date.now() - 10_000).toISOString();
    target.readiness.expiresAt = new Date(Date.now() - 1_000).toISOString();
  });
  const evaluated = await service.queueDueCampaignJobs("test-scheduler");
  const after = await service.snapshot();
  assert.equal(evaluated.length, 1);
  assert.equal(calls, 2);
  assert.equal(after.executionRequests.length, 1);
  assert.equal(after.executionRequests[0].executionId, executionId);
  assert.ok(after.executionRequests[0].lastRefreshedAt);
  assert.equal((await service.readyExecutionRequests()).length, 1);
});

test("retryable readiness failure is bounded and scheduler reevaluates automatically", async () => {
  let calls = 0;
  const { service, post } = await fixture({ provider: { async checkReadiness() {
    calls += 1;
    return calls === 1
      ? { state: "UNKNOWN", reasonCode: "network_error", retryable: true, recoveryClassification: "RECOVERABLE" }
      : ready();
  } } });
  let state = await service.snapshot();
  assert.equal(state.posts.find((item) => item.id === post.id).readinessState, "UNKNOWN");
  assert.equal(state.executionRequests.length, 0);
  await service.store.mutate("test", "make_retry_due", (current) => {
    current.posts.find((item) => item.id === post.id).readinessRetryAt = new Date(Date.now() - 1).toISOString();
  });
  await service.queueDueCampaignJobs("test-scheduler");
  state = await service.snapshot();
  assert.equal(calls, 2);
  assert.equal(state.posts.find((item) => item.id === post.id).status, "queued");
  assert.equal(state.executionRequests.length, 1);
});

test("human-required readiness is isolated and not automatically retried", async () => {
  let calls = 0;
  const { service, post } = await fixture({ provider: { async checkReadiness() {
    calls += 1;
    return { state: "HUMAN_REQUIRED", reasonCode: "passkey_required", retryable: false, recoveryClassification: "HUMAN_REQUIRED" };
  } } });
  const before = await service.snapshot();
  assert.equal(before.posts.find((item) => item.id === post.id).readinessState, "HUMAN_REQUIRED");
  await service.queueDueCampaignJobs("test-scheduler");
  await service.refreshCampaignJobReadiness(post.id, "forced-worker", { force: true });
  assert.equal(calls, 1);
  assert.equal((await service.readyExecutionRequests()).length, 0);
});

test("expected_profile_missing can be rechecked only for a canonical bound LinkedIn ORCA profile", async () => {
  let calls = 0;
  const { service, post } = await fixture({ platform: "linkedin", provider: { async checkReadiness() {
    calls += 1;
    return calls === 1
      ? { state: "HUMAN_REQUIRED", reasonCode: "expected_profile_missing", retryable: false, recoveryClassification: "HUMAN_REQUIRED" }
      : ready();
  } } });
  const first = await service.snapshot();
  assert.equal(first.posts.find((item) => item.id === post.id).readinessState, "HUMAN_REQUIRED");
  assert.equal(first.executionAccounts[0].health, "human_required");

  const results = await service.queueAuthorizedCampaignJobs(post.campaignId, "operator");
  assert.equal(calls, 2, JSON.stringify(results));
  assert.equal(results[0].readinessState, "READY");
  assert.equal((await service.readyExecutionRequests()).length, 1);
});

test("readiness runs outside the publish schedule but schedule still blocks queueing", async () => {
  let calls = 0;
  const tomorrow = new Date(Date.now() + 24 * 60 * 60_000).getUTCDay();
  const { service, post } = await fixture({
    schedule: { timezone: "UTC", weekdays: [tomorrow], startLocal: "00:00", endLocal: "23:59" },
    provider: { async checkReadiness() { calls += 1; return ready(); } }
  });
  const state = await service.snapshot();
  const stored = state.posts.find((item) => item.id === post.id);
  assert.equal(calls, 1);
  assert.equal(stored.readinessState, "READY");
  assert.equal(stored.status, "blocked");
  assert.ok(stored.authorizationDecision.reasons.includes("schedule_outside_allowed_window"));
  assert.equal(state.executionRequests.length, 0);
});

test("readiness runs at campaign concurrency limit but concurrency still blocks queueing", async () => {
  let calls = 0;
  const { service, post } = await fixture({
    maxConcurrency: 1,
    allowLiveExecution: false,
    provider: { async checkReadiness() { calls += 1; return ready(); } }
  });
  await service.store.mutate("test", "occupy_campaign_execution_slot", (state) => {
    const original = state.posts.find((item) => item.id === post.id);
    state.posts.push({ ...original, id: "other-inflight-job", idempotencyKey: "other-inflight-publication", status: "publishing", executionState: "SUBMIT_SENT" });
    const target = state.targets.find((item) => item.id === post.targetId);
    target.readiness.checkedAt = new Date(Date.now() - 60_000).toISOString();
    target.readiness.expiresAt = new Date(Date.now() - 1).toISOString();
  });
  calls = 0;
  await service.refreshCampaignJobReadiness(post.id, "test-scheduler", { force: true });
  const state = await service.snapshot();
  const stored = state.posts.find((item) => item.id === post.id);
  assert.equal(calls, 1);
  assert.equal(stored.readinessState, "READY");
  assert.equal(stored.status, "blocked");
  assert.ok(stored.authorizationDecision.reasons.includes("campaign_concurrency_limit_reached"));
  assert.equal(state.executionRequests.length, 0);
});

test("allowLiveExecution=false permits readiness but never queues or prepares execution", async () => {
  let calls = 0;
  const { service, post } = await fixture({
    allowLiveExecution: false,
    provider: { async checkReadiness() { calls += 1; return ready(); } }
  });
  const state = await service.snapshot();
  const stored = state.posts.find((item) => item.id === post.id);
  assert.equal(calls, 1);
  assert.equal(stored.readinessState, "READY");
  assert.equal(stored.status, "blocked");
  assert.ok(stored.authorizationDecision.reasons.includes("live_execution_not_authorized"));
  assert.equal(state.executionRequests.length, 0);
});

test("stale readiness refreshes while schedule still blocks execution", async () => {
  let calls = 0;
  const tomorrow = new Date(Date.now() + 24 * 60 * 60_000).getUTCDay();
  const { service, post } = await fixture({
    readinessTtlMs: 1_000,
    schedule: { timezone: "UTC", weekdays: [tomorrow], startLocal: "00:00", endLocal: "23:59" },
    provider: { async checkReadiness() { calls += 1; return ready(); } }
  });
  await service.store.mutate("test", "expire_preflight_readiness", (state) => {
    const target = state.targets.find((item) => item.id === post.targetId);
    target.readiness.checkedAt = new Date(Date.now() - 10_000).toISOString();
    target.readiness.expiresAt = new Date(Date.now() - 1).toISOString();
  });
  await service.queueDueCampaignJobs("test-scheduler");
  const state = await service.snapshot();
  const stored = state.posts.find((item) => item.id === post.id);
  assert.equal(calls, 2);
  assert.equal(stored.readinessState, "READY");
  assert.equal(stored.status, "blocked");
  assert.ok(stored.authorizationDecision.reasons.includes("schedule_outside_allowed_window"));
  assert.equal(state.executionRequests.length, 0);
});

test("non-retryable BLOCKED and exhausted UNKNOWN readiness are not polled repeatedly", async () => {
  let blockedCalls = 0;
  const blocked = await fixture({ provider: { async checkReadiness() {
    blockedCalls += 1;
    return { state: "BLOCKED", reasonCode: "composer_unavailable", retryable: false, recoveryClassification: "NONE" };
  } } });
  await blocked.service.queueDueCampaignJobs("test-scheduler");
  assert.equal(blockedCalls, 1);

  let unknownCalls = 0;
  const unknown = await fixture({ provider: { async checkReadiness() {
    unknownCalls += 1;
    return { state: "UNKNOWN", reasonCode: "provider_unavailable", retryable: false, recoveryClassification: "UNKNOWN" };
  } } });
  await unknown.service.queueDueCampaignJobs("test-scheduler");
  assert.equal(unknownCalls, 1);
});

test("execution account profile collisions and readiness binding mismatches fail closed", async () => {
  const { service, post, target } = await fixture({ provider: { async checkReadiness() { return ready(); } } });
  await assert.rejects(service.registerExecutionAccount({ platform: "threads", accountId: "other-account", profileId: target.profileId }, "operator"), /already bound/);
  const state = await service.snapshot();
  const currentTarget = state.targets.find((item) => item.id === post.targetId);
  currentTarget.readiness.accountId = "other-account";
  assert.equal(isReadinessFresh(currentTarget.readiness, {
    platform: currentTarget.channel, accountId: currentTarget.accountId, profileId: currentTarget.profileId, targetId: currentTarget.id
  }), false);
});

test("ExecutionRequestV1 and ExecutionReceiptV1 validate hashes, versions, and uncertain submit states", () => {
  assert.equal(contentSha256("payload").length, 64);
  assert.throws(() => validateExecutionRequestV1({ schemaVersion: 9 }), /schemaVersion/);
  assert.throws(() => normalizeReadinessResult({ state: "READY", cookie: "never" }, {
    platform: "threads", accountId: "a", profileId: "p", targetId: "t"
  }), /secret-like field/);
  const receipt = validateExecutionReceiptV1({
    schemaVersion: 1, executionId: "exec-1", jobId: "job-1", attempt: 1,
    startedAt: "2026-10-13T00:00:00.000Z", finishedAt: "2026-10-13T00:00:01.000Z",
    readinessResult: { state: "READY", checkedAt: "2026-10-13T00:00:00.000Z" },
    submitState: "SUBMIT_SENT", recoveryClassification: "UNKNOWN",
    telemetry: { durationMs: 1000, browserCommands: 1, computerUseCalls: 0, retries: 0 }
  });
  assert.equal(receipt.submitState, "SUBMIT_SENT");
  assert.throws(() => validateExecutionReceiptV1({
    ...receipt, recoveryClassification: "RECOVERABLE"
  }), /possibly submitted/);
});

test("SUBMIT_SENT receipt is terminal for dispatch and never creates a replacement request", async () => {
  const { service, post } = await fixture({ provider: { async checkReadiness() { return ready(); } } });
  const before = await service.snapshot();
  const request = before.executionRequests[0];
  await service.store.mutate("test", "simulate_durable_submit_intent", (state) => {
    const storedRequest = state.executionRequests.find((item) => item.executionId === request.executionId);
    storedRequest.state = "SUBMIT_SENT_INTENT";
    storedRequest.submitIntentAt = new Date().toISOString();
    const storedPost = state.posts.find((item) => item.id === post.id);
    storedPost.status = "publishing";
    storedPost.executionState = "SUBMIT_SENT_INTENT";
    storedPost.publicationAttemptId = "attempt-test";
    state.publicationAttempts.push({ id: "attempt-test", postId: post.id, targetId: storedPost.targetId, status: "prepared", executionId: request.executionId, contentSha256: contentSha256(storedPost.content) });
  });
  await service.recordExecutionReceipt(request.executionId, {
    schemaVersion: 1, executionId: request.executionId, jobId: post.id, attempt: 1,
    startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(),
    readinessResult: { state: "READY", checkedAt: new Date().toISOString() },
    submitState: "SUBMIT_SENT", recoveryClassification: "UNKNOWN",
    telemetry: { durationMs: 1, browserCommands: 1, computerUseCalls: 0, retries: 0 }
  });
  const terminal = await service.prepareExecutionRequest(post.id);
  const after = await service.snapshot();
  assert.equal(terminal.executionId, request.executionId);
  assert.equal(terminal.state, "SUBMIT_SENT");
  assert.equal(after.executionRequests.length, 1);
  assert.equal((await service.readyExecutionRequests()).length, 0);
});

test("execution lease serializes duplicate/profile work and releases for the next safe owner", async () => {
  const { service } = await fixture({ provider: { async checkReadiness() { return ready(); } } });
  const initial = (await service.snapshot()).executionRequests[0];
  const request = initial;
  const otherExecutionId = "second-execution-same-profile";
  await service.store.mutate("test", "add_second_job_same_profile", (state) => {
    const originalPost = state.posts.find((item) => item.id === initial.jobId);
    state.posts.push({ ...originalPost, id: "second-job-same-profile", contentId: "second-content", content: "separate child job", idempotencyKey: "different-publication-identity" });
    state.executionRequests.push({
      executionId: otherExecutionId, jobId: "second-job-same-profile", attempt: 1, state: "REQUEST_READY", submitState: "NOT_STARTED",
      request: { ...initial.request, executionId: otherExecutionId, jobId: "second-job-same-profile", idempotencyKey: "different-publication-identity" }
    });
  });
  const first = await service.acquireExecutionLease(request.executionId, "worker-one");
  assert.equal(first.acquired, true);
  const second = await service.acquireExecutionLease(otherExecutionId, "worker-two");
  assert.deepEqual(second, { acquired: false, reason: "execution_lease_held" });
  assert.equal(await service.releaseExecutionLease(first.lease.id, first.lease.token), true);
  const secondLease = await service.acquireExecutionLease(otherExecutionId, "worker-two");
  assert.equal(secondLease.acquired, true);
  assert.equal(await service.releaseExecutionLease(secondLease.lease.id, secondLease.lease.token), true);
});

test("dry-run receipt is auditable but does not consume or change the live execution state", async () => {
  const { service, post } = await fixture({ provider: { async checkReadiness() { return ready(); } } });
  const request = (await service.snapshot()).executionRequests[0];
  const timestamp = new Date().toISOString();
  const receipt = {
    schemaVersion: 1, executionId: request.executionId, jobId: post.id, attempt: request.attempt,
    startedAt: timestamp, finishedAt: timestamp,
    readinessResult: { state: "READY", checkedAt: timestamp },
    submitState: "NOT_STARTED", dryRun: true,
    telemetry: { durationMs: 0, browserCommands: 1, computerUseCalls: 0, retries: 0 }
  };
  await service.recordExecutionReceipt(request.executionId, receipt);
  const after = await service.snapshot();
  assert.equal(after.executionRequests[0].state, "REQUEST_READY");
  assert.equal(after.executionRequests[0].submitState, "NOT_STARTED");
  assert.equal((await service.readyExecutionRequests()).length, 1);
  assert.equal(after.executionReceipts[0].receipt.dryRun, true);
  assert.equal((await service.prepareExecutionRequest(post.id)).executionId, request.executionId);
});

test("verified confirmation receipt reconciles an intent to PUBLISHED and VERIFIED", async () => {
  const { service, post, target, profileId, accountId, content } = await fixture({ provider: { async checkReadiness() { return ready(); } } });
  const request = (await service.snapshot()).executionRequests[0];
  const startedAt = new Date().toISOString();
  await service.store.mutate("test", "simulate_sent_intent", (state) => {
    const storedRequest = state.executionRequests.find((item) => item.executionId === request.executionId);
    storedRequest.state = "SUBMIT_SENT_INTENT";
    storedRequest.submitIntentAt = startedAt;
    const storedPost = state.posts.find((item) => item.id === post.id);
    storedPost.status = "publishing";
    storedPost.executionState = "SUBMIT_SENT_INTENT";
    storedPost.publicationAttemptId = "attempt-verified";
    state.publicationAttempts.push({ id: "attempt-verified", postId: post.id, targetId: target.id, status: "prepared", executionId: request.executionId, contentSha256: contentSha256(content) });
  });
  const verifiedAt = new Date().toISOString();
  const confirmedReceipt = {
    schemaVersion: 1, executionId: request.executionId, jobId: post.id, attempt: 1,
    startedAt, finishedAt: verifiedAt, readinessResult: { state: "READY", checkedAt: startedAt },
    submitState: "CONFIRMED", publicationUrl: "https://www.threads.net/@owner/post/verified", publicationReference: "verified-post",
    publicationEvidence: {
      verifiedAt, accountMatched: true, targetMatched: true, contentHashMatched: true, mediaHashMatched: true,
      accountId, profileId, targetId: target.id, contentHash: contentSha256(content), mediaHash: null,
      verificationMethod: "isolated_test", evidenceReference: "test-evidence"
    },
    telemetry: { durationMs: 100, browserCommands: 2, computerUseCalls: 0, retries: 0 }
  };
  await assert.rejects(service.recordExecutionReceipt(request.executionId, confirmedReceipt, "automation"), /in-process JEV verifier/);
  await service.recordExecutionReceipt(request.executionId, confirmedReceipt, "jev-worker:test");
  const after = await service.snapshot();
  assert.equal(after.posts.find((item) => item.id === post.id).status, "published");
  assert.equal(after.executionRequests[0].state, "CONFIRMED");
  assert.ok(after.posts.find((item) => item.id === post.id).jobLifecycle.some((item) => item.state === "VERIFIED"));
});

test("uncertain LinkedIn submissions enter rate-limited reconciliation without becoming dispatchable", async () => {
  const { service } = await fixture({ provider: { async checkReadiness() { return ready(); } } });
  const request = (await service.snapshot()).executionRequests[0];
  await service.store.mutate("test", "simulate_unknown_submit", (state) => {
    const row = state.executionRequests.find((item) => item.executionId === request.executionId);
    row.request.platform = "linkedin";
    row.state = "SUBMIT_RESULT_UNKNOWN";
    row.submitState = "UNKNOWN";
  });
  assert.equal((await service.pendingExecutionReconciliations()).length, 1);
  await service.markExecutionReconciliationAttempt(request.executionId);
  assert.equal((await service.pendingExecutionReconciliations()).length, 0);
  assert.equal((await service.pendingExecutionReconciliations({ now: Date.now() + 60_001 })).length, 1);
  await service.store.mutate("test", "exhaust_auto_reconciliation", (state) => {
    state.executionRequests.find((item) => item.executionId === request.executionId).reconciliationAttempts = 10;
  });
  assert.equal((await service.pendingExecutionReconciliations({ now: Date.now() + 60_001 })).length, 0);
  assert.equal((await service.readyExecutionRequests()).length, 0);
});

test("recoverable pre-submit adapter failures get bounded automatic retries under a new execution identity", async () => {
  const { service, post } = await fixture({ provider: { async checkReadiness() { return ready(); } } });
  const before = (await service.snapshot()).executionRequests[0];
  const timestamp = new Date().toISOString();
  await service.recordExecutionReceipt(before.executionId, {
    schemaVersion: 1, executionId: before.executionId, jobId: post.id, attempt: before.attempt,
    startedAt: timestamp, finishedAt: timestamp, readinessResult: { state: "READY", checkedAt: timestamp },
    submitState: "FAILED", errorClassification: "TIMEOUT", recoveryClassification: "RECOVERABLE",
    telemetry: { durationMs: 100, browserCommands: 2, computerUseCalls: 0, retries: 0 }
  });
  await service.queueDueCampaignJobs("retry-scheduler");
  const after = await service.snapshot();
  assert.equal(after.executionRequests.length, 2);
  assert.equal(after.executionRequests[1].state, "REQUEST_READY");
  assert.equal(after.executionRequests[1].attempt, 2);
  assert.notEqual(after.executionRequests[1].executionId, before.executionId);
  const second = after.executionRequests[1];
  const retryAt = new Date().toISOString();
  await service.recordExecutionReceipt(second.executionId, {
    schemaVersion: 1, executionId: second.executionId, jobId: post.id, attempt: 2,
    startedAt: retryAt, finishedAt: retryAt, readinessResult: { state: "READY", checkedAt: retryAt },
    submitState: "FAILED", errorClassification: "TIMEOUT", recoveryClassification: "RECOVERABLE",
    telemetry: { durationMs: 100, browserCommands: 2, computerUseCalls: 0, retries: 0 }
  });
  await service.queueDueCampaignJobs("retry-scheduler");
  const thirdAttempt = (await service.snapshot()).executionRequests[2];
  assert.equal(thirdAttempt.attempt, 3);
  const thirdAt = new Date().toISOString();
  await service.recordExecutionReceipt(thirdAttempt.executionId, {
    schemaVersion: 1, executionId: thirdAttempt.executionId, jobId: post.id, attempt: 3,
    startedAt: thirdAt, finishedAt: thirdAt, readinessResult: { state: "READY", checkedAt: thirdAt },
    submitState: "FAILED", errorClassification: "TIMEOUT", recoveryClassification: "RECOVERABLE",
    telemetry: { durationMs: 100, browserCommands: 2, computerUseCalls: 0, retries: 0 }
  });
  await service.queueDueCampaignJobs("retry-scheduler");
  assert.equal((await service.snapshot()).executionRequests.length, 3);
});

test("human-required pre-submit adapter failures pause only the affected job and account", async () => {
  const { service, post, accountId } = await fixture({ provider: { async checkReadiness() { return ready(); } } });
  const request = (await service.snapshot()).executionRequests[0];
  const timestamp = new Date().toISOString();
  await service.recordExecutionReceipt(request.executionId, {
    schemaVersion: 1, executionId: request.executionId, jobId: post.id, attempt: request.attempt,
    startedAt: timestamp, finishedAt: timestamp, readinessResult: { state: "READY", checkedAt: timestamp },
    submitState: "FAILED", errorClassification: "AUTH_REQUIRED", recoveryClassification: "HUMAN_REQUIRED",
    telemetry: { durationMs: 100, browserCommands: 1, computerUseCalls: 0, retries: 0 }
  });
  const state = await service.snapshot();
  assert.equal(state.posts.find((item) => item.id === post.id).status, "blocked");
  assert.equal(state.posts.find((item) => item.id === post.id).readinessState, "HUMAN_REQUIRED");
  assert.equal(state.executionAccounts.find((item) => item.accountId === accountId).health, "human_required");
  assert.equal((await service.readyExecutionRequests()).length, 0);
});

test("LinkedIn readiness uses the bound ORCA profile and stops before content or submission", async () => {
  const calls = [];
  const browser = {
    async listProfiles() { calls.push("profiles"); return [{ id: "linkedin-profile-1" }]; },
    async listTabs() { calls.push("tabs"); return [{ id: "page-1", pageId: "page-1", profileId: "linkedin-profile-1", url: "https://www.linkedin.com/feed/" }]; },
    async showTab(id) { calls.push(`show:${id}`); return { pageId: id, profileId: "linkedin-profile-1", url: "https://www.linkedin.com/feed/" }; },
    async navigate(id, url) { calls.push(`navigate:${id}:${url}`); },
    async waitForFeed() { calls.push("wait"); },
    async evaluate(_id, expression) {
      calls.push(expression.includes("const expectedPath") ? "context" : "composer");
      if (expression.includes("const expectedPath")) return {
        linkedinDomain: true, loginRequired: false, securityChallenge: false,
        sessionAuthenticated: true, identityVerified: true, feedReachable: true
      };
      return { linkedinDomain: true, route: true, dialogCount: 1, editorCount: 1, audience: true, postButton: true, mediaControl: true, advertisingControls: 0 };
    },
    async snapshot() { calls.push("snapshot"); return '- button "Start a post" [ref=e10]'; },
    async click(_id, element) { calls.push(`click:${element}`); },
    async pressEscape() { calls.push("escape"); }
  };
  const provider = new LinkedInReadinessProvider(browser);
  const result = await provider.checkReadiness({
    jobId: "job-1", campaignId: "campaign-1", platform: "linkedin", accountId: "account-1",
    profileId: "linkedin-profile-1", targetId: "target-1", expectedIdentityUrl: "https://www.linkedin.com/in/owner"
  });
  assert.equal(result.state, "READY");
  assert.equal(result.capabilities.composerAvailable, true);
  assert.equal(calls.filter((call) => call.startsWith("click:")).length, 1);
  assert.ok(calls.includes("escape"));
  assert.equal(calls.some((call) => call === "fill" || call === "submit"), false);
});

function evaluateLinkedInContext({ path = "/feed/", navigation = true, main = true, composer = true, loginForm = false, pageText = "" } = {}) {
  const visible = { getClientRects: () => [{}] };
  const anchor = { href: "https://www.linkedin.com/in/test-owner" };
  const postButton = {
    ...visible,
    innerText: "Start a post",
    getAttribute(name) { return name === "aria-label" ? "" : null; }
  };
  const sessionInput = { ...visible };
  const document = {
    body: { innerText: pageText },
    querySelector(selector) { return selector === "main,#main-content" && main ? visible : null; },
    querySelectorAll(selector) {
      if (selector === "a[href]") return [anchor];
      if (selector === 'input[name="session_key"], input[name="session_password"]') return loginForm ? [sessionInput] : [];
      if (selector === 'nav,[role="navigation"]') return navigation ? [visible] : [];
      if (selector === "main,#main-content") return main ? [visible] : [];
      if (selector === 'button,[role="button"]') return composer ? [postButton] : [];
      return [];
    }
  };
  const expression = linkedInReadinessExpressions().context("/in/test-owner");
  return runInNewContext(expression, {
    URL,
    location: { hostname: "www.linkedin.com", pathname: path, href: `https://www.linkedin.com${path}` },
    document
  });
}

test("LinkedIn auth detector accepts an authenticated feed shell without legacy global-nav selectors", () => {
  const state = evaluateLinkedInContext();
  assert.equal(state.loginRequired, false);
  assert.equal(state.feedReachable, true);
  assert.equal(state.authenticatedNavigation, true);
  assert.equal(state.composerTrigger, true);
  assert.equal(state.sessionAuthenticated, true);
  assert.equal(state.identityVerified, true);
});

test("LinkedIn auth detector requires explicit login evidence and recognizes security challenges", () => {
  const login = evaluateLinkedInContext({ path: "/login/", navigation: false, main: false, composer: false });
  assert.equal(login.loginRequired, true);
  assert.equal(login.sessionAuthenticated, false);
  const challenge = evaluateLinkedInContext({ path: "/checkpoint/challenge/", navigation: false, main: false, composer: false });
  assert.equal(challenge.securityChallenge, true);
});

function evaluateLinkedInComposer({ dialog = false, editor = false, audience = false, post = false, media = false, close = false, path = "/feed/" } = {}) {
  const visible = { getClientRects: () => [{}] };
  const makeControl = (tagName, text, ariaLabel = "") => ({
    ...visible, tagName,
    innerText: text,
    getAttribute(name) { return name === "aria-label" ? ariaLabel : null; }
  });
  const controls = [
    ...(audience ? [makeControl("BUTTON", "Everyone")] : []),
    ...(post ? [makeControl("BUTTON", "Post")] : []),
    ...(media ? [makeControl("BUTTON", "Add media")] : []),
    ...(close ? [makeControl("BUTTON", "", "Close") ] : [])
  ];
  const editorNode = { ...visible };
  const dialogNode = {
    ...visible,
    querySelectorAll(selector) {
      if (selector === '[contenteditable="true"],[role="textbox"]') return editor ? [editorNode] : [];
      if (selector === 'button,[role="button"],input,[role="combobox"]') return controls;
      return [];
    }
  };
  const document = {
    querySelectorAll(selector) {
      return selector === 'dialog,[role="dialog"]' && dialog ? [dialogNode] : [];
    }
  };
  return runInNewContext(linkedInReadinessExpressions().composer, {
    document,
    location: { hostname: "www.linkedin.com", pathname: path }
  });
}

test("LinkedIn composer classifier confirms the real structural composer signals", () => {
  const state = evaluateLinkedInComposer({ dialog: true, editor: true, audience: true, post: true, media: true, close: true });
  assert.equal(state.confirmed, true);
  assert.equal(state.routeCompatible, true);
  assert.equal(classifyLinkedInComposerState(state), "CONFIRMED");
});

test("LinkedIn feed without an open composer is not classified as a composer", () => {
  const state = evaluateLinkedInComposer();
  assert.equal(state.confirmed, false);
  assert.equal(classifyLinkedInComposerState(state), "NOT_COMPOSER");
});

test("an unrelated LinkedIn dialog is not classified as the post composer", () => {
  const state = evaluateLinkedInComposer({ dialog: true, close: true });
  assert.equal(state.confirmed, false);
  assert.equal(classifyLinkedInComposerState(state), "NOT_COMPOSER");
});

test("a partially loaded LinkedIn composer remains UNKNOWN until structural signals arrive", () => {
  const state = evaluateLinkedInComposer({ dialog: true, editor: true, close: true });
  assert.equal(state.confirmed, false);
  assert.equal(classifyLinkedInComposerState(state), "UNKNOWN");
});

test("LinkedIn composer confirmation accepts contenteditable plus audience and submit controls", () => {
  const state = evaluateLinkedInComposer({ dialog: true, editor: true, audience: true, post: true });
  assert.equal(state.mediaControl, false);
  assert.equal(state.confirmed, true);
  assert.equal(classifyLinkedInComposerState(state), "CONFIRMED");
});

test("LinkedIn readiness waits for an asynchronously mounted composer before classifying it", async () => {
  let phase = "feed";
  let waitExpression;
  const browser = {
    async listProfiles() { return [{ id: "linkedin-profile-1" }]; },
    async listTabs() { return [{ id: "page-1", profileId: "linkedin-profile-1", url: "https://www.linkedin.com/feed/" }]; },
    async showTab(id) { return { pageId: id, profileId: "linkedin-profile-1", url: "https://www.linkedin.com/feed/" }; },
    async evaluate(_id, expression) {
      if (expression.includes("const expectedPath")) return {
        linkedinDomain: true, loginRequired: false, securityChallenge: false,
        sessionAuthenticated: true, identityVerified: true, feedReachable: true
      };
      return phase === "composer"
        ? { linkedinDomain: true, route: false, routeCompatible: true, dialogCount: 1, editorCount: 1, audience: true, postButton: true, mediaControl: true, closeControl: true, advertisingControls: 0, confirmed: true }
        : { linkedinDomain: true, route: false, routeCompatible: false, dialogCount: 1, editorCount: 0, audience: false, postButton: false, mediaControl: false, closeControl: true, advertisingControls: 0, confirmed: false };
    },
    async snapshot() { return '- button "Start a post" [ref=e10]'; },
    async click() { phase = "loading"; },
    async waitForExpression(_id, expression, timeoutMs) {
      waitExpression = { expression, timeoutMs };
      phase = "composer";
    },
    async pressEscape() { phase = "feed"; },
    async waitForFeed() {}
  };
  const result = await new LinkedInReadinessProvider(browser).checkReadiness({
    platform: "linkedin", profileId: "linkedin-profile-1", expectedIdentityUrl: "https://www.linkedin.com/in/test-owner"
  });
  assert.equal(result.state, "READY");
  assert.match(waitExpression.expression, /confirmed === true/);
  assert.equal(waitExpression.timeoutMs, 8_000);
});

test("LinkedIn readiness reports UNKNOWN for a partially loaded composer after bounded wait", async () => {
  const browser = {
    async listProfiles() { return [{ id: "linkedin-profile-1" }]; },
    async listTabs() { return [{ id: "page-1", profileId: "linkedin-profile-1", url: "https://www.linkedin.com/feed/" }]; },
    async showTab(id) { return { pageId: id, profileId: "linkedin-profile-1", url: "https://www.linkedin.com/feed/" }; },
    async evaluate(_id, expression) {
      if (expression.includes("const expectedPath")) return {
        linkedinDomain: true, loginRequired: false, securityChallenge: false,
        sessionAuthenticated: true, identityVerified: true, feedReachable: true
      };
      return { linkedinDomain: true, route: false, routeCompatible: false, dialogCount: 1, editorCount: 1, audience: false, postButton: false, mediaControl: false, closeControl: true, advertisingControls: 0, confirmed: false };
    },
    async snapshot() { return '- button "Start a post" [ref=e10]'; },
    async click() {},
    async waitForExpression() { throw Object.assign(new Error("bounded wait timed out"), { code: "ORCA_COMMAND_FAILED" }); },
    async pressEscape() {},
    async waitForFeed() {}
  };
  const result = await new LinkedInReadinessProvider(browser).checkReadiness({
    platform: "linkedin", profileId: "linkedin-profile-1", expectedIdentityUrl: "https://www.linkedin.com/in/test-owner"
  });
  assert.equal(result.state, "UNKNOWN");
  assert.equal(result.reasonCode, "composer_state_incomplete");
  assert.equal(result.retryable, true);
});

test("partially loaded LinkedIn page does not become authentication_required", async () => {
  const browser = {
    async listProfiles() { return [{ id: "linkedin-profile-1" }]; },
    async listTabs() { return [{ id: "page-1", profileId: "linkedin-profile-1", url: "https://www.linkedin.com/feed/" }]; },
    async showTab(id) { return { pageId: id, profileId: "linkedin-profile-1", url: "https://www.linkedin.com/feed/" }; },
    async evaluate() { return { linkedinDomain: true, loginRequired: false, securityChallenge: false, sessionAuthenticated: false, identityVerified: false, feedReachable: true }; }
  };
  const result = await new LinkedInReadinessProvider(browser).checkReadiness({
    profileId: "linkedin-profile-1", expectedIdentityUrl: "https://www.linkedin.com/in/test-owner"
  });
  assert.equal(result.state, "UNKNOWN");
  assert.equal(result.reasonCode, "linkedin_auth_state_ambiguous");
  assert.equal(result.recoveryClassification, "RECOVERABLE");
});

test("operator can force a fresh LinkedIn auth-detection check after a prior false-negative result", async () => {
  let calls = 0;
  const { service, post, accountId } = await fixture({ platform: "linkedin", provider: {
    async checkReadiness() {
      calls += 1;
      return calls === 1
        ? { state: "HUMAN_REQUIRED", reasonCode: "authentication_required", retryable: false, recoveryClassification: "HUMAN_REQUIRED" }
        : ready();
    }
  } });
  const before = await service.snapshot();
  assert.equal(calls, 1);
  assert.equal(before.executionAccounts.find((item) => item.accountId === accountId).health, "human_required");
  const result = await service.refreshCampaignJobReadiness(post.id, "operator", { force: true });
  const after = await service.snapshot();
  assert.equal(calls, 2);
  assert.equal(result.readinessState, "READY");
  assert.equal(after.posts.find((item) => item.id === post.id).readinessState, "READY");
  assert.equal(after.executionAccounts.find((item) => item.accountId === accountId).health, "healthy");
});

test("pending reconciliation selection includes registered and unregistered platforms", async () => {
  const { directory, service } = await fixture();
  try {
    await service.store.mutate("test", "mixed_platform_reconciliation_fixture", (state) => {
      state.executionRequests.push(
        { executionId: "exec-test-social", state: "SUBMIT_RESULT_UNKNOWN", reconciliationAttempts: 0, request: { platform: "test_social" } },
        { executionId: "exec-linkedin", state: "SUBMIT_SENT", reconciliationAttempts: 0, request: { platform: "linkedin" } },
        { executionId: "exec-done", state: "CONFIRMED", reconciliationAttempts: 0, request: { platform: "test_social" } }
      );
    });
    const pending = await service.pendingExecutionReconciliations({ minIntervalMs: 0 });
    assert.deepEqual(pending.map((item) => item.executionId).sort(), ["exec-linkedin", "exec-test-social"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
