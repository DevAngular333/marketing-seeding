import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { JsonStore } from "../src/store.mjs";
import { SeedingService, buildTrafficPulse, normalizeKeywords } from "../src/service.mjs";
import { campaignContentHash } from "../src/campaign-authorization.mjs";
import { readinessBinding } from "../src/readiness.mjs";
import { buildProductIntelligence } from "../src/product-intelligence.mjs";

async function fixture(prefix = "seeding-fixture-") {
  const directory = await mkdtemp(path.join(os.tmpdir(), prefix));
  const productRepo = path.join(directory, "product-repo");
  await mkdir(productRepo);
  const groundingText = "Rendered evidence is validated before the output is accepted.\n";
  await writeFile(path.join(productRepo, "README.md"), groundingText, "utf8");
  const service = new SeedingService(new JsonStore(path.join(directory, "state.json")));
  await service.init();
  const campaign = await service.createCampaign({ name: "Course", objective: "Validate demand", productRepo }, "operator");
  const target = await service.createTarget({
    channel: "threads", name: "Fixture audience", url: "https://www.threads.net/@fixture",
    accountId: "threads_fixture", status: "active"
  }, "operator");
  const post = await service.createPost({ campaignId: campaign.id, targetId: target.id, content: "Fixture post" }, "operator");
  return { directory, productRepo: await realpath(productRepo), groundingText, service, campaign, target, post };
}

async function templateCandidateFixture(prefix, { derive = true } = {}) {
  const { directory, service, campaign, productRepo, target } = await fixture(prefix);
  const profileId = `${prefix}-profile`;
  await service.registerExecutionAccount({ platform: "threads", accountId: target.accountId, profileId }, "operator");
  await service.updateTarget(target.id, { profileId, status: "active", readiness: {
    state: "ready", checkedAt: new Date().toISOString(),
    checks: { sessionValid: true, composerCapable: true, platformAvailable: true }
  } }, "operator");
  const document = buildProductIntelligence({
    productId: "fixture-product",
    evidence: [{ id: "readme", sourceType: "README", locator: "README.md", content: "A bounded product runtime." }],
    claims: [{ id: "what", field: "WHAT_IS_IT", text: "A bounded product runtime.", evidenceRefs: ["readme"] }]
  });
  await service.attachProductIntelligence(campaign.id, { document, sourceRepository: productRepo, readinessStatus: "READY" }, "automation");
  const story = await service.createStory(campaign.id, {
    title: "Evidence first", angle: "Proof", audience: "builders", callToAction: "Learn more",
    groundingSources: ["README.md"], claimIds: ["what"]
  }, "automation");
  const sourceHash = createHash("sha256").update(await readFile(path.join(productRepo, "README.md"))).digest("hex");
  await service.authorizeCampaign(campaign.id, {
    id: `${prefix}-auth`,
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
    allowLiveExecution: true, executionMode: "standing_autonomous", standingAuthorizationReference: `${prefix}-standing`
  }, "operator");
  const [candidate] = derive
    ? await service.deriveTemplateContentCandidates(campaign.id, { storyId: story.id, templateId: "template-1" }, "automation")
    : [null];
  return { directory, service, campaign, productRepo, target, candidate };
}

test("kill switch controls are operator-only and advance the durable epoch", async () => {
  const { service, post } = await fixture("seeding-kill-switch-controls-test-");
  await assert.rejects(service.activateKillSwitch("maintenance", "scheduler"), /Only an operator/);
  const activated = await service.activateKillSwitch("maintenance", "operator");
  assert.equal(activated.active, true);
  assert.equal(activated.epoch, 1);
  await assert.rejects(service.deactivateKillSwitch("automation"), /Only an operator/);
  const deactivated = await service.deactivateKillSwitch("local-human-operator");
  assert.equal(deactivated.active, false);
  assert.equal(deactivated.epoch, 2);
  await assert.rejects(service.rebasePostKillEpoch(post.id, "scheduler"), /Only an operator/);
});

test("product intelligence handoff is persisted on the campaign and projected read-only", async () => {
  const { service, campaign, productRepo } = await fixture("seeding-product-intelligence-runtime-test-");
  const document = buildProductIntelligence({
    productId: "fixture-product",
    evidence: [{ id: "readme", sourceType: "README", locator: "README.md", content: "A bounded product runtime." }],
    claims: [{ id: "what", field: "WHAT_IS_IT", text: "A bounded product runtime.", evidenceRefs: ["readme"] }]
  });
  const attached = await service.attachProductIntelligence(campaign.id, {
    document: { ...document, credentials: "must-not-persist" },
    sourceRepository: productRepo,
    readinessStatus: "incomplete"
  }, "automation");
  assert.equal(attached.handoff.readinessStatus, "INCOMPLETE");
  assert.equal("credentials" in attached.document, false);
  const state = await service.snapshot();
  const saved = state.campaigns.find((item) => item.id === campaign.id).productIntelligence;
  assert.equal(saved.handoff.evidenceClaimDocumentHash, attached.handoff.evidenceClaimDocumentHash);
  assert.equal("credentials" in saved.document, false);
  const dashboard = await service.dashboard();
  assert.equal(dashboard.productIntelligence.length, 1);
  assert.equal(dashboard.productIntelligence[0].campaignId, campaign.id);
  assert.equal(dashboard.productIntelligence[0].handoff.readinessStatus, "INCOMPLETE");
});

test("content candidates scope normal targets through campaign posts and survive restart without authority side effects", async () => {
  const { directory, service, campaign, productRepo, target } = await fixture("seeding-content-candidate-runtime-test-");
  const document = buildProductIntelligence({
    productId: "fixture-product",
    evidence: [{ id: "readme", sourceType: "README", locator: "README.md", content: "A bounded product runtime." }],
    claims: [{ id: "what", field: "WHAT_IS_IT", text: "A bounded product runtime.", evidenceRefs: ["readme"] }]
  });
  await service.attachProductIntelligence(campaign.id, { document, sourceRepository: productRepo, readinessStatus: "READY" }, "automation");
  const story = await service.createStory(campaign.id, {
    title: "Evidence first", angle: "Proof", audience: "builders", callToAction: "Learn more",
    groundingSources: ["README.md"], claimIds: ["what"]
  }, "automation");
  const candidates = await service.deriveContentCandidates(campaign.id, { storyId: story.id }, "automation");
  assert.equal(candidates.length, 1);
  const before = await service.snapshot();
  assert.equal(before.posts.length, 1);
  assert.equal((before.campaignAuthorizations || []).length, 0);
  assert.equal((before.executionRequests || []).length, 0);
  const restarted = new SeedingService(new JsonStore(path.join(directory, "state.json")));
  await restarted.init();
  const after = await restarted.snapshot();
  assert.deepEqual(after.campaigns.find((item) => item.id === campaign.id).contentCandidates, before.campaigns.find((item) => item.id === campaign.id).contentCandidates);
});

test("content candidate targetIds must be an array when supplied", async () => {
  const { service, campaign } = await fixture("seeding-content-target-input-test-");
  await assert.rejects(service.deriveContentCandidates(campaign.id, { storyId: "missing", targetIds: "target" }), /targetIds/);
});

test("materialize content candidate creates an idempotent draft without authority side effects", async () => {
  const { directory, service, campaign, productRepo, groundingText } = await fixture("seeding-content-materialize-test-");
  const document = buildProductIntelligence({
    productId: "fixture-product",
    evidence: [{ id: "readme", sourceType: "README", locator: "README.md", content: "A bounded product runtime." }],
    claims: [{ id: "what", field: "WHAT_IS_IT", text: "A bounded product runtime.", evidenceRefs: ["readme"] }]
  });
  await service.attachProductIntelligence(campaign.id, { document, sourceRepository: productRepo, readinessStatus: "READY" }, "automation");
  const story = await service.createStory(campaign.id, { title: "Evidence first", angle: "Proof", audience: "builders", callToAction: "Learn more", groundingSources: ["README.md"], claimIds: ["what"] }, "automation");
  const [candidate] = await service.deriveContentCandidates(campaign.id, { storyId: story.id }, "automation");
  const created = await service.materializeContentCandidate(campaign.id, { contentId: candidate.contentId, contentIdentity: candidate.contentIdentity }, "automation");
  assert.equal(created.status, "draft");
  assert.equal(created.contentId, candidate.contentId);
  assert.equal(created.contentIdentity, candidate.contentIdentity);
  assert.deepEqual(created.claimIds, candidate.claimIds);
  assert.deepEqual(created.contentEvidenceRefs, candidate.evidenceRefs);
  assert.deepEqual(created.contentSourceRefs, [{ relativePath: "README.md", sha256: createHash("sha256").update(groundingText).digest("hex") }]);
  assert.equal(created.audience, "builders");
  assert.equal("campaignAuthorizationId" in created, false);
  const before = await service.snapshot();
  assert.equal(before.executionRequests.length, 0);
  const repeated = await service.materializeContentCandidate(campaign.id, { contentId: candidate.contentId, contentIdentity: candidate.contentIdentity }, "automation");
  assert.equal(repeated.id, created.id);
  const restarted = new SeedingService(new JsonStore(path.join(directory, "state.json")));
  await restarted.init();
  const after = await restarted.materializeContentCandidate(campaign.id, { contentId: candidate.contentId, contentIdentity: candidate.contentIdentity }, "automation");
  assert.equal(after.id, created.id);
  assert.equal((await restarted.snapshot()).posts.filter((post) => post.contentId === candidate.contentId).length, 1);
});

test("materialize content candidate rejects identity tampering and unbound targets", async () => {
  const { service, campaign, productRepo, target } = await fixture("seeding-content-materialize-guards-test-");
  const document = buildProductIntelligence({ productId: "fixture-product", evidence: [{ id: "readme", sourceType: "README", locator: "README.md", content: "A bounded product runtime." }], claims: [{ id: "what", field: "WHAT_IS_IT", text: "A bounded product runtime.", evidenceRefs: ["readme"] }] });
  await service.attachProductIntelligence(campaign.id, { document, sourceRepository: productRepo, readinessStatus: "READY" }, "automation");
  const story = await service.createStory(campaign.id, { title: "Evidence first", angle: "Proof", audience: "builders", callToAction: "Learn more", groundingSources: ["README.md"], claimIds: ["what"] }, "automation");
  const [candidate] = await service.deriveContentCandidates(campaign.id, { storyId: story.id }, "automation");
  await service.store.mutate("fixture", "tamper_candidate", (state) => { state.campaigns.find((item) => item.id === campaign.id).contentCandidates[0].content = "tampered"; return state; });
  await assert.rejects(service.materializeContentCandidate(campaign.id, { contentId: candidate.contentId, contentIdentity: candidate.contentIdentity }, "automation"), /identity mismatch/);
  await service.store.mutate("fixture", "restore_candidate", (state) => { const item = state.campaigns.find((entry) => entry.id === campaign.id).contentCandidates[0]; item.content = candidate.content; return state; });
  await service.store.mutate("fixture", "unbind_target", (state) => { state.posts = state.posts.filter((post) => post.targetId !== target.id); return state; });
  await assert.rejects(service.materializeContentCandidate(campaign.id, { contentId: candidate.contentId, contentIdentity: candidate.contentIdentity }, "automation"), /not bound/);
});

test("materialize content candidate rejects a contentId that is not derived from its exact identity", async () => {
  const { service, campaign, productRepo } = await fixture("seeding-content-materialize-content-id-test-");
  const document = buildProductIntelligence({ productId: "fixture-product", evidence: [{ id: "readme", sourceType: "README", locator: "README.md", content: "A bounded product runtime." }], claims: [{ id: "what", field: "WHAT_IS_IT", text: "A bounded product runtime.", evidenceRefs: ["readme"] }] });
  await service.attachProductIntelligence(campaign.id, { document, sourceRepository: productRepo, readinessStatus: "READY" }, "automation");
  const story = await service.createStory(campaign.id, { title: "Evidence first", angle: "Proof", audience: "builders", callToAction: "Learn more", groundingSources: ["README.md"], claimIds: ["what"] }, "automation");
  const [candidate] = await service.deriveContentCandidates(campaign.id, { storyId: story.id }, "automation");
  await service.store.mutate("fixture", "tamper_candidate_content_id", (state) => {
    state.campaigns.find((item) => item.id === campaign.id).contentCandidates[0].contentId = "content-tampered";
    return state;
  });
  await assert.rejects(service.materializeContentCandidate(campaign.id, { contentId: "content-tampered", contentIdentity: candidate.contentIdentity }, "automation"), /contentId mismatch/);
});

