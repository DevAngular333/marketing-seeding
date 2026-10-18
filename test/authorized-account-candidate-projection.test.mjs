import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { JsonStore } from "../src/store.mjs";
import { SeedingService, projectAuthorizedAccountCandidates, projectAuthorizedAccountPoolSummary } from "../src/service.mjs";
import { campaignAuthorizationFingerprint, campaignScopeFingerprint } from "../src/campaign-authorization.mjs";
import { readinessBinding } from "../src/readiness.mjs";

const now = new Date("2026-10-19T12:00:00.000Z");
const profileId = "11111111-2222-4333-8444-555555555555";

function fixture() {
  const campaign = {
    id: "campaign-candidate-projection",
    productRepo: "/tmp/product-candidate-projection",
    objective: "bounded candidate projection",
    audience: ["public"],
    landingUrl: null,
    status: "active"
  };
  const target = {
    id: "target-candidate-projection",
    channel: "linkedin",
    accountId: "candidate-account",
    profileId,
    url: "https://www.linkedin.com/company/candidate-projection",
    status: "active",
    readiness: {
      state: "ready",
      checkedAt: "2026-10-19T11:58:00.000Z",
      expiresAt: "2026-10-19T12:03:00.000Z",
      reasonCode: "provider_ready",
      recoveryClassification: "NONE",
      binding: readinessBinding({ platform: "linkedin", accountId: "candidate-account", profileId, targetId: "target-candidate-projection" }),
      platform: "linkedin",
      accountId: "candidate-account",
      profileId,
      targetId: "target-candidate-projection",
      evidence: "must-not-project"
    }
  };
  const account = {
    id: "linkedin:candidate-account",
    platform: "linkedin",
    accountId: "candidate-account",
    profileId,
    status: "enabled",
    health: "healthy",
    secretToken: "must-not-project"
  };
  const authorization = {
    id: "authorization-candidate-projection",
    campaignId: campaign.id,
    status: "active",
    executionMode: "standing_autonomous",
    standingAuthorizationReference: "standing-candidate-projection",
    allowLiveExecution: true,
    validFrom: "2026-10-19T11:00:00.000Z",
    validUntil: "2026-10-19T13:00:00.000Z",
    destinations: [{ platform: "linkedin", accountId: account.accountId, profileId, targetId: target.id, targetUrl: target.url }],
    approvedAssets: [],
    contentBoundary: { mode: "approved_copy_set", contentHashes: ["a".repeat(64)], allowRepeatSameContent: false },
    audienceRules: { allowedAudiences: ["public"] },
    publicationVisibilityRules: { allowedVisibilities: ["PUBLIC"] },
    schedule: { timezone: "UTC", weekdays: [0, 1, 2, 3, 4, 5, 6], startLocal: "00:00", endLocal: "23:59" },
    rateLimits: { maxJobsPerAccountPerDay: 1, maxJobsPerCampaignPerDay: 1, maxConcurrency: 1, minIntervalMinutes: 0 },
    campaignBinding: campaignScopeFingerprint(campaign)
  };
  authorization.binding = campaignAuthorizationFingerprint(authorization);
  return { campaigns: [campaign], targets: [target], executionAccounts: [account], campaignAuthorizations: [authorization], executionRequests: [], oneTimeExecutionWindows: [], liveExecutionGrants: [], executionLeases: [], posts: [], submissionUncertainties: [] };
}

test("projects one exact eligible standing destination with a stable safe key", () => {
  const state = fixture();
  const before = structuredClone(state);
  const first = projectAuthorizedAccountCandidates(state, { now });
  const second = projectAuthorizedAccountCandidates(state, { now });
  assert.deepEqual(first, second);
  assert.equal(first.length, 1);
  assert.equal(first[0].eligibleForAutonomousExecution, true);
  assert.equal(first[0].selectionOrder, 1);
  assert.equal(first[0].platform, "linkedin");
  assert.equal(first[0].accountId, "candidate-account");
  assert.equal(first[0].targetId, "target-candidate-projection");
  assert.equal(first[0].sessionMode, "SESSION_REUSE");
  assert.equal(first[0].authMode, "MANUAL_AUTH");
  assert.match(first[0].profileFingerprint, /^[a-f0-9]{64}$/);
  assert.equal("profileId" in first[0], false);
  assert.equal("secretToken" in first[0], false);
  assert.equal("evidence" in (first[0].readiness || {}), false);
  assert.deepEqual(state, before);
});

