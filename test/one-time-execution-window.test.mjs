import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { JsonStore } from "../src/store.mjs";
import { SeedingService } from "../src/service.mjs";
import { evaluateQueue } from "../src/guards.mjs";
import { assertWindowExecutionBinding, normalizeOneTimeExecutionWindow, oneTimeExecutionWindowFingerprint, oneTimeExecutionWindowInBounds } from "../src/one-time-execution-window.mjs";
import { campaignContentHash } from "../src/campaign-authorization.mjs";
import { validateExecutionRequestV1 } from "../src/execution-contracts.mjs";
import { JevExecutionWorker } from "../src/jev-execution-worker.mjs";
import { PLATFORM_CAPABILITIES, PlatformAdapterRegistry } from "../src/platform-registries.mjs";

async function fixture({ allowLiveExecution = true, channels = ["threads"] } = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "one-time-window-"));
  const productRepo = path.join(directory, "product-repo");
  await mkdir(productRepo);
  await writeFile(path.join(productRepo, "README.md"), "Fixture product evidence.\n", "utf8");
  const service = new SeedingService(new JsonStore(path.join(directory, "state.json")));
  await service.init();
  const campaign = await service.createCampaign({ name: "Window fixture", objective: "Test one-time scheduling", productRepo }, "operator");
  await service.updateCampaign(campaign.id, { status: "active" }, "operator");
  const targets = [];
  const posts = [];
  for (const channel of channels) {
    const accountId = `${channel}_window_fixture`;
    const profileId = `${channel}-window-profile`;
    await service.registerExecutionAccount({ platform: channel, accountId, profileId }, "operator");
    const target = await service.createTarget({
      channel, name: `${channel} fixture`, url: channel === "linkedin" ? "https://www.linkedin.com/company/window-fixture"
        : channel === "reddit" ? "https://www.reddit.com/r/window_fixture" : "https://www.threads.net/@window_fixture",
      accountId, profileId, status: "active", readiness: {
        state: "ready", checkedAt: new Date().toISOString(),
        checks: { sessionValid: true, composerCapable: true, platformAvailable: true }
      }
    }, "operator");
    targets.push(target);
    posts.push(await service.createPost({ campaignId: campaign.id, targetId: target.id, content: `Approved ${channel} window copy.`, audience: "public" }, "producer"));
  }
  const now = new Date();
  const auth = await service.authorizeCampaign(campaign.id, {
    id: `auth-window-${Math.random().toString(16).slice(2)}`,
    validFrom: new Date(now.getTime() - 60_000).toISOString(), validUntil: new Date(now.getTime() + 60 * 60_000).toISOString(),
    destinations: targets.map((target) => ({ platform: target.channel, accountId: target.accountId, profileId: target.profileId, targetId: target.id })),
    approvedAssets: [], contentBoundary: { mode: "approved_copy_set", contentHashes: posts.map((post) => campaignContentHash(post.content)) },
    audienceRules: { allowedAudiences: ["public"] },
    schedule: { timezone: "UTC", weekdays: [(now.getUTCDay() + 1) % 7], startLocal: "00:00", endLocal: "00:01" },
    rateLimits: { maxJobsPerAccountPerDay: 1, maxJobsPerCampaignPerDay: 1, maxConcurrency: 1, minIntervalMinutes: 60 },
    allowLiveExecution
  }, "operator");
  return { directory, service, campaign, targets, posts, auth };
}

async function addWindow(service, job, authorization, overrides = {}) {
  const now = Date.now();
  return service.createOneTimeExecutionWindow({
    windowId: `window-${job.id}`,
    campaignId: job.campaignId,
    campaignAuthorizationId: authorization.id,
    jobId: job.id,
    validFrom: new Date(now - 5_000).toISOString(),
    validUntil: new Date(now + 60_000).toISOString(),
    timezone: "Asia/Saigon",
    reason: "controlled fixture scheduling test",
    ...overrides
  }, "operator");
}

test("one-time window satisfies recurring schedule mismatch for only its exact job while recurring rows stay untouched", async () => {
  const { service, campaign, posts, auth } = await fixture({ channels: ["threads", "reddit"] });
  await service.store.mutate("fixture", "pause_recurring_schedule", (state) => {
    state.schedules.push({ id: "paused-recurring-schedule", campaignId: campaign.id, status: "paused", cadence: "daily" });
  });
  const stateBefore = await service.snapshot();
  const recurringBefore = stateBefore.schedules;
  const first = stateBefore.posts.find((post) => post.id === posts[0].id);
  const sibling = stateBefore.posts.find((post) => post.id === posts[1].id);
  assert.ok(evaluateQueue(first, stateBefore).reasons.includes("schedule_outside_allowed_window"));
  const window = await addWindow(service, first, auth);
  const stateAfter = await service.snapshot();
  const firstAfter = stateAfter.posts.find((post) => post.id === first.id);
  const siblingAfter = stateAfter.posts.find((post) => post.id === sibling.id);
  const decision = evaluateQueue(firstAfter, stateAfter);
  assert.equal(decision.allowed, true);
  assert.equal(decision.oneTimeWindow.windowId, window.windowId);
  assert.ok(evaluateQueue(siblingAfter, stateAfter).reasons.includes("schedule_outside_allowed_window"));
  assert.deepEqual(stateAfter.schedules, recurringBefore);
  assert.equal(window.jobId, first.id);
  assert.equal(window.campaignId, campaign.id);
});

