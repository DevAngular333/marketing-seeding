import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { JsonStore } from "../src/store.mjs";
import { SeedingService } from "../src/service.mjs";
import { contentSha256 } from "../src/execution-contracts.mjs";

async function fixture(t, { accountCount = 1, freshReadiness = true, readinessProvider = false } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "campaign-bootstrap-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const productRepo = path.join(root, "design-os-studio");
  await mkdir(productRepo);
  await writeFile(path.join(productRepo, "README.md"), [
    "Design OS Studio is a local-first design application.",
    "It solves slow browser design workflows by keeping the design file local.",
    "Native deterministic rendering and verified evidence make it useful for design teams.",
    "Designers and Figma users need a local design workflow."
  ].join(" "), "utf8");
  const now = new Date();
  const service = new SeedingService(new JsonStore(path.join(root, "state.json")), {
    readinessTtlMs: 300_000,
    productRepoRoots: [root],
    ...(readinessProvider ? {
      readinessProviders: {
        linkedin: {
          async checkReadiness(context) {
            const checkedAt = new Date().toISOString();
            return {
              state: "READY",
              checkedAt,
              expiresAt: new Date(Date.now() + 240_000).toISOString(),
              capabilities: { sessionAuthenticated: true, identityVerified: true, feedReachable: true, composerAvailable: true },
              evidenceReference: `fixture-readiness:${context.targetId}`
            };
          }
        }
      }
    } : {})
  });
  await service.init();
  const profiles = [];
  for (let index = 0; index < accountCount; index += 1) {
    const accountId = `linkedin-bootstrap-${index}`;
    const profileId = `11111111-2222-4333-8444-55555555555${index}`;
    profiles.push({ accountId, profileId });
    await service.registerExecutionAccount({
      platform: "linkedin", accountId, profileId, health: "healthy",
      identityReference: `https://www.linkedin.com/in/bootstrap-${index}`
    }, "operator");
    const readiness = freshReadiness ? {
      state: "ready", checkedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 240_000).toISOString(),
      checks: { sessionValid: true, composerCapable: true, platformAvailable: true }
    } : {
      state: "ready", checkedAt: new Date(now.getTime() - 600_000).toISOString(),
      expiresAt: new Date(now.getTime() - 300_000).toISOString(),
      checks: { sessionValid: true, composerCapable: true, platformAvailable: true }
    };
    await service.createTarget({
      channel: "linkedin", name: `Bootstrap feed ${index}`,
      url: "https://www.linkedin.com/feed/", accountId, profileId,
      status: "active", readiness
    }, "operator");
  }
  return { service, productRepo, now, profiles };
}

function brief(productRepo, now, extra = {}) {
  return {
    productRepo,
    name: "Design OS Studio launch",
    objective: "Introduce Design OS Studio to an authorized design audience",
    audience: ["UI/UX designers", "Figma users", "design engineers"],
    authorizationReference: "design-os-studio-bootstrap-test",
    callToAction: "Explore the local workflow and inspect the repository evidence.",
    now,
    ...extra
  };
}

test("zero-touch bootstrap derives exact authority and is idempotent", async (t) => {
  const { service, productRepo, now } = await fixture(t);
  const first = await service.bootstrapAutonomousCampaign(brief(productRepo, now));
  assert.equal(first.status, "READY_FOR_AUTONOMOUS_EXECUTION");
  assert.equal(first.readinessFresh, true);
  assert.equal(first.audienceSerialization, JSON.stringify(["design engineers", "figma users", "ui/ux designers"]));
  assert.equal(first.content.media.length, 0);
  assert.equal(first.content.payloadSha256, contentSha256((await service.snapshot()).posts[0].content));
  assert.ok(first.executionId);
  assert.ok(first.oneTimeWindowId);
  assert.ok(first.liveGrantId);

  const before = await service.snapshot();
  const second = await service.bootstrapAutonomousCampaign(brief(productRepo, new Date(now.getTime() + 120_000)));
  const after = await service.snapshot();
  assert.equal(second.status, "READY_FOR_AUTONOMOUS_EXECUTION");
  assert.equal(second.campaignId, first.campaignId);
  assert.equal(second.authorizationId, first.authorizationId);
  assert.equal(second.executionId, first.executionId);
  assert.equal(after.campaigns.length, before.campaigns.length);
  assert.equal(after.campaignAuthorizations.length, before.campaignAuthorizations.length);
  assert.equal(after.posts.length, before.posts.length);
  assert.equal(after.executionRequests.length, before.executionRequests.length);
  assert.equal(after.oneTimeExecutionWindows.length, before.oneTimeExecutionWindows.length);
  assert.equal(after.liveExecutionGrants.length, before.liveExecutionGrants.length);
  assert.equal(after.submissionUncertainties.length, before.submissionUncertainties.length);
});