test("materialize content candidate binds only to an exact standing authorization and derives existing execution controls", async () => {
  const { service, campaign, productRepo, target } = await fixture("seeding-content-materialize-standing-test-");
  const profileId = "threads-standing-profile";
  await service.registerExecutionAccount({ platform: "threads", accountId: target.accountId, profileId }, "operator");
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
    productId: "fixture-product",
    evidence: [{ id: "readme", sourceType: "README", locator: "README.md", content: "A bounded product runtime." }],
    claims: [{ id: "what", field: "WHAT_IS_IT", text: "A bounded product runtime.", evidenceRefs: ["readme"] }]
  });
  await service.attachProductIntelligence(campaign.id, { document, sourceRepository: productRepo, readinessStatus: "READY" }, "automation");
  const story = await service.createStory(campaign.id, {
    title: "Evidence first", angle: "Proof", audience: "builders", callToAction: "Learn more",
    groundingSources: ["README.md"], claimIds: ["what"]
  }, "automation");
  const [candidate] = await service.deriveContentCandidates(campaign.id, { storyId: story.id }, "automation");
  await service.authorizeCampaign(campaign.id, {
    id: "standing-content-materialization-auth",
    validFrom: new Date(Date.now() - 60_000).toISOString(),
    validUntil: new Date(Date.now() + 60 * 60_000).toISOString(),
    destinations: [{ platform: "threads", accountId: target.accountId, profileId, targetId: target.id }],
    approvedAssets: [],
    contentBoundary: { mode: "approved_copy_set", contentHashes: [campaignContentHash(candidate.content)] },
    audienceRules: { allowedAudiences: ["builders"] },
    publicationVisibilityRules: { allowedVisibilities: ["PUBLIC"] },
    schedule: { timezone: "UTC", weekdays: [new Date().getUTCDay()], startLocal: "00:00", endLocal: "23:59" },
    rateLimits: { maxJobsPerAccountPerDay: 3, maxJobsPerCampaignPerDay: 3, maxConcurrency: 1, minIntervalMinutes: 0 },
    allowLiveExecution: true,
    executionMode: "standing_autonomous",
    standingAuthorizationReference: "fixture-standing-content-materialization"
  }, "operator");

  const materialized = await service.materializeContentCandidate(campaign.id, { contentId: candidate.contentId, contentIdentity: candidate.contentIdentity }, "automation");
  assert.equal(materialized.status, "queued");
  assert.equal(materialized.campaignAuthorizationId, "standing-content-materialization-auth");
  const state = await service.snapshot();
  const request = state.executionRequests.find((item) => item.jobId === materialized.id);
  const window = state.oneTimeExecutionWindows.find((item) => item.jobId === materialized.id);
  const grant = state.liveExecutionGrants.find((item) => item.jobId === materialized.id);
  assert.equal(request.state, "REQUEST_READY");
  assert.equal(window.status, "RESERVED");
  assert.equal(grant.status, "ACTIVE");
  assert.equal(grant.boundExecutionId, request.executionId);
  assert.equal(state.posts.filter((item) => item.idempotencyKey === materialized.idempotencyKey).length, 1);
});

test("queue scheduler materializes exact standing approved-copy candidates idempotently across ticks and restart", async () => {
  const { directory, service, campaign, productRepo, target } = await fixture("seeding-content-candidate-scheduler-test-");
  const profileId = "threads-scheduled-profile";
  await service.registerExecutionAccount({ platform: "threads", accountId: target.accountId, profileId }, "operator");
  await service.updateTarget(target.id, { profileId, status: "active", readiness: {
    state: "ready", checkedAt: new Date().toISOString(),
    checks: { sessionValid: true, composerCapable: true, platformAvailable: true }
  } }, "operator");
  const document = buildProductIntelligence({
    productId: "fixture-product",
    evidence: [{ id: "readme", sourceType: "README", locator: "README.md", content: "A bounded product runtime." }],
    claims: [{ id: "what", field: "WHAT_IS_IT", text: "A bounded product runtime.", evidenceRefs: ["readme"] }]
  });
  await service.attachProductIntelligence(campaign.id, { document, sourceRepository: productRepo, readinessStatus: "READY" }, "automation");
  const story = await service.createStory(campaign.id, {
    title: "Evidence first", angle: "Proof", audience: "builders", callToAction: "Learn more",
    groundingSources: ["README.md"], claimIds: ["what"]
  }, "automation");
  const [candidate] = await service.deriveContentCandidates(campaign.id, { storyId: story.id }, "automation");
  await service.authorizeCampaign(campaign.id, {
    id: "standing-content-candidate-scheduler-auth",
    validFrom: new Date(Date.now() - 60_000).toISOString(),
    validUntil: new Date(Date.now() + 60 * 60_000).toISOString(),
    destinations: [{ platform: "threads", accountId: target.accountId, profileId, targetId: target.id }],
    approvedAssets: [],
    contentBoundary: { mode: "approved_copy_set", contentHashes: [campaignContentHash(candidate.content)] },
    audienceRules: { allowedAudiences: ["builders"] },
    publicationVisibilityRules: { allowedVisibilities: ["PUBLIC"] },
    schedule: { timezone: "UTC", weekdays: [new Date().getUTCDay()], startLocal: "00:00", endLocal: "23:59" },
    rateLimits: { maxJobsPerAccountPerDay: 3, maxJobsPerCampaignPerDay: 3, maxConcurrency: 1, minIntervalMinutes: 0 },
    allowLiveExecution: true,
    executionMode: "standing_autonomous",
    standingAuthorizationReference: "fixture-standing-content-candidate-scheduler"
  }, "operator");

  await service.queueDueCampaignJobs("fixture-scheduler");
  const first = await service.snapshot();
  const firstPost = first.posts.find((item) => item.contentId === candidate.contentId);
  assert.ok(firstPost);
  assert.equal(firstPost.status, "queued");
  assert.equal(first.executionRequests.filter((item) => item.jobId === firstPost.id).length, 1);
  assert.equal(first.oneTimeExecutionWindows.filter((item) => item.jobId === firstPost.id).length, 1);
  assert.equal(first.liveExecutionGrants.filter((item) => item.jobId === firstPost.id).length, 1);

  await service.queueDueCampaignJobs("fixture-scheduler");
  const restarted = new SeedingService(new JsonStore(path.join(directory, "state.json")));
  await restarted.init();
  await restarted.queueDueCampaignJobs("fixture-scheduler-after-restart");
  const after = await restarted.snapshot();
  assert.equal(after.posts.filter((item) => item.idempotencyKey === firstPost.idempotencyKey).length, 1);
  assert.equal(after.executionRequests.filter((item) => item.jobId === firstPost.id).length, 1);
  assert.equal(after.oneTimeExecutionWindows.filter((item) => item.jobId === firstPost.id).length, 1);
  assert.equal(after.liveExecutionGrants.filter((item) => item.jobId === firstPost.id).length, 1);
  assert.equal(after.submissionUncertainties.length, 0);
});

test("template candidates render from exact approved claims and queue idempotently", async () => {
  const { directory, service, campaign, productRepo, target } = await fixture("seeding-template-candidate-scheduler-test-");
  const profileId = "threads-template-profile";
  await service.registerExecutionAccount({ platform: "threads", accountId: target.accountId, profileId }, "operator");
  await service.updateTarget(target.id, { profileId, status: "active", readiness: {
    state: "ready", checkedAt: new Date().toISOString(),
    checks: { sessionValid: true, composerCapable: true, platformAvailable: true }
  } }, "operator");
  const document = buildProductIntelligence({
    productId: "fixture-product",
    evidence: [{ id: "readme", sourceType: "README", locator: "README.md", content: "A bounded product runtime." }],
    claims: [{ id: "what", field: "WHAT_IS_IT", text: "A bounded product runtime.", evidenceRefs: ["readme"] }]
  });
  await service.attachProductIntelligence(campaign.id, { document, sourceRepository: productRepo, readinessStatus: "READY" }, "automation");
  const story = await service.createStory(campaign.id, {
    title: "Evidence first", angle: "Proof", audience: "builders", callToAction: "Learn more",
    groundingSources: ["README.md"], claimIds: ["what"]
  }, "automation");
  const sourceHash = createHash("sha256").update(await readFile(path.join(productRepo, "README.md"))).digest("hex");
  await service.authorizeCampaign(campaign.id, {
    id: "standing-template-candidate-auth",
    validFrom: new Date(Date.now() - 60_000).toISOString(),
    validUntil: new Date(Date.now() + 60 * 60_000).toISOString(),
    destinations: [{ platform: "threads", accountId: target.accountId, profileId, targetId: target.id }],
    approvedAssets: [],
    contentBoundary: {
      mode: "approved_template_set",
      approvedClaims: [{ id: "what", text: "A bounded product runtime.", sourceRefs: [{ relativePath: "README.md", sha256: sourceHash }] }],
      templates: [{ id: "template-1", platform: "threads", template: "{{claim:what}}\n{{disclosure}}" }],
      requiredDisclosures: ["AI-assisted draft grounded in verified repository evidence."]
    },
    audienceRules: { allowedAudiences: ["builders"] },
    publicationVisibilityRules: { allowedVisibilities: ["PUBLIC"] },
    schedule: { timezone: "UTC", weekdays: [new Date().getUTCDay()], startLocal: "00:00", endLocal: "23:59" },
    rateLimits: { maxJobsPerAccountPerDay: 3, maxJobsPerCampaignPerDay: 3, maxConcurrency: 1, minIntervalMinutes: 0 },
    allowLiveExecution: true,
    executionMode: "standing_autonomous",
    standingAuthorizationReference: "fixture-standing-template-candidate"
  }, "operator");

  const [candidate] = await service.deriveTemplateContentCandidates(campaign.id, { storyId: story.id, templateId: "template-1" }, "automation");
  assert.equal(candidate.content, "A bounded product runtime.\nAI-assisted draft grounded in verified repository evidence.");
  assert.equal(candidate.templateContractVersion, 1);
  assert.equal(candidate.templateId, "template-1");
  assert.equal(candidate.templatePlatform, "threads");
  assert.deepEqual(candidate.templateClaimIds, ["what"]);
  assert.deepEqual(candidate.templateSourceRefs, [{ relativePath: "README.md", sha256: sourceHash }]);
  assert.equal(candidate.contentId, `content-${candidate.contentIdentity.slice(0, 24)}`);

  await service.queueDueCampaignJobs("template-candidate-scheduler");
  const first = await service.snapshot();
  const post = first.posts.find((item) => item.contentId === candidate.contentId);
  assert.ok(post);
  assert.equal(post.status, "queued");
  assert.equal(post.templateId, "template-1");
  assert.equal(post.templateFingerprint, candidate.templateFingerprint);
  assert.equal(first.executionRequests.filter((item) => item.jobId === post.id).length, 1);
  assert.equal(first.oneTimeExecutionWindows.filter((item) => item.jobId === post.id).length, 1);
  assert.equal(first.liveExecutionGrants.filter((item) => item.jobId === post.id).length, 1);

  await service.queueDueCampaignJobs("template-candidate-scheduler");
  const restarted = new SeedingService(new JsonStore(path.join(directory, "state.json")));
  await restarted.init();
  await restarted.queueDueCampaignJobs("template-candidate-scheduler-restart");
  const after = await restarted.snapshot();
  assert.equal(after.posts.filter((item) => item.idempotencyKey === post.idempotencyKey).length, 1);
  assert.equal(after.executionRequests.filter((item) => item.jobId === post.id).length, 1);
  assert.equal(after.oneTimeExecutionWindows.filter((item) => item.jobId === post.id).length, 1);
  assert.equal(after.liveExecutionGrants.filter((item) => item.jobId === post.id).length, 1);
});

