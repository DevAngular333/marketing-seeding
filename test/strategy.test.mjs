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
  await store.mutate("fixture", "reply", (state) => {
    state.interactions.push({ id: "i1", postId: state.posts[0].id, status: "open" });
    state.replies.push({ id: "r1", interactionId: "i1", status: "draft", groundingSources: ["README.md"], groundingSummary: "grounded" });
  });
  const engage = await service.deriveStrategy(campaign.id, { now: "2026-10-17T12:00:00Z" });
  assert.equal(engage.action, "engage");
  assert.equal(engage.candidateId, "r1");
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