test("zero-touch bootstrap resolves a product-only brief from a bounded repository root", async (t) => {
  const { service, productRepo, now } = await fixture(t);
  const result = await service.bootstrapAutonomousCampaign({
    product: "design-os-studio",
    name: "Design OS Studio launch",
    objective: "Introduce Design OS Studio to an authorized design audience",
    audience: ["UI/UX designers", "Figma users", "design engineers"],
    authorizationReference: "design-os-studio-product-only-test",
    now
  });
  assert.equal(result.status, "READY_FOR_AUTONOMOUS_EXECUTION");
  assert.equal((await service.snapshot()).campaigns[0].productRepo, await realpath(productRepo));
});

test("product-only bootstrap fails closed when the bounded repository match is ambiguous", async (t) => {
  const { now } = await fixture(t);
  // Use a separate root with two exact product directory matches and a fresh
  // runtime registry; no campaign or authority is written before resolution.
  const root = await mkdtemp(path.join(os.tmpdir(), "campaign-bootstrap-ambiguous-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const suffix of ["one", "two"]) {
    const repo = path.join(root, suffix, "design-os-studio");
    await mkdir(repo, { recursive: true });
    await writeFile(path.join(repo, "README.md"), "Design OS Studio evidence.", "utf8");
  }
  const ambiguous = new SeedingService(new JsonStore(path.join(root, "state.json")), { productRepoRoots: [path.join(root, "one"), path.join(root, "two")] });
  await ambiguous.init();
  const result = await ambiguous.bootstrapAutonomousCampaign({ productId: "design-os-studio", audience: ["designers"], authorizationReference: "ambiguous-test", now });
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.code, "PRODUCT_REPOSITORY_AMBIGUOUS");
  assert.equal((await ambiguous.snapshot()).campaigns.length, 0);
});

test("zero-touch bootstrap fails closed when account or target authority is missing or ambiguous", async (t) => {
  const missing = await fixture(t, { accountCount: 0 });
  const missingResult = await missing.service.bootstrapAutonomousCampaign(brief(missing.productRepo, missing.now));
  assert.equal(missingResult.status, "BLOCKED");
  assert.equal(missingResult.code, "AUTHORIZED_LINKEDIN_TARGET_MISSING");
  assert.equal(missingResult.blockers[0].classification, "EXTERNAL_HARD_BLOCKER");
  assert.equal((await missing.service.snapshot()).campaigns.length, 0);

  const ambiguous = await fixture(t, { accountCount: 2 });
  const ambiguousResult = await ambiguous.service.bootstrapAutonomousCampaign(brief(ambiguous.productRepo, ambiguous.now));
  assert.equal(ambiguousResult.status, "BLOCKED");
  assert.equal(ambiguousResult.code, "AUTHORIZED_LINKEDIN_TARGET_AMBIGUOUS");
  assert.equal(ambiguousResult.blockers[0].classification, "ACCOUNT_BLOCKER");
  assert.equal((await ambiguous.service.snapshot()).campaigns.length, 0);
});