test("queue derives approved template candidates from persisted stories without per-post derivation", async () => {
  const { directory, service, campaign } = await templateCandidateFixture("seeding-template-candidate-autonomous-queue-test-", { derive: false });
  const before = await service.snapshot();
  assert.equal((before.campaigns.find((item) => item.id === campaign.id).contentCandidates || []).length, 0);

  const firstResults = await service.queueDueCampaignJobs("template-candidate-autonomous-queue");
  const first = await service.snapshot();
  const firstCampaign = first.campaigns.find((item) => item.id === campaign.id);
  const derived = firstCampaign.contentCandidates.filter((item) => item.templateId === "template-1");
  assert.equal(derived.length, 1);
  assert.equal(derived[0].content, "A bounded product runtime.");
  const post = first.posts.find((item) => item.contentId === derived[0].contentId);
  assert.ok(post);
  assert.equal(post.status, "queued");
  assert.ok(firstResults.some((item) => item.campaignId === campaign.id));
  assert.equal(first.executionRequests.filter((item) => item.jobId === post.id).length, 1);
  assert.equal(first.oneTimeExecutionWindows.filter((item) => item.jobId === post.id).length, 1);
  assert.equal(first.liveExecutionGrants.filter((item) => item.jobId === post.id).length, 1);

  await service.queueDueCampaignJobs("template-candidate-autonomous-queue-repeat");
  const restarted = new SeedingService(new JsonStore(path.join(directory, "state.json")));
  await restarted.init();
  await restarted.queueDueCampaignJobs("template-candidate-autonomous-queue-restart");
  const after = await restarted.snapshot();
  const afterCampaign = after.campaigns.find((item) => item.id === campaign.id);
  const afterCandidate = afterCampaign.contentCandidates.find((item) => item.templateId === "template-1");
  assert.equal(afterCampaign.contentCandidates.filter((item) => item.templateId === "template-1").length, 1);
  assert.equal(after.posts.filter((item) => item.contentId === afterCandidate.contentId).length, 1);
  assert.equal(after.executionRequests.filter((item) => item.jobId === post.id).length, 1);
  assert.equal(after.oneTimeExecutionWindows.filter((item) => item.jobId === post.id).length, 1);
  assert.equal(after.liveExecutionGrants.filter((item) => item.jobId === post.id).length, 1);
  assert.equal(after.submissionUncertainties.length, 0);
});

test("template candidate tampering remains draft-only with no execution artifacts", async () => {
  const { service, campaign, productRepo, target } = await fixture("seeding-template-candidate-tamper-test-");
  const profileId = "threads-template-tamper-profile";
  await service.registerExecutionAccount({ platform: "threads", accountId: target.accountId, profileId }, "operator");
  await service.updateTarget(target.id, { profileId, status: "active", readiness: {
    state: "ready", checkedAt: new Date().toISOString(),
    checks: { sessionValid: true, composerCapable: true, platformAvailable: true }
  } }, "operator");
  const document = buildProductIntelligence({
    productId: "fixture-product",
    evidence: [{ id: "readme", sourceType: "README", locator: "README.md", content: "A bounded product runtime." }],
    claims: [{ id: "what", field: "WHAT_IS_IT", text: "A bounded product runtime.", evidenceRefs: ["readme"] }]
  });
  await service.attachProductIntelligence(campaign.id, { document, sourceRepository: productRepo, readinessStatus: "READY" }, "automation");
  const story = await service.createStory(campaign.id, {
    title: "Evidence first", angle: "Proof", audience: "builders", callToAction: "Learn more",
    groundingSources: ["README.md"], claimIds: ["what"]
  }, "automation");
  const sourceHash = createHash("sha256").update(await readFile(path.join(productRepo, "README.md"))).digest("hex");
  await service.authorizeCampaign(campaign.id, {
    id: "standing-template-candidate-tamper-auth",
    validFrom: new Date(Date.now() - 60_000).toISOString(),
    validUntil: new Date(Date.now() + 60 * 60_000).toISOString(),
    destinations: [{ platform: "threads", accountId: target.accountId, profileId, targetId: target.id }],
    approvedAssets: [],
    contentBoundary: { mode: "approved_template_set", approvedClaims: [{ id: "what", text: "A bounded product runtime.", sourceRefs: [{ relativePath: "README.md", sha256: sourceHash }] }], templates: [{ id: "template-1", platform: "threads", template: "{{claim:what}}" }] },
    audienceRules: { allowedAudiences: ["builders"] },
    publicationVisibilityRules: { allowedVisibilities: ["PUBLIC"] },
    schedule: { timezone: "UTC", weekdays: [new Date().getUTCDay()], startLocal: "00:00", endLocal: "23:59" },
    rateLimits: { maxJobsPerAccountPerDay: 3, maxJobsPerCampaignPerDay: 3, maxConcurrency: 1, minIntervalMinutes: 0 },
    allowLiveExecution: true, executionMode: "standing_autonomous", standingAuthorizationReference: "fixture-standing-template-tamper"
  }, "operator");
  const [candidate] = await service.deriveTemplateContentCandidates(campaign.id, { storyId: story.id, templateId: "template-1" }, "automation");
  await service.store.mutate("fixture", "tamper_template_candidate", (state) => {
    const row = state.campaigns.find((item) => item.id === campaign.id).contentCandidates.find((item) => item.contentId === candidate.contentId);
    row.content = "tampered outside approved template";
    return state;
  });
  const before = await service.snapshot();
  await service.queueDueCampaignJobs("template-candidate-tamper");
  const after = await service.snapshot();
  const saved = after.campaigns.find((item) => item.id === campaign.id).contentCandidates.find((item) => item.contentId === candidate.contentId);
  assert.equal(saved.status, "draft");
  assert.equal(after.posts.filter((item) => item.campaignId === campaign.id && item.contentId === candidate.contentId).length, 0);
  assert.equal(after.executionRequests.length, before.executionRequests.length);
  assert.equal(after.oneTimeExecutionWindows.length, before.oneTimeExecutionWindows.length);
  assert.equal(after.liveExecutionGrants.length, before.liveExecutionGrants.length);
});

test("template binding scope tampering fails closed before execution artifacts", async () => {
  const cases = [
    ["contract", (candidate) => { candidate.templateContractVersion = 99; }, /Unsupported or unauthorized template candidate contract/],
    ["fingerprint", (candidate) => { candidate.templateFingerprint = "f".repeat(64); }, /fingerprint/],
    ["authorization", (candidate) => { candidate.templateAuthorizationBinding = "f".repeat(64); }, /fingerprint/],
    ["claims", (candidate) => { candidate.templateClaimIds = ["other"]; }, /claim binding/],
    ["sources", (candidate) => { candidate.templateSourceRefs = [{ relativePath: "README.md", sha256: "f".repeat(64) }]; }, /grounding source changed/],
    ["render", (candidate) => { candidate.content = "outside the approved template"; }, /content hash mismatch/],
    ["target", (_candidate, target) => { target.url = "https://www.threads.net/@different"; }, /does not fit one exact active standing authorization/],
    ["authorization-template", (_candidate, _target, authorization) => { authorization.contentBoundary.templates[0].template = "{{claim:what}} changed"; }, /fingerprint/],
    ["claim", (_candidate, _target, authorization) => { authorization.contentBoundary.approvedClaims[0].text = "changed claim"; }, /outside the authorized template/]
  ];
  for (const [label, mutate, expected] of cases) {
    const { service, campaign, productRepo, target, candidate } = await templateCandidateFixture(`seeding-template-binding-${label}-test`);
    await service.store.mutate("fixture", `tamper_template_binding_${label}`, (state) => {
      const currentCampaign = state.campaigns.find((item) => item.id === campaign.id);
      const currentCandidate = currentCampaign.contentCandidates.find((item) => item.contentId === candidate.contentId);
      const authorization = state.campaignAuthorizations.find((item) => item.campaignId === campaign.id && item.status === "active");
      mutate(currentCandidate, state.targets.find((item) => item.id === target.id), authorization);
      return state;
    });
    if (label === "sources") await writeFile(path.join(productRepo, "README.md"), "source drift\n", "utf8");
    const before = await service.snapshot();
    await assert.rejects(service.materializeContentCandidate(campaign.id, {
      contentId: candidate.contentId,
      contentIdentity: candidate.contentIdentity,
      requireStandingAuthorization: true
    }, "template-binding-tamper"), expected, label);
    const after = await service.snapshot();
    const saved = after.campaigns.find((item) => item.id === campaign.id).contentCandidates.find((item) => item.contentId === candidate.contentId);
    assert.equal(saved.status, "draft", label);
    assert.equal(after.posts.filter((item) => item.campaignId === campaign.id && item.contentId === candidate.contentId).length, 0, label);
    assert.equal(after.executionRequests.length, before.executionRequests.length, label);
    assert.equal(after.oneTimeExecutionWindows.length, before.oneTimeExecutionWindows.length, label);
    assert.equal(after.liveExecutionGrants.length, before.liveExecutionGrants.length, label);
  }
});

test("queue scheduler leaves candidates without exact approved-copy standing authority draft-only", async () => {
  for (const mode of ["none", "approved_template_set"]) {
    const { service, campaign, productRepo, target } = await fixture(`seeding-content-candidate-scheduler-${mode}-test-`);
    const profileId = `threads-scheduler-${mode}-profile`;
    await service.registerExecutionAccount({ platform: "threads", accountId: target.accountId, profileId }, "operator");
    await service.updateTarget(target.id, { profileId, status: "active", readiness: {
      state: "ready", checkedAt: new Date().toISOString(),
      checks: { sessionValid: true, composerCapable: true, platformAvailable: true }
    } }, "operator");
    const document = buildProductIntelligence({
      productId: "fixture-product",
      evidence: [{ id: "readme", sourceType: "README", locator: "README.md", content: "A bounded product runtime." }],
      claims: [{ id: "what", field: "WHAT_IS_IT", text: "A bounded product runtime.", evidenceRefs: ["readme"] }]
    });
    await service.attachProductIntelligence(campaign.id, { document, sourceRepository: productRepo, readinessStatus: "READY" }, "automation");
    const story = await service.createStory(campaign.id, {
      title: "Evidence first", angle: "Proof", audience: "builders", callToAction: "Learn more",
      groundingSources: ["README.md"], claimIds: ["what"]
    }, "automation");
    const [candidate] = await service.deriveContentCandidates(campaign.id, { storyId: story.id }, "automation");
    if (mode === "approved_template_set") {
      const sourceHash = createHash("sha256").update(await readFile(path.join(productRepo, "README.md"))).digest("hex");
      await service.authorizeCampaign(campaign.id, {
        id: `standing-content-candidate-scheduler-${mode}-auth`,
        validFrom: new Date(Date.now() - 60_000).toISOString(),
        validUntil: new Date(Date.now() + 60 * 60_000).toISOString(),
        destinations: [{ platform: "threads", accountId: target.accountId, profileId, targetId: target.id }],
        approvedAssets: [],
        contentBoundary: {
          mode,
          approvedClaims: [{ id: "what", text: "A bounded product runtime.", sourceRefs: [{ relativePath: "README.md", sha256: sourceHash }] }],
          templates: [{ id: "template-1", platform: "threads", template: "{{claim:what}}" }]
        },
        audienceRules: { allowedAudiences: ["builders"] },
        publicationVisibilityRules: { allowedVisibilities: ["PUBLIC"] },
        schedule: { timezone: "UTC", weekdays: [new Date().getUTCDay()], startLocal: "00:00", endLocal: "23:59" },
        rateLimits: { maxJobsPerAccountPerDay: 3, maxJobsPerCampaignPerDay: 3, maxConcurrency: 1, minIntervalMinutes: 0 },
        allowLiveExecution: true,
        executionMode: "standing_autonomous",
        standingAuthorizationReference: `fixture-standing-content-candidate-scheduler-${mode}`
      }, "operator");
    }
    const before = await service.snapshot();
    await service.queueDueCampaignJobs("fixture-scheduler");
    const after = await service.snapshot();
    assert.equal(after.campaigns.find((item) => item.id === campaign.id).contentCandidates.find((item) => item.contentId === candidate.contentId).status, "draft", mode);
    assert.equal(after.posts.filter((item) => item.campaignId === campaign.id && item.contentId === candidate.contentId).length, 0, mode);
    if (mode === "none") {
      assert.equal(after.executionRequests.length, before.executionRequests.length, mode);
      assert.equal(after.oneTimeExecutionWindows.length, before.oneTimeExecutionWindows.length, mode);
      assert.equal(after.liveExecutionGrants.length, before.liveExecutionGrants.length, mode);
    } else {
      const derived = after.campaigns.find((item) => item.id === campaign.id).contentCandidates.find((item) => item.templateId === "template-1");
      assert.ok(derived, mode);
      assert.equal(after.posts.filter((item) => item.campaignId === campaign.id && item.contentId === derived.contentId).length, 1, mode);
    }
  }
});