test("one-time window rejects mismatched job/auth references, duplicate active window, and non-operator", async () => {
  const { service, campaign, posts, auth } = await fixture({ channels: ["threads", "reddit"] });
  const state = await service.snapshot();
  const first = state.posts.find((post) => post.id === posts[0].id);
  assert.throws(() => normalizeOneTimeExecutionWindow({
    windowId: "wrong-campaign", campaignId: first.campaignId, campaignAuthorizationId: auth.id, jobId: first.id,
    validFrom: new Date().toISOString(), validUntil: new Date(Date.now() + 60_000).toISOString(), reason: "bad"
  }, { post: { ...first, campaignId: "another-campaign" }, authorization: auth, authorizationFingerprint: auth.binding, createdBy: "operator" }), /referenced campaign authorization/);
  assert.throws(() => normalizeOneTimeExecutionWindow({
    windowId: "multi-use", campaignId: first.campaignId, campaignAuthorizationId: auth.id, jobId: first.id,
    validFrom: new Date().toISOString(), validUntil: new Date(Date.now() + 60_000).toISOString(), reason: "bad", maxExecutions: 2
  }, { post: first, authorization: auth, authorizationFingerprint: auth.binding, createdBy: "operator" }), /maxExecutions must equal 1/);
  await assert.rejects(service.createOneTimeExecutionWindow({
    windowId: "wrong-campaign-input", campaignId: "another-campaign", campaignAuthorizationId: auth.id, jobId: first.id,
    validFrom: new Date().toISOString(), validUntil: new Date(Date.now() + 60_000).toISOString(), reason: "bad"
  }, "operator"), /exact job and campaign authorization/);
  await assert.rejects(service.createOneTimeExecutionWindow({ jobId: "missing-job", campaignAuthorizationId: auth.id, validFrom: new Date().toISOString(), validUntil: new Date(Date.now() + 60_000).toISOString(), reason: "bad" }, "operator"), /Post not found/);
  await assert.rejects(service.createOneTimeExecutionWindow({ jobId: first.id, campaignAuthorizationId: "wrong-auth", validFrom: new Date().toISOString(), validUntil: new Date(Date.now() + 60_000).toISOString(), reason: "bad" }, "automation"), /Only an operator/);
  const window = await addWindow(service, first, auth);
  await assert.rejects(service.createOneTimeExecutionWindow({ ...window, windowId: "mismatched-auth-window", campaignAuthorizationId: "wrong-auth" }, "operator"), /Campaign authorization not found/);
  await assert.rejects(addWindow(service, first, auth), /active one-time execution window already exists/);
  assert.equal((await service.getOneTimeExecutionWindow(window.windowId)).effectiveStatus, "ACTIVE");
  assert.equal(campaign.id, window.campaignId);
});

test("authorization fingerprint changes invalidate an existing window", async () => {
  const { service, posts, auth } = await fixture();
  const post = (await service.snapshot()).posts.find((item) => item.id === posts[0].id);
  const window = await addWindow(service, post, auth);
  await service.store.mutate("fixture", "change_authorization_scope", (state) => {
    const current = state.campaignAuthorizations.find((item) => item.id === auth.id);
    current.schedule.startLocal = "01:00";
  });
  const state = await service.snapshot();
  const changedPost = state.posts.find((item) => item.id === post.id);
  const decision = evaluateQueue(changedPost, state);
  assert.ok(decision.reasons.includes("campaign_authorization_binding_stale"));
  assert.ok(decision.reasons.includes("schedule_outside_allowed_window"));
  assert.equal(decision.oneTimeWindow, null);
  assert.equal((await service.getOneTimeExecutionWindow(window.windowId)).status, "ACTIVE");
});

