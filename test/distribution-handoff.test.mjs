import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { JsonStore } from "../src/store.mjs";
import { SeedingService } from "../src/service.mjs";
import { validateDistributionHandoff } from "../src/distribution-handoff.mjs";

async function fixture() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "handoff-")); const repo = path.join(dir, "repo"); await mkdir(repo); await writeFile(path.join(repo, "README.md"), "evidence");
  const stateFile = path.join(dir, "state.json");
  const service = new SeedingService(new JsonStore(stateFile)); await service.init();
  const campaign = await service.createCampaign({ name: "C", objective: "O", productRepo: repo });
  const target = await service.createTarget({ channel: "threads", name: "T", url: "https://threads.net/x", accountId: "a", status: "active" });
  const content = "Grounded content"; const candidate = { contentId: "content-1", contentIdentity: "identity-1", targetId: target.id, content };
  await service.store.mutate("fixture", "candidate_seeded", state => { const row = state.campaigns.find(c => c.id === campaign.id); row.contentCandidates = [candidate]; return row; });
  return { service, stateFile, campaign, target, candidate, content };
}
function input(f, extra = {}) { return { mode: "DRY_RUN", campaignId: f.campaign.id, productId: f.campaign.id, content: { contentId: f.candidate.contentId, contentIdentity: f.candidate.contentIdentity, sha256: createHash("sha256").update(f.content).digest("hex") }, platform: { targetId: f.target.id }, ...extra }; }

test("valid dry-run handoff persists idempotently and never dispatches", async () => {
  const f = await fixture(); const before = await f.service.snapshot(); const first = await f.service.attachDistributionHandoff(f.campaign.id, input(f)); const second = await f.service.attachDistributionHandoff(f.campaign.id, input(f));
  assert.equal(first.result.liveDispatch, false); assert.equal(first.result.publicationAttempts, 0); assert.equal(first.result.canonicalStateTouched, true); assert.equal(first.handoff.handoffHash, second.handoff.handoffHash);
  const after = await f.service.snapshot();
  assert.equal(after.posts.length, before.posts.length);
  assert.equal(after.executionRequests.length, before.executionRequests.length);
  assert.equal(after.campaignAuthorizations.length, before.campaignAuthorizations.length);
  const restarted = new SeedingService(new JsonStore(f.stateFile)); await restarted.init();
  const dash = await restarted.dashboard(); assert.equal(dash.distributionHandoffs.length, 1);
  assert.equal(dash.distributionHandoffs[0].handoffHash, first.handoff.handoffHash);
});
test("LIVE and cross-reference or integrity failures fail closed", async () => {
  const f = await fixture(); await assert.rejects(f.service.attachDistributionHandoff(f.campaign.id, input(f, { mode: "LIVE" })), /only explicit DRY_RUN/);
  await assert.rejects(f.service.attachDistributionHandoff(f.campaign.id, input(f, { productId: "other" })), /productId mismatch/);
  await assert.rejects(f.service.attachDistributionHandoff(f.campaign.id, input(f, { content: { ...input(f).content, sha256: "0".repeat(64) } })), /content sha256 mismatch/);
});
test("execution internals are rejected recursively", async () => {
  const f = await fixture(); await assert.rejects(f.service.attachDistributionHandoff(f.campaign.id, input(f, { metadata: { browserProfile: "x" } })), /forbidden/);
});
test("equivalent handoff key order has stable identity", async () => {
  const f = await fixture(); const a = input(f); const b = { platform: a.platform, content: a.content, productId: a.productId, campaignId: a.campaignId, mode: a.mode };
  assert.equal(validateDistributionHandoff(a, { state: await f.service.snapshot(), campaignId: f.campaign.id }).handoff.handoffHash, validateDistributionHandoff(b, { state: await f.service.snapshot(), campaignId: f.campaign.id }).handoff.handoffHash);
});