test("rejects stale, mismatched and non-standing destinations with deterministic reasons", () => {
  const state = fixture();
  const authorization = state.campaignAuthorizations[0];
  authorization.executionMode = "manual_exact";
  authorization.allowLiveExecution = false;
  authorization.status = "paused";
  authorization.binding = campaignAuthorizationFingerprint(authorization);
  state.targets[0].readiness.expiresAt = "2026-10-19T11:59:59.000Z";
  const result = projectAuthorizedAccountCandidates(state, { now });
  assert.equal(result.length, 1);
  assert.equal(result[0].eligibleForAutonomousExecution, false);
  assert.deepEqual(result[0].ineligibilityReasons, [
    "authorization:paused",
    "authorization:execution_mode_not_standing_autonomous",
    "authorization:live_execution_disabled",
    "readiness:expired"
  ]);
});

test("dashboard exposes candidates as a read-only projection and does not create execution artifacts", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "authorized-account-candidate-dashboard-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = new JsonStore(path.join(directory, "state.json"));
  const service = new SeedingService(store);
  await service.init();
  const state = fixture();
  await store.mutate("fixture", "candidate_projection_fixture", (next) => Object.assign(next, state));
  const before = await service.snapshot();
  const first = await service.dashboard();
  const restarted = new SeedingService(new JsonStore(path.join(directory, "state.json")));
  await restarted.init();
  const second = await restarted.dashboard();
  assert.deepEqual(first.authorizedAccountCandidates, second.authorizedAccountCandidates);
  assert.equal(first.authorizedAccountCandidates.length, 1);
  assert.deepEqual(await service.snapshot(), before);
  assert.deepEqual(await restarted.snapshot(), before);
  assert.equal(before.executionRequests.length, 0);
  assert.equal(before.oneTimeExecutionWindows.length, 0);
  assert.equal(before.liveExecutionGrants.length, 0);
  assert.equal(before.executionLeases.length, 0);
});

test("summarizes exact destination pool availability without selecting or mutating candidates", () => {
  const state = fixture();
  const candidates = projectAuthorizedAccountCandidates(state, { now });
  const blocked = structuredClone(candidates[0]);
  blocked.candidateKey = "blocked-candidate";
  blocked.eligibleForAutonomousExecution = false;
  blocked.ineligibilityReasons = ["account:health_rate_limited", "readiness:stale"];
  const summaries = projectAuthorizedAccountPoolSummary([blocked, candidates[0]]);
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].candidateCount, 2);
  assert.equal(summaries[0].eligibleCount, 1);
  assert.equal(summaries[0].autonomousPath, "AVAILABLE_ADVISORY");
  assert.deepEqual(summaries[0].eligibleCandidateKeys, [candidates[0].candidateKey]);
  assert.deepEqual(summaries[0].blockedReasonCounts, { "account:health_rate_limited": 1, "readiness:stale": 1 });
  assert.equal("profileId" in summaries[0], false);
});

test("dashboard exposes deterministic pool summary while preserving state", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "authorized-account-pool-summary-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = new JsonStore(path.join(directory, "state.json"));
  const service = new SeedingService(store);
  await service.init();
  await store.mutate("fixture", "candidate_pool_summary_fixture", (next) => Object.assign(next, fixture()));
  const before = await service.snapshot();
  const dashboard = await service.dashboard();
  assert.equal(dashboard.authorizedAccountPoolSummary.length, 1);
  assert.ok(["AVAILABLE_ADVISORY", "BLOCKED"].includes(dashboard.authorizedAccountPoolSummary[0].autonomousPath));
  assert.deepEqual(await service.snapshot(), before);
});