test("future, expired, and revoked windows do not satisfy schedule eligibility", async () => {
  const { service, posts, auth } = await fixture();
  const post = (await service.snapshot()).posts.find((item) => item.id === posts[0].id);
  const future = await addWindow(service, post, auth, {
    windowId: "future-window", validFrom: new Date(Date.now() + 60_000).toISOString(), validUntil: new Date(Date.now() + 120_000).toISOString()
  });
  let state = await service.snapshot();
  assert.ok(evaluateQueue(state.posts.find((item) => item.id === post.id), state).reasons.includes("schedule_outside_allowed_window"));
  assert.equal(future.status, "ACTIVE");
  await service.revokeOneTimeExecutionWindow(future.windowId, "operator");
  state = await service.snapshot();
  assert.ok(evaluateQueue(state.posts.find((item) => item.id === post.id), state).reasons.includes("schedule_outside_allowed_window"));
  await assert.rejects(service.revokeOneTimeExecutionWindow(future.windowId, "automation"), /Only an operator/);
  const expired = await addWindow(service, post, auth, { windowId: "expired-window" });
  await service.store.mutate("fixture", "expire_window", (current) => {
    const stored = current.oneTimeExecutionWindows.find((item) => item.windowId === expired.windowId);
    stored.validUntil = new Date(Date.now() - 1).toISOString();
    stored.binding = oneTimeExecutionWindowFingerprint(stored);
  });
  await service.expireOneTimeExecutionWindows("scheduler");
  const expiredRecord = await service.getOneTimeExecutionWindow(expired.windowId);
  assert.equal(expiredRecord.status, "EXPIRED");
  assert.equal(oneTimeExecutionWindowInBounds({ ...expiredRecord, status: "CONSUMED" }), false);
  state = await service.snapshot();
  assert.ok(evaluateQueue(state.posts.find((item) => item.id === post.id), state).reasons.includes("schedule_outside_allowed_window"));
});

test("window does not bypass daily, cadence, concurrency, target, readiness, live authorization, or uncertainty gates", async () => {
  const { service, posts, auth } = await fixture({ allowLiveExecution: false });
  const post = (await service.snapshot()).posts.find((item) => item.id === posts[0].id);
  await addWindow(service, post, auth);
  const blockedCases = [
    ["daily", (state) => state.posts.push({ ...post, id: "daily-peer", status: "published", publishedAt: new Date().toISOString() }), "campaign_daily_limit_reached"],
    ["cadence", (state) => state.posts.push({ ...post, id: "cadence-peer", status: "published", publishedAt: new Date(Date.now() - 1_000).toISOString() }), "campaign_minimum_interval_not_met"],
    ["concurrency", (state) => state.posts.push({ ...post, id: "active-peer", status: "publishing" }), "campaign_concurrency_limit_reached"],
    ["inactive", (state) => { state.targets[0].status = "needs_review"; }, "target_not_active"],
    ["readiness", (state) => { state.targets[0].readiness.state = "blocked"; }, "readiness_not_ready"],
    ["uncertain", (state) => state.submissionUncertainties.push({ status: "UNKNOWN", jobId: post.id, idempotencyKeys: [post.idempotencyKey] }), "submission_uncertain"]
  ];
  for (const [label, mutate, expected] of blockedCases) {
    const clone = structuredClone(await service.snapshot());
    mutate(clone);
    const decision = evaluateQueue(clone.posts.find((item) => item.id === post.id), clone);
    assert.ok(decision.reasons.includes(expected), `${label}: ${decision.reasons.join(",")}`);
  }
  const state = await service.snapshot();
  const liveDecision = evaluateQueue(state.posts.find((item) => item.id === post.id), state);
  assert.ok(liveDecision.reasons.includes("live_execution_not_authorized"));
});

test("one-time window reserves one execution, consumes at worker start, and never grants submit by itself", async () => {
  const { service, posts, auth } = await fixture();
  const post = (await service.snapshot()).posts.find((item) => item.id === posts[0].id);
  const window = await addWindow(service, post, auth);
  const queued = await service.queueAuthorizedCampaignJobs(post.campaignId, "scheduler");
  assert.ok(queued.some((item) => item.postId === post.id && item.status === "queued"));
  const request = await service.prepareExecutionRequest(post.id, "operator");
  assert.equal(request.request.oneTimeWindow.windowId, window.windowId);
  assert.equal(validateExecutionRequestV1(request.request).oneTimeWindow.windowId, window.windowId);
  let state = await service.snapshot();
  let storedWindow = state.oneTimeExecutionWindows.find((item) => item.windowId === window.windowId);
  assert.equal(storedWindow.status, "RESERVED");
  assert.equal(storedWindow.reservedExecutionId, request.executionId);
  assert.throws(() => assertWindowExecutionBinding(storedWindow, "second-execution", "RESERVED"), /another execution/);
  const leaseResult = await service.acquireExecutionLease(request.executionId, "fixture-worker");
  assert.equal(leaseResult.acquired, true);
  await assert.rejects(service.markExecutionStarted(request.executionId, leaseResult.lease), /grant/i);
  state = await service.snapshot();
  assert.equal(state.oneTimeExecutionWindows[0].status, "RESERVED");
  assert.equal(state.executionRequests.find((item) => item.executionId === request.executionId).state, "REQUEST_READY");
  const verifiedGates = Object.fromEntries(["authorizationValid", "readinessFresh", "accountMatch", "profileMatch", "targetMatch", "contentHashMatch", "mediaHashMatch", "audienceMatch", "composerConfirmed", "mediaPreviewConfirmed", "noDuplicateReceipt", "noExistingConfirmedPublication"].map((key) => [key, true]));
  await assert.rejects(service.beginExecutionSubmitIntent(request.executionId, leaseResult.lease, {
    liveEnabled: true, liveExecutionId: request.executionId, verifiedGates
  }), /grant/i);
  await service.releaseExecutionLease(leaseResult.lease.id, leaseResult.lease.token);
  const now = Date.now();
  const grant = await service.createLiveExecutionGrant({
    jobId: post.id, validFrom: new Date(now - 1_000).toISOString(), validUntil: new Date(now + 60_000).toISOString(),
    operatorAuthorizationReference: "fixture-only grant for window transition"
  }, "operator");
  assert.equal(grant.boundExecutionId, request.executionId);
  const workerLease = await service.acquireExecutionLease(request.executionId, "fixture-worker");
  assert.equal(workerLease.acquired, true);
  await service.markExecutionStarted(request.executionId, workerLease.lease);
  state = await service.snapshot();
  storedWindow = state.oneTimeExecutionWindows.find((item) => item.windowId === window.windowId);
  assert.equal(storedWindow.status, "CONSUMED");
  assert.equal(storedWindow.consumedExecutionId, request.executionId);
  assert.throws(() => assertWindowExecutionBinding(storedWindow, "second-execution", "CONSUMED"), /another execution/);
  const consumedEligibility = evaluateQueue(state.posts.find((item) => item.id === post.id), state, new Date(), { executionId: request.executionId });
  const replayEligibility = evaluateQueue(state.posts.find((item) => item.id === post.id), state, new Date(), { executionId: "second-execution" });
  assert.equal(consumedEligibility.allowed, true);
  assert.ok(replayEligibility.reasons.includes("schedule_outside_allowed_window"));
  await assert.rejects(service.prepareExecutionRequest(post.id, "operator"), /not available for this execution|reserved one-time window/i);
  assert.equal(state.executionRequests.find((item) => item.executionId === request.executionId).state, "REQUEST_READY");
  assert.equal(state.executionRequests.find((item) => item.executionId === request.executionId).state === "SUBMIT_SENT_INTENT", false);
  await service.releaseExecutionLease(workerLease.lease.id, workerLease.lease.token);
});

