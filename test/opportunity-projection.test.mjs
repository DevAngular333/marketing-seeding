import test from "node:test";
import assert from "node:assert/strict";
import { projectDiscoveryOpportunities } from "../src/opportunity-projection.mjs";

const base = (overrides = {}) => ({
  discoveryId: "d-1", status: "ELIGIBLE", channel: "example", classification: { label: "RELEVANT", matchedKeywords: ["automation"] }, score: { score: 80 }, provenance: { source: "fixture" }, ...overrides
});

test("projects deterministic bounded opportunities with explicit advisory controls", () => {
  const result = projectDiscoveryOpportunities([base(), base({ discoveryId: "d-2", score: { score: 90 } }), base({ discoveryId: "d-1", score: { score: 99 } })]);
  assert.deepEqual(result.map((item) => item.discoveryId), ["d-2", "d-1"]);
  assert.equal(result[0].recommendedAction, "research");
  assert.equal(result[0].campaignId, null);
  assert.equal(result[0].advisory, true);
  assert.equal(result[0].authoritySideEffects, false);
  assert.equal(result[0].externalSideEffects, false);
  assert.deepEqual(result, projectDiscoveryOpportunities([base(), base({ discoveryId: "d-2", score: { score: 90 } }), base({ discoveryId: "d-1", score: { score: 99 } })]));
});

test("keeps identical discovery IDs isolated across campaigns", () => {
  const result = projectDiscoveryOpportunities([
    base({ campaignId: "campaign-a" }),
    base({ campaignId: "campaign-b" })
  ]);
  assert.deepEqual(result.map((item) => [item.campaignId, item.discoveryId]), [
    ["campaign-a", "d-1"],
    ["campaign-b", "d-1"]
  ]);
});

test("fails closed for ineligible, blocked, unknown-fit, malformed and non-array inputs", () => {
  const rows = [
    base({ discoveryId: "blocked", classification: { label: "BLOCKED" } }),
    base({ discoveryId: "unknown-fit", fit: { eligible: false } }),
    base({ discoveryId: "unknown-fit-2", fit: { eligible: undefined } }),
    base({ discoveryId: "forged-fit", fit: { eligible: true, audience: { status: "UNKNOWN" }, channel: { status: "MATCHED" }, locale: { status: "MATCHED" } } }),
    base({ discoveryId: "bad id!" }),
    base({ discoveryId: "not-eligible", status: "UNKNOWN" })
  ];
  assert.deepEqual(projectDiscoveryOpportunities(rows), []);
  assert.deepEqual(projectDiscoveryOpportunities(null), []);
});

test("bounds output and clamps untrusted scores", () => {
  const rows = Array.from({ length: 30 }, (_, index) => base({ discoveryId: `d-${index}`, score: { score: index === 0 ? 999 : index } }));
  const result = projectDiscoveryOpportunities(rows, { limit: 100 });
  assert.equal(result.length, 24);
  assert.equal(result[0].score, 100);
});

test("exposes bounded fit evidence for matched opportunities without granting authority", () => {
  const [result] = projectDiscoveryOpportunities([base({ fit: {
    eligible: true,
    audience: { status: "MATCHED", reason: "audience term matched normalized text", matchedTerms: ["automation", "ignored"] },
    channel: { status: "MATCHED", reason: "observed channel matched target" },
    locale: { status: "MATCHED", reason: "observed locale matched target" }
  } })]);
  assert.deepEqual(result.fit, {
    audience: { status: "MATCHED", reason: "audience term matched normalized text" },
    channel: { status: "MATCHED", reason: "observed channel matched target" },
    locale: { status: "MATCHED", reason: "observed locale matched target" },
    eligible: true
  });
  assert.equal(result.advisory, true);
  assert.equal(result.authoritySideEffects, false);
  assert.equal(result.externalSideEffects, false);
});
