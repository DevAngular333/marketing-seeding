import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { JsonStore } from "../src/store.mjs";
import { SeedingService } from "../src/service.mjs";
import { deriveStrategyDecision } from "../src/strategy.mjs";
import { approvalFingerprint } from "../src/guards.mjs";

async function fixture(prefix = "strategy-") {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  const productRepo = path.join(root, "repo");
  await mkdir(productRepo);
  await writeFile(path.join(productRepo, "README.md"), "bounded evidence", "utf8");
  const store = new JsonStore(path.join(root, "state.json"));
  const service = new SeedingService(store);
  await service.init();
  const campaign = await service.createCampaign({ name: "Strategy", objective: "Test", productRepo });
  const target = await service.createTarget({ channel: "threads", name: "Audience", url: "https://www.threads.net/@fixture", accountId: "account", status: "active" });
  const post = await service.createPost({ campaignId: campaign.id, targetId: target.id, content: "A grounded post" });
  await store.mutate("fixture", "fixture_ready", (state) => {
    const current = state.campaigns.find((item) => item.id === campaign.id);
    current.productIntelligence = {
      handoff: { readinessStatus: "READY" },
      document: Object.fromEntries(["WHAT_IS_IT", "WHAT_PROBLEM_DOES_IT_SOLVE", "WHY_IS_IT_BETTER", "WHO_NEEDS_IT"].map((field) => [field, { text: field, evidenceRefs: ["e1"] }]))
    };
    const saved = state.posts.find((item) => item.id === post.id);
    const savedTarget = state.targets.find((item) => item.id === target.id);
    saved.approvedAt = new Date().toISOString();
    saved.approvalBinding = approvalFingerprint(saved, savedTarget);
  });
  return { root, store, service, campaign, target, post };
}

test("strategy deterministically selects a publish candidate only through dry-run eligibility", async () => {
  const { service, campaign } = await fixture("strategy-publish-");
  const now = new Date("2026-10-17T12:00:00.000Z");
  const first = await service.deriveStrategy(campaign.id, { now: now.toISOString() });
  const second = deriveStrategyDecision(await service.snapshot(), campaign.id, { now });
  assert.equal(first.action, "publish");
  assert.equal(first.eligible, true);
  assert.equal(first.authoritySideEffects, false);
  assert.equal(first.candidateId !== null, true);
  assert.deepEqual(first.reasons, ["product_intelligence_ready", "target_policy_and_queue_checks_pass"]);
  assert.equal(first.decisionId, second.decisionId);
  const state = await service.snapshot();
  assert.equal(state.liveExecutionGrants.length, 0);
  assert.equal(state.executionRequests.length, 0);
  assert.equal(state.posts.filter((post) => post.status === "published").length, 0);
});

test("strategy fails closed for incomplete intelligence and UNKNOWN quarantine", async () => {
  const { service, campaign, store, post } = await fixture("strategy-blocked-");
  await store.mutate("fixture", "incomplete", (state) => {
    state.campaigns.find((item) => item.id === campaign.id).productIntelligence.handoff.readinessStatus = "INCOMPLETE";
  });
  assert.equal((await service.deriveStrategy(campaign.id, { now: "2026-10-17T12:00:00Z" })).action, "do_nothing");
  await store.mutate("fixture", "unknown", (state) => {
    state.campaigns.find((item) => item.id === campaign.id).productIntelligence.handoff.readinessStatus = "READY";
    state.submissionUncertainties.push({ status: "UNKNOWN", campaignId: campaign.id, jobId: post.id });
  });
  const decision = await service.deriveStrategy(campaign.id, { now: "2026-10-17T12:00:00Z" });
  assert.equal(decision.action, "do_nothing");
  assert.equal(decision.reasons.includes("submission_unknown_quarantined"), true);
});

test("strategy quarantines a realistic UNKNOWN linked only by idempotency key", async () => {
  const { service, campaign, store, post } = await fixture("strategy-unknown-identity-");
  await store.mutate("fixture", "unknown_identity_only", (state) => {
    state.submissionUncertainties.push({
      id: "uncertain-identity-only",
      status: "UNKNOWN",
      jobId: "historical-job-id",
      executionId: "historical-execution-id",
      idempotencyKeys: [post.idempotencyKey]
    });
  });
  const decision = await service.deriveStrategy(campaign.id, { now: "2026-10-17T12:00:00Z" });
  assert.equal(decision.action, "do_nothing");
  assert.equal(decision.eligible, false);
  assert.deepEqual(decision.reasons, ["submission_unknown_quarantined"]);
});