test("queue scheduler leaves candidates draft-only when campaign is inactive even if authority state is stale", async () => {
  const { service, campaign, productRepo, target } = await fixture("seeding-content-candidate-scheduler-inactive-campaign-test-");
  const profileId = "threads-inactive-campaign-profile";
  await service.registerExecutionAccount({ platform: "threads", accountId: target.accountId, profileId }, "operator");
  await service.updateTarget(target.id, { profileId, status: "active", readiness: {
    state: "ready", checkedAt: new Date().toISOString(),
    checks: { sessionValid: true, composerCapable: true, platformAvailable: true }
  } }, "operator");
  const document = buildProductIntelligence({
    productId: "fixture-product",
    evidence: [{ id: "readme", sourceType: "README", locator: "README.md", content: "A bounded product runtime." }],
    claims: [{ id: "what", field: "WHAT_IS_IT", text: "A bounded product runtime.", evidenceRefs: ["readme"] }]
  });
  await service.attachProductIntelligence(campaign.id, { document, sourceRepository: productRepo, readinessStatus: "READY" }, "automation");
  const story = await service.createStory(campaign.id, {
    title: "Evidence first", angle: "Proof", audience: "builders", callToAction: "Learn more",
    groundingSources: ["README.md"], claimIds: ["what"]
  }, "automation");
  const [candidate] = await service.deriveContentCandidates(campaign.id, { storyId: story.id }, "automation");
  await service.authorizeCampaign(campaign.id, {
    id: "standing-content-candidate-inactive-campaign-auth",
    validFrom: new Date(Date.now() - 60_000).toISOString(),
    validUntil: new Date(Date.now() + 60 * 60_000).toISOString(),
    destinations: [{ platform: "threads", accountId: target.accountId, profileId, targetId: target.id }],
    approvedAssets: [],
    contentBoundary: { mode: "approved_copy_set", contentHashes: [campaignContentHash(candidate.content)] },
    audienceRules: { allowedAudiences: ["builders"] },
    publicationVisibilityRules: { allowedVisibilities: ["PUBLIC"] },
    schedule: { timezone: "UTC", weekdays: [new Date().getUTCDay()], startLocal: "00:00", endLocal: "23:59" },
    rateLimits: { maxJobsPerAccountPerDay: 3, maxJobsPerCampaignPerDay: 3, maxConcurrency: 1, minIntervalMinutes: 0 },
    allowLiveExecution: true,
    executionMode: "standing_autonomous",
    standingAuthorizationReference: "fixture-standing-content-candidate-inactive-campaign"
  }, "operator");
  await service.store.mutate("fixture", "stale_inactive_campaign_authority", (state) => {
    state.campaigns.find((item) => item.id === campaign.id).status = "paused";
    return state;
  });
  await service.queueDueCampaignJobs("fixture-scheduler");
  const after = await service.snapshot();
  assert.equal(after.campaigns.find((item) => item.id === campaign.id).contentCandidates.find((item) => item.contentId === candidate.contentId).status, "draft");
  assert.equal(after.posts.filter((item) => item.campaignId === campaign.id && item.contentId === candidate.contentId).length, 0);
  assert.equal(after.executionRequests.length, 0);
  assert.equal(after.oneTimeExecutionWindows.length, 0);
  assert.equal(after.liveExecutionGrants.length, 0);
});

test("queue does not derive template candidates for paused or ambiguous authority", async () => {
  for (const scenario of ["paused", "ambiguous"]) {
    const { service, campaign } = await templateCandidateFixture(`seeding-template-candidate-${scenario}-queue-test-`, { derive: false });
    if (scenario === "paused") {
      await service.setCampaignAuthorizationStatus(campaign.id, "paused", "operator");
    } else {
      const state = await service.snapshot();
      const authorization = state.campaignAuthorizations.find((item) => item.campaignId === campaign.id);
      await service.store.mutate("fixture", "template_queue_ambiguous_authority", (next) => {
        next.campaignAuthorizations.push({ ...authorization, id: `${authorization.id}-duplicate`, binding: authorization.binding, status: "active" });
        return next;
      });
    }
    const before = await service.snapshot();
    await service.queueDueCampaignJobs(`template-candidate-${scenario}-queue`);
    const after = await service.snapshot();
    const savedCampaign = after.campaigns.find((item) => item.id === campaign.id);
    assert.equal((savedCampaign.contentCandidates || []).length, 0, scenario);
    assert.equal(after.posts.length, before.posts.length, scenario);
    assert.equal(after.executionRequests.length, before.executionRequests.length, scenario);
    assert.equal(after.oneTimeExecutionWindows.length, before.oneTimeExecutionWindows.length, scenario);
    assert.equal(after.liveExecutionGrants.length, before.liveExecutionGrants.length, scenario);
  }
});

test("queue derives one deterministic product story only from an explicit standing story policy", async () => {
  const { directory, service, campaign, productRepo, target } = await fixture("seeding-story-policy-queue-test-");
  const profileId = "threads-story-policy-profile";
  await service.registerExecutionAccount({ platform: "threads", accountId: target.accountId, profileId }, "operator");
  await service.updateTarget(target.id, { profileId, status: "active", readiness: {
    state: "ready", checkedAt: new Date().toISOString(),
    checks: { sessionValid: true, composerCapable: true, platformAvailable: true }
  } }, "operator");
  await service.inspectProductIntelligence(campaign.id, {
    allowlist: ["README.md"],
    claims: [
      { id: "what", field: "WHAT_IS_IT", text: "A bounded product runtime.", evidenceRefs: ["repo:README.md"] },
      { id: "problem", field: "WHAT_PROBLEM_DOES_IT_SOLVE", text: "It reduces blind retries.", evidenceRefs: ["repo:README.md"] },
      { id: "better", field: "WHY_IS_IT_BETTER", text: "It is deterministic and verified.", evidenceRefs: ["repo:README.md"] },
      { id: "who", field: "WHO_NEEDS_IT", text: "Operators and developers.", evidenceRefs: ["repo:README.md"] }
    ]
  }, "automation");
  const sourceHash = createHash("sha256").update(await readFile(path.join(productRepo, "README.md"))).digest("hex");
  await service.authorizeCampaign(campaign.id, {
    id: "standing-story-policy-queue-auth",
    validFrom: new Date(Date.now() - 60_000).toISOString(),
    validUntil: new Date(Date.now() + 60 * 60_000).toISOString(),
    destinations: [{ platform: "threads", accountId: target.accountId, profileId, targetId: target.id }],
    approvedAssets: [],
    contentBoundary: {
      mode: "approved_template_set",
      approvedClaims: [{ id: "what", text: "A bounded product runtime.", sourceRefs: [{ relativePath: "README.md", sha256: sourceHash }] }],
      templates: [{ id: "template-1", platform: "threads", template: "{{claim:what}} {{disclosure}}" }],
      requiredDisclosures: ["Evidence-grounded draft."],
      storyPolicy: { callToAction: "Read the evidence", disclosure: "Evidence-grounded draft.", language: "en" }
    },
    audienceRules: { allowedAudiences: ["Operators and developers."] },
    publicationVisibilityRules: { allowedVisibilities: ["PUBLIC"] },
    schedule: { timezone: "UTC", weekdays: [new Date().getUTCDay()], startLocal: "00:00", endLocal: "23:59" },
    rateLimits: { maxJobsPerAccountPerDay: 3, maxJobsPerCampaignPerDay: 3, maxConcurrency: 1, minIntervalMinutes: 0 },
    allowLiveExecution: true,
    executionMode: "standing_autonomous",
    standingAuthorizationReference: "standing-story-policy-queue"
  }, "operator");

  const before = await service.snapshot();
  const firstTick = await service.queueDueCampaignJobs("story-policy-queue");
  const afterFirst = await service.snapshot();
  const firstCampaign = afterFirst.campaigns.find((item) => item.id === campaign.id);
  const firstStories = afterFirst.stories.filter((story) => story.campaignId === campaign.id);
  const firstCandidates = firstCampaign.contentCandidates.filter((candidate) => candidate.templateId === "template-1");
  assert.equal(firstStories.length, 1);
  assert.equal(firstStories[0].status, "draft");
  assert.equal(firstStories[0].callToAction, "Read the evidence");
  assert.equal(firstCandidates.length, 1);
  assert.equal(afterFirst.posts.filter((post) => post.campaignId === campaign.id && post.contentId === firstCandidates[0].contentId).length, 1);
  assert.ok(firstTick.some((item) => item.campaignId === campaign.id));

  const restarted = new SeedingService(new JsonStore(path.join(directory, "state.json")));
  await restarted.init();
  await restarted.queueDueCampaignJobs("story-policy-queue-restart");
  const afterRestart = await restarted.snapshot();
  assert.equal(afterRestart.stories.filter((story) => story.campaignId === campaign.id).length, 1);
  assert.equal(afterRestart.campaigns.find((item) => item.id === campaign.id).contentCandidates.filter((candidate) => candidate.templateId === "template-1").length, 1);
  assert.equal(afterRestart.posts.filter((post) => post.campaignId === campaign.id && post.contentId === firstCandidates[0].contentId).length, 1);
  assert.equal(afterRestart.executionRequests.length, afterFirst.executionRequests.length);
  assert.equal(afterRestart.oneTimeExecutionWindows.length, afterFirst.oneTimeExecutionWindows.length);
  assert.equal(afterRestart.liveExecutionGrants.length, afterFirst.liveExecutionGrants.length);
  assert.equal(before.submissionUncertainties.length, afterRestart.submissionUncertainties.length);
});

