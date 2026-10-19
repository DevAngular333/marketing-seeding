import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { JsonStore } from "../src/store.mjs";
import { SeedingService, projectAuthorizedAccountCandidates, projectAuthorizedAccountPool, projectAuthorizedAccountPoolSummary, projectCampaignAuthorityRuntime } from "../src/service.mjs";
import { campaignAuthorizationFingerprint, campaignScopeFingerprint, normalizeCampaignAuthorization } from "../src/campaign-authorization.mjs";
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

test("account pool projection selects only a unique eligible candidate and fails closed on ambiguity", () => {
  const state = fixture();
  const unique = projectAuthorizedAccountPool(state, { now });
  assert.equal(unique.length, 1);
  assert.equal(unique[0].selectionStatus, "UNIQUE_ELIGIBLE");
  assert.deepEqual(unique[0].selectionPolicy, { status: "UNSPECIFIED", reason: "no_explicit_account_preference_policy" });
  assert.equal(unique[0].eligibleCandidateCount, 1);
  assert.ok(unique[0].selectedCandidateKey);
  assert.equal(unique[0].eligibleAccounts.length, 1);
  assert.equal(unique[0].eligibleAccounts[0].accountId, "candidate-account");
  assert.match(unique[0].eligibleAccounts[0].profileFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(unique[0].eligibleAccounts[0].sessionMode, "SESSION_REUSE");
  assert.equal(unique[0].eligibleAccounts[0].authMode, "MANUAL_AUTH");

  state.campaignAuthorizations[0].destinations.push(structuredClone(state.campaignAuthorizations[0].destinations[0]));
  state.campaignAuthorizations[0].binding = campaignAuthorizationFingerprint(state.campaignAuthorizations[0]);
  const duplicate = projectAuthorizedAccountPool(state, { now });
  assert.equal(duplicate[0].selectionStatus, "UNIQUE_ELIGIBLE");
  assert.equal(duplicate[0].candidateCount, 1);

  const secondAuthorization = structuredClone(state.campaignAuthorizations[0]);
  secondAuthorization.id = "authorization-candidate-projection-2";
  secondAuthorization.binding = campaignAuthorizationFingerprint(secondAuthorization);
  state.campaignAuthorizations.push(secondAuthorization);
  const ambiguous = projectAuthorizedAccountPool(state, { now });
  assert.equal(ambiguous[0].selectionStatus, "AMBIGUOUS_AUTHORIZATION");
  assert.equal(ambiguous[0].selectionPolicy.status, "AMBIGUOUS_AUTHORIZATION");
  assert.equal(ambiguous[0].selectedCandidateKey, null);
  assert.equal(ambiguous[0].selectionReason, "multiple_active_authorizations");
});

test("ordered authorization policy deterministically selects the first eligible exact destination", () => {
  const state = fixture();
  const destination = state.campaignAuthorizations[0].destinations[0];
  state.campaignAuthorizations[0].accountSelectionPolicy = { mode: "ordered", order: [{ ...destination, profileId }] };
  state.campaignAuthorizations[0].binding = campaignAuthorizationFingerprint(state.campaignAuthorizations[0]);
  const result = projectAuthorizedAccountPool(state, { now });
  assert.equal(result[0].selectionPolicy.status, "ORDERED");
  assert.equal(result[0].selectionStatus, "POLICY_SELECTED");
  assert.ok(result[0].selectedCandidateKey);
});

test("normalization requires an exact policy profile binding", () => {
  const state = fixture();
  const authorizationInput = {
    ...state.campaignAuthorizations[0],
    id: "authorization-policy-profile-check",
    accountSelectionPolicy: { mode: "ordered", order: [{ ...state.campaignAuthorizations[0].destinations[0], profileId: "different-profile" }] }
  };
  assert.throws(() => normalizeCampaignAuthorization(authorizationInput, state.campaigns[0], now), /exact authorized account\/profile/);
  const missingProfile = { ...state.campaignAuthorizations[0].destinations[0] };
  delete missingProfile.profileId;
  assert.throws(() => normalizeCampaignAuthorization({ ...authorizationInput, accountSelectionPolicy: { mode: "ordered", order: [missingProfile] } }, state.campaigns[0], now), /selection profileId/);
});

test("dashboard exposes deterministic pool summary while preserving state", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "authorized-account-pool-summary-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = new JsonStore(path.join(directory, "state.json"));
  const service = new SeedingService(store);
  await service.init();
  await store.mutate("fixture", "candidate_pool_summary_fixture", (next) => {
    const value = fixture();
    const current = Date.now();
    const authorization = value.campaignAuthorizations[0];
    authorization.validFrom = new Date(current - 60_000).toISOString();
    authorization.validUntil = new Date(current + 3_600_000).toISOString();
    authorization.binding = campaignAuthorizationFingerprint(authorization);
    // Keep the persisted freshness interval within the configured five-minute
    // TTL. A 60s-old check plus a 300s expiry would span six minutes and is
    // correctly rejected by the production freshness guard.
    value.targets[0].readiness.checkedAt = new Date(current - 1_000).toISOString();
    value.targets[0].readiness.expiresAt = new Date(current + 299_000).toISOString();
    Object.assign(next, value);
  });
  const before = await service.snapshot();
  const dashboard = await service.dashboard();
  assert.equal(dashboard.authorizedAccountPoolSummary.length, 1);
  assert.equal(dashboard.campaignAuthorityRuntime.length, 1);
  assert.equal(dashboard.campaignAuthorityRuntime[0].status, "READY_FOR_BOUNDED_DELEGATION");
  assert.ok(["AVAILABLE_ADVISORY", "BLOCKED"].includes(dashboard.authorizedAccountPoolSummary[0].autonomousPath));
  assert.deepEqual(await service.snapshot(), before);
});

test("campaign authority runtime is a read-only bounded projection", () => {
  const state = fixture();
  const projection = projectCampaignAuthorityRuntime(state, { now });
  assert.equal(projection.length, 1);
  assert.equal(projection[0].status, "READY_FOR_BOUNDED_DELEGATION");
  assert.deepEqual(projection[0].reasons, []);
  assert.equal(projection[0].standingAuthorizationCount, 1);
  assert.equal(projection[0].eligibleAccountCandidateCount, 1);
  assert.equal(projection[0].authoritySideEffects, false);
  assert.equal(projection[0].externalSideEffects, false);
});