test("strategy selects engage or research only from eligible relevant discovery", async () => {
  const { service, campaign, store } = await fixture("strategy-discovery-");
  await store.mutate("fixture", "discovery", (state) => {
    const current = state.campaigns.find((item) => item.id === campaign.id);
    current.discovery = { observations: [{ discoveryId: "d1", status: "ELIGIBLE", classification: { label: "RELEVANT" }, score: { score: 80 }, title: "Need", text: "workflow" }] };
    state.posts = state.posts.map((post) => ({ ...post, status: "published" }));
  });
  const research = await service.deriveStrategy(campaign.id, { now: "2026-10-17T12:00:00Z" });
  assert.equal(research.action, "research");
  assert.equal(research.eligible, true);
  assert.deepEqual(research.evidence, ["discovery:d1"]);
  assert.equal(research.engagementContext.total, 0);
  assert.equal(research.engagementContext.candidateTotal, 0);
  assert.equal(research.authoritySideEffects, false);
  assert.equal(research.engagementContext.authoritySideEffects, false);
  assert.equal(research.engagementContext.externalSideEffects, false);
  await store.mutate("fixture", "reply", (state) => {
    state.interactions.push({ id: "i1", postId: state.posts[0].id, status: "open" });
    state.replies.push({ id: "r1", interactionId: "i1", status: "draft", groundingSources: ["README.md"], groundingSummary: "grounded" });
  });
  const engage = await service.deriveStrategy(campaign.id, { now: "2026-10-17T12:00:00Z" });
  assert.equal(engage.action, "engage");
  assert.equal(engage.candidateId, "r1");
  assert.equal(engage.engagementContext.total, 1);
  assert.equal(engage.engagementContext.candidateTotal, 0);
  assert.equal(engage.reasons.includes("engagement_context_observed"), true);
  assert.equal(engage.evidence.includes(`engagement-context:${campaign.id}`), true);
  assert.equal(engage.authoritySideEffects, false);
  assert.equal(engage.engagementContext.externalSideEffects, false);
});

test("strategy never projects engagement context when UNKNOWN quarantine dominates", async () => {
  const { service, campaign, store, post } = await fixture("strategy-engagement-unknown-");
  await store.mutate("fixture", "engagement_unknown", (state) => {
    state.posts = state.posts.map((item) => ({ ...item, status: "published" }));
    state.interactions.push({ id: "i-unknown", postId: post.id, externalId: "comment:unknown", text: "uncertain", capturedAt: "2026-10-01T00:00:00.000Z" });
    state.submissionUncertainties.push({ id: "u-engagement", status: "UNKNOWN", campaignId: campaign.id, jobId: post.id });
  });
  const decision = await service.deriveStrategy(campaign.id, { now: "2026-10-17T12:00:00Z" });
  assert.equal(decision.action, "do_nothing");
  assert.deepEqual(decision.reasons, ["submission_unknown_quarantined"]);
  assert.equal("engagementContext" in decision, false);
  assert.equal(decision.authoritySideEffects, false);
});

test("strategy keeps scheduler discoveries actionable when no fit hints are supplied", async () => {
  const { service, campaign, store } = await fixture("strategy-discovery-no-fit-");
  await store.mutate("fixture", "published", (state) => {
    state.posts = state.posts.map((post) => ({ ...post, status: "published" }));
  });
  const recorded = await service.recordDiscoveries(campaign.id, {
    observations: [{ url: "https://example.com/thread", title: "Need automation", text: "workflow pain", source: "fixture" }],
    policies: { "example.com": { channel: "example", actions: ["observe"] } },
    keywords: ["automation"]
  });
  assert.equal(recorded.observations.length, 1);
  assert.equal("fit" in recorded.observations[0], false);
  const saved = (await service.snapshot()).campaigns.find((item) => item.id === campaign.id);
  assert.equal("fit" in saved.discovery.observations[0], false);
  const decision = await service.deriveStrategy(campaign.id, { now: "2026-10-17T12:00:00Z" });
  assert.equal(decision.action, "research");
  assert.equal(decision.candidateId, recorded.observations[0].discoveryId);
});

test("strategy excludes discovery with explicit mismatched or unknown fit", async () => {
  const { service, campaign, store } = await fixture("strategy-fit-gate-");
  await store.mutate("fixture", "discovery_fit", (state) => {
    const current = state.campaigns.find((item) => item.id === campaign.id);
    current.discovery = {
      observations: [
        { discoveryId: "mismatch", status: "ELIGIBLE", classification: { label: "RELEVANT" }, score: { score: 100 }, fit: { eligible: false, audience: { status: "MISMATCHED" }, channel: { status: "MATCHED" }, locale: { status: "MATCHED" } } },
        { discoveryId: "unknown", status: "ELIGIBLE", classification: { label: "RELEVANT" }, score: { score: 90 }, fit: { eligible: false, audience: { status: "UNKNOWN" }, channel: { status: "UNKNOWN" }, locale: { status: "UNKNOWN" } } }
      ]
    };
    state.posts = state.posts.map((post) => ({ ...post, status: "published" }));
  });
  const decision = await service.deriveStrategy(campaign.id, { now: "2026-10-17T12:00:00Z" });
  assert.equal(decision.action, "do_nothing");
  assert.equal(decision.eligible, false);
  assert.deepEqual(decision.reasons, ["no_safe_action_candidate"]);
  assert.deepEqual((await service.snapshot()).executionRequests, []);
});