test("worker readiness carries the owning executionId through a RESERVED one-time window", async () => {
  const { service, posts, auth } = await fixture();
  const post = (await service.snapshot()).posts.find((item) => item.id === posts[0].id);
  const window = await addWindow(service, post, auth);
  const decisions = await service.queueAuthorizedCampaignJobs(post.campaignId, "scheduler");
  assert.ok(decisions.some((item) => item.postId === post.id && item.status === "queued"));
  let state = await service.snapshot();
  const requestRow = state.executionRequests.find((item) => item.jobId === post.id);
  assert.ok(requestRow);
  assert.equal(state.oneTimeExecutionWindows.find((item) => item.windowId === window.windowId).status, "RESERVED");

  await service.createLiveExecutionGrant({
    jobId: post.id, validFrom: new Date(Date.now() - 1_000).toISOString(),
    validUntil: new Date(Date.now() + 60_000).toISOString(), operatorAuthorizationReference: "fixture-only"
  }, "operator");

  const originalRefresh = service.refreshCampaignJobReadiness.bind(service);
  let readinessOptions;
  service.refreshCampaignJobReadiness = async (...args) => {
    readinessOptions = args[2];
    return originalRefresh(...args);
  };
  let adapterCalls = 0;
  const registry = new PlatformAdapterRegistry();
  registry.register("threads", {
    contractVersion: 1,
    capabilities: Object.fromEntries(PLATFORM_CAPABILITIES.map((capability) => [capability, false])),
    async execute() { adapterCalls += 1; throw Object.assign(new Error("fixture stop before submit"), { code: "FIXTURE_STOP" }); },
    async reconcile() { throw new Error("not used"); }
  });
  const worker = new JevExecutionWorker({
    service, adapterRegistry: registry, workerId: "fixture-worker",
    env: { SEEDING_JEV_LIVE_ENABLED: "true", SEEDING_JEV_LIVE_EXECUTION_ID: requestRow.executionId }
  });
  await assert.rejects(worker.run(requestRow.executionId, { dryRun: false }), /fixture stop before submit/);

  assert.equal(readinessOptions.executionId, requestRow.executionId);
  assert.equal(readinessOptions.force, undefined);
  assert.equal(adapterCalls, 1);
  state = await service.snapshot();
  assert.equal(state.oneTimeExecutionWindows.find((item) => item.windowId === window.windowId).status, "CONSUMED");
  assert.equal(state.oneTimeExecutionWindows.find((item) => item.windowId === window.windowId).consumedExecutionId, requestRow.executionId);
  assert.equal(state.executionRequests.find((item) => item.executionId === requestRow.executionId).state, "REQUEST_READY");
  assert.equal(state.executionLeases.filter((item) => Date.parse(item.expiresAt) > Date.now()).length, 0);
  assert.equal(state.executionRequests.some((item) => item.state === "SUBMIT_SENT_INTENT"), false);
});

