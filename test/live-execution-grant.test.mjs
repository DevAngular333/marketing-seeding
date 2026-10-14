import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { JsonStore } from "../src/store.mjs";
import { SeedingService } from "../src/service.mjs";
import { campaignAuthorizationFingerprint, campaignContentHash, campaignScopeFingerprint, publicationIdentityKey } from "../src/campaign-authorization.mjs";
import { createExecutionRequestV1, contentSha256 } from "../src/execution-contracts.mjs";
import { assertLiveGrantMatchesExecution, createLiveExecutionGrantV1 } from "../src/live-execution-grant.mjs";
import { readinessBinding } from "../src/readiness.mjs";

const gates = Object.fromEntries([
  "authorizationValid", "readinessFresh", "accountMatch", "profileMatch", "targetMatch",
  "contentHashMatch", "mediaHashMatch", "audienceMatch", "composerConfirmed", "mediaPreviewConfirmed",
  "noDuplicateReceipt", "noExistingConfirmedPublication"
].map((key) => [key, true]));

async function fixture({ platform = "linkedin", media = false, sibling = false } = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "seeding-live-grant-"));
  const store = new JsonStore(path.join(directory, "state.json"));
  await store.init();
  const service = new SeedingService(store);
  const now = new Date();
  const campaign = { id: "campaign-1", status: "active", productRepo: directory, track: "vibe-code", objective: "fixture", audience: [], landingUrl: null };
  const target = { id: "target-1", channel: platform, accountId: "account-1", profileId: "11111111-2222-4333-8444-555555555555", url: platform === "linkedin" ? "https://www.linkedin.com/feed/" : "https://www.threads.net/@fixture", status: "active" };
  target.readiness = { state: "ready", platform, accountId: target.accountId, profileId: target.profileId, targetId: target.id,
    checkedAt: now.toISOString(), expiresAt: new Date(now.getTime() + 240_000).toISOString(),
    binding: readinessBinding({ platform, accountId: target.accountId, profileId: target.profileId, targetId: target.id }),
    checks: { sessionValid: true, composerCapable: true, platformAvailable: true } };
  const account = { id: `${platform}:account-1`, platform, accountId: target.accountId, profileId: target.profileId, status: "enabled", health: "healthy" };
  const artifact = media ? { id: "artifact-1", campaignId: campaign.id, path: path.join(directory, "fixture.mp4"), sha256: "a".repeat(64), status: "verified", mimeType: "video/mp4" } : null;
  const posts = ["Exact authorized content", ...(sibling ? ["Different sibling content"] : [])].map((content, index) => ({
    id: `job-${index + 1}`, campaignId: campaign.id, targetId: target.id, contentId: `content-${index + 1}`,
    content, audience: "public", status: "queued", readinessState: "READY", queuedAt: now.toISOString(), createdAt: now.toISOString(),
    artifactId: artifact?.id || null, assetPath: artifact?.path || null, assetSha256: artifact?.sha256 || null,
    idempotencyKey: publicationIdentityKey({ campaignId: campaign.id, contentId: `content-${index + 1}`, platform, accountId: account.accountId, targetId: target.id }),
    campaignAuthorizationId: "auth-1"
  }));
  if (sibling) posts[1].status = "blocked";
  const authorization = {
    id: "auth-1", campaignId: campaign.id, status: "active", campaignBinding: campaignScopeFingerprint(campaign),
    validFrom: new Date(now.getTime() - 60_000).toISOString(), validUntil: new Date(now.getTime() + 60 * 60_000).toISOString(),
    destinations: [{ platform, accountId: account.accountId, profileId: account.profileId, targetId: target.id, targetUrl: target.url }],
    approvedAssets: artifact ? [{ artifactId: artifact.id, sha256: artifact.sha256 }] : [],
    contentBoundary: { mode: "approved_copy_set", contentHashes: posts.map((post) => campaignContentHash(post.content)), allowRepeatSameContent: false },
    audienceRules: { allowedAudiences: ["public"] },
    schedule: { timezone: "UTC", weekdays: [now.getUTCDay()], startLocal: "00:00", endLocal: "23:59" },
    rateLimits: { maxJobsPerAccountPerDay: 10, maxJobsPerCampaignPerDay: 10, maxConcurrency: 1, minIntervalMinutes: 0 },
    allowLiveExecution: true
  };
  authorization.binding = campaignAuthorizationFingerprint(authorization);
  for (const post of posts) post.campaignAuthorizationBinding = authorization.binding;
  await store.mutate("test", "fixture", (state) => {
    state.campaigns.push(campaign);
    state.targets.push(target);
    state.executionAccounts.push(account);
    state.campaignAuthorizations.push(authorization);
    if (artifact) state.artifacts.push(artifact);
    state.posts.push(...posts);
  });
  const createGrant = (jobId = posts[0].id) => service.createLiveExecutionGrant({
    jobId, validFrom: new Date(Date.now() - 30_000).toISOString(),
    validUntil: new Date(Date.now() + 10 * 60_000).toISOString(), operatorAuthorizationReference: "fixture-operator-approval"
  }, "operator");
  return { service, store, posts, target, account, authorization, artifact, createGrant };
}