test("strategy accepts explicitly matched discovery fit", async () => {
  const { service, campaign, store } = await fixture("strategy-fit-match-");
  await store.mutate("fixture", "discovery_fit", (state) => {
    const current = state.campaigns.find((item) => item.id === campaign.id);
    current.discovery = {
      observations: [{ discoveryId: "matched", status: "ELIGIBLE", classification: { label: "RELEVANT" }, score: { score: 100 }, fit: { eligible: true, audience: { status: "MATCHED" }, channel: { status: "MATCHED" }, locale: { status: "MATCHED" } } }]
    };
    state.posts = state.posts.map((post) => ({ ...post, status: "published" }));
  });
  const decision = await service.deriveStrategy(campaign.id, { now: "2026-10-17T12:00:00Z" });
  assert.equal(decision.action, "research");
  assert.equal(decision.candidateId, "matched");
  assert.deepEqual(decision.evidence, ["discovery:matched"]);
});

test("strategy history is bounded, restart-safe and projected read-only", async () => {
  const { service, campaign, store, root } = await fixture("strategy-history-");
  for (let index = 0; index < 30; index += 1) await service.deriveStrategy(campaign.id, { now: new Date(Date.UTC(2026, 9, 17, 12, index * 16)).toISOString() });
  const saved = await service.snapshot();
  assert.equal(saved.campaigns.find((item) => item.id === campaign.id).strategyDecisions.length, 24);
  const restarted = new SeedingService(new JsonStore(path.join(root, "state.json")));
  await restarted.init();
  const dashboard = await restarted.dashboard();
  assert.equal(dashboard.strategy[0].recent.length, 24);
});

test("strategy preserves publish precedence while exposing current learning context", async () => {
  const { service, campaign, store, post, target } = await fixture("strategy-learning-context-");
  await store.mutate("fixture", "outcome", (state) => {
    const current = state.campaigns.find((item) => item.id === campaign.id);
    state.targets.find((item) => item.id === target.id).profileId = "profile";
    current.outcomeSummary = {
      summaryId: "outcome-111111111111111111111111",
      publication: { unknown: 0 },
      metrics: { snapshots: 1, totals: { clicks: 2 }, coverage: { clicks: { measured: 1 } } },
      evidence: { metricSnapshotIds: ["metric-1"] },
      postAttributions: [{ postId: post.id, status: "VERIFIED", target: { targetId: target.id, channel: "threads", accountId: "account", profileId: "profile" }, evidence: { receiptIds: ["receipt-1"] } }]
    };
  });
  const learning = await service.deriveLearningFeedback(campaign.id, { now: "2026-10-17T12:00:00.000Z" });
  assert.equal(learning.action, "engage");
  const decision = await service.deriveStrategy(campaign.id, { now: "2026-10-17T12:00:00.000Z" });
  assert.equal(decision.action, "publish");
  assert.equal(decision.learningContext.feedbackId, learning.feedbackId);
  assert.equal(decision.learningContext.outcomeSummaryId, "outcome-111111111111111111111111");
  assert.equal(decision.learningContext.postAttributionContext.counts.VERIFIED, 1);
  assert.equal(decision.learningContext.postAttributionContext.postAttributions[0].postId, post.id);
  assert.equal(decision.reasons.includes("current_learning_feedback_observed"), true);
  assert.equal(decision.evidence.includes(`learning:${learning.feedbackId}`), true);
  const state = await service.snapshot();
  assert.equal(state.executionRequests.length, 0);
  assert.equal(state.liveExecutionGrants.length, 0);
});