test("RESERVED windows require the exact execution, job, authorization, and current fingerprint", async () => {
  const { service, posts, auth } = await fixture({ channels: ["threads", "reddit"] });
  const state = await service.snapshot();
  const post = state.posts.find((item) => item.id === posts[0].id);
  const sibling = state.posts.find((item) => item.id === posts[1].id);
  const window = await addWindow(service, post, auth);
  const request = await service.queueAuthorizedCampaignJobs(post.campaignId, "scheduler");
  assert.ok(request.some((item) => item.postId === post.id && item.status === "queued"));
  const execution = (await service.snapshot()).executionRequests.find((item) => item.jobId === post.id);
  const reservedState = await service.snapshot();
  const reservedPost = reservedState.posts.find((item) => item.id === post.id);

  assert.equal(evaluateQueue(reservedPost, reservedState, new Date(), { executionId: execution.executionId }).allowed, true);
  assert.ok(evaluateQueue(reservedPost, reservedState).reasons.includes("schedule_outside_allowed_window"));
  assert.ok(evaluateQueue(reservedPost, reservedState, new Date(), { executionId: "different-execution" }).reasons.includes("schedule_outside_allowed_window"));
  assert.ok(evaluateQueue(sibling, reservedState, new Date(), { executionId: execution.executionId }).reasons.includes("schedule_outside_allowed_window"));

  const wrongAuthorizationState = structuredClone(reservedState);
  const wrongAuthorizationWindow = wrongAuthorizationState.oneTimeExecutionWindows.find((item) => item.windowId === window.windowId);
  wrongAuthorizationWindow.campaignAuthorizationId = "different-authorization";
  wrongAuthorizationWindow.binding = oneTimeExecutionWindowFingerprint(wrongAuthorizationWindow);
  assert.ok(evaluateQueue(wrongAuthorizationState.posts.find((item) => item.id === post.id), wrongAuthorizationState, new Date(), { executionId: execution.executionId }).reasons.includes("schedule_outside_allowed_window"));

  const wrongCampaignState = structuredClone(reservedState);
  const wrongCampaignWindow = wrongCampaignState.oneTimeExecutionWindows.find((item) => item.windowId === window.windowId);
  wrongCampaignWindow.campaignId = "different-campaign";
  wrongCampaignWindow.binding = oneTimeExecutionWindowFingerprint(wrongCampaignWindow);
  assert.ok(evaluateQueue(wrongCampaignState.posts.find((item) => item.id === post.id), wrongCampaignState, new Date(), { executionId: execution.executionId }).reasons.includes("schedule_outside_allowed_window"));

  const changedFingerprintState = structuredClone(reservedState);
  const changedAuthorization = changedFingerprintState.campaignAuthorizations.find((item) => item.id === auth.id);
  changedAuthorization.schedule.startLocal = "01:00";
  assert.ok(evaluateQueue(changedFingerprintState.posts.find((item) => item.id === post.id), changedFingerprintState, new Date(), { executionId: execution.executionId }).reasons.includes("schedule_outside_allowed_window"));

  const revokedState = structuredClone(reservedState);
  revokedState.oneTimeExecutionWindows.find((item) => item.windowId === window.windowId).status = "REVOKED";
  assert.ok(evaluateQueue(revokedState.posts.find((item) => item.id === post.id), revokedState, new Date(), { executionId: execution.executionId }).reasons.includes("schedule_outside_allowed_window"));

  const expiredState = structuredClone(reservedState);
  const expiredWindow = expiredState.oneTimeExecutionWindows.find((item) => item.windowId === window.windowId);
  expiredWindow.validUntil = new Date(Date.now() - 1).toISOString();
  expiredWindow.binding = oneTimeExecutionWindowFingerprint(expiredWindow);
  assert.ok(evaluateQueue(expiredState.posts.find((item) => item.id === post.id), expiredState, new Date(), { executionId: execution.executionId }).reasons.includes("schedule_outside_allowed_window"));
});