test("one job grant binds one live execution; sibling and dry-run never inherit or consume it", async () => {
  const f = await fixture({ sibling: true });
  const grant = await f.createGrant();
  const live = await f.service.prepareExecutionRequest(f.posts[0].id, "operator");
  const sibling = { request: createExecutionRequestV1({ executionId: "sibling-exec", post: f.posts[1], target: f.target,
    account: f.account, authorization: f.authorization, readiness: f.target.readiness, artifact: null }) };
  assert.equal(live.request.liveGrant.grantId, grant.grantId);
  assert.equal(sibling.request.liveGrant, null);
  assert.equal((await f.service.readyExecutionRequests()).some((row) => row.executionId === live.executionId), true);
  assert.equal((await f.service.readyExecutionRequests()).some((row) => row.jobId === f.posts[1].id), false);
  const stored = await f.service.getLiveExecutionGrant(grant.grantId);
  assert.equal(stored.boundExecutionId, live.executionId);
  assert.throws(() => assertLiveGrantMatchesExecution(stored, sibling.request, f.authorization), /does not match/);
  const dry = createExecutionRequestV1({ executionId: "dry-1", post: f.posts[1], target: f.target, account: f.account,
    authorization: f.authorization, readiness: f.target.readiness, artifact: null, dryRun: true });
  assert.equal(dry.liveGrant, null);
  const realDry = await f.service.prepareExecutionRequest(f.posts[1].id, "operator", { dryRun: true });
  assert.equal(realDry.request.dryRun, true);
  assert.equal(realDry.request.liveGrant, null);
  assert.equal((await f.service.getLiveExecutionGrant(grant.grantId)).status, "ACTIVE");
});

test("live grant rejects wrong job, execution, platform, account, profile, target, content, media and audience", async () => {
  const f = await fixture({ media: true });
  const grant = await f.createGrant();
  const row = await f.service.prepareExecutionRequest(f.posts[0].id, "operator");
  const stored = await f.service.getLiveExecutionGrant(grant.grantId);
  assert.equal(assertLiveGrantMatchesExecution(stored, row.request, f.authorization), true);
  for (const mutate of [
    (r) => { r.jobId = "other-job"; }, (r) => { r.executionId = "other-exec"; },
    (r) => { r.platform = "threads"; }, (r) => { r.accountId = "other-account"; },
    (r) => { r.profileId = "other-profile"; }, (r) => { r.target.targetId = "other-target"; },
    (r) => { r.content.sha256 = "b".repeat(64); }, (r) => { r.content.contentId = "other-content"; },
    (r) => { r.media[0].sha256 = "b".repeat(64); }, (r) => { r.media[0].artifactId = "other-artifact"; },
    (r) => { r.audience = "private"; }
  ]) {
    const changed = structuredClone(row.request);
    mutate(changed);
    assert.throws(() => assertLiveGrantMatchesExecution(stored, changed, f.authorization), /does not match/);
  }
});

test("expired, revoked and consumed grants reject a second execution", async () => {
  const f = await fixture();
  const grant = await f.createGrant();
  const row = await f.service.prepareExecutionRequest(f.posts[0].id, "operator");
  for (const change of [{ validUntil: new Date(Date.now() - 1).toISOString() }, { status: "REVOKED" }, { status: "CONSUMED" }]) {
    assert.throws(() => assertLiveGrantMatchesExecution({ ...grant, boundExecutionId: row.executionId, ...change }, row.request, f.authorization), /inactive, consumed or expired/);
  }
  assert.throws(() => assertLiveGrantMatchesExecution({ ...grant, boundExecutionId: row.executionId, consumedAt: new Date().toISOString() }, row.request, f.authorization), /consumed/);
  await f.service.revokeLiveExecutionGrant(grant.grantId, "operator");
  assert.equal((await f.service.getLiveExecutionGrant(grant.grantId)).status, "REVOKED");
  assert.equal((await f.service.readyExecutionRequests()).length, 0);
});

test("scheduler persists EXPIRED without creating or consuming an execution", async () => {
  const f = await fixture();
  const grant = await f.createGrant();
  await f.store.mutate("test", "fixture_expire_grant", (state) => {
    state.liveExecutionGrants[0].validUntil = new Date(Date.now() - 1).toISOString();
  });
  assert.deepEqual(await f.service.expireLiveExecutionGrants("scheduler"), [grant.grantId]);
  const state = await f.service.snapshot();
  assert.equal(state.liveExecutionGrants[0].status, "EXPIRED");
  assert.equal(state.executionRequests.length, 0);
});

