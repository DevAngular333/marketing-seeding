import test from "node:test";
import assert from "node:assert/strict";
import {
  PLATFORM_CAPABILITIES,
  PlatformAdapterRegistry,
  ReadinessProviderRegistry,
  normalizePublicationVerification
} from "../src/platform-registries.mjs";
import { PlatformPolicyRegistry, defaultPlatformPolicies } from "../src/platform-policies.mjs";

const caps = Object.fromEntries(PLATFORM_CAPABILITIES.map((item) => [item, false]));

test("platform adapter registry resolves a versioned adapter by platform and leaves unregistered platforms unsupported", () => {
  const adapter = { contractVersion: 1, capabilities: caps, async execute() {}, async reconcile() {} };
  const registry = new PlatformAdapterRegistry({ test_social: adapter });
  assert.equal(registry.resolve("TEST_SOCIAL"), adapter);
  assert.equal(registry.resolve("threads"), null);
  assert.deepEqual(registry.platforms(), ["test_social"]);
});

test("platform adapter registry rejects incomplete capabilities and duplicate platform registration", () => {
  const registry = new PlatformAdapterRegistry();
  assert.throws(() => registry.register("test_social", { contractVersion: 1, async execute() {}, async reconcile() {} }), /capabilities/);
  const adapter = { contractVersion: 1, capabilities: caps, async execute() {}, async reconcile() {} };
  registry.register("test_social", adapter);
  assert.throws(() => registry.register("test_social", adapter), /already registered/);
});

test("readiness registry dispatches by platform and reports an unregistered provider explicitly", async () => {
  const seen = [];
  const registry = new ReadinessProviderRegistry({ test_social: { async checkReadiness(context) { seen.push(context); return { state: "READY" }; } } });
  const context = { accountId: "a", profileId: "p" };
  assert.deepEqual(await registry.checkReadiness("test_social", context), { state: "READY" });
  assert.equal(seen[0], context);
  assert.deepEqual(await registry.checkReadiness("threads", context), {
    state: "BLOCKED", reasonCode: "readiness_provider_not_registered", retryable: false, recoveryClassification: "NONE"
  });
});

test("publication verification contract accepts generic outcomes and evidence fields", () => {
  assert.deepEqual(normalizePublicationVerification({ state: "unknown", publicationReference: "ref-1" }), {
    state: "UNKNOWN", publicationReference: "ref-1", publicationUrl: null, verificationEvidence: null, verifiedAt: null, reasonCode: null
  });
  assert.throws(() => normalizePublicationVerification({ state: "RETRY" }), /CONFIRMED, UNKNOWN, or FAILED/);
});

test("platform URL and account identity rules live in platform policy data", () => {
  const policies = new PlatformPolicyRegistry({
    test_social: { allowedTargetHosts: ["social.example"], requiresIdentityUrl: true, normalizeIdentityUrl: (value) => new URL(value).toString() }
  });
  assert.equal(policies.allowsTargetUrl("test_social", "https://social.example/feed"), true);
  assert.equal(policies.allowsTargetUrl("test_social", "https://linkedin.com/feed"), false);
  assert.equal(policies.normalizeIdentityUrl("test_social", "https://social.example/u/owner"), "https://social.example/u/owner");
  assert.throws(() => policies.normalizeIdentityUrl("test_social", null), /required/);
  assert.equal(defaultPlatformPolicies.allowsTargetUrl("linkedin", "https://www.linkedin.com/feed/"), true);
  assert.equal(defaultPlatformPolicies.allowsTargetUrl("linkedin", "https://threads.net/"), false);
  assert.equal(defaultPlatformPolicies.resolve("linkedin").postPublishMediaHash, "NOT_AVAILABLE");
  assert.equal(defaultPlatformPolicies.resolve("threads").postPublishMediaHash, "REQUIRED");
});