test("abandoned REQUEST_READY execution with a revoked window cannot resume", async () => {
  const { service, posts, auth } = await fixture();
  const post = (await service.snapshot()).posts.find((item) => item.id === posts[0].id);
  const window = await addWindow(service, post, auth);
  await service.queueAuthorizedCampaignJobs(post.campaignId, "scheduler");
  const abandonedExecutionId = "4818e202-1554-4854-a2ba-9904ac79ee2a";
  await service.store.mutate("fixture", "bind_abandoned_execution", (state) => {
    const row = state.executionRequests.find((item) => item.jobId === post.id);
    row.executionId = abandonedExecutionId;
    row.request.executionId = abandonedExecutionId;
    const reserved = state.oneTimeExecutionWindows.find((item) => item.windowId === window.windowId);
    reserved.reservedExecutionId = abandonedExecutionId;
  });
  await service.revokeOneTimeExecutionWindow(window.windowId, "operator");
  await service.store.mutate("fixture", "pause_abandoned_authorization", (state) => {
    const authorization = state.campaignAuthorizations.find((item) => item.id === auth.id);
    authorization.status = "paused";
  });
  let adapterCalls = 0;
  const registry = new PlatformAdapterRegistry();
  registry.register("threads", {
    contractVersion: 1,
    capabilities: Object.fromEntries(PLATFORM_CAPABILITIES.map((capability) => [capability, false])),
    async execute() { adapterCalls += 1; return {}; }, async reconcile() { return {}; }
  });
  const worker = new JevExecutionWorker({ service, adapterRegistry: registry, workerId: "fixture-worker", env: {} });
  const result = await worker.run(abandonedExecutionId, { dryRun: false });
  assert.equal(result.status, "PRE_SUBMIT_STOPPED");
  assert.equal(result.reasonCode, "campaign_authorization_not_active");
  assert.equal(adapterCalls, 0);
  const finalState = await service.snapshot();
  assert.equal(finalState.oneTimeExecutionWindows.find((item) => item.windowId === window.windowId).status, "REVOKED");
  assert.equal(finalState.executionRequests.find((item) => item.executionId === abandonedExecutionId).state, "REQUEST_READY");
  assert.equal(finalState.executionRequests.some((item) => item.state === "SUBMIT_SENT_INTENT"), false);
});

test("dry-run eligibility does not require or consume a one-time live window", async () => {
  const { service, posts, auth } = await fixture();
  const state = await service.snapshot();
  const post = state.posts.find((item) => item.id === posts[0].id);
  const dryDecision = evaluateQueue(post, state, new Date(), { mode: "dry_run" });
  assert.equal(dryDecision.oneTimeWindow, null);
  assert.ok(dryDecision.reasons.includes("live_execution_not_authorized") === false);
  assert.ok(dryDecision.reasons.includes("schedule_outside_allowed_window") === false);
  const window = await addWindow(service, post, auth);
  assert.equal((await service.getOneTimeExecutionWindow(window.windowId)).status, "ACTIVE");
});

test("dry-run request works without creating or consuming a one-time window", async () => {
  const { service, posts } = await fixture();
  const post = (await service.snapshot()).posts.find((item) => item.id === posts[0].id);
  const request = await service.prepareExecutionRequest(post.id, "operator", { dryRun: true });
  const state = await service.snapshot();
  assert.equal(request.request.dryRun, true);
  assert.equal(request.request.oneTimeWindow, null);
  assert.deepEqual(state.oneTimeExecutionWindows, []);
});

test("live grant without recurring eligibility or a one-time window remains schedule-blocked", async () => {
  const { service, posts, auth } = await fixture({ channels: ["threads"] });
  const post = (await service.snapshot()).posts.find((item) => item.id === posts[0].id);
  const state = await service.snapshot();
  state.liveExecutionGrants.push({ jobId: post.id, status: "ACTIVE" });
  const decision = evaluateQueue(state.posts.find((item) => item.id === post.id), state);
  assert.ok(decision.reasons.includes("schedule_outside_allowed_window"));
});

test("same window contract works for a non-LinkedIn platform", async () => {
  const { service, posts, auth } = await fixture({ channels: ["threads"] });
  const post = (await service.snapshot()).posts.find((item) => item.id === posts[0].id);
  const window = await addWindow(service, post, auth);
  const state = await service.snapshot();
  const decision = evaluateQueue(state.posts.find((item) => item.id === post.id), state);
  assert.equal(decision.allowed, true);
  assert.equal(decision.oneTimeWindow.windowId, window.windowId);
  assert.equal(window.binding, oneTimeExecutionWindowFingerprint(window));
});

async function abandonedRequestFixture({ channels = ["threads"], grant = false } = {}) {
  const { service, campaign, posts, auth } = await fixture({ channels });
  const post = (await service.snapshot()).posts[0];
  const oldWindow = await addWindow(service, post, auth, { windowId: `old-window-${post.id}` });
  await service.queueAuthorizedCampaignJobs(campaign.id, "scheduler");
  const request = await service.prepareExecutionRequest(post.id, "operator");
  if (grant) await service.createLiveExecutionGrant({
    jobId: post.id, validFrom: new Date(Date.now() - 5_000).toISOString(),
    validUntil: new Date(Date.now() + 60_000).toISOString(), operatorAuthorizationReference: "fixture-only grant"
  }, "operator");
  return { service, campaign, posts, post, auth, oldWindow, request };
}

const cancelInput = { reason: "Abandoned before dispatch; authorization window was revoked", operatorAuthorizationReference: "fixture-operator-approval" };

