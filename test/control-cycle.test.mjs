import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { JsonStore } from "../src/store.mjs";
import { SeedingService } from "../src/service.mjs";

async function fixture(prefix = "control-cycle-") {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  const productRepo = path.join(root, "repo");
  await mkdir(productRepo);
  const service = new SeedingService(new JsonStore(path.join(root, "state.json")));
  await service.init();
  const campaign = await service.createCampaign({ name: "Cycle", objective: "Observe", productRepo }, "operator");
  const target = await service.createTarget({ channel: "threads", name: "Fixture", url: "https://threads.net/fixture", accountId: "fixture", status: "active" }, "operator");
  const post = await service.createPost({ campaignId: campaign.id, targetId: target.id, content: "Fixture post" }, "operator");
  return { service, campaign, post };
}

test("control cycle is deterministic and idempotent for the same observation bucket", async () => {
  const { service, campaign } = await fixture();
  const now = "2026-10-17T12:00:00.000Z";
  const first = await service.runCampaignControlCycle(campaign.id, { now }, "automation");
  const second = await service.runCampaignControlCycle(campaign.id, { now }, "automation");
  assert.equal(first.advisory, true);
  assert.equal(first.authoritySideEffects, false);
  assert.equal(first.externalSideEffects, false);
  assert.equal(first.outcome.summaryId, second.outcome.summaryId);
  assert.equal(first.learning.feedbackId, second.learning.feedbackId);
  assert.equal(first.strategy.decisionId, second.strategy.decisionId);
  const state = await service.snapshot();
  const saved = state.campaigns.find((item) => item.id === campaign.id);
  assert.equal(saved.outcomeSummaries.length, 1);
  assert.equal(saved.learningFeedback.length, 1);
  assert.equal(saved.strategyDecisions.length, 1);
  assert.equal(state.liveExecutionGrants.length, 0);
  assert.equal(state.oneTimeExecutionWindows.length, 0);
  assert.equal(state.executionLeases.length, 0);
  assert.equal(state.executionRequests.length, 0);
});

test("UNKNOWN publication dominates cycle learning and never changes authority", async () => {
  const { service, campaign, post } = await fixture("control-cycle-unknown-");
  await service.store.mutate("fixture", "unknown", (state) => {
    state.submissionUncertainties.push({ id: "unknown-1", status: "UNKNOWN", campaignId: campaign.id, jobId: post.id, executionId: "exec-1" });
  });
  const before = await service.snapshot();
  const result = await service.runCampaignControlCycle(campaign.id, { now: "2026-10-17T12:00:00.000Z" });
  assert.equal(result.learning.action, "do_nothing");
  assert.equal(result.learning.reasons.includes("submission_unknown_quarantined"), true);
  const after = await service.snapshot();
  assert.deepEqual(after.liveExecutionGrants, before.liveExecutionGrants);
  assert.deepEqual(after.oneTimeExecutionWindows, before.oneTimeExecutionWindows);
  assert.deepEqual(after.executionLeases, before.executionLeases);
  assert.deepEqual(after.executionRequests, before.executionRequests);
  assert.equal(after.submissionUncertainties[0].status, "UNKNOWN");
});