test("queue story derivation stays draft-only without policy, with ambiguous or stale authority, or after source drift", async () => {
  const scenarios = ["missing-policy", "ambiguous-authority", "stale-binding", "stale-campaign-binding", "source-drift"];
  for (const scenario of scenarios) {
    const { service, campaign, productRepo, target } = await fixture(`seeding-story-policy-${scenario}-test-`);
    const profileId = `threads-story-policy-${scenario}-profile`;
    await service.registerExecutionAccount({ platform: "threads", accountId: target.accountId, profileId }, "operator");
    await service.updateTarget(target.id, { profileId, status: "active", readiness: {
      state: "ready", checkedAt: new Date().toISOString(),
      checks: { sessionValid: true, composerCapable: true, platformAvailable: true }
    } }, "operator");
    await service.inspectProductIntelligence(campaign.id, {
      allowlist: ["README.md"],
      claims: [
        { id: "what", field: "WHAT_IS_IT", text: "A bounded product runtime.", evidenceRefs: ["repo:README.md"] },
        { id: "problem", field: "WHAT_PROBLEM_DOES_IT_SOLVE", text: "It reduces blind retries.", evidenceRefs: ["repo:README.md"] },
        { id: "better", field: "WHY_IS_IT_BETTER", text: "It is deterministic and verified.", evidenceRefs: ["repo:README.md"] },
        { id: "who", field: "WHO_NEEDS_IT", text: "Operators and developers.", evidenceRefs: ["repo:README.md"] }
      ]
    }, "automation");
    const sourceHash = createHash("sha256").update(await readFile(path.join(productRepo, "README.md"))).digest("hex");
    const contentBoundary = {
      mode: "approved_template_set",
      approvedClaims: [{ id: "what", text: "A bounded product runtime.", sourceRefs: [{ relativePath: "README.md", sha256: sourceHash }] }],
      templates: [{ id: "template-1", platform: "threads", template: "{{claim:what}}" }],
      ...(scenario === "missing-policy" ? {} : { storyPolicy: { callToAction: "Read the evidence" } })
    };
    await service.authorizeCampaign(campaign.id, {
      id: `standing-story-policy-${scenario}-auth`,
      validFrom: new Date(Date.now() - 60_000).toISOString(),
      validUntil: new Date(Date.now() + 60 * 60_000).toISOString(),
      destinations: [{ platform: "threads", accountId: target.accountId, profileId, targetId: target.id }],
      approvedAssets: [], contentBoundary,
      audienceRules: { allowedAudiences: ["Operators and developers."] },
      publicationVisibilityRules: { allowedVisibilities: ["PUBLIC"] },
      schedule: { timezone: "UTC", weekdays: [new Date().getUTCDay()], startLocal: "00:00", endLocal: "23:59" },
      rateLimits: { maxJobsPerAccountPerDay: 3, maxJobsPerCampaignPerDay: 3, maxConcurrency: 1, minIntervalMinutes: 0 },
      allowLiveExecution: true,
      executionMode: "standing_autonomous",
      standingAuthorizationReference: `standing-story-policy-${scenario}`
    }, "operator");
    if (scenario === "ambiguous-authority") {
      const snapshot = await service.snapshot();
      const authorization = snapshot.campaignAuthorizations.find((item) => item.campaignId === campaign.id);
      await service.store.mutate("fixture", "duplicate_story_policy_authority", (state) => {
        state.campaignAuthorizations.push({ ...authorization, id: `${authorization.id}-duplicate`, status: "active" });
        return state;
      });
    }
    if (["stale-binding", "stale-campaign-binding"].includes(scenario)) {
      await service.store.mutate("fixture", "stale_story_policy_authority", (state) => {
        const authorization = state.campaignAuthorizations.find((item) => item.campaignId === campaign.id && item.status === "active");
        if (scenario === "stale-binding") authorization.binding = "tampered-authorization-binding";
        else authorization.campaignBinding = "tampered-campaign-binding";
        return state;
      });
    }
    if (scenario === "source-drift") await writeFile(path.join(productRepo, "README.md"), "source drift\n", "utf8");
    const before = await service.snapshot();
    await service.queueDueCampaignJobs(`story-policy-${scenario}`);
    const after = await service.snapshot();
    assert.equal(after.stories.filter((story) => story.campaignId === campaign.id).length, 0, scenario);
    assert.equal((after.campaigns.find((item) => item.id === campaign.id).contentCandidates || []).length, 0, scenario);
    assert.equal(after.posts.filter((post) => post.campaignId === campaign.id).length, before.posts.filter((post) => post.campaignId === campaign.id).length, scenario);
    assert.equal(after.executionRequests.length, before.executionRequests.length, scenario);
    assert.equal(after.oneTimeExecutionWindows.length, before.oneTimeExecutionWindows.length, scenario);
    assert.equal(after.liveExecutionGrants.length, before.liveExecutionGrants.length, scenario);
    assert.equal(after.executionLeases.length, before.executionLeases.length, scenario);
  }
});

test("queue scheduler isolates one campaign failure and continues the next campaign", async () => {
  const { service, campaign, target } = await fixture("seeding-queue-failure-isolation-test-");
  const secondCampaign = await service.createCampaign({ name: "Second course", objective: "Continue queue", productRepo: campaign.productRepo }, "operator");
  await service.store.mutate("fixture", "queue_failure_isolation_fixture", (state) => {
    state.posts.push(
      { id: "queue-failure-post", campaignId: campaign.id, targetId: target.id, campaignAuthorizationId: "auth-failure", status: "blocked", readinessAttempts: 0 },
      { id: "queue-healthy-post", campaignId: secondCampaign.id, targetId: target.id, campaignAuthorizationId: "auth-healthy", status: "blocked", readinessAttempts: 0 }
    );
    return state;
  });
  const calls = [];
  service.queueAuthorizedCampaignJobs = async (campaignId) => {
    calls.push(campaignId);
    if (campaignId === campaign.id) throw Object.assign(new Error("internal details must not escape"), { code: "BROKEN_FIXTURE" });
    return [{ postId: "queue-healthy-post", status: "blocked", reasons: [] }];
  };

  const results = await service.queueDueCampaignJobs("queue-failure-isolation-test");
  assert.deepEqual(calls, [campaign.id, secondCampaign.id]);
  assert.deepEqual(results, [
    { campaignId: campaign.id, decisions: [], failed: true, reason: "BROKEN_FIXTURE" },
    { campaignId: secondCampaign.id, decisions: [{ postId: "queue-healthy-post", status: "blocked", reasons: [] }] }
  ]);
  assert.equal(JSON.stringify(results).includes("internal details"), false);
});

test("materialize content candidate revalidates grounding source bytes before creating a post", async () => {
  const { service, campaign, productRepo } = await fixture("seeding-content-materialize-grounding-test-");
  const document = buildProductIntelligence({
    productId: "fixture-product",
    evidence: [{ id: "readme", sourceType: "README", locator: "README.md", content: "A bounded product runtime." }],
    claims: [{ id: "what", field: "WHAT_IS_IT", text: "A bounded product runtime.", evidenceRefs: ["readme"] }]
  });
  await service.attachProductIntelligence(campaign.id, { document, sourceRepository: productRepo, readinessStatus: "READY" }, "automation");
  const story = await service.createStory(campaign.id, { title: "Evidence first", angle: "Proof", audience: "builders", callToAction: "Learn more", groundingSources: ["README.md"], claimIds: ["what"] }, "automation");
  const [candidate] = await service.deriveContentCandidates(campaign.id, { storyId: story.id }, "automation");
  await writeFile(path.join(productRepo, "README.md"), "Changed evidence.\n", "utf8");
  await assert.rejects(service.materializeContentCandidate(campaign.id, { contentId: candidate.contentId, contentIdentity: candidate.contentIdentity }, "automation"), /grounding source changed/);
  assert.equal((await service.snapshot()).posts.filter((item) => item.contentId === candidate.contentId).length, 0);
});

test("paused, revoked and expired standing authorizations leave materialized candidates draft", async () => {
  for (const scenario of ["paused", "revoked", "expired"]) {
    const { service, campaign, productRepo, target } = await fixture(`seeding-content-materialize-${scenario}-authorization-test-`);
    const profileId = `threads-${scenario}-profile`;
    await service.registerExecutionAccount({ platform: "threads", accountId: target.accountId, profileId }, "operator");
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
      productId: "fixture-product",
      evidence: [{ id: "readme", sourceType: "README", locator: "README.md", content: "A bounded product runtime." }],
      claims: [{ id: "what", field: "WHAT_IS_IT", text: "A bounded product runtime.", evidenceRefs: ["readme"] }]
    });
    await service.attachProductIntelligence(campaign.id, { document, sourceRepository: productRepo, readinessStatus: "READY" }, "automation");
    const story = await service.createStory(campaign.id, {
      title: "Evidence first", angle: "Proof", audience: "builders", callToAction: "Learn more",
      groundingSources: ["README.md"], claimIds: ["what"]
    }, "automation");
    const [candidate] = await service.deriveContentCandidates(campaign.id, { storyId: story.id }, "automation");
    await service.authorizeCampaign(campaign.id, {
      id: `standing-${scenario}-materialization-auth`,
      validFrom: scenario === "expired" ? new Date(Date.now() - 120_000).toISOString() : new Date(Date.now() - 60_000).toISOString(),
      validUntil: scenario === "expired" ? new Date(Date.now() - 60_000).toISOString() : new Date(Date.now() + 60 * 60_000).toISOString(),
      destinations: [{ platform: "threads", accountId: target.accountId, profileId, targetId: target.id }],
      approvedAssets: [],
      contentBoundary: { mode: "approved_copy_set", contentHashes: [campaignContentHash(candidate.content)] },
      audienceRules: { allowedAudiences: ["builders"] },
      publicationVisibilityRules: { allowedVisibilities: ["PUBLIC"] },
      schedule: { timezone: "UTC", weekdays: [new Date().getUTCDay()], startLocal: "00:00", endLocal: "23:59" },
      rateLimits: { maxJobsPerAccountPerDay: 3, maxJobsPerCampaignPerDay: 3, maxConcurrency: 1, minIntervalMinutes: 0 },
      allowLiveExecution: true,
      executionMode: "standing_autonomous",
      standingAuthorizationReference: `fixture-standing-${scenario}`
    }, "operator");
    if (scenario === "expired") await service.expireCampaignAuthorizations("scheduler");
    else await service.setCampaignAuthorizationStatus(campaign.id, scenario, "operator");
    const before = await service.snapshot();
    const materialized = await service.materializeContentCandidate(campaign.id, { contentId: candidate.contentId, contentIdentity: candidate.contentIdentity }, "automation");
    assert.equal(materialized.status, "draft", scenario);
    assert.equal("campaignAuthorizationId" in materialized, false, scenario);
    assert.equal("executionState" in materialized, false, scenario);
    const after = await service.snapshot();
    assert.equal(after.executionRequests.length, before.executionRequests.length, scenario);
    assert.equal(after.oneTimeExecutionWindows.length, before.oneTimeExecutionWindows.length, scenario);
    assert.equal(after.liveExecutionGrants.length, before.liveExecutionGrants.length, scenario);
    assert.equal(after.posts.filter((post) => post.contentId === candidate.contentId).length, 1, scenario);
  }
});

test("repository inspection builds grounded intelligence and persists safe lineage", async () => {
  const { service, campaign, productRepo } = await fixture("seeding-product-inspection-runtime-test-");
  const result = await service.inspectProductIntelligence(campaign.id, {
    allowlist: ["README.md"],
    claims: [{ id: "what", field: "WHAT_IS_IT", text: "A bounded product runtime.", evidenceRefs: ["repo:README.md"] }]
  }, "automation");
  assert.equal(result.persisted, true);
  assert.equal(result.externalSideEffects, false);
  assert.equal(result.productIntelligence.document.WHAT_IS_IT.id, "what");
  assert.equal(result.productIntelligence.repositoryInspection.records.length, 1);
  assert.equal(result.productIntelligence.repositoryInspection.records[0].locator, "README.md");
  const state = await service.snapshot();
  const saved = state.campaigns.find((item) => item.id === campaign.id).productIntelligence;
  assert.equal(saved.repositoryInspection.inspectionHash, result.inspection.inspectionHash);
  assert.equal(saved.repositoryInspection.records[0].sha256, result.inspection.records[0].sha256);
  assert.equal(saved.repositoryInspection.records[0].content, undefined);
  const dashboard = await service.dashboard();
  assert.equal(dashboard.productIntelligence[0].repositoryInspection.inspectionHash, result.inspection.inspectionHash);
  assert.equal(dashboard.productIntelligence[0].repositoryInspection.records[0].content, undefined);
  assert.equal(path.resolve(result.inspection.repository), path.resolve(productRepo));
});

test("product intelligence derives one grounded draft story idempotently across restart", async () => {
  const { directory, service, campaign, productRepo } = await fixture("seeding-product-intelligence-story-test-");
  const result = await service.inspectProductIntelligence(campaign.id, {
    allowlist: ["README.md"],
    claims: [
      { id: "what", field: "WHAT_IS_IT", text: "A bounded product runtime.", evidenceRefs: ["repo:README.md"] },
      { id: "problem", field: "WHAT_PROBLEM_DOES_IT_SOLVE", text: "It reduces blind retries.", evidenceRefs: ["repo:README.md"] },
      { id: "better", field: "WHY_IS_IT_BETTER", text: "It is deterministic and verified.", evidenceRefs: ["repo:README.md"] },
      { id: "who", field: "WHO_NEEDS_IT", text: "Operators and developers.", evidenceRefs: ["repo:README.md"] }
    ]
  }, "automation");
  assert.equal(result.productIntelligence.handoff.readinessStatus, "READY");
  const before = await service.snapshot();
  const first = await service.deriveProductIntelligenceStory(campaign.id, { callToAction: "Read the evidence" }, "automation");
  assert.equal(first.status, "draft");
  assert.equal(first.title, "A bounded product runtime.");
  assert.equal(first.audience, "Operators and developers.");
  assert.deepEqual(first.claimIds, ["what", "problem", "better", "who"]);
  assert.equal(first.groundingSources.length, 1);
  assert.equal(first.groundingSources[0].relativePath, "README.md");
  const second = await service.deriveProductIntelligenceStory(campaign.id, { callToAction: "Read the evidence", disclosure: "AI-assisted draft grounded in verified repository evidence." }, "automation");
  assert.equal(second.id, first.id);
  const restarted = new SeedingService(new JsonStore(path.join(directory, "state.json")));
  await restarted.init();
  const third = await restarted.deriveProductIntelligenceStory(campaign.id, { callToAction: "Read the evidence" }, "automation");
  assert.equal(third.id, first.id);
  const after = await restarted.snapshot();
  assert.equal(after.stories.filter((story) => story.storyIdentity === first.storyIdentity).length, 1);
  assert.equal(after.executionRequests.length, before.executionRequests.length);
  assert.equal(after.oneTimeExecutionWindows.length, before.oneTimeExecutionWindows.length);
  assert.equal(after.liveExecutionGrants.length, before.liveExecutionGrants.length);
  assert.equal(after.executionLeases.length, before.executionLeases.length);
  assert.equal(after.submissionUncertainties.length, before.submissionUncertainties.length);
  await writeFile(path.join(productRepo, "README.md"), "drifted repository source\n", "utf8");
  await assert.rejects(restarted.deriveProductIntelligenceStory(campaign.id, { callToAction: "Read the evidence" }, "automation"), /grounding source changed|repository inspection changed/);
  const finalState = await restarted.snapshot();
  assert.equal(finalState.stories.filter((story) => story.storyIdentity === first.storyIdentity).length, 1);
});

