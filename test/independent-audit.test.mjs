import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { JsonStore } from "../src/store.mjs";
import { SeedingService } from "../src/service.mjs";
import { campaignContentHash } from "../src/campaign-authorization.mjs";

async function fixture(prefix = "independent-audit-") {
  const directory = await mkdtemp(path.join(os.tmpdir(), prefix));
  const productRepo = path.join(directory, "product");
  await mkdir(productRepo);
  await writeFile(path.join(productRepo, "README.md"), "Isolated audit fixture\n", "utf8");
  const service = new SeedingService(new JsonStore(path.join(directory, "state.json")));
  await service.init();
  const campaign = await service.createCampaign({ name: "Audit fixture", objective: "Audit bounded execution", productRepo }, "operator");
  await service.updateCampaign(campaign.id, { status: "active" }, "operator");
  await service.registerExecutionAccount({ platform: "threads", accountId: "audit-account", profileId: "audit-profile" }, "operator");
  const target = await service.createTarget({
    channel: "threads", name: "Audit target", url: "https://www.threads.net/@audit",
    accountId: "audit-account", profileId: "audit-profile", status: "active",
    readiness: { state: "ready", checkedAt: new Date().toISOString(), checks: { sessionValid: true, composerCapable: true, platformAvailable: true } }
  }, "operator");
  const content = "Bounded audit copy.";
  const authorization = await service.authorizeCampaign(campaign.id, {
    id: "audit-standing-auth", validFrom: new Date(Date.now() - 60_000).toISOString(), validUntil: new Date(Date.now() + 3_600_000).toISOString(),
    destinations: [{ platform: "threads", accountId: target.accountId, profileId: target.profileId, targetId: target.id }],
    approvedAssets: [], contentBoundary: { mode: "approved_copy_set", contentHashes: [campaignContentHash(content)] },
    audienceRules: { allowedAudiences: ["public"] }, publicationVisibilityRules: { allowedVisibilities: ["PUBLIC"] },
    schedule: { timezone: "UTC", weekdays: [new Date().getUTCDay()], startLocal: "00:00", endLocal: "23:59" },
    rateLimits: { maxJobsPerAccountPerDay: 5, maxJobsPerCampaignPerDay: 5, maxConcurrency: 1, minIntervalMinutes: 0 },
    allowLiveExecution: true, executionMode: "standing_autonomous", standingAuthorizationReference: "audit-standing-reference"
  }, "operator");
  const post = await service.createPost({ campaignId: campaign.id, targetId: target.id, content, audience: "public" }, "producer");
  return { service, campaign, target, post, authorization };
}

test("inactive standing authorization prevents live-ready dispatch", async () => {
  const { service, post } = await fixture();
  await service.store.mutate("audit", "pause_standing_authorization", (state) => {
    const auth = state.campaignAuthorizations.find((item) => item.id === post.campaignAuthorizationId);
    auth.status = "paused";
  });
  assert.deepEqual(await service.readyExecutionRequests(), []);
});
test("UNKNOWN quarantine remains immutable and dashboard does not expose it as published", async () => {
  const { service, post } = await fixture("independent-unknown-");
  await service.store.mutate("audit", "seed_unknown_quarantine", (state) => {
    const row = state.executionRequests.find((item) => item.jobId === post.id);
    row.state = "SUBMIT_RESULT_UNKNOWN";
    row.submitState = "UNKNOWN";
    row.reasonCode = "transport_ambiguous";
    const current = state.posts.find((item) => item.id === post.id);
    current.status = "submit_result_unknown";
    current.submissionUncertaintyId = "audit-uncertainty";
    state.submissionUncertainties.push({ id: "audit-uncertainty", status: "UNKNOWN", jobId: post.id, idempotencyKeys: [current.idempotencyKey], reasonCode: "transport_ambiguous" });
  });
  const before = await service.snapshot();
  assert.deepEqual(await service.readyExecutionRequests(), []);
  const dashboard = await service.dashboard();
  assert.equal(dashboard.posts.find((item) => item.id === post.id).status, "submit_result_unknown");
  assert.equal(dashboard.statuses.published || 0, 0);
  const after = await service.snapshot();
  assert.deepEqual(after.posts.find((item) => item.id === post.id), before.posts.find((item) => item.id === post.id));
  assert.deepEqual(after.submissionUncertainties.find((item) => item.id === "audit-uncertainty"), before.submissionUncertainties.find((item) => item.id === "audit-uncertainty"));
});
