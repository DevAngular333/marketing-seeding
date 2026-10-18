import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { JsonStore } from "../src/store.mjs";
import { SeedingService } from "../src/service.mjs";
import { campaignAuthorizationFingerprint, campaignContentHash } from "../src/campaign-authorization.mjs";
import { readinessBinding, executionAccountKey } from "../src/readiness.mjs";
import { deriveStandingExecutionControlPlan } from "../src/standing-campaign-delegation.mjs";

test("standing autonomous delegation derives exact live controls and lease without per-post approval", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "standing-autonomous-proof-"));
  t.after(async () => { await rm(directory, { recursive: true, force: true }); });
  const productRepo = path.join(directory, "product-repo");
  await mkdir(productRepo);
  await writeFile(path.join(productRepo, "README.md"), "Bounded local evidence for autonomous delegation.\n", "utf8");

  const service = new SeedingService(new JsonStore(path.join(directory, "state.json")));
  await service.init();
  const campaign = await service.createCampaign({ name: "Standing delegation proof", objective: "Prove bounded autonomous execution controls", productRepo }, "operator");
  await service.updateCampaign(campaign.id, { status: "active" }, "operator");

  const now = new Date();
  const accountId = "linkedin_standing_fixture";
  const profileId = "11111111-2222-4333-8444-555555555555";
  await service.registerExecutionAccount({
    platform: "linkedin", accountId, profileId,
    expectedIdentityUrl: "https://www.linkedin.com/in/standing-fixture"
  }, "operator");
  const target = await service.createTarget({
    channel: "linkedin", name: "Standing delegation fixture target",
    url: "https://www.linkedin.com/company/standing-delegation-fixture",
    accountId, profileId, status: "active",
    readiness: {
      state: "ready", checkedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 5 * 60_000).toISOString(),
      checks: { sessionValid: true, composerCapable: true, platformAvailable: true },
      platform: "linkedin", accountId, profileId,
      targetId: "pending", binding: readinessBinding({ platform: "linkedin", accountId, profileId, targetId: "pending" })
    }
  }, "operator");
  await service.updateTarget(target.id, {
    readiness: {
      state: "ready", checkedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 5 * 60_000).toISOString(),
      checks: { sessionValid: true, composerCapable: true, platformAvailable: true }
    }
  }, "readiness-proof");

  const content = "Harmless standing delegation proof copy.";
  const authorization = await service.authorizeCampaign(campaign.id, {
    id: "standing-proof-authorization",
    validFrom: new Date(now.getTime() - 60_000).toISOString(),
    validUntil: new Date(now.getTime() + 15 * 60_000).toISOString(),
    destinations: [{ platform: "linkedin", accountId, profileId, targetId: target.id }],
    approvedAssets: [],
    contentBoundary: { mode: "approved_copy_set", contentHashes: [campaignContentHash(content)] },
    audienceRules: { allowedAudiences: ["public"] },
    publicationVisibilityRules: { allowedVisibilities: ["PUBLIC"] },
    schedule: { timezone: "UTC", weekdays: [now.getUTCDay()], startLocal: "00:00", endLocal: "23:59" },
    rateLimits: { maxJobsPerAccountPerDay: 1, maxJobsPerCampaignPerDay: 1, maxConcurrency: 1, minIntervalMinutes: 0 },
    allowLiveExecution: true,
    executionMode: "standing_autonomous",
    standingAuthorizationReference: "standing-proof-reference"
  }, "operator");
  assert.equal(authorization.executionMode, "standing_autonomous");
  assert.equal(authorization.binding, campaignAuthorizationFingerprint(authorization));

  const post = await service.createPost({ campaignId: campaign.id, targetId: target.id, content, audience: "public" }, "producer");
  let state = await service.snapshot();
  const queued = state.posts.find((item) => item.id === post.id);
  const request = state.executionRequests.find((item) => item.jobId === post.id);
  const window = state.oneTimeExecutionWindows.find((item) => item.jobId === post.id);
  const grant = state.liveExecutionGrants.find((item) => item.jobId === post.id);
  assert.equal(queued.status, "queued");
  assert.equal(request.state, "REQUEST_READY");
  assert.equal(request.submitState, "NOT_STARTED");
  assert.equal(window.status, "RESERVED");
  assert.equal(window.maxExecutions, 1);
  assert.equal(window.reservedExecutionId, request.executionId);
  assert.equal(grant.status, "ACTIVE");
  assert.equal(grant.boundExecutionId, request.executionId);
  assert.equal(grant.operatorAuthorizationReference, "standing-proof-reference");
  assert.equal(request.request.authorization.authorizationId, authorization.id);
  assert.equal(request.request.authorization.binding, authorization.binding);
  assert.equal(request.request.target.targetId, target.id);
  assert.equal(request.request.accountId, accountId);
  assert.equal(request.request.profileId, profileId);
  assert.equal(request.request.content.contentId, queued.contentId);
  assert.equal(request.request.publicationVisibility, "PUBLIC");

  const leaseResult = await service.acquireExecutionLease(request.executionId, "standing-proof-worker", { leaseMs: 30_000 });
  assert.equal(leaseResult.acquired, true);
  assert.equal(leaseResult.lease.executionId, request.executionId);
  assert.equal(leaseResult.lease.jobId, post.id);
  assert.equal(leaseResult.lease.accountId, accountId);
  assert.equal(leaseResult.lease.profileId, profileId);
  assert.equal(leaseResult.lease.profileKey, `linkedin:${profileId}`);

  state = await service.snapshot();
  const context = await service.executionContext(request.executionId);
  const plan = deriveStandingExecutionControlPlan({
    authorization: context.authorization, state, post: context.post, target: context.target,
    account: context.account, executionId: request.executionId,
    oneTimeWindow: context.state.oneTimeExecutionWindows.find((item) => item.windowId === request.request.oneTimeWindow.windowId),
    liveGrant: context.liveGrant, now: new Date()
  });
  assert.equal(plan.allowed, true, plan.reasons.join(", "));
  assert.equal(plan.control.campaignAuthorizationId, authorization.id);
  assert.equal(plan.control.oneTimeWindowId, window.windowId);
  assert.equal(plan.control.liveGrantId, grant.grantId);
  assert.equal(plan.control.executionId, request.executionId);

  const countsBefore = {
    requests: state.executionRequests.filter((item) => item.jobId === post.id).length,
    windows: state.oneTimeExecutionWindows.filter((item) => item.jobId === post.id).length,
    grants: state.liveExecutionGrants.filter((item) => item.jobId === post.id).length,
    leases: state.executionLeases.filter((item) => item.jobId === post.id).length
  };
  await service.queueAuthorizedCampaignJobs(campaign.id, "scheduler");
  state = await service.snapshot();
  assert.deepEqual({
    requests: state.executionRequests.filter((item) => item.jobId === post.id).length,
    windows: state.oneTimeExecutionWindows.filter((item) => item.jobId === post.id).length,
    grants: state.liveExecutionGrants.filter((item) => item.jobId === post.id).length,
    leases: state.executionLeases.filter((item) => item.jobId === post.id).length
  }, countsBefore);

  assert.equal(await service.releaseExecutionLease(leaseResult.lease.id, leaseResult.lease.token), true);
  state = await service.snapshot();
  assert.equal(state.executionLeases.filter((item) => item.jobId === post.id).length, 0);
  assert.equal(state.posts.filter((item) => item.status === "published").length, 0);
  assert.equal(state.publicationAttempts.length, 0);

  // Authority drift must fail before direct standing derivation can create or
  // reuse execution artifacts, even when the authorization still looks active.
  await service.store.mutate("fixture", "tamper_standing_authorization_binding", (next) => {
    const current = next.campaignAuthorizations.find((item) => item.id === authorization.id);
    current.binding = "stale-binding";
  });
  const beforeDriftAttempt = await service.snapshot();
  await assert.rejects(service.ensureStandingExecutionWindow(post.id, "scheduler"), /exact current campaign authorization binding/);
  await assert.rejects(service.ensureStandingExecutionGrant(post.id, "scheduler"), /exact current campaign authorization binding/);
  const afterDriftAttempt = await service.snapshot();
  assert.equal(afterDriftAttempt.oneTimeExecutionWindows.length, beforeDriftAttempt.oneTimeExecutionWindows.length);
  assert.equal(afterDriftAttempt.liveExecutionGrants.length, beforeDriftAttempt.liveExecutionGrants.length);
});