test("product intelligence story derivation remains draft-only and requires READY handoff", async () => {
  const { service, campaign, productRepo } = await fixture("seeding-product-intelligence-story-gate-test-");
  const document = buildProductIntelligence({
    productId: "fixture-product",
    evidence: [{ id: "readme", sourceType: "README", locator: "README.md", content: "A bounded product runtime." }],
    claims: [{ id: "what", field: "WHAT_IS_IT", text: "A bounded product runtime.", evidenceRefs: ["readme"] }]
  });
  await service.attachProductIntelligence(campaign.id, { document, sourceRepository: productRepo, readinessStatus: "INCOMPLETE" }, "automation");
  await assert.rejects(service.deriveProductIntelligenceStory(campaign.id, { callToAction: "Read the evidence" }, "automation"), /requires READY/);
  const state = await service.snapshot();
  assert.equal(state.stories.length, 0);
  assert.equal(state.executionRequests.length, 0);
  assert.equal(state.oneTimeExecutionWindows.length, 0);
  assert.equal(state.liveExecutionGrants.length, 0);
});

test("product intelligence story derivation rejects forged lineage and unsafe disclosure", async () => {
  const { service, campaign, productRepo } = await fixture("seeding-product-intelligence-story-forgery-test-");
  const result = await service.inspectProductIntelligence(campaign.id, {
    allowlist: ["README.md"],
    claims: [
      { id: "what", field: "WHAT_IS_IT", text: "A bounded product runtime.", evidenceRefs: ["repo:README.md"] },
      { id: "problem", field: "WHAT_PROBLEM_DOES_IT_SOLVE", text: "It reduces blind retries.", evidenceRefs: ["repo:README.md"] },
      { id: "better", field: "WHY_IS_IT_BETTER", text: "It is deterministic and verified.", evidenceRefs: ["repo:README.md"] },
      { id: "who", field: "WHO_NEEDS_IT", text: "Operators and developers.", evidenceRefs: ["repo:README.md"] }
    ]
  }, "automation");
  await service.store.mutate("fixture", "forge_product_intelligence", (state) => {
    const current = state.campaigns.find((item) => item.id === campaign.id);
    current.productIntelligence.document.evidence[0].content = "forged content";
    return state;
  });
  await assert.rejects(service.deriveProductIntelligenceStory(campaign.id, { callToAction: "Read the evidence" }, "automation"), /evidence is not derived|hash mismatch|inspection|Invalid product intelligence handoff/);

  await service.store.mutate("fixture", "restore_product_intelligence", (state) => {
    const current = state.campaigns.find((item) => item.id === campaign.id);
    current.productIntelligence.document = result.productIntelligence.document;
    current.productIntelligence.handoff = result.productIntelligence.handoff;
    return state;
  });
  await assert.rejects(service.deriveProductIntelligenceStory(campaign.id, { callToAction: "Read the evidence", disclosure: "token: leaked" }, "automation"), /credential\/session/);
  const state = await service.snapshot();
  assert.equal(state.stories.length, 0);
  assert.equal(state.executionRequests.length, 0);
  assert.equal(state.oneTimeExecutionWindows.length, 0);
  assert.equal(state.liveExecutionGrants.length, 0);
  assert.equal(path.resolve(state.campaigns.find((item) => item.id === campaign.id).productRepo), path.resolve(productRepo));
});

test("discovery observations are normalized, scored, persisted and never become publish authority", async () => {
  const { service, campaign, post } = await fixture("seeding-discovery-runtime-test-");
  const result = await service.recordDiscoveries(campaign.id, {
    policies: { "example.com": { channel: "example", actions: ["observe"] } },
    keywords: ["automation"],
    blockedKeywords: ["spam"],
    observations: [
      { url: "https://EXAMPLE.COM/thread#x", title: "Need automation", text: "workflow pain", source: "fixture" },
      { url: "https://example.com/thread", title: "Need automation", text: "workflow pain", source: "fixture" },
      { url: "https://example.com/blocked", text: "spam automation", source: "fixture" }
    ]
  }, "automation");
  assert.equal(result.accepted, 2);
  assert.equal(result.total, 2);
  assert.equal(result.observations.some((item) => item.classification.label === "RELEVANT"), true);
  assert.equal(result.observations.some((item) => item.classification.label === "BLOCKED"), true);
  const state = await service.snapshot();
  const saved = state.campaigns.find((item) => item.id === campaign.id);
  assert.equal(saved.discovery.observations.length, 2);
  assert.equal(state.posts.length, 1);
  assert.equal(state.posts[0].id, post.id);
  const dashboard = await service.dashboard();
  assert.equal(dashboard.discoveries.length, 2);
});

test("provider-send fence rejects changed execution identity and target binding", async () => {
  const now = new Date();
  const readiness = {
    state: "READY",
    checkedAt: new Date(now.getTime() - 1_000).toISOString(),
    expiresAt: new Date(now.getTime() + 60_000).toISOString(),
    binding: readinessBinding({ platform: "linkedin", accountId: "account-1", profileId: "profile-1", targetId: "target-1" }),
    platform: "linkedin", accountId: "account-1", profileId: "profile-1", targetId: "target-1"
  };
  const base = {
    requestRow: { executionId: "execution-1", jobId: "job-1", state: "SUBMIT_SENT_INTENT", submitState: "NOT_STARTED" },
    request: {
      executionId: "execution-1", jobId: "job-1", campaignId: "campaign-1", platform: "linkedin",
      accountId: "account-1", profileId: "profile-1", target: { targetId: "target-1", url: "https://www.linkedin.com/feed/" },
      authorization: { authorizationId: "authorization-1", binding: "authorization-binding" }
    },
    post: { id: "job-1", campaignId: "campaign-1", targetId: "target-1", status: "queued" },
    target: { id: "target-1", channel: "linkedin", accountId: "account-1", profileId: "profile-1", status: "active", url: "https://www.linkedin.com/feed/", readiness },
    account: { accountId: "account-1", profileId: "profile-1", status: "enabled", health: "healthy" },
    authorization: { id: "authorization-1", status: "active", allowLiveExecution: true, binding: "authorization-binding" },
    state: { executionLeases: [{ id: "lease-1", token: "lease-token", expiresAt: new Date(now.getTime() + 60_000).toISOString() }], control: { killSwitch: { active: false, epoch: 0 } } }
  };
  const service = Object.create(SeedingService.prototype);
  service.readinessTtlMs = 300_000;
  for (const mutate of [
    (context) => { context.request.jobId = "other-job"; },
    (context) => { context.request.platform = "threads"; },
    (context) => { context.request.target.targetId = "other-target"; },
    (context) => { context.request.target.url = "https://www.linkedin.com/company/other"; },
    (context) => { context.target.status = "needs_review"; }
  ]) {
    const context = structuredClone(base);
    mutate(context);
    service.executionContext = async () => context;
    await assert.rejects(service.assertExecutionSendable("execution-1", { id: "lease-1", token: "lease-token" }), { code: "IDENTITY_MISMATCH" });
  }
  service.executionContext = async () => structuredClone(base);
  const allowed = await service.assertExecutionSendable("execution-1", { id: "lease-1", token: "lease-token" });
  assert.equal(allowed.executionId, "execution-1");
});

test("R19 bootstrap is idempotent and does not fabricate publication evidence", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "seeding-test-"));
  const productRepo = path.join(directory, "design-os-3d-blender");
  await mkdir(productRepo);
  const file = path.join(directory, "state.json");
  const service = new SeedingService(new JsonStore(file));
  await service.init();
  const priorProductRepo = process.env.SEEDING_R19_PRODUCT_REPO;
  try {
    process.env.SEEDING_R19_PRODUCT_REPO = productRepo;
    await service.bootstrapR19("test");
    await service.bootstrapR19("test");
  } finally {
    if (priorProductRepo === undefined) delete process.env.SEEDING_R19_PRODUCT_REPO;
    else process.env.SEEDING_R19_PRODUCT_REPO = priorProductRepo;
  }
  const state = JSON.parse(await readFile(file, "utf8"));
  assert.equal(state.campaigns.length, 1);
  assert.equal(state.targets.length, 7);
  assert.equal(state.posts.length, 7);
  assert.deepEqual(new Set(state.targets.map((target) => target.channel)), new Set([
    "facebook_group", "threads", "reddit", "product_hunt", "indie_hackers", "linkedin", "email"
  ]));
  assert.equal(state.posts.every((post) => post.status === "needs_review"), true);
  assert.equal(state.posts.every((post) => !post.publicationUrl && !post.evidence), true);
  assert.equal(state.campaigns[0].productRepo, await realpath(productRepo));
  assert.equal(state.campaigns[0].assetPath, null);
  assert.equal(state.posts.every((post) => post.assetPath === null), true);
  assert.equal(new Set(state.posts.map((post) => post.content)).size, 7);
});

test("post audience can be updated independently through the service", async () => {
  const { service, post } = await fixture("seeding-post-audience-test-");
  const before = { content: post.content, assetPath: post.assetPath, targetId: post.targetId, status: post.status };
  const updated = await service.updatePost(post.id, { audience: "public" }, "operator");
  assert.equal(updated.audience, "public");
  assert.deepEqual({ content: updated.content, assetPath: updated.assetPath, targetId: updated.targetId, status: updated.status }, before);
});

test("LinkedIn execution accounts require an ORCA profile UUID and targets must use the same unique active binding", async () => {
  const { service } = await fixture("seeding-linkedin-profile-binding-test-");
  const profileId = "1fe88615-ddcc-4d71-9cf6-821cf67b3b01";
  const account = await service.registerExecutionAccount({
    platform: "linkedin", accountId: "linkedin_binding_test", profileId,
    identityReference: "https://www.linkedin.com/in/fixture-owner"
  }, "operator");
  assert.equal(account.profileId, profileId);

  await assert.rejects(service.registerExecutionAccount({
    platform: "linkedin", accountId: "linkedin_label_binding", profileId: "marketing-linkedin-test-01"
  }, "operator"), /immutable ORCA profile UUID/);
  await assert.rejects(service.createTarget({
    channel: "linkedin", name: "Mismatched profile", url: "https://www.linkedin.com/feed/",
    accountId: account.accountId, profileId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
  }, "operator"), /must match a registered execution account/);
  await assert.rejects(service.registerExecutionAccount({
    platform: "linkedin", accountId: "linkedin_duplicate_binding", profileId: profileId,
    identityReference: "https://www.linkedin.com/in/other-owner"
  }, "operator"), /already bound to another linkedin account/);
});