test("stale readiness never produces live execution controls", async (t) => {
  const { service, productRepo, now } = await fixture(t, { freshReadiness: false });
  const result = await service.bootstrapAutonomousCampaign(brief(productRepo, now));
  assert.equal(result.status, "BLOCKED");
  const state = await service.snapshot();
  assert.equal(state.executionRequests.length, 0);
  assert.equal(state.oneTimeExecutionWindows.length, 0);
  assert.equal(state.liveExecutionGrants.length, 0);
  assert.equal(state.submissionUncertainties.length, 0);
});

test("expired bootstrap schedule renews exact authority without mutating historical execution", async (t) => {
  const { service, productRepo, now } = await fixture(t);
  const first = await service.bootstrapAutonomousCampaign(brief(productRepo, now));
  assert.equal(first.status, "READY_FOR_AUTONOMOUS_EXECUTION");
  const before = await service.snapshot();
  const oldAuthorization = before.campaignAuthorizations.find((item) => item.id === first.authorizationId);
  const oldRequest = before.executionRequests.find((item) => item.executionId === first.executionId);
  await service.store.mutate("test", "test_expire_bootstrap_schedule", (state) => {
    const campaign = state.campaigns.find((item) => item.id === first.campaignId);
    campaign.autonomousBootstrap.schedule.validUntil = new Date(now.getTime() - 60_000).toISOString();
  });
  const renewed = await service.bootstrapAutonomousCampaign(brief(productRepo, now, { validityHours: 1 }));
  assert.equal(renewed.status, "READY_FOR_AUTONOMOUS_EXECUTION");
  assert.notEqual(renewed.authorizationId, first.authorizationId);
  assert.notEqual(renewed.executionId, first.executionId);
  const after = await service.snapshot();
  const historicalAuthorization = after.campaignAuthorizations.find((item) => item.id === first.authorizationId);
  assert.equal(historicalAuthorization.id, oldAuthorization.id);
  assert.equal(historicalAuthorization.validFrom, oldAuthorization.validFrom);
  assert.equal(historicalAuthorization.validUntil, oldAuthorization.validUntil);
  const historicalRequest = after.executionRequests.find((item) => item.executionId === first.executionId);
  assert.equal(historicalRequest.executionId, oldRequest.executionId);
  assert.equal(historicalRequest.request.authorization.authorizationId, oldRequest.request.authorization.authorizationId);
  assert.equal(after.campaignAuthorizations.filter((item) => item.campaignId === first.campaignId).length, 2);
  const campaign = after.campaigns.find((item) => item.id === first.campaignId);
  assert.equal(campaign.autonomousBootstrap.schedule.identity, renewed.schedule.identity);
  assert.ok(Date.parse(campaign.autonomousBootstrap.schedule.validUntil) > now.getTime());
  assert.equal(after.executionRequests.filter((item) => item.jobId === renewed.postId && item.request?.dryRun !== true).length, 2);
});

