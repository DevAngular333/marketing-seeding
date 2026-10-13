import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { JsonStore } from "../src/store.mjs";
import { SeedingService, buildTrafficPulse, normalizeKeywords } from "../src/service.mjs";

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

test("R19 bootstrap is idempotent and does not fabricate publication evidence", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "seeding-test-"));
  const file = path.join(directory, "state.json");
  const service = new SeedingService(new JsonStore(file));
  await service.init();
  await service.bootstrapR19("test");
  await service.bootstrapR19("test");
  const state = JSON.parse(await readFile(file, "utf8"));
  assert.equal(state.campaigns.length, 1);
  assert.equal(state.targets.length, 7);
  assert.equal(state.posts.length, 7);
  assert.deepEqual(new Set(state.targets.map((target) => target.channel)), new Set([
    "facebook_group", "threads", "reddit", "product_hunt", "indie_hackers", "linkedin", "email"
  ]));
  assert.equal(state.posts.every((post) => post.status === "needs_review"), true);
  assert.equal(state.posts.every((post) => !post.publicationUrl && !post.evidence), true);
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
  assert.equal(verified.metricSnapshot.provenance.screenshotPath, screenshotPath);
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