test("verified artifact to grounded story to channel drafts stays draft-only", async () => {
  const { productRepo, service, campaign, target } = await fixture("seeding-pipeline-test-");
  await writeFile(path.join(productRepo, "preview.mp4"), "video-fixture", "utf8");
  const artifact = await service.registerArtifact(campaign.id, {
    name: "Daily preview", path: "preview.mp4", mediaType: "video/mp4", evidence: "Decoded fixture"
  }, "producer");
  assert.equal(artifact.status, "verified");
  assert.equal(artifact.sha256, createHash("sha256").update("video-fixture").digest("hex"));
  await assert.rejects(service.registerArtifact(campaign.id, {
    name: "Outside", path: path.join(path.dirname(productRepo), "outside.mp4"), evidence: "none"
  }), /inside productRepo|does not exist/);
  const story = await service.createStory(campaign.id, {
    artifactId: artifact.id,
    title: "Evidence-first workflow",
    angle: "Show the verification loop",
    audience: "3D builders",
    callToAction: "Ask for the validation checklist",
    groundingSources: ["README.md"]
  }, "ai-drafter");
  const drafts = await service.createChannelDrafts(story.id, {
    variants: [{ targetId: target.id, content: "A grounded channel-specific draft." }]
  }, "ai-drafter");
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].status, "draft");
  assert.equal(drafts[0].storyId, story.id);
  const schedule = await service.createSchedule(campaign.id, {
    name: "Daily draft", localTime: "09:00", timezone: "Asia/Saigon", channels: ["threads", "linkedin"]
  }, "operator");
  assert.equal(schedule.mode, "draft_only");
  const run = await service.recordScheduleRun(schedule.id, { status: "succeeded", artifactId: artifact.id, storyId: story.id });
  assert.equal(run.externalSideEffects, false);
  const dashboard = await service.dashboard();
  assert.equal(dashboard.recentArtifacts.length, 1);
  assert.equal(dashboard.recentStories.length, 1);
  assert.equal(dashboard.flowGraph.counters.unresolvedReferences, 0);
});

test("standing owner approval schedules are explicit, editable and audit side effects", async () => {
  const { service, campaign } = await fixture("seeding-standing-approval-test-");
  const schedule = await service.createSchedule(campaign.id, {
    name: "Morning publish",
    localTime: "09:00",
    timezone: "Asia/Saigon",
    channels: ["threads", "linkedin"],
    mode: "publish_with_standing_approval",
    approvalReference: "D:\\build-agentic-AI\\automation-contracts\\marketing-seeding\\standing-publish-approval.json"
  }, "operator");
  assert.equal(schedule.requiresHumanPublishApproval, false);
  assert.equal(schedule.approvalPolicy, "campaign_authorization");
  const updated = await service.updateSchedule(schedule.id, { localTime: "19:00", status: "active" }, "operator");
  assert.equal(updated.localTime, "19:00");
  const run = await service.recordScheduleRun(schedule.id, { status: "succeeded", externalSideEffects: true }, "scheduler");
  assert.equal(run.externalSideEffects, true);
});

test("legacy Telegram product review schedules normalize to standing approval", async () => {
  const { service, campaign } = await fixture("seeding-telegram-review-test-");
  const schedule = await service.createSchedule(campaign.id, {
    name: "Morning product review publish",
    localTime: "09:00",
    timezone: "Asia/Saigon",
    channels: ["threads", "linkedin"],
    mode: "publish_with_product_review",
    approvalReference: "D:\\build-agentic-AI\\automation-contracts\\marketing-seeding\\standing-publish-approval.json"
  }, "operator");
  assert.equal(schedule.approvalPolicy, "campaign_authorization");
  assert.equal(schedule.mode, "publish_with_standing_approval");
  assert.equal(schedule.requiresHumanPublishApproval, false);
});

test("three product tracks remain explicit on campaigns and staggered schedules", async () => {
  const { productRepo, service } = await fixture("seeding-three-track-test-");
  const campaign = await service.createCampaign({
    name: "SVG studio",
    objective: "Explain a technical motion workflow",
    productRepo,
    track: "svg-animation"
  }, "operator");
  assert.equal(campaign.track, "svg-animation");
  const schedule = await service.createSchedule(campaign.id, {
    name: "SVG morning",
    localTime: "11:00",
    timezone: "Asia/Saigon",
    channels: ["threads"],
    track: "svg-animation"
  }, "operator");
  assert.equal(schedule.track, "svg-animation");
  await assert.rejects(service.createSchedule(campaign.id, {
    name: "Wrong track",
    localTime: "12:00",
    channels: ["threads"],
    track: "unknown"
  }), /Unsupported product track/);
});

test("custom campaigns require and retain an existing product repository", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "seeding-campaign-test-"));
  const service = new SeedingService(new JsonStore(path.join(directory, "state.json")));
  await service.init();
  await assert.rejects(service.createCampaign({ name: "Course", objective: "Test" }), /productRepo is required/);
  await assert.rejects(service.createCampaign({
    name: "Course", objective: "Test", productRepo: path.join(directory, "missing")
  }), /does not exist/);
  const campaign = await service.createCampaign({ name: "Course", objective: "Test", productRepo: directory });
  assert.equal(campaign.productRepo, await realpath(directory));
});

test("published transition requires a specific URL and verification evidence", async () => {
  const { service, post, target } = await fixture("seeding-publish-test-");
  await service.approvePost(post.id, "operator");
  await service.transitionPost(post.id, { status: "queued" }, "operator");
  await service.transitionPost(post.id, { status: "publishing" }, "operator");
  await assert.rejects(service.transitionPost(post.id, { status: "published" }, "operator"), /verification evidence/);
  await assert.rejects(service.transitionPost(post.id, {
    status: "published", evidence: "Playback verified"
  }, "operator"), /valid publication URL/);
  await assert.rejects(service.transitionPost(post.id, {
    status: "published", evidence: "Playback verified", publicationUrl: target.url
  }, "operator"), /specific post URL/);
  await assert.rejects(service.transitionPost(post.id, {
    status: "published", evidence: "Playback verified", publicationUrl: "https://www.facebook.com/posts/123"
  }, "operator"), /allowlisted threads hostname/);
  const published = await service.transitionPost(post.id, {
    status: "published", evidence: "Playback verified at 00:04",
    publicationUrl: "https://www.threads.net/@fixture/post/C123"
  }, "operator");
  assert.equal(published.status, "published");
  assert.equal(published.evidence, "Playback verified at 00:04");
});

test("server-side target validation enforces channel hosts and specific Reddit communities", async () => {
  const { service } = await fixture("seeding-target-host-test-");
  await assert.rejects(service.createTarget({
    channel: "linkedin", name: "Fake", url: "https://example.com/feed", accountId: "linked"
  }), /allowlisted linkedin hostname/);
  await assert.rejects(service.createTarget({
    channel: "reddit", name: "Reddit home", url: "https://www.reddit.com/", accountId: "reddit"
  }), /specific subreddit/);
});

test("blocked channel readiness is structured, visible and cannot be activated", async () => {
  const { service, target, post } = await fixture("seeding-readiness-test-");
  const blocked = await service.updateTarget(target.id, {
    readiness: {
      state: "blocked",
      reasonCode: "account_trust",
      summary: "Tài khoản chưa đủ độ tin cậy để đăng trong cộng đồng",
      nextSteps: ["Tham gia thảo luận hữu ích", "Kiểm tra lại quyền đăng sau 7 ngày"],
      evidence: "Hai bài tự quảng bá giống nhau đã bị moderator gỡ",
      checkedAt: "2026-10-08T02:00:00.000Z"
    }
  }, "operator");
  assert.equal(blocked.status, "needs_review");
  assert.equal(blocked.readiness.reasonCode, "account_trust");
  await assert.rejects(service.updateTarget(target.id, { status: "active" }, "operator"), /readiness state is ready/);
  const dashboard = await service.dashboard();
  assert.deepEqual(dashboard.targets.find((item) => item.id === target.id).readiness.nextSteps, [
    "Tham gia thảo luận hữu ích", "Kiểm tra lại quyền đăng sau 7 ngày"
  ]);
  assert.equal(dashboard.posts.find((item) => item.id === post.id).status, "draft");
});

test("reply grounding is read and hashed inside productRepo and reply state cannot regress", async () => {
  const { directory, productRepo, groundingText, service, post } = await fixture("seeding-reply-test-");
  const outside = path.join(directory, "outside.md");
  await writeFile(outside, "outside", "utf8");
  const interaction = await service.addInteraction(post.id, { externalId: "comment:reply-test", authorLabel: "learner", text: "How?" }, "collector");
  await assert.rejects(service.draftReply(interaction.id, {
    text: "Answer", groundingSources: ["missing.md"], groundingSummary: "Missing"
  }), /does not exist/);
  await assert.rejects(service.draftReply(interaction.id, {
    text: "Answer", groundingSources: [outside], groundingSummary: "Outside"
  }), /inside productRepo/);
  const reply = await service.draftReply(interaction.id, {
    text: "The workflow validates rendered evidence before accepting the output.",
    groundingSources: ["README.md"], groundingSummary: "The repository documents validation."
  }, "ai-drafter");
  assert.equal(reply.productRepo, productRepo);
  assert.equal(reply.groundingSources[0].relativePath, "README.md");
  assert.equal(reply.groundingSources[0].sha256, createHash("sha256").update(groundingText).digest("hex"));
  await assert.rejects(service.markReplySent(reply.id, { evidence: "comment permalink" }, "operator"), /cannot be sent/);
  await service.approveReply(reply.id, "operator");
  await assert.rejects(service.approveReply(reply.id, "operator"), /cannot be approved/);
  await assert.rejects(service.markReplySent(reply.id, {}, "operator"), /evidence/);
  await service.markReplySent(reply.id, { evidence: "comment permalink" }, "operator");
  await assert.rejects(service.approveReply(reply.id, "operator"), /cannot be approved from sent/);
});

test("failed posts return through needs_review and require renewed approval", async () => {
  const { service, post } = await fixture("seeding-failure-test-");
  await service.approvePost(post.id, "operator");
  await service.transitionPost(post.id, { status: "queued" }, "operator");
  await service.transitionPost(post.id, { status: "failed", error: "unknown submission" }, "operator");
  await assert.rejects(service.transitionPost(post.id, { status: "queued" }, "operator"), /Invalid post transition/);
  const review = await service.transitionPost(post.id, { status: "needs_review" }, "operator");
  assert.equal(review.approvedAt, null);
  await assert.rejects(service.transitionPost(post.id, { status: "queued" }, "operator"), /Invalid post transition/);
});

test("metric snapshots accept only finite nonnegative safe integers", async () => {
  const { service, post } = await fixture("seeding-metrics-test-");
  for (const invalid of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(service.recordMetrics(post.id, { reactions: invalid }), /finite nonnegative integer/);
  }
  const metric = await service.recordMetrics(post.id, { impressions: 10, reactions: 2, comments: 1 });
  assert.equal(metric.impressions, 10);
  assert.equal(metric.reactions, 2);
  assert.equal(metric.comments, 1);
  assert.equal(metric.shares, null);
  assert.equal(metric.coverage.shares, "unknown");
  const spoofed = await service.recordMetrics(post.id, { reactions: 3, source: "official:threads" }, "operator");
  assert.equal(spoofed.source, "manual");
  assert.equal(spoofed.provenance.kind, "verified_manual");
});

test("metric coverage rejects unknown status values and preserves explicit supported states", async () => {
  const { service, post } = await fixture("seeding-metrics-coverage-contract-test-");
  await assert.rejects(
    service.recordMetrics(post.id, { impressions: 1, coverage: { impressions: "guessed" } }),
    /coverage must be measured, unknown, or unsupported/
  );
  await assert.rejects(
    service.recordMetrics(post.id, { clicks: 1, coverage: { clicks: "unsupported" } }),
    /unsupported coverage cannot include a value/
  );
  await assert.rejects(
    service.recordMetrics(post.id, { clicks: 1, coverage: { clicks: "unknown" } }),
    /unknown coverage cannot include a value/
  );
  await assert.rejects(
    service.recordMetrics(post.id, { coverage: { leads: "measured" } }),
    /measured coverage requires a value/
  );
  const unsupported = await service.recordMetrics(post.id, { coverage: { clicks: "unsupported" } });
  assert.equal(unsupported.clicks, null);
  assert.equal(unsupported.coverage.clicks, "unsupported");
  const measured = await service.recordMetrics(post.id, { impressions: 2, coverage: { impressions: "MEASURED" } });
  assert.equal(measured.impressions, 2);
  assert.equal(measured.coverage.impressions, "measured");
});

