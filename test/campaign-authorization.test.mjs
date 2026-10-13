import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { JsonStore } from "../src/store.mjs";
import { SeedingService } from "../src/service.mjs";
import { campaignContentHash } from "../src/campaign-authorization.mjs";
import { approvalFingerprint, evaluateQueue } from "../src/guards.mjs";

async function campaignFixture({ channels = ["threads"], rateLimits = {}, allowRepeatSameContent = false } = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "campaign-auth-test-"));
  const productRepo = path.join(directory, "product-repo");
  await mkdir(productRepo);
  await writeFile(path.join(productRepo, "README.md"), "Fixture product evidence.\n", "utf8");
  const service = new SeedingService(new JsonStore(path.join(directory, "state.json")));
  await service.init();
  const campaign = await service.createCampaign({ name: "Scoped campaign", objective: "Validate campaign authorization", productRepo }, "operator");
  await service.updateCampaign(campaign.id, { status: "active" }, "operator");
  const checkedAt = new Date().toISOString();
  const targets = [];
  for (const channel of channels) {
    const accountId = `${channel}_fixture_account`;
    const profileId = `${channel}-fixture-profile`;
    await service.registerExecutionAccount({
      platform: channel,
      accountId,
      profileId,
      expectedIdentityUrl: channel === "linkedin" ? "https://www.linkedin.com/in/fixture-owner" : undefined
    }, "operator");
    targets.push(await service.createTarget({
      channel,
      name: `${channel} fixture target`,
      url: channel === "linkedin" ? "https://www.linkedin.com/company/fixture" : "https://www.threads.net/@fixture",
      accountId,
      profileId,
      status: "active",
      readiness: {
        state: "ready",
        checkedAt,
        checks: { sessionValid: true, composerCapable: true, platformAvailable: true }
      }
    }, "operator"));
  }
  const authorization = async (contents, overrides = {}) => service.authorizeCampaign(campaign.id, {
    id: `auth-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    validFrom: new Date(Date.now() - 60_000).toISOString(),
    validUntil: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
    destinations: targets.map((target) => ({ platform: target.channel, accountId: target.accountId, profileId: target.profileId, targetId: target.id })),
    approvedAssets: [],
    contentBoundary: {
      mode: "approved_copy_set",
      contentHashes: [...new Set(contents.map(campaignContentHash))],
      allowRepeatSameContent
    },
    audienceRules: { allowedAudiences: ["public"] },
    schedule: {
      timezone: "UTC",
      weekdays: [new Date().getUTCDay()],
      startLocal: "00:00",
      endLocal: "23:59"
    },
    rateLimits: {
      maxJobsPerAccountPerDay: 5,
      maxJobsPerCampaignPerDay: 10,
      maxConcurrency: 2,
      minIntervalMinutes: 0,
      ...rateLimits
    },
    allowLiveExecution: true,
    ...overrides
  }, "operator");
  return { directory, service, campaign, targets, authorization };
}

test("campaign authorization inherits to existing and new jobs with independent platform fan-out", async () => {
  const { service, campaign, targets, authorization } = await campaignFixture({ channels: ["threads", "linkedin"] });
  const copy = "One approved campaign message.";
  const drafts = [];
  for (const target of targets) drafts.push(await service.createPost({
    campaignId: campaign.id, targetId: target.id, content: copy, audience: "public"
  }, "producer"));

  const grant = await authorization([copy]);
  const inherited = await service.snapshot();
  for (const draft of drafts) {
    const job = inherited.posts.find((item) => item.id === draft.id);
    assert.equal(job.campaignAuthorizationId, grant.id);
    assert.equal(job.status, "queued");
  }

  const newJob = await service.createPost({
    campaignId: campaign.id, targetId: targets[0].id, content: "Second approved message.", audience: "public"
  }, "producer");
  assert.equal(newJob.campaignAuthorizationId, grant.id);
  assert.equal(newJob.status, "blocked");
  assert.ok(newJob.authorizationDecision.reasons.includes("content_not_in_approved_copy_set"));
});

test("target readiness failure blocks only its job and a fresh target update requeues it", async () => {
  const { service, campaign, targets, authorization } = await campaignFixture();
  const target = targets[0];
  const copy = "Readiness-gated campaign copy.";
  const draft = await service.createPost({ campaignId: campaign.id, targetId: target.id, content: copy, audience: "public" }, "producer");
  await service.updateTarget(target.id, { readiness: {
    state: "ready",
    checkedAt: new Date().toISOString(),
    checks: { sessionValid: false, composerCapable: true, platformAvailable: true }
  } }, "operator");
  await authorization([copy]);
  let job = (await service.snapshot()).posts.find((item) => item.id === draft.id);
  assert.equal(job.status, "blocked");
  assert.ok(job.authorizationDecision.reasons.includes("session_not_verified"));

  await service.updateTarget(target.id, { readiness: {
    state: "ready",
    checkedAt: new Date().toISOString(),
    checks: { sessionValid: true, composerCapable: true, platformAvailable: true }
  } }, "readiness-collector");
  job = (await service.snapshot()).posts.find((item) => item.id === draft.id);
  assert.equal(job.status, "queued");
});

test("publication idempotency reuses a legacy job without a stored key and blocks copy repeats by default", async () => {
  const { service, campaign, targets, authorization } = await campaignFixture();
  const copy = "A repeated campaign message.";
  await authorization([copy]);
  const first = await service.createPost({ campaignId: campaign.id, targetId: targets[0].id, content: copy, audience: "public" }, "producer");
  await service.store.mutate("fixture", "simulate_legacy_missing_key", (state) => {
    delete state.posts.find((item) => item.id === first.id).idempotencyKey;
  });
  const duplicate = await service.createPost({ campaignId: campaign.id, targetId: targets[0].id, content: copy, audience: "public" }, "producer");
  assert.equal(duplicate.id, first.id);

  const distinctContentId = await service.createPost({
    campaignId: campaign.id,
    targetId: targets[0].id,
    content: copy,
    contentId: "different-content-id",
    audience: "public"
  }, "producer");
  assert.notEqual(distinctContentId.id, first.id);
  assert.equal(distinctContentId.status, "blocked");
  assert.ok(distinctContentId.authorizationDecision.reasons.includes("duplicate_content_for_account"));
});

test("same-platform/account copy duplicates are blocked across different targets", async () => {
  const { service, campaign, targets, authorization } = await campaignFixture();
  const secondTarget = await service.createTarget({
    channel: targets[0].channel,
    name: "Second fixture target for same account",
    url: "https://www.threads.net/@fixture/second",
    accountId: targets[0].accountId,
    profileId: targets[0].profileId,
    status: "active",
    readiness: {
      state: "ready",
      checkedAt: new Date().toISOString(),
      checks: { sessionValid: true, composerCapable: true, platformAvailable: true }
    }
  }, "operator");
  targets.push(secondTarget);
  const copy = "Do not repeat this across targets on one account.";
  await authorization([copy]);
  const first = await service.createPost({ campaignId: campaign.id, targetId: targets[0].id, content: copy, audience: "public" }, "producer");
  await service.store.mutate("fixture", "simulate_same_account_published_copy", (state) => {
    const post = state.posts.find((item) => item.id === first.id);
    post.status = "published";
    post.publishedAt = new Date().toISOString();
  });

  const repeated = await service.createPost({
    campaignId: campaign.id,
    targetId: secondTarget.id,
    content: copy,
    contentId: "different-target-identity",
    audience: "public"
  }, "producer");
  assert.equal(repeated.status, "blocked");
  assert.ok(repeated.authorizationDecision.reasons.includes("duplicate_content_for_account"));
});

test("explicit campaign scope can allow repeating the same copy", async () => {
  const { service, campaign, targets, authorization } = await campaignFixture({ allowRepeatSameContent: true });
  const copy = "An explicitly repeat-authorized message.";
  await authorization([copy]);
  const first = await service.createPost({ campaignId: campaign.id, targetId: targets[0].id, content: copy, audience: "public" }, "producer");
  await service.store.mutate("fixture", "seed_past_published_copy", (state) => {
    const existing = state.posts.find((item) => item.id === first.id);
    existing.status = "published";
    existing.publishedAt = new Date(Date.now() - 2 * 60 * 60_000).toISOString();
  });
  const repeated = await service.createPost({
    campaignId: campaign.id,
    targetId: targets[0].id,
    content: copy,
    contentId: "approved-repeat-content-id",
    audience: "public"
  }, "producer");
  assert.equal(first.status, "queued");
  assert.equal(repeated.status, "queued", JSON.stringify(repeated.authorizationDecision));
});

test("live execution requires explicit campaign scope and changes the authorization binding", async () => {
  const { service, campaign, targets } = await campaignFixture({ channels: ["linkedin"] });
  const defaultAuth = await service.authorizeCampaign(campaign.id, {
    id: "live-default-deny",
    validFrom: new Date(Date.now() - 60_000).toISOString(),
    validUntil: new Date(Date.now() + 60 * 60_000).toISOString(),
    destinations: [{ platform: "linkedin", accountId: targets[0].accountId, profileId: targets[0].profileId, targetId: targets[0].id }],
    approvedAssets: [], contentBoundary: { mode: "approved_copy_set", contentHashes: [campaignContentHash("authorized copy")] },
    audienceRules: { allowedAudiences: ["public"] },
    schedule: { timezone: "UTC", weekdays: [new Date().getUTCDay()], startLocal: "00:00", endLocal: "23:59" },
    rateLimits: { maxJobsPerAccountPerDay: 5, maxJobsPerCampaignPerDay: 5, maxConcurrency: 1, minIntervalMinutes: 0 }
  }, "operator");
  assert.equal(defaultAuth.allowLiveExecution, false);
  const liveAuth = await service.authorizeCampaign(campaign.id, {
    id: "live-explicitly-authorized",
    validFrom: new Date(Date.now() - 60_000).toISOString(),
    validUntil: new Date(Date.now() + 60 * 60_000).toISOString(),
    destinations: [{ platform: "linkedin", accountId: targets[0].accountId, profileId: targets[0].profileId, targetId: targets[0].id }],
    approvedAssets: [], contentBoundary: { mode: "approved_copy_set", contentHashes: [campaignContentHash("authorized copy")] },
    audienceRules: { allowedAudiences: ["public"] },
    schedule: { timezone: "UTC", weekdays: [new Date().getUTCDay()], startLocal: "00:00", endLocal: "23:59" },
    rateLimits: { maxJobsPerAccountPerDay: 5, maxJobsPerCampaignPerDay: 5, maxConcurrency: 1, minIntervalMinutes: 0 },
    allowLiveExecution: true
  }, "operator");
  assert.equal(liveAuth.allowLiveExecution, true);
  assert.notEqual(liveAuth.binding, defaultAuth.binding);
});

test("concurrency limit carries across campaign authorization renewal", async () => {
  const copyOne = "First in-flight approved copy.";
  const copyTwo = "Second approved copy.";
  const { service, campaign, targets, authorization } = await campaignFixture({ rateLimits: { maxConcurrency: 1 } });
  const firstDraft = await service.createPost({ campaignId: campaign.id, targetId: targets[0].id, content: copyOne, audience: "public" }, "producer");
  await authorization([copyOne]);
  await service.transitionPost(firstDraft.id, { status: "publishing" }, "worker");

  await authorization([copyOne, copyTwo]);
  const second = await service.createPost({ campaignId: campaign.id, targetId: targets[0].id, content: copyTwo, audience: "public" }, "producer");
  assert.equal(second.status, "blocked");
  assert.ok(second.authorizationDecision.reasons.includes("campaign_concurrency_limit_reached"));
});

test("legacy approvedAt cannot substitute for missing campaign authorization once campaign scope exists", async () => {
  const { service, campaign, targets, authorization } = await campaignFixture();
  const copy = "Bound campaign authorization copy.";
  await authorization([copy]);
  const post = await service.createPost({ campaignId: campaign.id, targetId: targets[0].id, content: copy, audience: "public" }, "producer");
  await service.store.mutate("fixture", "remove_campaign_binding", (state) => {
    const job = state.posts.find((item) => item.id === post.id);
    job.status = "draft";
    delete job.campaignAuthorizationId;
    delete job.campaignAuthorizationBinding;
    job.approvedAt = new Date().toISOString();
    job.approvalBinding = approvalFingerprint(job, state.targets.find((item) => item.id === job.targetId));
  });
  const state = await service.snapshot();
  const job = state.posts.find((item) => item.id === post.id);
  const decision = evaluateQueue(job, state);
  assert.equal(decision.allowed, false);
  assert.ok(decision.reasons.includes("campaign_authorization_missing"));
});

test("campaign daily and cadence limits remain enforced across authorized child jobs", async () => {
  {
    const { service, campaign, targets, authorization } = await campaignFixture({ rateLimits: { maxJobsPerAccountPerDay: 1 } });
    const firstCopy = "First daily-limited message.";
    const secondCopy = "Second daily-limited message.";
    await service.createPost({ campaignId: campaign.id, targetId: targets[0].id, content: firstCopy, audience: "public" }, "producer");
    await service.createPost({ campaignId: campaign.id, targetId: targets[0].id, content: secondCopy, audience: "public" }, "producer");
    await authorization([firstCopy, secondCopy]);
    const state = await service.snapshot();
    const second = state.posts.find((item) => item.content === secondCopy);
    assert.equal(second.status, "blocked");
    assert.ok(second.authorizationDecision.reasons.includes("account_daily_limit_reached"));
  }
  {
    const { service, campaign, targets, authorization } = await campaignFixture({ rateLimits: { minIntervalMinutes: 60 } });
    const firstCopy = "First cadence-limited message.";
    const secondCopy = "Second cadence-limited message.";
    await service.createPost({ campaignId: campaign.id, targetId: targets[0].id, content: firstCopy, audience: "public" }, "producer");
    await service.createPost({ campaignId: campaign.id, targetId: targets[0].id, content: secondCopy, audience: "public" }, "producer");
    await authorization([firstCopy, secondCopy]);
    const state = await service.snapshot();
    const second = state.posts.find((item) => item.content === secondCopy);
    assert.equal(second.status, "blocked");
    assert.ok(second.authorizationDecision.reasons.includes("campaign_minimum_interval_not_met"));
  }
});