test("abandoned request matching the legacy validation fixture cancels safely and permits a new authorization, window, and execution", async () => {
  const f = await abandonedRequestFixture({ grant: true });
  const oldExecutionId = "4818e202-1554-4854-a2ba-9904ac79ee2a";
  const oldGrantId = (await f.service.snapshot()).liveExecutionGrants[0].grantId;
  await f.service.store.mutate("fixture", "install_abandoned_request_identity", (state) => {
    const row = state.executionRequests.find((item) => item.executionId === f.request.executionId);
    row.executionId = oldExecutionId;
    row.request.executionId = oldExecutionId;
    const grant = state.liveExecutionGrants.find((item) => item.grantId === oldGrantId);
    grant.boundExecutionId = oldExecutionId;
    const window = state.oneTimeExecutionWindows.find((item) => item.windowId === f.oldWindow.windowId);
    window.status = "REVOKED";
    window.reservedExecutionId = oldExecutionId;
    const authorization = state.campaignAuthorizations.find((item) => item.id === f.auth.id);
    authorization.status = "paused";
  });
  const cancelled = await f.service.cancelExecutionRequest(oldExecutionId, cancelInput, "operator");
  assert.equal(cancelled.executionId, oldExecutionId);
  assert.equal(cancelled.state, "CANCELLED_PRE_SUBMIT");
  assert.equal(cancelled.submitState, "NOT_STARTED");
  assert.equal(cancelled.cancellationReason, cancelInput.reason);
  assert.equal(cancelled.operatorAuthorizationReference, cancelInput.operatorAuthorizationReference);
  assert.equal((await f.service.readyExecutionRequests()).some((row) => row.executionId === oldExecutionId), false);
  assert.deepEqual(await f.service.acquireExecutionLease(oldExecutionId, "cancelled-worker"), { acquired: false, reason: "execution_not_ready" });
  const oldState = await f.service.snapshot();
  assert.equal(oldState.oneTimeExecutionWindows.find((item) => item.windowId === f.oldWindow.windowId).status, "REVOKED");

  const now = Date.now();
  const newAuth = await f.service.authorizeCampaign(f.campaign.id, {
    ...f.auth, id: "new-auth-after-presubmit-cancel",
    validFrom: new Date(now - 5_000).toISOString(), validUntil: new Date(now + 60 * 60_000).toISOString()
  }, "operator");
  const refreshedPost = (await f.service.snapshot()).posts.find((item) => item.id === f.post.id);
  const newWindow = await addWindow(f.service, refreshedPost, newAuth, { windowId: "new-window-after-presubmit-cancel" });
  await f.service.queueAuthorizedCampaignJobs(f.campaign.id, "scheduler");
  const newRequest = await f.service.prepareExecutionRequest(f.post.id, "operator");
  const finalState = await f.service.snapshot();
  assert.notEqual(newRequest.executionId, oldExecutionId);
  assert.equal(newRequest.attempt, cancelled.attempt + 1);
  assert.equal(newRequest.request.authorization.authorizationId, newAuth.id);
  assert.equal(newRequest.request.oneTimeWindow.windowId, newWindow.windowId);
  assert.equal(newRequest.request.liveGrant, null);
  assert.equal(finalState.executionRequests.find((item) => item.executionId === oldExecutionId).state, "CANCELLED_PRE_SUBMIT");
  assert.equal(finalState.oneTimeExecutionWindows.find((item) => item.windowId === f.oldWindow.windowId).status, "REVOKED");
  assert.equal(finalState.liveExecutionGrants.find((item) => item.grantId === oldGrantId).status, "REVOKED");
});

test("cancellation is operator-only, requires reason/reference, is terminal, and preserves siblings and dry-run history", async () => {
  const f = await abandonedRequestFixture();
  const siblingId = "unrelated-sibling-job";
  await f.service.store.mutate("fixture", "preserve_existing_dry_run_history", (state) => {
    state.posts.push({ ...state.posts[0], id: siblingId, status: "blocked", executionState: undefined });
    state.executionRequests.push({ executionId: "sibling-dry-run-execution", jobId: "historical-dry-run-job", state: "DRY_RUN_COMPLETE", submitState: "NOT_STARTED", request: { dryRun: true } });
    state.executionReceipts.push({ executionId: "sibling-dry-run-execution", jobId: "historical-dry-run-job", receipt: { dryRun: true, submitState: "NOT_STARTED" } });
  });
  await assert.rejects(f.service.cancelExecutionRequest(f.request.executionId, cancelInput, "automation"), /Only an operator/);
  await assert.rejects(f.service.cancelExecutionRequest(f.request.executionId, { reason: "missing ref" }, "operator"), /operator authorization reference/);
  const cancelled = await f.service.cancelExecutionRequest(f.request.executionId, cancelInput, "operator");
  assert.equal(cancelled.state, "CANCELLED_PRE_SUBMIT");
  assert.equal((await f.service.readyExecutionRequests()).some((row) => row.executionId === cancelled.executionId), false);
  await assert.rejects(f.service.markExecutionStarted(cancelled.executionId, { id: "missing", token: "missing" }), /dispatchable request and active lease/);
  const gates = Object.fromEntries(["authorizationValid", "readinessFresh", "accountMatch", "profileMatch", "targetMatch", "contentHashMatch", "mediaHashMatch", "audienceMatch", "composerConfirmed", "mediaPreviewConfirmed", "noDuplicateReceipt", "noExistingConfirmedPublication"].map((key) => [key, true]));
  await assert.rejects(f.service.beginExecutionSubmitIntent(cancelled.executionId, { id: "missing", token: "missing" }, { liveEnabled: true, liveExecutionId: cancelled.executionId, verifiedGates: gates }));
  const state = await f.service.snapshot();
  assert.equal(state.executionRequests.find((item) => item.executionId === "sibling-dry-run-execution").state, "DRY_RUN_COMPLETE");
  assert.equal(state.executionReceipts.some((item) => item.executionId === "sibling-dry-run-execution" && item.receipt.dryRun), true);
  assert.equal(state.posts.find((item) => item.id === siblingId).status, "blocked");
  assert.equal(state.posts.find((item) => item.id === siblingId).executionState, undefined);
});