test("browser observations require permalink evidence and preserve unknown metrics", async () => {
  const { directory, service, post } = await fixture("seeding-browser-observation-test-");
  await service.approvePost(post.id, "operator");
  await service.transitionPost(post.id, { status: "queued" }, "operator");
  await service.transitionPost(post.id, { status: "publishing" }, "operator");
  await service.transitionPost(post.id, {
    status: "published", publicationUrl: "https://www.threads.net/@fixture/post/abc123",
    evidence: "Exact post rendered in the logged-in browser"
  }, "operator");
  const screenshotDirectory = path.join(directory, "evidence");
  const screenshotPath = path.join(screenshotDirectory, "threads-abc123.png");
  const screenshotContent = Buffer.from("fixture screenshot evidence");
  await mkdir(screenshotDirectory);
  await writeFile(screenshotPath, screenshotContent);
  const screenshotSha256 = createHash("sha256").update(screenshotContent).digest("hex");
  const base = {
    observedUrl: "https://www.threads.net/@fixture/post/abc123",
    evidence: "Visible post header and counters captured",
    screenshotPath, screenshotSha256, observedAt: new Date().toISOString()
  };
  await assert.rejects(service.recordBrowserObservation(post.id, { ...base, observedUrl: "https://www.threads.net/@fixture/post/other", reactions: 2 }), /match the stored publication permalink/);
  await assert.rejects(service.recordBrowserObservation(post.id, { ...base, observedUrl: "https://www.threads.net/@fixture/post/ABC123", reactions: 2 }), /match the stored publication permalink/);
  await assert.rejects(service.recordBrowserObservation(post.id, { ...base, screenshotSha256: "a".repeat(64), reactions: 2 }), /does not match/);
  await assert.rejects(service.recordBrowserObservation(post.id, { ...base, screenshotPath: path.join(directory, "state.json"), reactions: 2 }), /runtime evidence directory/);
  await assert.rejects(service.recordBrowserObservation(post.id, { ...base, reactions: -1 }), /finite nonnegative integer/);
  const verified = await service.recordBrowserObservation(post.id, { ...base, reactions: 2, comments: 1 }, "browser-collector");
  assert.equal(verified.metricSnapshot.source, "browser:threads");
  assert.equal(verified.metricSnapshot.provenance.kind, "browser_verified");
  assert.equal(verified.metricSnapshot.provenance.screenshotPath, await realpath(screenshotPath));
  assert.equal(verified.metricSnapshot.impressions, null);
  assert.equal(verified.metricSnapshot.coverage.impressions, "unknown");
  assert.equal(verified.metricsChanged, true);
  const unchanged = await service.recordBrowserObservation(post.id, { ...base, reactions: 2, comments: 1 }, "browser-collector");
  assert.equal(unchanged.metricSnapshot, null);
  assert.equal(unchanged.metricsChanged, false);
  let state = await service.snapshot();
  assert.equal(state.metricSnapshots.length, 1);
  assert.equal(state.collectorRuns.length, 2);
  const changedCoverage = await service.recordBrowserObservation(post.id, {
    ...base, reactions: 2, comments: 1, coverage: { impressions: "unsupported" }
  }, "browser-collector");
  assert.equal(changedCoverage.metricsChanged, true);
  assert.equal(changedCoverage.metricSnapshot.coverage.impressions, "unsupported");
  const changedValue = await service.recordBrowserObservation(post.id, { ...base, reactions: 3, comments: 1 }, "browser-collector");
  assert.equal(changedValue.metricsChanged, true);
  state = await service.snapshot();
  assert.equal(state.metricSnapshots.length, 3);
  assert.equal(state.collectorRuns.length, 4);
  const unknown = await service.recordBrowserObservation(post.id, { ...base, status: "unknown", reason: "Login wall or ambiguous layout" }, "browser-collector");
  assert.equal(unknown.metricSnapshot, null);
  assert.equal(unknown.collectorRun.status, "unknown");
  const dashboard = await service.dashboard();
  assert.equal(dashboard.browserCoverage.totalPublished, 1);
  assert.equal(dashboard.browserCoverage.observed, 1);
  assert.equal(dashboard.browserCoverage.unknown, 1);
  assert.equal(dashboard.browserCoverage.missing, 0);
  assert.equal(dashboard.browserCoverage.complete, true);
  assert.equal(dashboard.browserCoverage.windowMinutes, 1440);
});

test("interactions preserve no-ID observations and deduplicate stable IDs per post", async () => {
  const { service, post } = await fixture("seeding-interaction-idempotence-test-");
  const noIdFirst = await service.addInteraction(post.id, { text: "No identity" }, "browser-collector");
  const noIdSecond = await service.addInteraction(post.id, { text: "Another observation" }, "browser-collector");
  assert.equal(noIdFirst.externalId, null);
  assert.notEqual(noIdSecond.id, noIdFirst.id);
  const first = await service.addInteraction(post.id, {
    kind: "comment", externalId: "comment:stable-1", authorLabel: "learner", text: "How?"
  }, "browser-collector");
  const duplicate = await service.addInteraction(post.id, {
    kind: "comment", externalId: "comment:stable-1", authorLabel: "learner", text: "How?"
  }, "browser-collector");
  assert.equal(duplicate.id, first.id);
  const state = await service.snapshot();
  assert.equal(state.interactions.length, 3);
});

test("browser monitoring scope requires published status and a publication URL", async () => {
  const { service, post } = await fixture("seeding-browser-owner-rule-test-");
  await service.store.mutate("test", "fixture_published_without_url", (state) => {
    const stored = state.posts.find((item) => item.id === post.id);
    stored.status = "published";
  });
  let dashboard = await service.dashboard();
  assert.equal(dashboard.browserCoverage.totalPublished, 0);
  await service.store.mutate("test", "fixture_publication_url", (state) => {
    const stored = state.posts.find((item) => item.id === post.id);
    stored.publicationUrl = "https://www.threads.net/@fixture/post/owner-rule";
  });
  dashboard = await service.dashboard();
  assert.equal(dashboard.browserCoverage.totalPublished, 1);
  assert.deepEqual(dashboard.browserCoverage.missingPostIds, [post.id]);
});

test("dashboard exposes recent metrics, interactions, replies, and audit history", async () => {
  const { service, post } = await fixture("seeding-dashboard-test-");
  await service.recordMetrics(post.id, { impressions: 10, reactions: 2 }, "collector");
  const interaction = await service.addInteraction(post.id, { externalId: "comment:dashboard-test", text: "Question" }, "collector");
  await service.draftReply(interaction.id, {
    text: "Answer", groundingSources: ["README.md"], groundingSummary: "Grounded summary"
  }, "ai-drafter");
  const dashboard = await service.dashboard();
  assert.equal(dashboard.latestMetricSnapshots.length, 1);
  assert.equal(dashboard.recentInteractions.length, 1);
  assert.equal(dashboard.recentReplies.length, 1);
  assert.ok(dashboard.recentAudit.length >= 6);
});

test("traffic pulse prioritizes open interactions and reports metric deltas", () => {
  const post = { id: "p1", publishedAt: "2026-10-06T00:00:00.000Z", status: "published" };
  const snapshots = [
    { postId: "p1", capturedAt: "2026-10-06T01:00:00.000Z", impressions: 100, reactions: 4, comments: 1, shares: 0, clicks: 2, leads: 0 },
    { postId: "p1", capturedAt: "2026-10-07T00:00:00.000Z", impressions: 220, reactions: 9, comments: 3, shares: 1, clicks: 8, leads: 1 }
  ];
  const pulse = buildTrafficPulse(post, snapshots, [{ postId: "p1", status: "open" }], new Date("2026-10-07T00:30:00.000Z"));
  assert.equal(pulse.latest.impressions, 220);
  assert.equal(pulse.delta.clicks, 6);
  assert.equal(pulse.delta.leads, 1);
  assert.equal(pulse.priority, "engage");
  assert.match(pulse.recommendation, /1 tương tác đang mở/);
});

test("traffic pulse handles a newly published post without metric snapshots", () => {
  const pulse = buildTrafficPulse(
    { id: "p2", publishedAt: "2026-10-06T00:00:00.000Z", status: "published" },
    [],
    [],
    new Date("2026-10-06T00:30:00.000Z")
  );
  assert.equal(pulse.latest, null);
  assert.equal(pulse.delta.impressions, null);
  assert.equal(pulse.priority, "watch");
  assert.match(pulse.recommendation, /snapshot traffic 1 giờ/);
});

test("traffic pulse uses snapshot id as deterministic tie-breaker", () => {
  const post = { id: "p-tie", publishedAt: "2026-10-06T00:00:00.000Z", status: "published" };
  const first = { id: "metric-a", postId: post.id, capturedAt: "2026-10-07T00:00:00.000Z", impressions: 100, clicks: 2 };
  const second = { id: "metric-b", postId: post.id, capturedAt: "2026-10-07T00:00:00.000Z", impressions: 220, clicks: 8 };
  const pulseA = buildTrafficPulse(post, [first, second], [], new Date("2026-10-07T00:30:00.000Z"));
  const pulseB = buildTrafficPulse(post, [second, first], [], new Date("2026-10-07T00:30:00.000Z"));
  assert.equal(pulseA.latest.id, "metric-b");
  assert.equal(pulseA.previous.id, "metric-a");
  assert.deepEqual(pulseB, pulseA);
});

test("dashboard uses the same deterministic metric tie-break and bounded coverage", async () => {
  const { service, post } = await fixture("seeding-dashboard-metric-tie-test-");
  const snapshots = [
    { id: "metric-a", postId: post.id, capturedAt: "2026-10-07T00:00:00.000Z", impressions: 100, coverage: { impressions: "measured", clicks: "rogue" } },
    { id: "metric-b", postId: post.id, capturedAt: "2026-10-07T00:00:00.000Z", impressions: 220, coverage: { impressions: "measured", clicks: "rogue" } }
  ];
  await service.store.mutate("test", "metric_tie_fixture", (state) => { state.metricSnapshots = snapshots; });
  const dashboardA = await service.dashboard();
  await service.store.mutate("test", "metric_tie_fixture_reversed", (state) => { state.metricSnapshots = snapshots.slice().reverse(); });
  const dashboardB = await service.dashboard();
  assert.equal(dashboardA.latestMetrics[post.id].id, "metric-b");
  assert.equal(dashboardB.latestMetrics[post.id].id, "metric-b");
  assert.deepEqual(dashboardA.metricCoverage, dashboardB.metricCoverage);
  assert.equal(Object.prototype.hasOwnProperty.call(dashboardA.metricCoverage.clicks, "rogue"), false);
});

test("dashboard does not total numeric values marked non-measured", async () => {
  const { service, post } = await fixture("seeding-dashboard-metric-coverage-total-test-");
  await service.store.mutate("test", "metric_coverage_fixture", (state) => {
    state.metricSnapshots = [{
      id: "metric-legacy-rogue", postId: post.id, capturedAt: "2026-10-07T00:00:00.000Z",
      impressions: 999, coverage: { impressions: "rogue" }
    }];
  });
  const dashboard = await service.dashboard();
  assert.equal(dashboard.metricCoverage.impressions.unknown, 1);
  assert.equal(dashboard.totals.impressions, 0);
});

test("campaign keywords are normalized, persisted and expose latest performance", async () => {
  assert.deepEqual(normalizeKeywords([" Blender automation ", "blender automation", { phrase: "AI 3D workflow", intent: "solution", locale: "en" }]), [
    { phrase: "Blender automation", intent: "discovery", locale: "global", status: "active" },
    { phrase: "AI 3D workflow", intent: "solution", locale: "en", status: "active" }
  ]);
  const { service, campaign } = await fixture("seeding-keyword-test-");
  const updated = await service.updateCampaign(campaign.id, {
    landingUrl: "https://example.com/blender-workflow",
    keywords: ["Blender automation", { phrase: "AI 3D workflow", intent: "solution", locale: "en" }]
  }, "operator");
  assert.equal(updated.keywords.length, 2);
  const metric = await service.recordKeywordMetrics(campaign.id, {
    keyword: "Blender automation", impressions: 120, clicks: 12, leads: 2, rank: 8
  }, "collector");
  assert.equal(metric.rank, 8);
  await assert.rejects(service.recordKeywordMetrics(campaign.id, { keyword: "not configured" }), /not configured/);
  const dashboard = await service.dashboard();
  const keyword = dashboard.keywordPerformance.find((item) => item.phrase === "Blender automation");
  assert.equal(keyword.latest.clicks, 12);
  assert.equal(keyword.latest.leads, 2);
});
