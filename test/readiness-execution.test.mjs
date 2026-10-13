import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { JsonStore } from "../src/store.mjs";
import { SeedingService } from "../src/service.mjs";
import { campaignContentHash } from "../src/campaign-authorization.mjs";
import { contentSha256, validateExecutionReceiptV1, validateExecutionRequestV1 } from "../src/execution-contracts.mjs";
import { isReadinessFresh, normalizeReadinessResult } from "../src/readiness.mjs";
import { LinkedInReadinessProvider } from "../src/linkedin-readiness.mjs";

async function fixture({ provider, readinessAgeMs = 10_000, readinessTtlMs = 5_000, maxReadinessAttempts = 2 } = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pr2-readiness-test-"));
  const productRepo = path.join(directory, "product");
  await mkdir(productRepo);
  await writeFile(path.join(productRepo, "README.md"), "Isolated test evidence\n", "utf8");
  const service = new SeedingService(new JsonStore(path.join(directory, "state.json")), {
    readinessTtlMs, maxReadinessAttempts,
    readinessProviders: provider ? { threads: provider } : {}
  });
  await service.init();
  const campaign = await service.createCampaign({ name: "PR2 test", objective: "Exercise readiness", productRepo }, "operator");
  await service.updateCampaign(campaign.id, { status: "active" }, "operator");
  const accountId = "threads-account-1";
  const profileId = "threads-profile-1";
  await service.registerExecutionAccount({ platform: "threads", accountId, profileId }, "operator");
  const checkedAt = new Date(Date.now() - readinessAgeMs).toISOString();
  const target = await service.createTarget({
    channel: "threads", name: "Test target", url: "https://www.threads.net/@owner", accountId, profileId,
    status: "active",
    readiness: { state: "ready", checkedAt, checks: { sessionValid: true, composerCapable: true, platformAvailable: true } }
  }, "operator");
  const content = "PR2 approved test content";
  const post = await service.createPost({ campaignId: campaign.id, targetId: target.id, content, audience: "public" }, "producer");
  await service.authorizeCampaign(campaign.id, {
    id: "pr2-test-auth",
    validFrom: new Date(Date.now() - 60_000).toISOString(),
    validUntil: new Date(Date.now() + 60 * 60_000).toISOString(),
    destinations: [{ platform: "threads", accountId, profileId, targetId: target.id }],
    approvedAssets: [],
    contentBoundary: { mode: "approved_copy_set", contentHashes: [campaignContentHash(content)] },
    audienceRules: { allowedAudiences: ["public"] },
    schedule: { timezone: "UTC", weekdays: [new Date().getUTCDay()], startLocal: "00:00", endLocal: "23:59" },
    rateLimits: { maxJobsPerAccountPerDay: 10, maxJobsPerCampaignPerDay: 10, maxConcurrency: 2, minIntervalMinutes: 0 }
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
  assert.equal(calls, 1);
  assert.equal((await service.readyExecutionRequests()).length, 0);
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
