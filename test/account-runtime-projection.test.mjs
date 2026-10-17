import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { JsonStore } from "../src/store.mjs";
import { SeedingService } from "../src/service.mjs";

const profileId = "11111111-2222-4333-8444-555555555555";

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "account-runtime-projection-"));
  const store = new JsonStore(path.join(directory, "state.json"));
  const service = new SeedingService(store);
  await service.init();
  await store.mutate("fixture", "account_projection_fixture", (state) => {
    state.executionAccounts.push({
      id: "linkedin:fixture-account", platform: "linkedin", accountId: "fixture-account", profileId,
      identityReference: "https://www.linkedin.com/in/private-owner", expectedIdentityUrl: "https://www.linkedin.com/in/private-owner",
      status: "enabled", health: "healthy", lastReadinessAt: "2026-10-17T00:00:00.000Z",
      secretToken: "must-not-project"
    });
    state.targets.push(
      { id: "target-1", channel: "linkedin", accountId: "fixture-account", profileId,
        readiness: { state: "ready", checkedAt: "2026-10-17T00:01:00.000Z", expiresAt: "2026-10-17T00:06:00.000Z", reasonCode: "eligible", recoveryClassification: "NONE", evidence: "private evidence", identityReference: "https://private.example" } },
      { id: "target-2", channel: "linkedin", accountId: "fixture-account", profileId,
        readiness: { state: "blocked", checkedAt: "2026-10-17T00:02:00.000Z", expiresAt: "2026-10-17T00:07:00.000Z", reasonCode: "session_expired", recoveryClassification: "RECOVERABLE", evidence: "secret evidence" } },
      { id: "target-other", channel: "linkedin", accountId: "other", profileId, readiness: { state: "blocked", reasonCode: "other" } }
    );
  });
  return { directory, service };
}

test("dashboard account projection is allowlisted, fingerprinted, and counts bound targets", async () => {
  const { service } = await fixture();
  const dashboard = await service.dashboard();
  assert.deepEqual(dashboard.executionAccounts, dashboard.accountRuntime);
  assert.equal(dashboard.accountRuntime.length, 1);
  const account = dashboard.accountRuntime[0];
  assert.equal(account.profileFingerprint, createHash("sha256").update(profileId).digest("hex"));
  assert.equal(account.boundTargetCount, 2);
  assert.equal(account.readiness.state, "BLOCKED");
  assert.equal(account.readiness.reasonCode, "session_expired");
  assert.equal(account.currentBlocker, "readiness:session_expired");
  assert.equal("profileId" in account, false);
  assert.equal("identityReference" in account, false);
  assert.equal("expectedIdentityUrl" in account, false);
  assert.equal("evidence" in account.readiness, false);
  assert.equal("secretToken" in account, false);
});

test("dashboard account projection survives restart without state mutation", async () => {
  const { directory, service } = await fixture();
  const before = await service.snapshot();
  const first = await service.dashboard();
  const restarted = new SeedingService(new JsonStore(path.join(directory, "state.json")));
  await restarted.init();
  const second = await restarted.dashboard();
  assert.deepEqual(second.accountRuntime, first.accountRuntime);
  assert.deepEqual(second.executionAccounts, first.executionAccounts);
  assert.deepEqual(await restarted.snapshot(), before);
});