test("active worker lease prevents pre-submit cancellation", async () => {
  const f = await abandonedRequestFixture();
  const lease = await f.service.acquireExecutionLease(f.request.executionId, "active-fixture-worker");
  assert.equal(lease.acquired, true);
  await assert.rejects(f.service.cancelExecutionRequest(f.request.executionId, cancelInput, "operator"), /[Ee]xecution worker ownership|active execution lease/);
  await f.service.releaseExecutionLease(lease.lease.id, lease.lease.token);
});

test("submit intent, sent, unknown, uncertainty, publication attempt, and confirmed publication all block cancellation", async () => {
  const blockedCases = [
    ["intent", (state, row, post) => { row.state = "SUBMIT_SENT_INTENT"; row.submitState = "NOT_STARTED"; }],
    ["sent", (state, row) => { row.state = "SUBMIT_SENT"; row.submitState = "SUBMIT_SENT"; }],
    ["inconsistent-submit-state", (state, row) => state.executionRequests.push({ ...structuredClone(row), executionId: "other-execution-with-sent-state", attempt: row.attempt + 1, state: "REQUEST_READY", submitState: "SUBMIT_SENT", request: { ...structuredClone(row.request), executionId: "other-execution-with-sent-state" } })],
    ["unknown", (state, row) => { row.state = "SUBMIT_RESULT_UNKNOWN"; row.submitState = "UNKNOWN"; }],
    ["uncertainty", (state, row, post) => state.submissionUncertainties.push({ id: "unknown-hold", status: "UNKNOWN", jobId: post.id, idempotencyKeys: [row.request.idempotencyKey] })],
    ["attempt", (state, row, post) => { state.publicationAttempts.push({ id: "possible-submit", postId: post.id, executionId: row.executionId, status: "prepared" }); post.publicationAttemptId = "possible-submit"; }],
    ["publication", (state, row, post) => { post.status = "published"; state.executionReceipts.push({ executionId: row.executionId, jobId: post.id, receipt: { submitState: "CONFIRMED" } }); }]
  ];
  for (const [label, mutate] of blockedCases) {
    const f = await abandonedRequestFixture();
    await f.service.store.mutate("fixture", `install_${label}_hold`, (state) => {
      const row = state.executionRequests.find((item) => item.executionId === f.request.executionId);
      const post = state.posts.find((item) => item.id === row.jobId);
      mutate(state, row, post);
    });
    await assert.rejects(f.service.cancelExecutionRequest(f.request.executionId, cancelInput, "operator"), /Only a REQUEST_READY|submission history|uncertainty/i, label);
  }
});

test("cancellation revokes an attached unused grant and reserved window atomically but rejects a consumed grant", async () => {
  const f = await abandonedRequestFixture({ grant: true });
  const result = await f.service.cancelExecutionRequest(f.request.executionId, cancelInput, "operator");
  const state = await f.service.snapshot();
  assert.equal(result.state, "CANCELLED_PRE_SUBMIT");
  assert.equal(state.liveExecutionGrants[0].status, "REVOKED");
  assert.equal(state.oneTimeExecutionWindows[0].status, "REVOKED");

  const consumed = await abandonedRequestFixture({ grant: true });
  await consumed.service.store.mutate("fixture", "consume_grant_fixture", (current) => {
    current.liveExecutionGrants[0].status = "CONSUMED";
    current.liveExecutionGrants[0].consumedAt = new Date().toISOString();
  });
  await assert.rejects(consumed.service.cancelExecutionRequest(consumed.request.executionId, cancelInput, "operator"), /consumed LiveExecutionGrant/);
});

test("terminal pre-submit cancellation never releases or overrides an idempotency uncertainty hold", async () => {
  const f = await abandonedRequestFixture();
  await f.service.store.mutate("fixture", "install_unknown_hold", (state) => {
    state.submissionUncertainties.push({ id: "identity-hold", status: "UNKNOWN", jobId: f.post.id, idempotencyKeys: [f.post.idempotencyKey] });
  });
  await assert.rejects(f.service.cancelExecutionRequest(f.request.executionId, cancelInput, "operator"), /submission history/);
  await assert.rejects(f.service.prepareExecutionRequest(f.post.id, "operator"), /SUBMISSION_UNCERTAIN/);
});