test("bootstrap never reuses a cancelled request or its terminal controls", async (t) => {
  const { service, productRepo, now } = await fixture(t);
  const first = await service.bootstrapAutonomousCampaign(brief(productRepo, now));
  assert.equal(first.status, "READY_FOR_AUTONOMOUS_EXECUTION");
  const before = await service.snapshot();
  const oldRequest = structuredClone(before.executionRequests.find((item) => item.executionId === first.executionId));
  const oldWindow = structuredClone(before.oneTimeExecutionWindows.find((item) => item.windowId === first.oneTimeWindowId));
  const oldGrant = structuredClone(before.liveExecutionGrants.find((item) => item.grantId === first.liveGrantId));

  const cancelled = await service.cancelExecutionRequest(first.executionId, {
    reason: "bootstrap regression fixture cancellation",
    operatorAuthorizationReference: "bootstrap-regression-fixture"
  }, "operator");
  assert.equal(cancelled.state, "CANCELLED_PRE_SUBMIT");
  await service.store.mutate("test", "expire_cancelled_bootstrap_controls", (state) => {
    const window = state.oneTimeExecutionWindows.find((item) => item.windowId === first.oneTimeWindowId);
    if (window) {
      window.status = "EXPIRED";
      window.expiredAt = new Date().toISOString();
    }
    const grant = state.liveExecutionGrants.find((item) => item.grantId === first.liveGrantId);
    if (grant) {
      grant.status = "EXPIRED";
      grant.expiredAt = new Date().toISOString();
    }
  });

  const renewed = await service.bootstrapAutonomousCampaign(brief(productRepo, now));
  assert.equal(renewed.status, "READY_FOR_AUTONOMOUS_EXECUTION");
  assert.notEqual(renewed.executionId, first.executionId);
  assert.notEqual(renewed.oneTimeWindowId, first.oneTimeWindowId);
  assert.notEqual(renewed.liveGrantId, first.liveGrantId);
  assert.equal(renewed.readinessFresh, true);

  const after = await service.snapshot();
  const historicalRequest = after.executionRequests.find((item) => item.executionId === first.executionId);
  const historicalWindow = after.oneTimeExecutionWindows.find((item) => item.windowId === first.oneTimeWindowId);
  const historicalGrant = after.liveExecutionGrants.find((item) => item.grantId === first.liveGrantId);
  assert.deepEqual(historicalRequest, { ...oldRequest, state: "CANCELLED_PRE_SUBMIT", executionPhase: "CANCELLED_PRE_SUBMIT", cancelledAt: historicalRequest.cancelledAt, cancelledBy: "operator", cancellationReason: "bootstrap regression fixture cancellation", operatorAuthorizationReference: "bootstrap-regression-fixture" });
  assert.equal(historicalWindow.status, "EXPIRED");
  assert.equal(historicalGrant.status, "EXPIRED");
  assert.equal(historicalWindow.binding, oldWindow.binding);
  assert.equal(historicalGrant.grantId, oldGrant.grantId);
  assert.equal(after.executionRequests.filter((item) => item.jobId === renewed.postId && item.request?.dryRun !== true).length, 2);
});

test("bootstrap renews a stale REQUEST_READY control package without mutating its historical request", async (t) => {
  const { service, productRepo, now } = await fixture(t, { readinessProvider: true });
  const first = await service.bootstrapAutonomousCampaign(brief(productRepo, now));
  assert.equal(first.status, "READY_FOR_AUTONOMOUS_EXECUTION");
  const before = await service.snapshot();
  const oldRequest = structuredClone(before.executionRequests.find((item) => item.executionId === first.executionId));
  await service.store.mutate("test", "expire_stale_bootstrap_controls", (state) => {
    const request = state.executionRequests.find((item) => item.executionId === first.executionId);
    // Expire only the persisted control package's copy; the historical row is
    // expected to remain immutable even when its controls are stale.
    const window = state.oneTimeExecutionWindows.find((item) => item.windowId === first.oneTimeWindowId);
    window.status = "EXPIRED";
    window.expiredAt = new Date(now.getTime() - 500).toISOString();
    const grant = state.liveExecutionGrants.find((item) => item.grantId === first.liveGrantId);
    grant.status = "EXPIRED";
    grant.expiredAt = new Date(now.getTime() - 500).toISOString();
  });

  const renewed = await service.bootstrapAutonomousCampaign(brief(productRepo, now));
  assert.equal(renewed.status, "READY_FOR_AUTONOMOUS_EXECUTION");
  assert.notEqual(renewed.executionId, first.executionId);
  assert.notEqual(renewed.oneTimeWindowId, first.oneTimeWindowId);
  assert.notEqual(renewed.liveGrantId, first.liveGrantId);
  const after = await service.snapshot();
  const historical = after.executionRequests.find((item) => item.executionId === first.executionId);
  assert.equal(historical.executionId, oldRequest.executionId);
  assert.equal(historical.createdAt, oldRequest.createdAt);
  assert.equal(historical.request.oneTimeWindow.windowId, oldRequest.request.oneTimeWindow.windowId);
  assert.equal(historical.request.liveGrant.grantId, oldRequest.request.liveGrant.grantId);
  assert.equal(historical.request.readiness.expiresAt, oldRequest.request.readiness.expiresAt);
  assert.equal(after.executionRequests.filter((item) => item.jobId === renewed.postId && item.request?.dryRun !== true).length, 2);
});