test("strategy ignores stale or malformed learning feedback without changing fallback", async () => {
  const { service, campaign, store } = await fixture("strategy-learning-stale-");
  await store.mutate("fixture", "stale_learning", (state) => {
    const current = state.campaigns.find((item) => item.id === campaign.id);
    current.outcomeSummary = { summaryId: "outcome-222222222222222222222222", publication: { unknown: 0 }, metrics: { snapshots: 0 }, evidence: {} };
    current.latestLearningFeedback = { feedbackId: "learning-333333333333333333333333", campaignId: campaign.id, action: "publish", reasons: ["metrics_not_collected"], outcomeSummaryId: "outcome-111111111111111111111111", advisory: true, authoritySideEffects: false };
    current.strategyDecisions = [];
  });
  const stale = await service.deriveStrategy(campaign.id, { now: "2026-10-17T12:00:00.000Z" });
  assert.equal(stale.action, "publish");
  assert.equal("learningContext" in stale, false);
  assert.equal(stale.reasons.includes("current_learning_feedback_observed"), false);
  await store.mutate("fixture", "malformed_learning", (state) => {
    const current = state.campaigns.find((item) => item.id === campaign.id);
    current.latestLearningFeedback = { feedbackId: "bad", campaignId: campaign.id, action: "engage", reasons: ["measured_response_present"], outcomeSummaryId: current.outcomeSummary.summaryId, advisory: true, authoritySideEffects: false };
  });
  const malformed = await service.deriveStrategy(campaign.id, { now: "2026-10-17T12:15:00.000Z" });
  assert.equal(malformed.action, "publish");
  assert.equal("learningContext" in malformed, false);
});

test("strategy rejects self-consistent attribution for a foreign post or target", async () => {
  const { service, campaign, store, target } = await fixture("strategy-learning-foreign-attribution-");
  await store.mutate("fixture", "foreign_attribution", (state) => {
    const current = state.campaigns.find((item) => item.id === campaign.id);
    state.campaigns.push({ id: "other-campaign" });
    state.posts.push({ id: "foreign-post", campaignId: "other-campaign", targetId: target.id, content: "Other campaign" });
    current.outcomeSummary = {
      summaryId: "outcome-666666666666666666666666",
      publication: { unknown: 0 }, metrics: { snapshots: 0 }, evidence: {},
      postAttributions: [{ postId: "foreign-post", status: "VERIFIED", target: { targetId: target.id, channel: "threads", accountId: "account", profileId: "profile" } }]
    };
  });
  const learning = await service.deriveLearningFeedback(campaign.id, { now: "2026-10-17T12:00:00.000Z" });
  assert.equal("postAttributionContext" in learning, true);
  const decision = await service.deriveStrategy(campaign.id, { now: "2026-10-17T12:00:00.000Z" });
  assert.equal("learningContext" in decision, false);
  assert.equal(decision.action, "publish");
});

test("strategy rejects attribution when the bound target identity drifts", async () => {
  const { service, campaign, store, post, target } = await fixture("strategy-learning-target-drift-");
  await store.mutate("fixture", "target_drift", (state) => {
    const current = state.campaigns.find((item) => item.id === campaign.id);
    current.outcomeSummary = {
      summaryId: "outcome-777777777777777777777777",
      publication: { unknown: 0 }, metrics: { snapshots: 0 }, evidence: {},
      postAttributions: [{ postId: post.id, status: "VERIFIED", target: { targetId: target.id, channel: "threads", accountId: "other-account", profileId: "profile" } }]
    };
  });
  const learning = await service.deriveLearningFeedback(campaign.id, { now: "2026-10-17T12:00:00.000Z" });
  const decision = await service.deriveStrategy(campaign.id, { now: "2026-10-17T12:00:00.000Z" });
  assert.equal("postAttributionContext" in learning, true);
  assert.equal("learningContext" in decision, false);
  assert.equal(decision.action, "publish");
});

test("authoritative UNKNOWN dominates a learning publish recommendation", async () => {
  const { service, campaign, post, store } = await fixture("strategy-learning-unknown-");
  await store.mutate("fixture", "unknown_learning", (state) => {
    const current = state.campaigns.find((item) => item.id === campaign.id);
    current.outcomeSummary = { summaryId: "outcome-444444444444444444444444", publication: { unknown: 0 }, metrics: { snapshots: 1, totals: { clicks: 1 }, coverage: { clicks: { measured: 1 } } }, evidence: {} };
    current.latestLearningFeedback = { feedbackId: "learning-555555555555555555555555", campaignId: campaign.id, action: "publish", reasons: ["measured_outcome_without_response"], outcomeSummaryId: current.outcomeSummary.summaryId, advisory: true, authoritySideEffects: false };
    state.submissionUncertainties.push({ id: "unknown-learning-1", status: "UNKNOWN", campaignId: campaign.id, jobId: post.id, executionId: "unknown-learning-exec" });
  });
  const decision = await service.deriveStrategy(campaign.id, { now: "2026-10-17T12:00:00.000Z" });
  assert.equal(decision.action, "do_nothing");
  assert.deepEqual(decision.reasons, ["submission_unknown_quarantined"]);
  assert.equal("learningContext" in decision, false);
});

