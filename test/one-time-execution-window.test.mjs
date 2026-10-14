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
