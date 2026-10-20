import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { JsonStore } from "../src/store.mjs";
import { SeedingService } from "../src/service.mjs";
import { contentSha256 } from "../src/execution-contracts.mjs";

async function fixture(t, { accountCount = 1, freshReadiness = true } = {}) {
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
  const service = new SeedingService(new JsonStore(path.join(root, "state.json")), { readinessTtlMs: 300_000 });
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