test("a grant bound to one failed execution cannot move to a retry execution", async () => {
  const f = await fixture();
  const grant = await f.createGrant();
  const first = await f.service.prepareExecutionRequest(f.posts[0].id, "operator");
  await f.store.mutate("test", "fixture_recoverable_failure", (state) => {
    const row = state.executionRequests.find((item) => item.executionId === first.executionId);
    row.state = "FAILED";
    row.submitState = "FAILED";
    row.recoveryClassification = "RECOVERABLE";
  });
  const second = await f.service.prepareExecutionRequest(f.posts[0].id, "operator");
  assert.notEqual(second.executionId, first.executionId);
  assert.equal(second.request.liveGrant, null);
  assert.equal((await f.service.getLiveExecutionGrant(grant.grantId)).boundExecutionId, first.executionId);
});

test("durable submit intent consumes the exact grant in one state write and cannot be replayed", async () => {
  const f = await fixture();
  const grant = await f.createGrant();
  const row = await f.service.prepareExecutionRequest(f.posts[0].id, "operator");
  const acquired = await f.service.acquireExecutionLease(row.executionId, "fixture-worker");
  assert.equal(acquired.acquired, true);
  const intent = () => f.service.beginExecutionSubmitIntent(row.executionId, acquired.lease, {
    liveEnabled: true, liveExecutionId: row.executionId, verifiedGates: gates
  });
  await intent();
  const state = await f.service.snapshot();
  assert.equal(state.liveExecutionGrants[0].status, "CONSUMED");
  assert.equal(state.liveExecutionGrants[0].consumedExecutionId, row.executionId);
  assert.equal(state.executionRequests[0].state, "SUBMIT_SENT_INTENT");
  await assert.rejects(intent(), /inactive, consumed or expired|no longer dispatchable/);
  await assert.rejects(f.service.createLiveExecutionGrant({ jobId: f.posts[0].id, validFrom: new Date().toISOString(), validUntil: new Date(Date.now() + 60_000).toISOString(), operatorAuthorizationReference: "second" }, "operator"), /current state|existing or uncertain/);
  await f.service.releaseExecutionLease(acquired.lease.id, acquired.lease.token);
});

test("failed durable submit-intent write leaves grant ACTIVE and no submit state", async () => {
  const f = await fixture();
  const grant = await f.createGrant();
  const row = await f.service.prepareExecutionRequest(f.posts[0].id, "operator");
  const acquired = await f.service.acquireExecutionLease(row.executionId, "fixture-worker");
  const original = f.store.mutate.bind(f.store);
  f.store.mutate = async (actor, event, mutation) => {
    if (event === "execution_submit_intent_persisted") {
      await mutation(await f.store.read());
      throw new Error("fixture durable write failure");
    }
    return original(actor, event, mutation);
  };
  await assert.rejects(f.service.beginExecutionSubmitIntent(row.executionId, acquired.lease, {
    liveEnabled: true, liveExecutionId: row.executionId, verifiedGates: gates
  }), /durable write failure/);
  const state = await f.service.snapshot();
  assert.equal(state.liveExecutionGrants.find((item) => item.grantId === grant.grantId).status, "ACTIVE");
  assert.equal(state.executionRequests[0].state, "REQUEST_READY");
  assert.equal(state.publicationAttempts.length, 0);
  await f.service.releaseExecutionLease(acquired.lease.id, acquired.lease.token);
});

test("campaign authorization alone cannot cross submit boundary, including a non-LinkedIn platform", async () => {
  const f = await fixture({ platform: "threads" });
  const row = await f.service.prepareExecutionRequest(f.posts[0].id, "operator");
  const acquired = await f.service.acquireExecutionLease(row.executionId, "fixture-worker");
  await assert.rejects(f.service.beginExecutionSubmitIntent(row.executionId, acquired.lease, {
    liveEnabled: true, liveExecutionId: row.executionId, verifiedGates: gates
  }), /Invalid LiveExecutionGrantV1/);
  await f.service.releaseExecutionLease(acquired.lease.id, acquired.lease.token);
  const grant = await f.createGrant();
  assert.equal(grant.platform, "threads");
  assert.equal((await f.service.getLiveExecutionGrant(grant.grantId)).boundExecutionId, row.executionId);
});

test("grant contract binds canonical and raw content identities without confusing their hashes", async () => {
  const f = await fixture();
  const grant = await f.createGrant();
  assert.equal(grant.content.canonicalSha256, campaignContentHash(f.posts[0].content));
  assert.equal(grant.content.rawSha256, contentSha256(f.posts[0].content));
  assert.notEqual(grant.content.canonicalSha256, grant.content.rawSha256);
  assert.equal(grant.maxExecutions, 1);
  assert.equal(grant.operatorAuthorizationReference, "fixture-operator-approval");
});
